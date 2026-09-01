import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';
import { isSameUrl, lookupPage, resolveCanonical } from './site-page-utils.js';

/**
 * Rule: Canonical Points To Disallowed URL
 *
 * Reference hint: indexability/canonical-points-to-a-disallowed-url
 *
 * A canonical tag delegates indexing to its target, but a robots.txt
 * disallow tells crawlers not to fetch that target at all — so the canonical
 * signal on this page may never be seen, and the disallowed URL cannot be
 * indexed either.
 *
 * The disallow flag is best-effort (unknown reads as false), and the
 * target's state only exists once the crawl fetched it, so this runs in
 * crawl mode only.
 */
export const canonicalToDisallowedRule = defineRule({
  id: 'crawl-canonical-to-disallowed',
  name: 'Canonical Points To Disallowed URL',
  description: 'Checks that the canonical target is not disallowed by robots.txt',
  category: 'crawl',
  weight: 8,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'crawl-canonical-to-disallowed',
        'Checking the canonical target needs per-page crawl state - run with --crawl to build it'
      );
    }

    const canonical = resolveCanonical(context);
    if (!canonical) {
      return pass(
        'crawl-canonical-to-disallowed',
        canonical === null
          ? 'Canonical tag is declared but unresolvable - nothing to cross-reference'
          : 'No canonical tag declared',
        { canonical: canonical ?? null }
      );
    }

    if (isSameUrl(site, canonical, context.url)) {
      return pass('crawl-canonical-to-disallowed', 'Canonical is self-referencing', {
        canonical,
      });
    }

    const target = lookupPage(site, canonical);
    if (!target) {
      return notMeasured(
        'crawl-canonical-to-disallowed',
        'Canonical target was not crawled, so its robots.txt state is unknown',
        { canonical }
      );
    }

    if (target.disallowed) {
      return fail(
        'crawl-canonical-to-disallowed',
        'Canonical points to a URL disallowed by robots.txt',
        {
          canonical,
          impact:
            'Crawlers are told not to fetch the canonical target, so the canonical signal may never be processed and neither URL gets indexed cleanly.',
          recommendation:
            'Point the canonical at a crawlable URL, or remove the robots.txt disallow for the target.',
        }
      );
    }

    return pass('crawl-canonical-to-disallowed', 'Canonical target is crawlable', { canonical });
  },
});
