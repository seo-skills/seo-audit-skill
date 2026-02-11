import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';
import { compareAttribute } from './utils/compare-dom.js';

/**
 * Rule: Canonical Mismatch Between Raw and Rendered DOM
 *
 * Detects when the canonical URL changes after JavaScript execution.
 * This is a serious issue because search engines may see different canonical
 * URLs depending on whether they execute JavaScript, leading to inconsistent
 * indexing behavior.
 */
export const canonicalMismatchRule = defineRule({
  id: 'js-canonical-mismatch',
  name: 'Canonical Mismatch (Raw vs Rendered)',
  description: 'Checks if the canonical URL differs between raw HTML and rendered DOM',
  category: 'js',
  weight: 10,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-canonical-mismatch',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const comparison = compareAttribute(
      context.$,
      rendered$,
      'link[rel="canonical"]',
      'href'
    );

    if (!comparison) {
      return pass(
        'js-canonical-mismatch',
        'Unable to compare canonical tags'
      );
    }

    // Both missing is not a mismatch (handled by other rules)
    if (!comparison.rawValue && !comparison.renderedValue) {
      return pass(
        'js-canonical-mismatch',
        'Canonical tag not present in either raw or rendered DOM (no mismatch)',
        { rawCanonical: null, renderedCanonical: null }
      );
    }

    if (comparison.differs) {
      return fail(
        'js-canonical-mismatch',
        'Canonical URL changed after JavaScript execution',
        {
          rawCanonical: comparison.rawValue || null,
          renderedCanonical: comparison.renderedValue || null,
          impact: 'Search engines may see different canonical URLs depending on JS execution',
          recommendation: 'Ensure the canonical URL is consistent in both raw HTML and after JS rendering',
        }
      );
    }

    return pass(
      'js-canonical-mismatch',
      'Canonical URL is consistent between raw and rendered DOM',
      {
        rawCanonical: comparison.rawValue,
        renderedCanonical: comparison.renderedValue,
      }
    );
  },
});
