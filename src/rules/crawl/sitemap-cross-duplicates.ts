import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hint: xml-sitemaps/url-in-multiple-xml-sitemaps

/** How many offending URLs to list in details before truncating. */
const MAX_LISTED = 10;

interface CrossDuplicateEntry {
  url: string;
  sitemaps: string[];
}

/**
 * Rule: URLs in Multiple Sitemaps
 *
 * Detects page URLs declared by more than one sitemap document. Unlike
 * crawl-sitemap-duplicate-urls, which spots repeated `<loc>` entries within a
 * single sitemap, this compares membership across sibling documents — a
 * common byproduct of overlapping sitemap generators (posts sitemap plus
 * pages sitemap plus a handcrafted one).
 *
 * Informational rather than harmful: crawlers dedupe on their side, but
 * overlapping declarations are a maintenance smell that usually means the
 * sitemap ownership is unclear.
 */
export const sitemapCrossDuplicatesRule = defineRule({
  id: 'crawl-sitemap-cross-duplicates',
  name: 'URLs in Multiple Sitemaps',
  description:
    'Flags page URLs declared by more than one sitemap document',
  category: 'crawl',
  weight: 2,
  run: (context: AuditContext) => {
    const site = context.site;
    const pages = site?.pages;
    const sitemapUrls = context.sitemapUrls;

    if (!site || !pages) {
      return notMeasured(
        'crawl-sitemap-cross-duplicates',
        'Per-page crawl data needs a multi-page crawl - run with --crawl to build it'
      );
    }

    if (!sitemapUrls || sitemapUrls.length === 0) {
      return notMeasured(
        'crawl-sitemap-cross-duplicates',
        'No sitemap URLs available to check for cross-sitemap duplication'
      );
    }

    const urlSources = context.sitemapUrlSources;
    if (!urlSources) {
      return notMeasured(
        'crawl-sitemap-cross-duplicates',
        'Which sitemap documents declared each URL was not recorded, so cross-sitemap duplication cannot be checked'
      );
    }

    const duplicates: CrossDuplicateEntry[] = [];
    for (const [url, sources] of urlSources) {
      if (sources.length > 1) {
        duplicates.push({ url, sitemaps: sources });
      }
    }

    const details = {
      sitemapUrlCount: sitemapUrls.length,
      trackedUrlCount: urlSources.size,
      duplicateCount: duplicates.length,
      duplicateUrls: duplicates.slice(0, MAX_LISTED),
    };

    if (duplicates.length > 0) {
      return warn(
        'crawl-sitemap-cross-duplicates',
        `${duplicates.length} URL(s) are declared in more than one sitemap document`,
        {
          ...details,
          impact:
            'Overlapping sitemap declarations are harmless to crawlers but usually signal unclear sitemap ownership.',
          recommendation:
            'Assign each URL to a single sitemap so coverage reporting stays meaningful.',
        }
      );
    }

    return pass(
      'crawl-sitemap-cross-duplicates',
      `No URL is declared by more than one sitemap document (${urlSources.size} URLs tracked)`,
      details
    );
  },
});
