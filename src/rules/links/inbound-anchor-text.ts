import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { getInboundEdges, NEEDS_SITE_GRAPH_MESSAGE } from './inbound.js';
import { NON_DESCRIPTIVE_PATTERNS } from './anchor-text.js';

// Reference hint: links/has-incoming-followed-links-that-do-not-use-descriptive-anchor-text

/**
 * Whether an inbound anchor is generic: empty (image-only links have no text),
 * shorter than 2 characters, or an exact match of the non-descriptive phrase
 * list shared with the outgoing anchor-text rule.
 */
function isGenericAnchor(anchor: string): boolean {
  const text = anchor.trim().toLowerCase();

  if (!text || text.length < 2) return true;

  return NON_DESCRIPTIVE_PATTERNS.some(
    (pattern) => text === pattern || text === pattern + '...'
  );
}

/**
 * Rule: Descriptive Inbound Anchor Text
 *
 * Flags pages whose followed inbound links all use generic anchors ("click
 * here", "read more", empty/image-only). Inbound anchor text is a relevance
 * signal for the target page, and only the target page's owner can feel its
 * absence — the linking side is already covered by `links-anchor-text`.
 *
 * Pages with no followed inbound links pass; that condition is
 * `links-inbound-all-nofollow`'s message, and no inbound links at all is
 * `links-orphan-pages`' territory.
 */
export const inboundAnchorTextRule = defineRule({
  id: 'links-inbound-anchor-text',
  name: 'Descriptive Inbound Anchor Text',
  description:
    'Warns when every followed internal link pointing to this page uses generic anchor text like "click here"',
  category: 'links',
  weight: 2,
  run: (context: AuditContext) => {
    const edges = getInboundEdges(context);

    if (edges === null) {
      return notMeasured('links-inbound-anchor-text', NEEDS_SITE_GRAPH_MESSAGE);
    }

    if (edges.length === 0) {
      return pass(
        'links-inbound-anchor-text',
        'No inbound internal links - inbound link counting is covered by links-orphan-pages'
      );
    }

    // Nofollowed edges pass no anchor-text signal worth judging here.
    const followed = edges.filter((edge) => !edge.nofollow);

    if (followed.length === 0) {
      return pass(
        'links-inbound-anchor-text',
        'No followed inbound internal links - covered by links-inbound-all-nofollow'
      );
    }

    const generic = followed.filter((edge) => isGenericAnchor(edge.anchor));
    const details = {
      followedInboundCount: followed.length,
      genericAnchorCount: generic.length,
      genericAnchors: generic
        .map((edge) => ({ from: edge.from, anchor: edge.anchor }))
        .slice(0, 5),
    };

    if (generic.length === followed.length) {
      return warn(
        'links-inbound-anchor-text',
        `All ${followed.length} followed inbound internal link(s) use generic anchor text`,
        {
          ...details,
          suggestion:
            'Ask for descriptive anchor text on internal links pointing here - it tells search engines what this page is about',
        }
      );
    }

    return pass(
      'links-inbound-anchor-text',
      `${followed.length - generic.length} of ${followed.length} followed inbound internal link(s) use descriptive anchor text`,
      details
    );
  },
});
