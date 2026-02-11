import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Common root element selectors used by client-side rendering frameworks.
 */
const CSR_ROOT_SELECTORS = ['#root', '#app', '#__next', '#__nuxt', '#__svelte'];

/**
 * Patterns in <noscript> content that indicate JS-only rendering.
 */
const NOSCRIPT_JS_PATTERNS = [
  /enable\s+javascript/i,
  /javascript\s+is\s+required/i,
  /you\s+need\s+to\s+enable\s+javascript/i,
  /this\s+app\s+requires\s+javascript/i,
  /please\s+enable\s+javascript/i,
  /javascript\s+must\s+be\s+enabled/i,
  /requires\s+javascript/i,
];

/**
 * Rule: SSR Check
 *
 * Checks if the page uses server-side rendering (SSR) or relies entirely
 * on client-side rendering (CSR). Client-side only pages may not be
 * indexed properly by search engines, especially if JavaScript rendering
 * is delayed or fails.
 */
export const ssrCheckRule = defineRule({
  id: 'js-ssr-check',
  name: 'Server-Side Rendering Check',
  description: 'Checks if the page uses SSR or relies on client-side rendering only',
  category: 'js',
  weight: 10,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const bodyText = $('body').text().trim();
    const bodyTextLength = bodyText.length;

    // Check for CSR root elements
    let hasEmptyRoot = false;
    let rootSelector: string | null = null;

    for (const selector of CSR_ROOT_SELECTORS) {
      const el = $(selector);
      if (el.length > 0) {
        const rootText = el.text().trim();
        const rootChildren = el.children().length;
        // Consider "empty" if the root has very little text and few children
        if (rootText.length < 50 && rootChildren <= 2) {
          hasEmptyRoot = true;
          rootSelector = selector;
          break;
        }
      }
    }

    // Check for noscript messages indicating JS requirement
    let hasJsRequiredNoscript = false;
    let noscriptMessage: string | null = null;

    $('noscript').each((_, el) => {
      const text = $(el).text().trim();
      for (const pattern of NOSCRIPT_JS_PATTERNS) {
        if (pattern.test(text)) {
          hasJsRequiredNoscript = true;
          noscriptMessage = text.slice(0, 200);
          return false; // break .each()
        }
      }
    });

    // Count script tags for context
    const scriptCount = $('script').length;

    const details: Record<string, unknown> = {
      bodyTextLength,
      hasEmptyRoot,
      rootSelector,
      hasJsRequiredNoscript,
      scriptCount,
    };

    // Client-side only: empty root div, very little content, JS-required noscript
    if (bodyTextLength < 200 && hasEmptyRoot) {
      return fail(
        'js-ssr-check',
        'Page appears to be client-side rendered only: empty root element with minimal HTML content',
        {
          ...details,
          ...(noscriptMessage && { noscriptMessage }),
          impact: 'Search engines may see an empty page if JavaScript execution fails or is delayed',
          recommendation: 'Implement server-side rendering (SSR) or static site generation (SSG) to include content in initial HTML',
        }
      );
    }

    // Warning: signs of CSR dependency
    if (hasEmptyRoot && bodyTextLength < 500) {
      return warn(
        'js-ssr-check',
        'Page may rely on client-side rendering: root element has minimal content',
        {
          ...details,
          ...(noscriptMessage && { noscriptMessage }),
          recommendation: 'Consider implementing SSR to ensure content is available in the initial HTML response',
        }
      );
    }

    if (hasJsRequiredNoscript && bodyTextLength < 500) {
      return warn(
        'js-ssr-check',
        'Page indicates JavaScript is required and has minimal HTML content',
        {
          ...details,
          noscriptMessage,
          recommendation: 'Implement SSR so search engines can access content without JavaScript',
        }
      );
    }

    return pass(
      'js-ssr-check',
      'Page appears to be server-side rendered with content in the initial HTML',
      details
    );
  },
});
