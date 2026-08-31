import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

/**
 * Maximum recommended click depth from the entry point.
 *
 * Three clicks is the common guideline: beyond it, pages get crawled less
 * often and receive noticeably less internal link equity.
 */
const MAX_RECOMMENDED_DEPTH = 3;

/** Beyond this, a page is effectively buried. */
const SEVERE_DEPTH = 5;

/**
 * Rule: Page Depth
 *
 * Measures click distance from the crawl entry point — how many links a user
 * or crawler must follow to reach this page.
 *
 * This is deliberately not inferred from the URL path. A page at
 * `/a/b/c/d/` may be linked directly from the homepage (depth 1), and a page
 * at `/promo` may be reachable only through four other pages. Only the crawl
 * graph knows which, so this runs in crawl mode.
 */
export const depthRule = defineRule({
  id: 'links-depth',
  name: 'Page Depth',
  description:
    'Checks click distance from the crawl entry point (more than 3 clicks is hard to reach)',
  category: 'links',
  weight: 4,
  run: (context: AuditContext) => {
    const site = context.site;

    if (!site) {
      return notMeasured(
        'links-depth',
        'Click depth needs the site-wide link graph - run with --crawl to measure it'
      );
    }

    const url = site.normalize(context.url);
    const depth = site.depthByUrl.get(url);

    if (depth === undefined) {
      return notMeasured('links-depth', 'Page was not reached by following links from the entry point', {
        url,
      });
    }

    const details = {
      depth,
      entryUrl: site.entryUrl,
      maxRecommended: MAX_RECOMMENDED_DEPTH,
      pagesCrawled: site.pageCount,
    };

    if (depth === 0) {
      return pass('links-depth', 'Crawl entry point (depth 0)', details);
    }

    if (depth > SEVERE_DEPTH) {
      return fail(
        'links-depth',
        `Page is ${depth} clicks from the entry point, well beyond the ${MAX_RECOMMENDED_DEPTH}-click guideline`,
        {
          ...details,
          impact:
            'Deeply buried pages are crawled less often and inherit little internal link equity. Link to them from a hub or category page closer to the entry point.',
        }
      );
    }

    if (depth > MAX_RECOMMENDED_DEPTH) {
      return warn(
        'links-depth',
        `Page is ${depth} clicks from the entry point (more than the recommended ${MAX_RECOMMENDED_DEPTH})`,
        details
      );
    }

    return pass(
      'links-depth',
      `Page is ${depth} click(s) from the entry point`,
      details
    );
  },
});
