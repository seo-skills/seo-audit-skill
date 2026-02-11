import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Module-level registry for tracking crawled URLs across pages.
 * Populated during multi-page crawls to enable cross-page analysis.
 */
const crawledUrls = new Set<string>();

/**
 * Module-level registry for sitemap URLs to check against crawled URLs.
 */
const sitemapCheckUrls = new Set<string>();

/**
 * Normalize URL for comparison
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
 * Reset the orphan URL registries (useful for testing and between audits)
 */
export function resetOrphanRegistry(): void {
  crawledUrls.clear();
  sitemapCheckUrls.clear();
}

/**
 * Get statistics from the orphan URL registries
 */
export function getOrphanStats(): {
  crawledUrlCount: number;
  sitemapUrlCount: number;
  orphanUrls: string[];
} {
  const orphanUrls: string[] = [];
  for (const url of sitemapCheckUrls) {
    if (!crawledUrls.has(url)) {
      orphanUrls.push(url);
    }
  }
  return {
    crawledUrlCount: crawledUrls.size,
    sitemapUrlCount: sitemapCheckUrls.size,
    orphanUrls,
  };
}

/**
 * Rule: Sitemap Orphan URLs
 *
 * Detects sitemap URLs that are not linked from any crawled page.
 * Orphan URLs in a sitemap may indicate pages that lack internal linking,
 * which reduces their discoverability and crawl priority.
 *
 * This rule uses module-level registries to accumulate data across
 * multiple page runs during a crawl. For single-page audits it collects
 * data but cannot determine orphan status.
 */
export const sitemapOrphanUrlsRule = defineRule({
  id: 'crawl-sitemap-orphan-urls',
  name: 'Sitemap Orphan URLs',
  description: 'Checks if sitemap contains URLs not linked from any crawled page',
  category: 'crawl',
  weight: 7,
  run: async (context: AuditContext) => {
    const { links, url } = context;
    const sitemapUrls = (context as any).sitemapUrls as string[] | undefined;

    // Register the current page URL as crawled
    crawledUrls.add(normalizeUrl(url));

    // Register all internal link destinations as crawled URLs
    for (const link of links) {
      if (link.isInternal && link.href) {
        try {
          const absoluteHref = new URL(link.href, url).href;
          crawledUrls.add(normalizeUrl(absoluteHref));
        } catch {
          // Skip malformed URLs
        }
      }
    }

    // Register sitemap URLs if available
    if (sitemapUrls && sitemapUrls.length > 0) {
      for (const sitemapUrl of sitemapUrls) {
        sitemapCheckUrls.add(normalizeUrl(sitemapUrl));
      }
    }

    // Check for orphan URLs (sitemap URLs not found in crawled URLs)
    const orphanUrls: string[] = [];
    for (const sitemapUrl of sitemapCheckUrls) {
      if (!crawledUrls.has(sitemapUrl)) {
        orphanUrls.push(sitemapUrl);
      }
    }

    const details = {
      crawledUrlCount: crawledUrls.size,
      sitemapUrlCount: sitemapCheckUrls.size,
      orphanCount: orphanUrls.length,
      orphanUrls: orphanUrls.slice(0, 10),
    };

    // If we have no sitemap URLs to compare, just collect data
    if (sitemapCheckUrls.size === 0) {
      return pass(
        'crawl-sitemap-orphan-urls',
        'No sitemap URLs available for orphan detection',
        { ...details, note: 'Data is being collected for cross-page analysis' }
      );
    }

    if (orphanUrls.length > 0) {
      const orphanPercent = ((orphanUrls.length / sitemapCheckUrls.size) * 100).toFixed(1);
      return warn(
        'crawl-sitemap-orphan-urls',
        `${orphanUrls.length} sitemap URL(s) (${orphanPercent}%) are not linked from any crawled page`,
        {
          ...details,
          impact: 'Orphan pages lack internal links, reducing discoverability and crawl priority',
          recommendation: 'Add internal links to orphan pages or remove them from the sitemap if obsolete',
        }
      );
    }

    return pass(
      'crawl-sitemap-orphan-urls',
      `All ${sitemapCheckUrls.size} sitemap URLs are linked from crawled pages`,
      details
    );
  },
});
