import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';
import { lookupPage, resolveHreflangOut } from './site-page-utils.js';

/**
 * Rule: Hreflang To Disallowed URLs
 *
 * Reference hint: international/has-outgoing-hreflang-annotations-to-disallowed-urls
 *
 * hreflang annotations point crawlers at localized equivalents of this page,
 * but a robots.txt disallow tells crawlers not to fetch those targets — so
 * the annotation may never be discovered on the far side and the cluster
 * cannot be confirmed.
 *
 * The disallow flag is best-effort (unknown reads as false), and targets'
 * state only exists once the crawl fetched them, so this runs in crawl mode
 * only.
 */
export const hreflangToDisallowedRule = defineRule({
  id: 'crawl-hreflang-to-disallowed',
  name: 'Hreflang To Disallowed URLs',
  description: 'Checks that outgoing hreflang annotations do not point to robots.txt-disallowed URLs',
  category: 'crawl',
  weight: 7,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'crawl-hreflang-to-disallowed',
        'Checking hreflang targets needs per-page crawl state - run with --crawl to build it'
      );
    }

    const annotations = Object.entries(resolveHreflangOut(context));
    if (annotations.length === 0) {
      return pass('crawl-hreflang-to-disallowed', 'No hreflang annotations on this page');
    }

    const flagged: Array<{ code: string; url: string }> = [];
    let unknown = 0;
    for (const [code, targetUrl] of annotations) {
      const target = lookupPage(site, targetUrl);
      if (!target) {
        unknown++;
        continue;
      }
      if (target.disallowed) {
        flagged.push({ code, url: targetUrl });
      }
    }

    if (flagged.length > 0) {
      return fail(
        'crawl-hreflang-to-disallowed',
        `${flagged.length} hreflang annotation(s) point to robots.txt-disallowed URL(s)`,
        {
          flagged: flagged.slice(0, 10),
          hreflangCount: annotations.length,
          impact:
            'Crawlers are told not to fetch the hreflang target, so the return annotation there cannot be confirmed and the cluster may be ignored.',
          recommendation:
            'Remove the robots.txt disallow for the hreflang targets, or drop the annotations pointing at them.',
        }
      );
    }

    if (unknown === annotations.length) {
      return notMeasured(
        'crawl-hreflang-to-disallowed',
        'None of the hreflang targets were crawled, so their robots.txt state is unknown',
        { hreflangCount: annotations.length }
      );
    }

    return pass(
      'crawl-hreflang-to-disallowed',
      'No hreflang annotation points to a disallowed URL',
      { hreflangCount: annotations.length, uncheckedTargets: unknown }
    );
  },
});
