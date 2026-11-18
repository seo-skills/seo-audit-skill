import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { urlServiceFor } from '../../net/url-service.js';

/** A linked PDF above this size is expensive to crawl and to download. */
const WARN_BYTES = 10 * 1024 * 1024;
const SAMPLE_LIMIT = 8;

function pdfUrl(href: string, pageUrl: string): string | null {
  try {
    const url = new URL(href, pageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.pathname.toLowerCase().endsWith('.pdf')) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * A PDF's advertised size; null when not advertised. Read from the run's
 * status check of the URL, which links-broken-internal asks too, so the PDF
 * is asked about once.
 */
async function contentLength(context: AuditContext, url: string): Promise<number | null> {
  const info = await urlServiceFor(context).status(url);
  return info.status === 0 ? null : info.contentLength;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Rule: Linked PDF size
 *
 * Checks the Content-Length of PDF links on the page. A missing length is
 * skipped rather than failed. Pages with no PDF links pass.
 */
export const pdfSizeRule = defineRule({
  id: 'crawl-pdf-size',
  name: 'Linked PDF Size',
  description: 'Checks that linked PDF files are at most 10 MB',
  category: 'crawl',
  weight: 3,
  run: async (context: AuditContext) => {
    const urls: string[] = [];
    context.$('a[href]').each((_, el) => {
      if (urls.length >= SAMPLE_LIMIT) return;
      const href = pdfUrl(context.$(el).attr('href') || '', context.url);
      if (href && !urls.includes(href)) urls.push(href);
    });

    if (urls.length === 0) {
      return pass('crawl-pdf-size', 'No PDF links on the page', { pdfs: [] });
    }

    const sizes = await Promise.all(urls.map((url) => contentLength(context, url)));
    const oversized: Array<{ url: string; bytes: number }> = [];
    urls.forEach((url, i) => {
      const bytes = sizes[i];
      if (bytes !== null && bytes > WARN_BYTES) oversized.push({ url, bytes });
    });

    if (oversized.length === 0) {
      return pass('crawl-pdf-size', 'Linked PDFs are within 10 MB, or their size was not advertised', {
        checked: urls.length,
      });
    }

    const summary = oversized.map((item) => `${item.url} (${formatMb(item.bytes)})`).join('; ');
    return warn('crawl-pdf-size', `Linked PDF over 10 MB: ${summary}`, {
      oversized,
      recommendation: 'Compress the PDF or split it. Files over 10 MB are slow to download and to crawl.',
    });
  },
});
