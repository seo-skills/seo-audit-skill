import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';
import { looksPaginated } from './site-page-utils.js';

/**
 * Rule: Pagination URL Has No Incoming Internal Links
 *
 * Reference hint: links/pagination-url-has-no-incoming-internal-links
 *
 * A paginated page (URL pattern like ?page=N or /page/N, or self-declared
 * rel="next"/"prev") that no internal <a> link points to is reachable only
 * through rel links, the sitemap, or not at all — crawlers and link equity
 * flow through ordinary anchor links.
 *
 * Needs the site-wide link graph, so it runs in crawl mode only. Note the
 * same caveat as links-orphan-pages: a page the crawler found by following
 * anchors necessarily has an inbound link, so this fires for paginated URLs
 * discovered some other way.
 */
export const paginationIsolatedRule = defineRule({
  id: 'crawl-pagination-isolated',
  name: 'Pagination URL Without Incoming Links',
  description: 'Checks that paginated URLs receive at least one incoming internal link',
  category: 'crawl',
  weight: 5,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'crawl-pagination-isolated',
        'Counting incoming links needs the site-wide crawl graph - run with --crawl to build it'
      );
    }

    const url = site.normalize(context.url);
    const { paginated, label } = looksPaginated(context);
    if (!paginated) {
      return pass('crawl-pagination-isolated', 'Page does not appear to be paginated', {
        isPaginated: false,
      });
    }

    // The crawl began here; nothing inside the crawl is expected to link
    // "down" to it.
    if (url === site.entryUrl) {
      return pass('crawl-pagination-isolated', 'Crawl entry point', {
        isPaginated: true,
        matchedPattern: label,
      });
    }

    const inboundCount = site.inboundLinksByUrl.get(url)?.size ?? 0;
    if (inboundCount === 0) {
      return fail(
        'crawl-pagination-isolated',
        `Paginated URL (${label}) has no incoming internal links`,
        {
          isPaginated: true,
          matchedPattern: label,
          inboundLinkCount: 0,
          impact:
            'Without anchor links, crawlers may never reach this page and it receives no internal link equity.',
          recommendation:
            'Link to the pagination series from ordinary anchors (e.g. a pager in the body), not only rel="next"/"prev" tags.',
        }
      );
    }

    return pass(
      'crawl-pagination-isolated',
      `Paginated URL has ${inboundCount} incoming internal link(s)`,
      { isPaginated: true, matchedPattern: label, inboundLinkCount: inboundCount }
    );
  },
});
