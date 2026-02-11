import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { compareAttribute } from './utils/compare-dom.js';

/**
 * Rule: Meta Description Modified by JavaScript
 *
 * Detects when the meta description content attribute is changed by JavaScript.
 * Search engines may use the raw HTML description for snippets. If JavaScript
 * modifies it, the displayed snippet may not match what was intended.
 */
export const descriptionModifiedRule = defineRule({
  id: 'js-description-modified',
  name: 'Meta Description Modified by JavaScript',
  description: 'Checks if the meta description is modified by JavaScript execution',
  category: 'js',
  weight: 7,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-description-modified',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const comparison = compareAttribute(
      context.$,
      rendered$,
      'meta[name="description"]',
      'content'
    );

    if (!comparison) {
      return pass(
        'js-description-modified',
        'Unable to compare meta description elements'
      );
    }

    // Both missing is not a modification issue (handled by other rules)
    if (!comparison.rawValue && !comparison.renderedValue) {
      return pass(
        'js-description-modified',
        'Meta description is not present in either raw or rendered DOM (no modification detected)',
        { rawDescription: null, renderedDescription: null }
      );
    }

    if (comparison.differs) {
      return warn(
        'js-description-modified',
        'Meta description was modified by JavaScript execution',
        {
          rawDescription: comparison.rawValue || null,
          renderedDescription: comparison.renderedValue || null,
          impact: 'Search engines may use the raw HTML description for search result snippets',
          recommendation: 'Set the correct meta description in server-side HTML rather than modifying it with JavaScript',
        }
      );
    }

    return pass(
      'js-description-modified',
      'Meta description is unchanged after JavaScript execution',
      {
        rawDescription: comparison.rawValue,
        renderedDescription: comparison.renderedValue,
      }
    );
  },
});
