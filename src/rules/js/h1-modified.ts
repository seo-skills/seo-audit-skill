import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { compareDomElement } from './utils/compare-dom.js';

/**
 * Rule: H1 Modified by JavaScript
 *
 * Detects when the H1 heading content is changed by JavaScript.
 * Search engines use the H1 from raw HTML to understand page topic.
 * If JavaScript modifies the H1, the indexed heading may differ from
 * what users see in the browser.
 */
export const h1ModifiedRule = defineRule({
  id: 'js-h1-modified',
  name: 'H1 Modified by JavaScript',
  description: 'Checks if the H1 heading is modified by JavaScript execution',
  category: 'js',
  weight: 7,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-h1-modified',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const comparison = compareDomElement(context.$, rendered$, 'h1');

    if (!comparison) {
      return pass(
        'js-h1-modified',
        'Unable to compare H1 elements'
      );
    }

    // Both empty is not a modification issue (handled by other rules)
    if (!comparison.rawText && !comparison.renderedText) {
      return pass(
        'js-h1-modified',
        'H1 is not present in either raw or rendered DOM (no modification detected)',
        { rawH1: null, renderedH1: null }
      );
    }

    if (comparison.differs) {
      return warn(
        'js-h1-modified',
        'H1 heading was modified by JavaScript execution',
        {
          rawH1: comparison.rawText || null,
          renderedH1: comparison.renderedText || null,
          impact: 'Search engines may index the raw HTML H1; the JS-modified heading may not be used',
          recommendation: 'Set the correct H1 heading in server-side HTML rather than modifying it with JavaScript',
        }
      );
    }

    return pass(
      'js-h1-modified',
      'H1 heading is unchanged after JavaScript execution',
      {
        rawH1: comparison.rawText,
        renderedH1: comparison.renderedText,
      }
    );
  },
});
