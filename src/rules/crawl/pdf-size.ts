import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { registerResettable } from '../registry.js';
import { getUserAgent } from '../../crawler/user-agent.js';
import { netFetch } from '../../net/fetch.js';

/** A linked PDF above this size is expensive to crawl and to download. */
const WARN_BYTES = 10 * 1024 * 1024;
const SAMPLE_LIMIT = 8;

const lengths = new Map<string, Promise<number | null>>();

export function resetPdfSizes(): void {
  lengths.clear();
}

registerResettable(resetPdfSizes);

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

function contentLength(url: string, signal?: AbortSignal): Promise<number | null> {
  const cached = lengths.get(url);
  if (cached) return cached;
  const pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const response = await netFetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: requestSignal,
        headers: { 'User-Agent': getUserAgent() },
      });
      const raw = response.headers.get('content-length');
      if (!raw) return null;
      const size = Number(raw);
      return Number.isFinite(size) ? size : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  lengths.set(url, pending);
  return pending;
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

    const oversized: Array<{ url: string; bytes: number }> = [];
    for (const url of urls) {
      const bytes = await contentLength(url, context.signal);
      if (bytes !== null && bytes > WARN_BYTES) oversized.push({ url, bytes });
    }

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
