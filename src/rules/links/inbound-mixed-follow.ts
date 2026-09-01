import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { getInboundEdges, NEEDS_SITE_GRAPH_MESSAGE } from './inbound.js';

// Reference hint: links/url-receives-both-follow-nofollow-internal-links

/**
 * Rule: Mixed Follow/Nofollow Inbound Links
 *
 * Flags pages receiving a mixture of followed and nofollowed internal links.
 * A mixture usually means the nofollow was applied inconsistently — a template
 * or widget nofollowing links that the rest of the site follows — rather than
 * a deliberate policy.
 *
 * All-nofollow is not flagged here; that is `links-inbound-all-nofollow`'s
 * message. No inbound links at all is `links-orphan-pages`' territory.
 */
export const inboundMixedFollowRule = defineRule({
  id: 'links-inbound-mixed-follow',
  name: 'Mixed Follow/Nofollow Inbound Links',
  description:
    'Warns when a page receives both followed and nofollowed internal links, suggesting inconsistent nofollow usage',
  category: 'links',
  weight: 2,
  run: (context: AuditContext) => {
    const edges = getInboundEdges(context);

    if (edges === null) {
      return notMeasured('links-inbound-mixed-follow', NEEDS_SITE_GRAPH_MESSAGE);
    }

    if (edges.length === 0) {
      return pass(
        'links-inbound-mixed-follow',
        'No inbound internal links - inbound link counting is covered by links-orphan-pages'
      );
    }

    const nofollowCount = edges.filter((edge) => edge.nofollow).length;
    const followedCount = edges.length - nofollowCount;
    const details = {
      inboundEdgeCount: edges.length,
      nofollowCount,
      followedCount,
      nofollowFrom: edges
        .filter((edge) => edge.nofollow)
        .map((edge) => edge.from)
        .slice(0, 5),
    };

    if (nofollowCount > 0 && followedCount > 0) {
      return warn(
        'links-inbound-mixed-follow',
        `Receives both followed (${followedCount}) and nofollowed (${nofollowCount}) internal links`,
        {
          ...details,
          suggestion:
            'Decide whether internal links to this page should be nofollowed and apply it consistently',
        }
      );
    }

    return pass(
      'links-inbound-mixed-follow',
      nofollowCount === 0
        ? `All ${edges.length} inbound internal link(s) are followed`
        : 'All inbound internal links are nofollow - covered by links-inbound-all-nofollow',
      details
    );
  },
});
