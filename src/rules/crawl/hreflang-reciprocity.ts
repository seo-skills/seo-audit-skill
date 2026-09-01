import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { resolveHreflangOut, lookupPage, isSameUrl } from './site-page-utils.js';

// Reference hint: international/missing-reciprocal-hreflang-no-return-tag

/**
 * Rule: Hreflang Reciprocity
 *
 * hreflang annotations are only honoured when they are mutual: if this page
 * declares T as its 'fr' alternate, T must declare this page as an alternate
 * in return. Without the return tag, search engines cannot confirm the
 * relationship and may drop both annotations.
 *
 * Reciprocity failures are usually unintentional — a template that renders
 * annotations on one locale but not another — so this warns rather than
 * fails.
 *
 * Only targets the crawl actually fetched can be checked: a target outside
 * the crawled set may reciprocate perfectly well for all we know. When none
 * of the targets were crawled, there is nothing to judge and the rule is
 * not measured.
 */
export const hreflangReciprocityRule = defineRule({
  id: 'crawl-hreflang-reciprocity',
  name: 'Hreflang Reciprocity',
  description:
    'Checks that crawled hreflang targets annotate this page in return (return tags)',
  category: 'crawl',
  weight: 6,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'crawl-hreflang-reciprocity',
        'Checking hreflang return tags needs per-page crawl state - run with --crawl to build it'
      );
    }

    const annotations = Object.entries(resolveHreflangOut(context));
    if (annotations.length === 0) {
      return pass('crawl-hreflang-reciprocity', 'No hreflang annotations on this page');
    }

    const missingReturn: Array<{ code: string; target: string }> = [];
    let unknown = 0;
    for (const [code, targetUrl] of annotations) {
      const target = lookupPage(site, targetUrl);
      if (!target) {
        unknown++;
        continue;
      }
      const reciprocates = Object.values(target.hreflangOut).some((back) =>
        isSameUrl(site, back, context.url)
      );
      if (!reciprocates) {
        missingReturn.push({ code, target: targetUrl });
      }
    }

    if (unknown === annotations.length) {
      return notMeasured(
        'crawl-hreflang-reciprocity',
        'None of the hreflang targets were crawled, so their return tags cannot be checked',
        { hreflangCount: annotations.length }
      );
    }

    if (missingReturn.length > 0) {
      return warn(
        'crawl-hreflang-reciprocity',
        `${missingReturn.length} hreflang target(s) do not annotate this page in return`,
        {
          missingReturn: missingReturn.slice(0, 10),
          hreflangCount: annotations.length,
          uncheckedTargets: unknown,
          recommendation:
            'Add reciprocal hreflang annotations on the target pages pointing back at this URL.',
        }
      );
    }

    return pass(
      'crawl-hreflang-reciprocity',
      'All crawled hreflang targets annotate this page in return',
      { hreflangCount: annotations.length, uncheckedTargets: unknown }
    );
  },
});
