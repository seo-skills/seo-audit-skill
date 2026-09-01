import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';
import { isSameUrl, lookupPage, resolveCanonical } from './site-page-utils.js';

/**
 * Rule: Canonical Points To Noindex URL
 *
 * Reference hint: indexability/canonical-points-to-a-noindex-url
 *
 * A canonical tag tells search engines to index the target instead of this
 * page. When that target is itself noindex, the two signals contradict each
 * other: this page delegates its indexing to a URL that asks not to be
 * indexed, so both can drop out of the index.
 *
 * Cross-page by nature — the target's robots state is only known once the
 * crawl fetched it — so it runs in crawl mode only.
 */
export const canonicalToNoindexRule = defineRule({
  id: 'crawl-canonical-to-noindex',
  name: 'Canonical Points To Noindex URL',
  description: 'Checks that the canonical target is not itself noindex',
  category: 'crawl',
  weight: 8,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'crawl-canonical-to-noindex',
        'Checking the canonical target needs per-page crawl state - run with --crawl to build it'
      );
    }

    const canonical = resolveCanonical(context);
    if (!canonical) {
      return pass(
        'crawl-canonical-to-noindex',
        canonical === null
          ? 'Canonical tag is declared but unresolvable - nothing to cross-reference'
          : 'No canonical tag declared',
        { canonical: canonical ?? null }
      );
    }

    // A self-referencing canonical on a noindex page is an explicit opt-out,
    // not a contradictory delegation.
    if (isSameUrl(site, canonical, context.url)) {
      return pass('crawl-canonical-to-noindex', 'Canonical is self-referencing', {
        canonical,
      });
    }

    const target = lookupPage(site, canonical);
    if (!target) {
      return notMeasured(
        'crawl-canonical-to-noindex',
        'Canonical target was not crawled, so its robots state is unknown',
        { canonical }
      );
    }

    if (target.noindex) {
      return fail(
        'crawl-canonical-to-noindex',
        'Canonical points to a URL that is noindex',
        {
          canonical,
          impact:
            'The page delegates indexing to a URL that asks not to be indexed, so search engines may index neither.',
          recommendation:
            'Point the canonical at an indexable URL, or remove noindex from the canonical target.',
        }
      );
    }

    return pass('crawl-canonical-to-noindex', 'Canonical target is indexable', { canonical });
  },
});
