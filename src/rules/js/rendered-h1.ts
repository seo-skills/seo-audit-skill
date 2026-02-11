import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Rendered H1 Present
 *
 * Checks that an H1 heading exists in the rendered DOM after JavaScript
 * execution. Pages that rely entirely on client-side rendering may not
 * have any H1 visible to search engine crawlers.
 */
export const renderedH1Rule = defineRule({
  id: 'js-rendered-h1',
  name: 'Rendered H1 Present',
  description: 'Checks that an H1 heading exists in the rendered DOM after JavaScript execution',
  category: 'js',
  weight: 8,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-rendered-h1',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const h1Text = rendered$('h1').first().text().trim();

    if (!h1Text) {
      return fail(
        'js-rendered-h1',
        'H1 heading is missing or empty in the rendered DOM after JavaScript execution',
        {
          renderedH1: null,
          recommendation: 'Ensure your JavaScript framework renders an H1 heading element',
        }
      );
    }

    return pass(
      'js-rendered-h1',
      'H1 heading is present in the rendered DOM',
      { renderedH1: h1Text }
    );
  },
});
