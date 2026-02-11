import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Normalize URL for duplicate comparison
 * Lowercases host, removes trailing slash, preserves query string
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${urlObj.protocol}//${urlObj.host.toLowerCase()}${path}${urlObj.search}`;
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Rule: Sitemap Duplicate URLs
 *
 * Detects duplicate URLs within the sitemap. Duplicate entries waste
 * crawl budget and can confuse search engine crawlers about crawl
 * priority signals.
 */
export const sitemapDuplicateUrlsRule = defineRule({
  id: 'crawl-sitemap-duplicate-urls',
  name: 'Sitemap Duplicate URLs',
  description: 'Checks for duplicate URLs in sitemap',
  category: 'crawl',
  weight: 6,
  run: async (context: AuditContext) => {
    const sitemapUrls = (context as any).sitemapUrls as string[] | undefined;

    if (!sitemapUrls || sitemapUrls.length === 0) {
      return pass(
        'crawl-sitemap-duplicate-urls',
        'No sitemap URLs available to check',
        { sitemapAvailable: false }
      );
    }

    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const url of sitemapUrls) {
      const normalized = normalizeUrl(url);
      if (seen.has(normalized)) {
        if (!duplicates.includes(normalized)) {
          duplicates.push(normalized);
        }
      } else {
        seen.add(normalized);
      }
    }

    const details = {
      totalUrls: sitemapUrls.length,
      uniqueUrls: seen.size,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 5),
    };

    if (duplicates.length > 0) {
      return warn(
        'crawl-sitemap-duplicate-urls',
        `Sitemap contains ${duplicates.length} duplicate URL(s)`,
        {
          ...details,
          impact: 'Duplicate URLs waste crawl budget and may confuse crawl priority',
          recommendation: 'Remove duplicate entries from the sitemap',
        }
      );
    }

    return pass(
      'crawl-sitemap-duplicate-urls',
      `All ${sitemapUrls.length} sitemap URLs are unique`,
      details
    );
  },
});
