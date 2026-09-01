import type { AuditContext, DiscoverySource } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';

/**
 * Rule: Isolated URL
 *
 * Reference hints:
 * - indexability/isolated-url-only-found-via-a-canonical
 * - indexability/isolated-url-only-found-via-a-redirect
 * - indexability/isolated-url-only-found-via-a-noindex-follow
 * - indexability/isolated-url-only-linked-from-other-isolated-urls
 *
 * A URL is isolated when nothing links to it with an ordinary anchor: the
 * crawl only learned about it through a canonical tag, a redirect hop, or the
 * XML sitemap. Search engines discover and rank pages primarily by following
 * links, so an isolated URL is easy to miss and quick to drop.
 *
 * Weaker forms count too: a page reachable only through noindex,follow pages
 * (the link path dies once the noindex page leaves the index), or linked only
 * from pages that are themselves isolated.
 *
 * Needs the crawl's per-URL discovery records, so it runs in crawl mode only.
 */

/** Human-readable phrasing for each discovery source, for result messages */
const SOURCE_LABELS: Record<DiscoverySource, string> = {
  link: 'an internal link',
  canonical: 'a canonical tag',
  redirect: 'a redirect',
  sitemap: 'the XML sitemap',
  entry: 'the crawl entry point',
};

/** Non-link sources worth reporting when a URL was never anchor-linked */
const REPORTABLE_SOURCES: DiscoverySource[] = ['canonical', 'redirect', 'sitemap'];

export const crawlIsolatedUrlRule = defineRule({
  id: 'crawl-isolated-url',
  name: 'Isolated URL',
  description: 'Checks that the page is reachable through ordinary internal links, not only canonicals, redirects or the sitemap',
  category: 'crawl',
  weight: 8,
  run: (context: AuditContext) => {
    const site = context.site;
    const discovery = site?.discoverySourceByUrl;
    if (!site || !discovery) {
      return notMeasured(
        'crawl-isolated-url',
        'Checking how the URL was discovered needs the crawl\'s per-URL discovery records - run with --crawl to build them'
      );
    }

    const url = site.normalize(context.url);
    const sources = discovery.get(url);
    if (!sources) {
      return notMeasured(
        'crawl-isolated-url',
        'No discovery record for this URL - its reachability cannot be judged',
        { url: context.url }
      );
    }

    // Base isolation set: URLs the crawl knows about that no anchor points
    // to. The entry point is excluded by construction (the crawl began there).
    const isolatedBase = new Set<string>();
    for (const [u, s] of discovery) {
      if (!s.has('link') && !s.has('entry')) {
        isolatedBase.add(u);
      }
    }

    // One propagation pass: a URL whose only inbound links come from
    // base-isolated pages inherits the isolation. Deliberately a single pass,
    // not a fixpoint - deep chains of isolated pages are rare, and each extra
    // pass costs a walk of the whole graph.
    const isolatedPropagated = new Set<string>(isolatedBase);
    for (const [u, s] of discovery) {
      if (isolatedBase.has(u) || !s.has('link') || s.has('entry')) continue;
      const linkers = site.inboundLinksByUrl.get(u);
      if (!linkers || linkers.size === 0) continue;
      let allIsolated = true;
      for (const from of linkers) {
        if (!isolatedBase.has(from)) {
          allIsolated = false;
          break;
        }
      }
      if (allIsolated) {
        isolatedPropagated.add(u);
      }
    }

    // The crawl began here; nothing is expected to link "up" to it.
    if (sources.has('entry') || url === site.entryUrl) {
      return pass('crawl-isolated-url', 'Crawl entry point', {
        discoverySources: [...sources],
      });
    }

    // Strongest form: no anchor link at all - the crawl found the URL only
    // through a canonical, a redirect or the sitemap.
    if (!sources.has('link')) {
      const foundVia = REPORTABLE_SOURCES.filter((s) => sources.has(s)).map(
        (s) => SOURCE_LABELS[s]
      );
      return fail(
        'crawl-isolated-url',
        `URL is isolated: it can only be found via ${foundVia.join(' and ') || 'non-link sources'}`,
        {
          isolationKind: 'no-inbound-links',
          discoverySources: [...sources],
          foundVia,
          impact:
            'Without internal anchor links, search engines may never discover this page, and it receives no internal link equity.',
          recommendation:
            'Link to this page from ordinary anchors on relevant, indexable pages; do not rely on canonicals, redirects or the sitemap for discovery.',
        }
      );
    }

    const linkers = site.inboundLinksByUrl.get(url);
    if (!linkers || linkers.size === 0) {
      // Discovery says the URL was anchor-linked but the graph holds no
      // inbound edge - the two records disagree, so there is no reading.
      return notMeasured(
        'crawl-isolated-url',
        'Discovery records show an inbound link but the link graph has none - the records disagree',
        { discoverySources: [...sources] }
      );
    }

    // Reachable only through noindex,follow pages: the anchor exists, but the
    // path to it leaves the index with the linking page. Uncrawled linkers
    // make the answer unknown, so this fires only when every linker was
    // crawled and is noindex (without nofollow).
    if (site.pages) {
      const linkerInfos = [...linkers].map((from) => site.pages!.get(from));
      if (
        linkerInfos.length > 0 &&
        linkerInfos.every((info) => info && info.noindex && !info.nofollow)
      ) {
        return fail(
          'crawl-isolated-url',
          `URL is only reachable through noindex,follow page(s): ${[...linkers].slice(0, 3).join(', ')}`,
          {
            isolationKind: 'noindex-follow-only',
            discoverySources: [...sources],
            inboundLinkers: [...linkers],
            impact:
              'Once the noindex linking pages drop out of the index, search engines lose the only path to this URL.',
            recommendation:
              'Link to this page from at least one indexable page so the discovery path survives.',
          }
        );
      }
    }

    // Linked, but every linking page is itself isolated (directly or after
    // one propagation pass).
    let allLinkersIsolated = true;
    for (const from of linkers) {
      if (!isolatedPropagated.has(from)) {
        allLinkersIsolated = false;
        break;
      }
    }
    if (allLinkersIsolated) {
      return fail(
        'crawl-isolated-url',
        `URL is only linked from other isolated URLs: ${[...linkers].slice(0, 3).join(', ')}`,
        {
          isolationKind: 'isolated-linkers-only',
          discoverySources: [...sources],
          inboundLinkers: [...linkers],
          impact:
            'The only links to this page come from pages that are themselves unreachable by links, so the whole chain is invisible to link-based discovery.',
          recommendation:
            'Link to this page - or to the pages linking to it - from ordinarily linked, indexable content.',
        }
      );
    }

    return pass('crawl-isolated-url', 'URL is reachable through internal links', {
      discoverySources: [...sources],
      inboundLinkerCount: linkers.size,
    });
  },
});
