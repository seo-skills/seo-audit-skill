import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

/**
 * Maximum number of URLs allowed per sitemap file (Google specification)
 */
const MAX_URLS = 50_000;

/**
 * Warning threshold for approaching the URL limit
 */
const WARN_THRESHOLD = 40_000;

/**
 * Count <url> tags in sitemap XML content using string matching
 */
function countSitemapUrls(content: string): number {
  let count = 0;
  let index = 0;
  const lowerContent = content.toLowerCase();
  const needle = '<url>';
  const needleAlt = '<url ';

  while (index < lowerContent.length) {
    const pos1 = lowerContent.indexOf(needle, index);
    const pos2 = lowerContent.indexOf(needleAlt, index);

    let foundAt = -1;
    if (pos1 === -1 && pos2 === -1) break;
    if (pos1 === -1) foundAt = pos2;
    else if (pos2 === -1) foundAt = pos1;
    else foundAt = Math.min(pos1, pos2);

    count++;
    index = foundAt + 1;
  }

  return count;
}

/**
 * Rule: Sitemap URL Limit
 *
 * Validates that a sitemap file does not exceed the 50,000 URL limit
 * defined in the Sitemaps protocol specification. Sitemaps exceeding
 * this limit will be rejected by search engines.
 */
export const sitemapUrlLimitRule = defineRule({
  id: 'crawl-sitemap-url-limit',
  name: 'Sitemap URL Limit',
  description: 'Checks if sitemap exceeds the 50,000 URL limit per file',
  category: 'crawl',
  weight: 6,
  run: async (context: AuditContext) => {
    const { sitemapContent, sitemapDocuments } = context;

    if (!sitemapContent && !sitemapDocuments?.length) {
      return pass(
        'crawl-sitemap-url-limit',
        'No sitemap content available to check',
        { sitemapAvailable: false }
      );
    }

    // The limit is per file, and an index lists sitemaps rather than URLs:
    // judging developer.mozilla.org's index reported "0 URLs" for 67,000.
    const files = sitemapDocuments
      ? sitemapDocuments.filter((doc) => !doc.isIndex)
      : [{ url: 'sitemap', urlCount: countSitemapUrls(sitemapContent ?? ''), isIndex: false }];
    const skippedSitemaps = context.sitemapSkippedCount ?? 0;

    if (files.length === 0) {
      return notMeasured(
        'crawl-sitemap-url-limit',
        'The sitemap is an index, and none of the sitemaps it lists could be fetched',
        { sitemapsChecked: 0, skippedSitemaps }
      );
    }

    const largest = files.reduce((max, doc) => (doc.urlCount > max.urlCount ? doc : max));
    const urlCount = largest.urlCount;
    const fromIndex = sitemapDocuments?.some((doc) => doc.isIndex) ?? false;
    const subject = fromIndex || files.length > 1 ? `Sitemap ${largest.url}` : 'Sitemap';

    const details = {
      urlCount,
      largestUrlCount: urlCount,
      largestSitemap: largest.url,
      sitemapsChecked: files.length,
      skippedSitemaps,
      maxAllowed: MAX_URLS,
      warnThreshold: WARN_THRESHOLD,
    };

    if (urlCount > MAX_URLS) {
      return fail(
        'crawl-sitemap-url-limit',
        `${subject} contains ${urlCount.toLocaleString()} URLs, exceeding the ${MAX_URLS.toLocaleString()} limit`,
        {
          ...details,
          impact: 'Search engines will reject sitemaps exceeding 50,000 URLs',
          recommendation: 'Split the sitemap into multiple files using a sitemap index',
        }
      );
    }

    if (urlCount > WARN_THRESHOLD) {
      return warn(
        'crawl-sitemap-url-limit',
        `${subject} contains ${urlCount.toLocaleString()} URLs, approaching the ${MAX_URLS.toLocaleString()} limit`,
        {
          ...details,
          recommendation: 'Consider splitting into multiple sitemaps before reaching the limit',
        }
      );
    }

    return pass(
      'crawl-sitemap-url-limit',
      files.length > 1
        ? `Largest of ${files.length} sitemaps lists ${urlCount.toLocaleString()} URLs (within ${MAX_URLS.toLocaleString()} limit)${skippedSitemaps > 0 ? `; ${skippedSitemaps} listed sitemap(s) not fetched` : ''}`
        : `${subject} contains ${urlCount.toLocaleString()} URLs (within ${MAX_URLS.toLocaleString()} limit)`,
      details
    );
  },
});
