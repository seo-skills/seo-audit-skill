import type { AuditContext, SiteContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { describeSitemapGaps } from '../../crawler/sitemap.js';

interface OrphanAnalysis {
  reachedCount: number;
  sitemapCount: number;
  orphanUrls: string[];
}

/**
 * One analysis per crawl, whichever page asks: the answer is site-wide.
 * Keyed by the site and its sitemap list, and dropped with them.
 */
const analyses = new WeakMap<SiteContext, { sitemapUrls: string[]; analysis: OrphanAnalysis }>();

/**
 * Sitemap URLs that no crawled page links to, and that the crawl never
 * fetched. Computed over the whole crawl, so every page reports the same
 * answer: it used to grow page by page, and the first page of a crawl saw
 * almost every sitemap URL as an orphan.
 */
function analyse(site: SiteContext, sitemapUrls: string[]): OrphanAnalysis {
  const cached = analyses.get(site);
  if (cached && cached.sitemapUrls === sitemapUrls) return cached.analysis;

  const reached = new Set<string>([site.entryUrl, ...site.inboundLinksByUrl.keys()]);
  for (const key of site.pages?.keys() ?? []) reached.add(key);

  const listed = new Set<string>();
  for (const url of sitemapUrls) {
    try {
      listed.add(site.normalize(url));
    } catch {
      // A malformed sitemap URL is sitemap-valid's finding, not an orphan
    }
  }
  const orphanUrls = [...listed].filter((url) => !reached.has(url));
  const analysis = { reachedCount: reached.size, sitemapCount: listed.size, orphanUrls };
  analyses.set(site, { sitemapUrls, analysis });
  return analysis;
}

/**
 * Rule: Sitemap Orphan URLs
 *
 * Detects sitemap URLs that are not linked from any crawled page.
 * Orphan URLs in a sitemap may indicate pages that lack internal linking,
 * which reduces their discoverability and crawl priority.
 */
export const sitemapOrphanUrlsRule = defineRule({
  id: 'crawl-sitemap-orphan-urls',
  name: 'Sitemap Orphan URLs',
  description: 'Checks if sitemap contains URLs not linked from any crawled page',
  category: 'crawl',
  weight: 7,
  run: async (context: AuditContext) => {
    // Without a crawl there are no crawled pages' links to compare against
    if (!context.site) {
      return notMeasured('crawl-sitemap-orphan-urls', 'Orphan detection needs the links of crawled pages - run with --crawl to build them');
    }

    const sitemapUrls = context.sitemapUrls ?? [];
    if (sitemapUrls.length === 0) {
      return pass('crawl-sitemap-orphan-urls', 'No sitemap URLs available for orphan detection', {
        sitemapUrlCount: 0,
      });
    }

    const { reachedCount, sitemapCount, orphanUrls } = analyse(context.site, sitemapUrls);
    // A partial sitemap can still show real orphans; it cannot show there are none
    const partial = context.sitemapComplete === false ? describeSitemapGaps(context.sitemapGaps ?? []) : '';
    const details = {
      crawledUrlCount: reachedCount,
      sitemapUrlCount: sitemapCount,
      orphanCount: orphanUrls.length,
      orphanUrls: orphanUrls.slice(0, 10),
      ...(partial && { sitemapIncomplete: partial }),
    };

    if (orphanUrls.length > 0) {
      const orphanPercent = ((orphanUrls.length / sitemapCount) * 100).toFixed(1);
      return warn(
        'crawl-sitemap-orphan-urls',
        `${orphanUrls.length} sitemap URL(s) (${orphanPercent}%) are not linked from any crawled page` +
          (partial ? `; the sitemap was read in part (${partial}), so there may be more` : ''),
        {
          ...details,
          impact: 'Orphan pages lack internal links, reducing discoverability and crawl priority',
          recommendation: 'Add internal links to orphan pages or remove them from the sitemap if obsolete',
        }
      );
    }

    if (partial) {
      return notMeasured(
        'crawl-sitemap-orphan-urls',
        `The sitemap could not be read in full (${partial}), so it cannot be said that no sitemap URL is an orphan`,
        details,
        'could-not-verify'
      );
    }

    return pass('crawl-sitemap-orphan-urls', `All ${sitemapCount} sitemap URLs are linked from crawled pages`, details);
  },
});
