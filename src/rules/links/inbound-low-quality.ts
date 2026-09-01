import type { AuditContext, SiteContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { getInboundEdges, NEEDS_SITE_GRAPH_MESSAGE } from './inbound.js';

// Reference hint: links/only-receives-nofollow-links-or-links-from-canonicalized-urls

/**
 * Whether the linking page is canonicalized away from itself, i.e. its
 * canonical tag points at a different URL. Links from such pages pass no
 * link equity of their own — the source page consolidates its signals onto
 * the canonical target.
 *
 * Unknown answers resolve to false (not canonicalized): a missing `pages`
 * map, an unrecorded source page, or an unresolvable canonical (`null`)
 * never flip an edge to "no equity".
 */
function isCanonicalizedAway(site: SiteContext, from: string): boolean {
  const canonical = site.pages?.get(from)?.canonical;
  return typeof canonical === 'string' && canonical.length > 0 && site.normalize(canonical) !== from;
}

/**
 * Rule: Inbound Links Passing No Link Equity
 *
 * Flags pages where no inbound internal link passes link equity: every edge
 * is either nofollow or comes from a page canonicalized to another URL. Such
 * a page is linked, yet starved of internal ranking signal.
 *
 * A page with no inbound links at all passes here; that condition is
 * `links-orphan-pages`' territory.
 */
export const inboundLowQualityRule = defineRule({
  id: 'links-inbound-low-quality',
  name: 'Inbound Links Passing No Link Equity',
  description:
    'Warns when every inbound internal link is nofollow or comes from a canonicalized page, so none pass link equity',
  category: 'links',
  weight: 3,
  run: (context: AuditContext) => {
    const edges = getInboundEdges(context);

    if (edges === null) {
      return notMeasured('links-inbound-low-quality', NEEDS_SITE_GRAPH_MESSAGE);
    }

    if (edges.length === 0) {
      return pass(
        'links-inbound-low-quality',
        'No inbound internal links - inbound link counting is covered by links-orphan-pages'
      );
    }

    // getInboundEdges returned edges, so the site graph is present.
    const site = context.site!;
    const nofollowCount = edges.filter((edge) => edge.nofollow).length;
    const canonicalizedSourceCount = edges.filter((edge) => isCanonicalizedAway(site, edge.from)).length;
    const equityPassing = edges.filter(
      (edge) => !edge.nofollow && !isCanonicalizedAway(site, edge.from)
    );

    const details = {
      inboundEdgeCount: edges.length,
      nofollowCount,
      canonicalizedSourceCount,
      equityPassingCount: equityPassing.length,
    };

    if (equityPassing.length === 0) {
      return warn(
        'links-inbound-low-quality',
        `No inbound internal link passes link equity - every link is nofollow or from a page canonicalized elsewhere`,
        {
          ...details,
          suggestion:
            'Earn followed links from indexable, self-canonical pages so this URL receives internal link equity',
        }
      );
    }

    return pass(
      'links-inbound-low-quality',
      `${equityPassing.length} of ${edges.length} inbound internal link(s) pass link equity`,
      details
    );
  },
});
