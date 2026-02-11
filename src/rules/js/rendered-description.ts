import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Rendered Meta Description Present
 *
 * Checks that a meta description tag exists in the rendered DOM after
 * JavaScript execution. Client-side rendering frameworks may fail to inject
 * the meta description, leaving search engines without a description to display.
 */
export const renderedDescriptionRule = defineRule({
  id: 'js-rendered-description',
  name: 'Rendered Meta Description Present',
  description: 'Checks that a meta description exists in the rendered DOM after JavaScript execution',
  category: 'js',
  weight: 8,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-rendered-description',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const description = rendered$('meta[name="description"]').attr('content')?.trim();

    if (!description) {
      return fail(
        'js-rendered-description',
        'Meta description is missing in the rendered DOM after JavaScript execution',
        {
          renderedDescription: null,
          recommendation: 'Ensure your JavaScript framework injects <meta name="description"> during rendering',
        }
      );
    }

    return pass(
      'js-rendered-description',
      'Meta description is present in the rendered DOM',
      { renderedDescription: description }
    );
  },
});
