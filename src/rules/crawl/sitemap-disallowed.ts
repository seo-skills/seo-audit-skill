import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';

// Reference hint: xml-sitemaps/disallowed-url-in-xml-sitemaps

/** How many offending URLs to list in details before truncating. */
const MAX_LISTED = 10;

/**
 * Rule: Disallowed URLs in Sitemap
 *
 * robots.txt Disallow tells crawlers to stay away; a sitemap entry tells them
 * to come index the URL. Listing a disallowed URL sends both signals at once,
 * and since a disallowed page cannot be crawled, search engines may index it
 * blind — URL only, no content signals.
 *
 * The crawler's `disallowed` flag is best-effort: it is false whenever
 * robots.txt was not fetched or could not be matched. So when nothing anywhere
 * in the crawl was disallowed and no robots.txt content was captured, a clean
 * bill of health would be vacuous — the rule reports unmeasured instead.
 */
export const sitemapDisallowedRule = defineRule({
  id: 'crawl-sitemap-disallowed',
  name: 'Disallowed URLs in Sitemap',
  description:
    'Flags sitemap URLs that robots.txt disallows, a direct contradiction of crawl signals',
  category: 'crawl',
  weight: 7,
  run: (context: AuditContext) => {
    const site = context.site;
    const pages = site?.pages;
    const sitemapUrls = context.sitemapUrls;

    if (!site || !pages) {
      return notMeasured(
        'crawl-sitemap-disallowed',
        'Per-page crawl data needs a multi-page crawl - run with --crawl to build it'
      );
    }

    if (!sitemapUrls || sitemapUrls.length === 0) {
      return notMeasured(
        'crawl-sitemap-disallowed',
        'No sitemap URLs available to cross-reference against robots.txt'
      );
    }

    const disallowedUrls: string[] = [];
    let checked = 0;
    let notCrawled = 0;

    for (const url of sitemapUrls) {
      const info = pages.get(site.normalize(url));
      if (!info) {
        notCrawled++;
        continue;
      }
      checked++;
      if (info.disallowed) {
        disallowedUrls.push(url);
      }
    }

    const details = {
      sitemapUrlCount: sitemapUrls.length,
      checkedCount: checked,
      notCrawledCount: notCrawled,
      disallowedCount: disallowedUrls.length,
      disallowedUrls: disallowedUrls.slice(0, MAX_LISTED),
    };

    if (disallowedUrls.length > 0) {
      return fail(
        'crawl-sitemap-disallowed',
        `${disallowedUrls.length} sitemap URL(s) are disallowed by robots.txt`,
        {
          ...details,
          impact:
            'Disallowed pages cannot be crawled, so search engines may index them blind or drop them; either way the sitemap entry contradicts robots.txt.',
          recommendation:
            'Remove the URLs from the sitemap or allow them in robots.txt - whichever reflects intent.',
        }
      );
    }

    // `disallowed` is false whenever the robots answer is unknown, so "nothing
    // disallowed" only means something if robots.txt was actually evaluated.
    const anyDisallowed = [...pages.values()].some((p) => p.disallowed);
    if (!anyDisallowed && !context.robotsTxtContent) {
      return notMeasured(
        'crawl-sitemap-disallowed',
        'robots.txt was not fetched, so disallow status of sitemap URLs is unknown',
        details
      );
    }

    return pass(
      'crawl-sitemap-disallowed',
      `No sitemap URLs are disallowed by robots.txt (${checked} checked)`,
      details
    );
  },
});
