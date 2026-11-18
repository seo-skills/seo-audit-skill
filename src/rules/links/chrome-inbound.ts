import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';
import { getInboundEdges, NEEDS_SITE_GRAPH_MESSAGE } from './inbound.js';

/**
 * Rule: Inbound links only from site chrome
 *
 * A footer link on every page looks like many inbound links and carries
 * little of the signal of a link in the body. The rule warns when every
 * recorded inbound edge was in nav, header, or footer.
 */
export const chromeInboundRule = defineRule({
  id: 'links-chrome-inbound',
  name: 'Chrome-Only Inbound Links',
  description: 'Checks that a page has at least one inbound internal link outside nav, header, and footer',
  category: 'links',
  weight: 4,
  run: (context: AuditContext) => {
    const edges = getInboundEdges(context);
    if (!edges) {
      return notMeasured('links-chrome-inbound', NEEDS_SITE_GRAPH_MESSAGE, undefined, 'needs-crawl');
    }

    if (edges.length === 0) {
      return pass('links-chrome-inbound', 'No inbound links to classify (orphan rules cover that case)', {
        inbound: 0,
      });
    }

    if (edges.some((edge) => edge.chrome === undefined)) {
      return notMeasured(
        'links-chrome-inbound',
        'Inbound edges do not record whether the link was in site chrome'
      );
    }

    const editorial = edges.filter((edge) => edge.chrome === false);
    if (editorial.length > 0) {
      return pass('links-chrome-inbound', `${editorial.length} inbound link(s) sit outside site chrome`, {
        editorial: editorial.length,
        inbound: edges.length,
      });
    }

    return warn('links-chrome-inbound', 'Every inbound internal link is in the nav, header, or footer', {
      inbound: edges.length,
      recommendation: 'Link to this page from body copy on a relevant page, not only from sitewide chrome.',
    });
  },
});
