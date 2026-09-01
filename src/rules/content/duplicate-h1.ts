import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hint: duplicate-content/urls-with-duplicate-h1s
/**
 * Rule: Duplicate H1 Across Pages
 *
 * Warns when this page's H1 is the exact same text as the H1 of at least one
 * other crawled page. Identical H1s across URLs suggest templated or
 * duplicated content and make it harder for search engines (and users
 * scanning snippets) to tell the pages apart.
 *
 * Requires the crawl's per-page inventory (`site.pages`), so it runs in
 * crawl mode only; all comparison data comes from the crawl, so no
 * module-level state is accumulated between audits.
 */
export const duplicateH1Rule = defineRule({
  id: 'content-duplicate-h1',
  name: 'Duplicate H1 Across Pages',
  description:
    'Detects pages whose h1 heading is the exact same text as another crawled page',
  category: 'content',
  weight: 5,
  run: (context: AuditContext) => {
    const site = context.site;

    if (!site?.pages) {
      return notMeasured(
        'content-duplicate-h1',
        'Cross-page H1 comparison needs the crawl page inventory - run with --crawl to build it'
      );
    }

    const url = site.normalize(context.url);
    const thisPage = site.pages.get(url);
    const h1 = thisPage?.h1?.trim();

    // An absent or empty H1 is a missing-heading problem, not a duplicate one;
    // the heading rules cover that case.
    if (!thisPage || !h1) {
      return notMeasured(
        'content-duplicate-h1',
        'No H1 text recorded for this page in the crawl data'
      );
    }

    const duplicateUrls: string[] = [];
    for (const [otherUrl, info] of site.pages) {
      if (otherUrl === url) continue;
      if (info.h1 && info.h1.trim() === h1) {
        duplicateUrls.push(otherUrl);
      }
    }

    if (duplicateUrls.length > 0) {
      return warn(
        'content-duplicate-h1',
        `This page's H1 is identical to ${duplicateUrls.length} other crawled page(s)`,
        {
          url: context.url,
          h1,
          duplicateCount: duplicateUrls.length,
          duplicateUrls: duplicateUrls.slice(0, 10),
          pagesCrawled: site.pages.size,
          impact:
            'Identical H1s across pages suggest templated or duplicated content and blur the topical difference between URLs.',
          recommendation:
            'Give each page a unique H1 that reflects its specific topic.',
        }
      );
    }

    return pass(
      'content-duplicate-h1',
      'This page\'s H1 is unique across the crawled pages',
      {
        url: context.url,
        h1,
        pagesCrawled: site.pages.size,
      }
    );
  },
});
