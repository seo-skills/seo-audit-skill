import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { compareDomElement } from './utils/compare-dom.js';

/**
 * Rule: Title Modified by JavaScript
 *
 * Detects when the <title> tag content is changed by JavaScript.
 * Search engines primarily use the title from the raw HTML source.
 * If JavaScript modifies the title, search engines may display the
 * original title rather than the JS-modified version.
 */
export const titleModifiedRule = defineRule({
  id: 'js-title-modified',
  name: 'Title Modified by JavaScript',
  description: 'Checks if the page title is modified by JavaScript execution',
  category: 'js',
  weight: 8,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-title-modified',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const comparison = compareDomElement(context.$, rendered$, 'title');

    if (!comparison) {
      return pass(
        'js-title-modified',
        'Unable to compare title elements'
      );
    }

    // Both empty is not a modification issue (handled by other rules)
    if (!comparison.rawText && !comparison.renderedText) {
      return pass(
        'js-title-modified',
        'Title is not present in either raw or rendered DOM (no modification detected)',
        { rawTitle: null, renderedTitle: null }
      );
    }

    if (comparison.differs) {
      return warn(
        'js-title-modified',
        'Title was modified by JavaScript execution',
        {
          rawTitle: comparison.rawText || null,
          renderedTitle: comparison.renderedText || null,
          impact: 'Search engines primarily use the raw HTML title; the JS-modified title may not be indexed',
          recommendation: 'Set the correct title in server-side HTML rather than modifying it with JavaScript',
        }
      );
    }

    return pass(
      'js-title-modified',
      'Title is unchanged after JavaScript execution',
      {
        rawTitle: comparison.rawText,
        renderedTitle: comparison.renderedText,
      }
    );
  },
});
