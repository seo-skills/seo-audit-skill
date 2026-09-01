import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';
import { getOwnPageInfo } from './site-page-utils.js';

/**
 * Rule: Disallowed URL Has Incoming Hreflang
 *
 * Reference hint: international/disallowed-url-has-incoming-hreflang
 *
 * The mirror of the outgoing check: this page is disallowed by robots.txt,
 * yet other pages point hreflang annotations at it. Crawlers following those
 * annotations are told not to fetch this page, so its return tags can never
 * be confirmed and the hreflang cluster breaks.
 *
 * Needs the whole crawl's hreflang map, so it runs in crawl mode only.
 */
export const hreflangDisallowedTargetRule = defineRule({
  id: 'crawl-hreflang-disallowed-target',
  name: 'Disallowed URL Has Incoming Hreflang',
  description: 'Checks that no other page points hreflang annotations at this robots.txt-disallowed page',
  category: 'crawl',
  weight: 7,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'crawl-hreflang-disallowed-target',
        'Checking incoming hreflang needs per-page crawl state - run with --crawl to build it'
      );
    }

    const own = getOwnPageInfo(context);
    if (!own) {
      return notMeasured(
        'crawl-hreflang-disallowed-target',
        'This page has no crawl record, so its robots.txt state is unknown'
      );
    }

    if (!own.disallowed) {
      return pass(
        'crawl-hreflang-disallowed-target',
        'Page is not disallowed by robots.txt'
      );
    }

    const ownKey = site.normalize(context.url);
    const referring: string[] = [];
    for (const [pageUrl, info] of site.pages) {
      if (pageUrl === ownKey) continue;
      for (const targetUrl of Object.values(info.hreflangOut)) {
        if (site.normalize(targetUrl) === ownKey) {
          referring.push(pageUrl);
          break;
        }
      }
    }

    if (referring.length > 0) {
      return fail(
        'crawl-hreflang-disallowed-target',
        `Page is disallowed by robots.txt but ${referring.length} crawled page(s) point hreflang annotations at it`,
        {
          referringPages: referring.slice(0, 10),
          referringCount: referring.length,
          impact:
            'Crawlers cannot fetch this page, so its hreflang return tags are never seen and the cluster may be ignored.',
          recommendation:
            'Remove the robots.txt disallow for this URL, or remove the hreflang annotations pointing at it.',
        }
      );
    }

    return pass(
      'crawl-hreflang-disallowed-target',
      'Page is disallowed but no crawled page points hreflang annotations at it'
    );
  },
});
