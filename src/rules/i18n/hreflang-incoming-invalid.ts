import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';

// Reference hint: international/invalid-incoming-hreflang-annotations

/**
 * Same code shape `i18n-hreflang` enforces on outgoing annotations
 * (`/^[a-z]{2}(-[A-Z]{2})?$/`), applied case-insensitively because the crawl
 * records codes verbatim from the source pages' markup.
 */
const HREFLANG_CODE_PATTERN = /^[a-z]{2}(-[a-z]{2})?$/i;

/**
 * Rule: Invalid Incoming Hreflang Annotations
 *
 * The incoming counterpart to `i18n-hreflang`'s outgoing validation: other
 * crawled pages that point hreflang annotations AT this URL must use valid
 * language/region codes. An invalid code (unknown language, malformed
 * region, stray separators) makes the annotation unusable, so this page
 * loses the cluster membership the source page tried to declare.
 *
 * The page's own annotations are excluded — those are the outgoing side,
 * already validated from the HTML by `i18n-hreflang`. x-default is a valid
 * value and never flagged. (Entries whose href could not be resolved at all
 * never reach the crawl record; `i18n-hreflang-to-broken` reports those.)
 *
 * Requires the per-page hreflang records, so it runs in crawl mode only.
 */
export const hreflangIncomingInvalidRule = defineRule({
  id: 'i18n-hreflang-incoming-invalid',
  name: 'Invalid Incoming Hreflang Annotations',
  description:
    'Checks that hreflang annotations from other crawled pages targeting this URL use valid language/region codes',
  category: 'i18n',
  weight: 8,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(
        'i18n-hreflang-incoming-invalid',
        'Validating incoming hreflang annotations needs per-page crawl state - run with --crawl to build it'
      );
    }

    const ownKey = site.normalize(context.url);

    const invalid: Array<{ source: string; hreflang: string }> = [];
    let incomingCount = 0;
    for (const [sourceUrl, info] of site.pages) {
      if (sourceUrl === ownKey) continue;
      for (const [code, target] of Object.entries(info.hreflangOut)) {
        if (site.normalize(target) !== ownKey) continue;
        incomingCount++;
        if (code.trim().toLowerCase() === 'x-default') continue;
        if (!HREFLANG_CODE_PATTERN.test(code.trim())) {
          invalid.push({ source: sourceUrl, hreflang: code });
        }
      }
    }

    if (invalid.length > 0) {
      return fail(
        'i18n-hreflang-incoming-invalid',
        `${invalid.length} incoming hreflang annotation(s) use invalid language/region codes`,
        {
          invalid: invalid.slice(0, 10),
          incomingCount,
          impact:
            'Annotations with invalid codes are ignored by search engines, so this page loses the declared cluster membership.',
          recommendation:
            'Fix the annotations on the source pages to use valid ISO 639-1 language codes with optional ISO 3166-1 Alpha-2 region codes (e.g. "en", "en-GB").',
        }
      );
    }

    return pass(
      'i18n-hreflang-incoming-invalid',
      incomingCount === 0
        ? 'No other crawled page annotates this URL with hreflang'
        : 'All incoming hreflang annotations use valid codes',
      { incomingCount }
    );
  },
});
