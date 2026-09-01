import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { walkCanonical } from './site-page-utils.js';

/**
 * Rule: Canonical Points To Another Canonicalized URL
 *
 * Reference hint: indexability/canonical-points-to-another-canonicalized-url
 *
 * This page's canonical target is itself canonicalized to a different URL,
 * forming a canonical chain. Search engines usually follow the chain to its
 * end, but each hop weakens the signal and the final destination may not be
 * the one intended.
 *
 * Following the chain needs the target's own canonical, which only exists
 * once the crawl fetched it — so this runs in crawl mode only. Loops are
 * reported by crawl-canonical-loop instead.
 */
export const canonicalChainRule = defineRule({
  id: 'crawl-canonical-chain',
  name: 'Canonical Chain',
  description: 'Checks that the canonical target is not itself canonicalized to a different URL',
  category: 'crawl',
  weight: 6,
  run: (context: AuditContext) => {
    if (!context.site?.pages) {
      return notMeasured(
        'crawl-canonical-chain',
        'Following the canonical chain needs per-page crawl state - run with --crawl to build it'
      );
    }

    const walk = walkCanonical(context);

    switch (walk.kind) {
      case 'none':
        return pass('crawl-canonical-chain', 'No canonical tag declared');
      case 'self':
        return pass('crawl-canonical-chain', 'Canonical is self-referencing');
      case 'ok':
        return pass('crawl-canonical-chain', 'Canonical target is a final destination', {
          canonical: walk.target,
        });
      case 'unknown':
        return notMeasured(
          'crawl-canonical-chain',
          'Canonical chain leaves the crawled set, so its end is unknown',
          { canonical: walk.target || undefined }
        );
      case 'loop':
        // crawl-canonical-loop reports this at fail severity.
        return pass('crawl-canonical-chain', 'Canonical forms a loop - reported by crawl-canonical-loop', {
          path: walk.path,
        });
      case 'chain':
        return warn(
          'crawl-canonical-chain',
          'Canonical points to a URL that is itself canonicalized elsewhere',
          {
            canonical: walk.target,
            targetCanonical: walk.targetCanonical,
            chainResolved: walk.resolved,
            impact:
              'Canonical chains dilute the signal and may resolve to a different URL than intended.',
            recommendation: `Point the canonical directly at ${walk.targetCanonical}.`,
          }
        );
    }
  },
});
