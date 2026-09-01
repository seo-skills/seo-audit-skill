import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { getInboundEdges, NEEDS_SITE_GRAPH_MESSAGE } from './inbound.js';

// Reference hint: indexability/url-only-has-nofollow-incoming-internal-links

/**
 * Rule: Inbound Links All Nofollow
 *
 * Flags pages whose every inbound internal link carries nofollow. Nofollow
 * links do not pass link equity, so the page is effectively cut off from
 * internal ranking signal even though it is linked. Insight-level in the
 * reference catalog, so this warns at most — it never fails.
 *
 * A page with no inbound links at all passes here; that condition is
 * `links-orphan-pages`' territory.
 */
export const inboundAllNofollowRule = defineRule({
  id: 'links-inbound-all-nofollow',
  name: 'Inbound Links All Nofollow',
  description:
    'Warns when every internal link pointing to this page is nofollow, so no link equity reaches it',
  category: 'links',
  weight: 2,
  run: (context: AuditContext) => {
    const edges = getInboundEdges(context);

    if (edges === null) {
      return notMeasured('links-inbound-all-nofollow', NEEDS_SITE_GRAPH_MESSAGE);
    }

    if (edges.length === 0) {
      return pass(
        'links-inbound-all-nofollow',
        'No inbound internal links - inbound link counting is covered by links-orphan-pages'
      );
    }

    const nofollowCount = edges.filter((edge) => edge.nofollow).length;
    const details = {
      inboundEdgeCount: edges.length,
      nofollowCount,
      followedCount: edges.length - nofollowCount,
    };

    if (nofollowCount === edges.length) {
      return warn(
        'links-inbound-all-nofollow',
        `All ${edges.length} inbound internal link(s) are nofollow, so no link equity reaches this page`,
        {
          ...details,
          suggestion:
            'If these pages should pass ranking signal, remove nofollow from the internal links pointing here',
        }
      );
    }

    return pass(
      'links-inbound-all-nofollow',
      `${edges.length - nofollowCount} of ${edges.length} inbound internal link(s) are followed`,
      details
    );
  },
});
