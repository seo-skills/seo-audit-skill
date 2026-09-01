import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';

// Reference hint: international/has-conflicting-incoming-hreflang-annotations

/**
 * Rule: Conflicting Incoming Hreflang Annotations
 *
 * Every page in an hreflang cluster should agree on which language/region
 * code each member URL represents. When page X annotates this URL as 'en'
 * and page Y annotates it as 'fr', search engines cannot tell which version
 * this actually is and may ignore the cluster's annotations entirely.
 *
 * This is the incoming side of the conflict check: `i18n-hreflang-conflicting`
 * covers annotations a page makes itself (one code → several URLs, one URL →
 * several codes, multiple self-references); this rule compares what OTHER
 * crawled pages say about this URL. The page's own annotations are excluded —
 * self-reference conflicts are the outgoing rule's job.
 *
 * x-default is excluded from the comparison: it is a fallback declaration,
 * not a language claim, so targeting this URL as x-default alongside a
 * language annotation elsewhere is not a conflict.
 *
 * Requires the per-page hreflang records, so it runs in crawl mode only.
 */
export const hreflangIncomingConflictRule = defineRule({
  id: 'crawl-hreflang-incoming-conflict',
  name: 'Conflicting Incoming Hreflang Annotations',
  description:
    'Checks that other crawled pages do not annotate this URL with conflicting hreflang codes',
  category: 'crawl',
  weight: 7,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'crawl-hreflang-incoming-conflict',
        'Comparing incoming hreflang annotations needs per-page crawl state - run with --crawl to build it'
      );
    }

    const ownKey = site.normalize(context.url);

    // Incoming annotations, grouped by hreflang code: every other crawled
    // page's annotation whose target is this URL.
    const sourcesByCode = new Map<string, Set<string>>();
    for (const [sourceUrl, info] of site.pages) {
      if (sourceUrl === ownKey) continue;
      for (const [code, target] of Object.entries(info.hreflangOut)) {
        if (site.normalize(target) !== ownKey) continue;
        // Codes are compared case-insensitively; 'EN' and 'en' are the same claim.
        const normalizedCode = code.trim().toLowerCase();
        if (!sourcesByCode.has(normalizedCode)) sourcesByCode.set(normalizedCode, new Set());
        sourcesByCode.get(normalizedCode)!.add(sourceUrl);
      }
    }

    // x-default is a fallback, not a language claim - it cannot conflict.
    sourcesByCode.delete('x-default');

    if (sourcesByCode.size === 0) {
      return pass(
        'crawl-hreflang-incoming-conflict',
        'No other crawled page annotates this URL with hreflang',
        { incomingCodes: [] }
      );
    }

    if (sourcesByCode.size === 1) {
      const [code, sources] = Array.from(sourcesByCode.entries())[0];
      return pass(
        'crawl-hreflang-incoming-conflict',
        `Incoming hreflang annotations agree: this URL is "${code}"`,
        {
          incomingCodes: [code],
          sources: Array.from(sources).slice(0, 10),
        }
      );
    }

    const conflicts = Array.from(sourcesByCode.entries()).map(([code, sources]) => ({
      hreflang: code,
      sources: Array.from(sources).slice(0, 5),
    }));

    return fail(
      'crawl-hreflang-incoming-conflict',
      `Other pages annotate this URL with ${sourcesByCode.size} different hreflang codes`,
      {
        conflicts,
        impact:
          'Search engines receive contradictory signals about which language/region version this URL is, and may ignore the hreflang cluster entirely.',
        recommendation:
          'Make every page in the hreflang cluster annotate each member URL with the same single language/region code.',
      }
    );
  },
});
