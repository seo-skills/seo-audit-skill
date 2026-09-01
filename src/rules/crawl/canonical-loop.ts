import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';
import { walkCanonical } from './site-page-utils.js';

/**
 * Rule: Canonical Loop
 *
 * Reference hint: indexability/canonical-loop
 *
 * Following this page's canonical target leads back to a URL already in the
 * chain (A canonicalizes to B, B canonicalizes to A). A loop gives search
 * engines no final destination, so they fall back to their own choice of
 * canonical — or index neither page.
 *
 * Detecting a loop needs the targets' own canonicals, which only exist once
 * the crawl fetched them — so this runs in crawl mode only.
 */
export const canonicalLoopRule = defineRule({
  id: 'crawl-canonical-loop',
  name: 'Canonical Loop',
  description: 'Checks that following canonical targets does not loop back to a visited URL',
  category: 'crawl',
  weight: 8,
  run: (context: AuditContext) => {
    if (!context.site?.pages) {
      return notMeasured(
        'crawl-canonical-loop',
        'Following the canonical chain needs per-page crawl state - run with --crawl to build it'
      );
    }

    const walk = walkCanonical(context);

    switch (walk.kind) {
      case 'none':
        return pass('crawl-canonical-loop', 'No canonical tag declared');
      case 'self':
        return pass('crawl-canonical-loop', 'Canonical is self-referencing');
      case 'ok':
        return pass('crawl-canonical-loop', 'Canonical chain resolves to a final destination', {
          canonical: walk.target,
        });
      case 'unknown':
        return notMeasured(
          'crawl-canonical-loop',
          'Canonical chain leaves the crawled set, so a loop cannot be ruled out',
          { canonical: walk.target || undefined }
        );
      case 'chain':
        if (!walk.resolved) {
          return notMeasured(
            'crawl-canonical-loop',
            'Canonical chain leaves the crawled set, so a loop cannot be ruled out',
            { canonical: walk.target, targetCanonical: walk.targetCanonical }
          );
        }
        return pass('crawl-canonical-loop', 'Canonical chain does not loop', {
          canonical: walk.target,
          targetCanonical: walk.targetCanonical,
        });
      case 'loop':
        return fail(
          'crawl-canonical-loop',
          'Canonical targets form a loop with no final destination',
          {
            path: walk.path,
            impact:
              'A canonical loop gives search engines no URL to index; they pick a canonical themselves or index neither page.',
            recommendation:
              'Make every page in the loop canonicalize to a single final URL.',
          }
        );
    }
  },
});
