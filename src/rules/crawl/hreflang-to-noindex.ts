import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';
import { lookupPage, resolveHreflangOut } from './site-page-utils.js';

/**
 * Rule: Hreflang To Noindex URLs
 *
 * Reference hint: international/has-outgoing-hreflang-annotations-to-noindex-urls
 *
 * hreflang annotations tell search engines which localized equivalent of
 * this page to serve. Pointing one at a noindex URL is contradictory: the
 * annotation asks for the target to be served in search while the target
 * asks not to be indexed at all.
 *
 * The targets' robots state only exists once the crawl fetched them, so
 * this runs in crawl mode only.
 */
export const hreflangToNoindexRule = defineRule({
  id: 'crawl-hreflang-to-noindex',
  name: 'Hreflang To Noindex URLs',
  description: 'Checks that outgoing hreflang annotations do not point to noindex URLs',
  category: 'crawl',
  weight: 8,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'crawl-hreflang-to-noindex',
        'Checking hreflang targets needs per-page crawl state - run with --crawl to build it'
      );
    }

    const annotations = Object.entries(resolveHreflangOut(context));
    if (annotations.length === 0) {
      return pass('crawl-hreflang-to-noindex', 'No hreflang annotations on this page');
    }

    const flagged: Array<{ code: string; url: string }> = [];
    let unknown = 0;
    for (const [code, targetUrl] of annotations) {
      const target = lookupPage(site, targetUrl);
      if (!target) {
        unknown++;
        continue;
      }
      if (target.noindex) {
        flagged.push({ code, url: targetUrl });
      }
    }

    if (flagged.length > 0) {
      return fail(
        'crawl-hreflang-to-noindex',
        `${flagged.length} hreflang annotation(s) point to noindex URL(s)`,
        {
          flagged: flagged.slice(0, 10),
          hreflangCount: annotations.length,
          impact:
            'Hreflang asks search engines to serve a URL that asks not to be indexed, so the localized cluster can break down.',
          recommendation:
            'Remove noindex from the hreflang targets, or drop the annotations pointing at them.',
        }
      );
    }

    if (unknown === annotations.length) {
      return notMeasured(
        'crawl-hreflang-to-noindex',
        'None of the hreflang targets were crawled, so their robots state is unknown',
        { hreflangCount: annotations.length }
      );
    }

    return pass('crawl-hreflang-to-noindex', 'No hreflang annotation points to a noindex URL', {
      hreflangCount: annotations.length,
      uncheckedTargets: unknown,
    });
  },
});
