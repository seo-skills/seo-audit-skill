import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

/**
 * Rule: Inbound Internal Links
 *
 * Measures how many pages link to this one. Inbound internal links carry
 * ranking signal and are how crawlers reach a page, so a page hanging off a
 * single link is one edit away from being unreachable.
 *
 * A note on true orphans: a crawl can only reach a page by following a link to
 * it, so every page it finds necessarily has at least one inbound link. A page
 * with genuinely zero inbound links is never discovered and so cannot appear
 * here. Detecting those requires a URL inventory from outside the link graph,
 * which is what `crawl-sitemap-orphan-urls` does by diffing the sitemap against
 * what the crawl reached. The zero case below is kept for correctness if the
 * graph is ever seeded from such an inventory.
 *
 * Requires the site-wide link graph, so it runs in crawl mode only.
 */
export const orphanPagesRule = defineRule({
  id: 'links-orphan-pages',
  name: 'Inbound Internal Links',
  description:
    'Measures how many internal pages link to this one; true zero-inbound orphans are covered by crawl-sitemap-orphan-urls',
  category: 'links',
  weight: 6,
  run: (context: AuditContext) => {
    const site = context.site;

    if (!site) {
      return notMeasured(
        'links-orphan-pages',
        'Inbound link counting needs the site-wide link graph - run with --crawl to build it'
      );
    }

    const url = site.normalize(context.url);
    const inbound = site.inboundLinksByUrl.get(url);
    const inboundCount = inbound?.size ?? 0;
    const outboundCount = site.outboundLinksByUrl.get(url)?.size ?? 0;

    const details = {
      inboundLinkCount: inboundCount,
      outboundInternalLinkCount: outboundCount,
      pagesCrawled: site.pageCount,
      linkedFrom: inbound ? Array.from(inbound).slice(0, 5) : [],
    };

    // The entry URL is where the crawl began; nothing inside the crawl is
    // expected to link "down" to it, so its inbound count says nothing.
    if (url === site.entryUrl) {
      return pass(
        'links-orphan-pages',
        'Crawl entry point - pages inside the crawl are not expected to link back to where it started',
        details
      );
    }

    // A crawl of one page has no graph to speak of.
    if (site.pageCount < 2) {
      return notMeasured(
        'links-orphan-pages',
        'Only one page was crawled, which is too few to measure inbound linking',
        details
      );
    }

    if (inboundCount === 0) {
      return fail(
        'links-orphan-pages',
        `No internal links point to this page across ${site.pageCount} crawled pages`,
        {
          ...details,
          impact:
            'Crawlers find pages by following links. An orphan is discoverable only via the sitemap or an external link, receives no internal link equity, and is easily missed during site changes.',
        }
      );
    }

    if (inboundCount === 1) {
      return warn(
        'links-orphan-pages',
        'Only one internal link points to this page, so it is one edit away from being orphaned',
        details
      );
    }

    return pass(
      'links-orphan-pages',
      `${inboundCount} internal link(s) point to this page`,
      details
    );
  },
});
