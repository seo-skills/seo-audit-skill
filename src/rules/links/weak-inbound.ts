import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';
import { getInboundEdges, NEEDS_SITE_GRAPH_MESSAGE } from './inbound.js';

/**
 * Rule: Exactly one dofollow inbound link
 *
 * One followed internal link is enough to be found and not enough to look
 * important. The crawl entry URL is skipped: it is often linked only from
 * the pages it links to. Zero inbound links are left to the orphan rules.
 */
export const weakInboundRule = defineRule({
  id: 'links-weak-inbound',
  name: 'Single Inbound Link',
  description: 'Checks that a non-entry page has more than one dofollow inbound internal link',
  category: 'links',
  weight: 3,
  run: (context: AuditContext) => {
    const edges = getInboundEdges(context);
    if (!edges || !context.site) {
      return notMeasured('links-weak-inbound', NEEDS_SITE_GRAPH_MESSAGE, undefined, 'needs-crawl');
    }

    if (context.site.normalize(context.url) === context.site.normalize(context.site.entryUrl)) {
      return pass('links-weak-inbound', 'The crawl entry URL is not judged for a single inbound link', {
        inbound: edges.length,
      });
    }

    const followed = edges.filter((edge) => !edge.nofollow);
    if (followed.length !== 1) {
      return pass(
        'links-weak-inbound',
        followed.length === 0
          ? 'No dofollow inbound links (orphan rules cover that case)'
          : `${followed.length} dofollow inbound links`,
        { followed: followed.length }
      );
    }

    return warn('links-weak-inbound', 'Only one dofollow internal link points at this page', {
      from: followed[0].from,
      anchor: followed[0].anchor,
      recommendation: 'Add another followed internal link from a relevant page.',
    });
  },
});
