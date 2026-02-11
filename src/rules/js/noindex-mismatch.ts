import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Check if a Cheerio instance has a noindex robots directive.
 */
function hasNoindex($: any): boolean {
  const robotsContent = $('meta[name="robots"]').attr('content') || '';
  return /noindex/i.test(robotsContent);
}

/**
 * Rule: Noindex Mismatch Between Raw and Rendered DOM
 *
 * Detects when the noindex directive changes after JavaScript execution.
 * This is extremely dangerous: JavaScript could accidentally add or remove
 * noindex, causing pages to be hidden from or exposed to search engines
 * depending on whether the crawler executes JavaScript.
 */
export const noindexMismatchRule = defineRule({
  id: 'js-noindex-mismatch',
  name: 'Noindex Mismatch (Raw vs Rendered)',
  description: 'Checks if the noindex directive changes between raw HTML and rendered DOM',
  category: 'js',
  weight: 10,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-noindex-mismatch',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const rawHasNoindex = hasNoindex(context.$);
    const renderedHasNoindex = hasNoindex(rendered$);

    if (rawHasNoindex !== renderedHasNoindex) {
      const direction = rawHasNoindex
        ? 'JavaScript removed the noindex directive (page becomes indexable after JS)'
        : 'JavaScript added a noindex directive (page becomes hidden after JS)';

      return fail(
        'js-noindex-mismatch',
        `Noindex status changed after JavaScript execution: ${direction}`,
        {
          rawHasNoindex,
          renderedHasNoindex,
          direction,
          impact: 'Search engines may index or de-index the page inconsistently depending on JS execution',
          recommendation: 'Set noindex directives in server-side HTML, not via client-side JavaScript',
        }
      );
    }

    return pass(
      'js-noindex-mismatch',
      'Noindex status is consistent between raw and rendered DOM',
      { rawHasNoindex, renderedHasNoindex }
    );
  },
});
