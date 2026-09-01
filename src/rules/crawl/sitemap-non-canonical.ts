import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';

// Reference hint: xml-sitemaps/canonicalized-url-in-xml-sitemaps

/** How many offending URLs to list in details before truncating. */
const MAX_LISTED = 10;

interface CanonicalisedEntry {
  url: string;
  canonical: string;
}

/**
 * Rule: Canonicalised URLs in Sitemap
 *
 * A sitemap entry tells crawlers "index this URL"; a canonical pointing
 * elsewhere tells them "index that URL instead". Listing a URL that
 * canonicalises away sends both signals at once, and the canonical wins — the
 * sitemap entry is ignored.
 *
 * Pages the crawl never reached, and pages whose canonical could not be
 * resolved (`null`), carry no reading and are skipped. Both sides are compared
 * through the crawler's own URL normalisation, so a self-referential canonical
 * with cosmetic differences still passes.
 */
export const sitemapNonCanonicalRule = defineRule({
  id: 'crawl-sitemap-non-canonical',
  name: 'Canonicalised URLs in Sitemap',
  description:
    'Flags sitemap URLs whose canonical link element resolves to a different URL',
  category: 'crawl',
  weight: 7,
  run: (context: AuditContext) => {
    const site = context.site;
    const pages = site?.pages;
    const sitemapUrls = context.sitemapUrls;

    if (!site || !pages) {
      return notMeasured(
        'crawl-sitemap-non-canonical',
        'Per-page crawl data needs a multi-page crawl - run with --crawl to build it'
      );
    }

    if (!sitemapUrls || sitemapUrls.length === 0) {
      return notMeasured(
        'crawl-sitemap-non-canonical',
        'No sitemap URLs available to cross-reference against canonicals'
      );
    }

    const canonicalised: CanonicalisedEntry[] = [];
    let checked = 0;
    let notCrawled = 0;

    for (const url of sitemapUrls) {
      const key = site.normalize(url);
      const info = pages.get(key);
      if (!info) {
        notCrawled++;
        continue;
      }
      checked++;

      // undefined: no canonical declared. null: declared but unresolvable.
      // Neither proves the URL canonicalises elsewhere.
      if (typeof info.canonical !== 'string') {
        continue;
      }

      if (site.normalize(info.canonical) !== key) {
        canonicalised.push({ url, canonical: info.canonical });
      }
    }

    const details = {
      sitemapUrlCount: sitemapUrls.length,
      checkedCount: checked,
      notCrawledCount: notCrawled,
      canonicalisedCount: canonicalised.length,
      canonicalisedUrls: canonicalised.slice(0, MAX_LISTED),
    };

    if (canonicalised.length > 0) {
      return fail(
        'crawl-sitemap-non-canonical',
        `${canonicalised.length} sitemap URL(s) canonicalise to a different URL`,
        {
          ...details,
          impact:
            'The sitemap asks crawlers to index URLs the pages themselves disown, so the entries are ignored and the intended targets may be missing from the sitemap.',
          recommendation:
            'List the canonical targets in the sitemap instead of URLs that canonicalise away.',
        }
      );
    }

    return pass(
      'crawl-sitemap-non-canonical',
      `No sitemap URLs canonicalise to a different URL (${checked} checked)`,
      details
    );
  },
});
