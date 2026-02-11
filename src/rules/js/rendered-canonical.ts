import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Rendered Canonical Present
 *
 * Checks that a canonical link tag exists in the rendered DOM after JavaScript
 * execution. If the canonical is only injected by JavaScript and rendering fails,
 * search engines may not discover the preferred URL for the page.
 */
export const renderedCanonicalRule = defineRule({
  id: 'js-rendered-canonical',
  name: 'Rendered Canonical Present',
  description: 'Checks that a canonical link tag exists in the rendered DOM after JavaScript execution',
  category: 'js',
  weight: 8,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-rendered-canonical',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const canonicalHref = rendered$('link[rel="canonical"]').attr('href')?.trim();

    if (!canonicalHref) {
      return fail(
        'js-rendered-canonical',
        'Canonical link tag is missing in the rendered DOM after JavaScript execution',
        {
          renderedCanonical: null,
          recommendation: 'Ensure your JavaScript framework injects <link rel="canonical"> during rendering',
        }
      );
    }

    return pass(
      'js-rendered-canonical',
      'Canonical link tag is present in the rendered DOM',
      { renderedCanonical: canonicalHref }
    );
  },
});
