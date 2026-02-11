import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Rendered Title Present
 *
 * Checks that a <title> tag exists and has content in the rendered DOM
 * after JavaScript execution. Pages using client-side rendering frameworks
 * may fail to inject the title, leaving search engines with no title to index.
 */
export const renderedTitleRule = defineRule({
  id: 'js-rendered-title',
  name: 'Rendered Title Present',
  description: 'Checks that a <title> tag exists in the rendered DOM after JavaScript execution',
  category: 'js',
  weight: 10,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-rendered-title',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const titleText = rendered$('title').text().trim();

    if (!titleText) {
      return fail(
        'js-rendered-title',
        'Title tag is missing or empty in the rendered DOM after JavaScript execution',
        {
          renderedTitle: titleText || null,
          recommendation: 'Ensure your JavaScript framework injects the <title> tag during rendering',
        }
      );
    }

    return pass(
      'js-rendered-title',
      'Title tag is present in the rendered DOM',
      { renderedTitle: titleText }
    );
  },
});
