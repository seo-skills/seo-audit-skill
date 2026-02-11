import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Rendered Content Check
 *
 * Checks if significant page content is only present after JavaScript rendering.
 * Pages that rely heavily on client-side rendering may not be properly indexed
 * by search engines that do not execute JavaScript or have delayed rendering.
 */
export const renderedContentRule = defineRule({
  id: 'js-rendered-content',
  name: 'Rendered Content Dependency',
  description: 'Checks if significant content is only present after JavaScript rendering',
  category: 'js',
  weight: 8,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-rendered-content',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const rawLen = context.$('body').text().trim().length;
    const renderedLen = rendered$('body').text().trim().length;

    const details = {
      rawContentLength: rawLen,
      renderedContentLength: renderedLen,
      ratio: rawLen > 0 ? (renderedLen / rawLen).toFixed(2) : 'N/A',
    };

    // Page is essentially empty without JS but has content after rendering
    if (rawLen < 100 && renderedLen > 500) {
      return fail(
        'js-rendered-content',
        'Page is essentially empty without JavaScript; all content is client-side rendered',
        {
          ...details,
          impact: 'Search engines that do not execute JavaScript will see an empty page',
          recommendation: 'Implement server-side rendering (SSR) or static generation to include content in raw HTML',
        }
      );
    }

    // Most content is JS-rendered
    if (renderedLen > rawLen * 3) {
      return warn(
        'js-rendered-content',
        'Most page content is injected by JavaScript; raw HTML has significantly less content',
        {
          ...details,
          impact: 'Search engines may not index all content if JavaScript rendering is delayed or fails',
          recommendation: 'Consider server-side rendering for critical content to ensure indexability',
        }
      );
    }

    return pass(
      'js-rendered-content',
      'Page content is mostly present in raw HTML',
      details
    );
  },
});
