import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

// Reference hint: xml-sitemaps/error-5xx-url-in-xml-sitemaps
// Reference hint: xml-sitemaps/not-found-4xx-url-in-xml-sitemaps
// Reference hint: xml-sitemaps/forbidden-403-url-in-xml-sitemaps
// Reference hint: xml-sitemaps/redirect-3xx-url-in-xml-sitemaps
// Reference hint: xml-sitemaps/timed-out-url-in-xml-sitemaps

/** How many offending URLs to list in details before truncating. */
const MAX_LISTED = 10;

interface BucketEntry {
  url: string;
  statusCode: number;
}

/**
 * Rule: Non-200 URLs in Sitemap
 *
 * Cross-references every sitemap URL against the per-page fetch state recorded
 * during the crawl. A sitemap is a promise that each listed URL is worth
 * indexing; URLs that error, redirect, or time out break that promise and
 * waste crawl budget on dead ends.
 *
 * 4xx and 5xx fail outright. Redirects (3xx) and timeouts (statusCode 0) warn:
 * the target may still be fine, but the sitemap should name the final URL and
 * the timeout may be transient.
 *
 * Sitemap URLs the crawl never reached carry no reading here — that gap is
 * what crawl-sitemap-orphan-urls measures.
 */
export const sitemapNon200Rule = defineRule({
  id: 'crawl-sitemap-non-200',
  name: 'Non-200 URLs in Sitemap',
  description:
    'Cross-references sitemap URLs against crawled status codes; fails on 4xx/5xx, warns on 3xx and timed-out URLs',
  category: 'crawl',
  weight: 10,
  run: (context: AuditContext) => {
    const site = context.site;
    const pages = site?.pages;
    const sitemapUrls = context.sitemapUrls;

    if (!site || !pages) {
      return notMeasured(
        'crawl-sitemap-non-200',
        'Per-page crawl data needs a multi-page crawl - run with --crawl to build it'
      );
    }

    if (!sitemapUrls || sitemapUrls.length === 0) {
      return notMeasured(
        'crawl-sitemap-non-200',
        'No sitemap URLs available to cross-reference against crawled status codes'
      );
    }

    const serverErrors: BucketEntry[] = [];
    const clientErrors: BucketEntry[] = [];
    const redirects: BucketEntry[] = [];
    const timedOut: string[] = [];
    let checked = 0;
    let notCrawled = 0;

    for (const url of sitemapUrls) {
      const info = pages.get(site.normalize(url));
      if (!info) {
        notCrawled++;
        continue;
      }
      checked++;

      const status = info.statusCode;
      if (status === 0) {
        timedOut.push(url);
      } else if (status >= 500) {
        serverErrors.push({ url, statusCode: status });
      } else if (status >= 400) {
        clientErrors.push({ url, statusCode: status });
      } else if (status >= 300) {
        redirects.push({ url, statusCode: status });
      }
    }

    const details = {
      sitemapUrlCount: sitemapUrls.length,
      checkedCount: checked,
      notCrawledCount: notCrawled,
      serverErrorCount: serverErrors.length,
      clientErrorCount: clientErrors.length,
      forbiddenCount: clientErrors.filter((e) => e.statusCode === 403).length,
      redirectCount: redirects.length,
      timedOutCount: timedOut.length,
      serverErrors: serverErrors.slice(0, MAX_LISTED),
      clientErrors: clientErrors.slice(0, MAX_LISTED),
      redirects: redirects.slice(0, MAX_LISTED),
      timedOutUrls: timedOut.slice(0, MAX_LISTED),
    };

    if (serverErrors.length > 0 || clientErrors.length > 0) {
      const total = serverErrors.length + clientErrors.length;
      return fail(
        'crawl-sitemap-non-200',
        `${total} sitemap URL(s) return an error status (${serverErrors.length} 5xx, ${clientErrors.length} 4xx)`,
        {
          ...details,
          impact:
            'Erroring URLs in the sitemap waste crawl budget and signal poor site quality to search engines.',
          recommendation:
            'Remove erroring URLs from the sitemap or fix the underlying responses.',
        }
      );
    }

    if (redirects.length > 0 || timedOut.length > 0) {
      return warn(
        'crawl-sitemap-non-200',
        `${redirects.length} sitemap URL(s) redirect (3xx) and ${timedOut.length} timed out during the crawl`,
        {
          ...details,
          impact:
            'Sitemaps should list final destination URLs; redirects and timeouts waste crawl budget.',
          recommendation:
            'Replace redirected URLs with their final targets and investigate timed-out pages.',
        }
      );
    }

    return pass(
      'crawl-sitemap-non-200',
      `All ${checked} crawled sitemap URLs return a success status`,
      details
    );
  },
});
