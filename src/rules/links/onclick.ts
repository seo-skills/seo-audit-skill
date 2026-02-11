import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Patterns in onclick attribute values that indicate client-side navigation.
 * These are not crawlable by search engines.
 */
const NAVIGATION_PATTERNS = [
  'window.location',
  'location.href',
  'location.assign',
  'location.replace',
  'document.location',
];

/**
 * Tests whether an onclick attribute value contains navigation logic.
 */
function containsNavigation(onclick: string): boolean {
  const lower = onclick.toLowerCase();
  return NAVIGATION_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Rule: Check for onclick-based navigation instead of proper href links
 *
 * Using onclick handlers on anchor tags or other elements for page navigation
 * makes those links invisible to search engine crawlers. Crawlers rely on
 * standard href attributes to discover pages. onclick-only navigation results
 * in orphaned pages that cannot be indexed.
 */
export const onclickRule = defineRule({
  id: 'links-onclick',
  name: 'No Onclick Navigation',
  description: 'Checks for elements using onclick handlers for navigation instead of proper href attributes',
  category: 'links',
  weight: 5,
  run: (context: AuditContext) => {
    const { $ } = context;
    const found: Array<{ element: string; onclick: string; text: string }> = [];

    // Check <a> elements with onclick containing navigation patterns
    $('a[onclick]').each((_i, el) => {
      const node = $(el);
      const onclick = node.attr('onclick') || '';
      if (containsNavigation(onclick)) {
        found.push({
          element: 'a',
          onclick: onclick.slice(0, 100),
          text: node.text().trim().slice(0, 80) || '[no text]',
        });
      }
    });

    // Check non-anchor elements that use onclick for navigation
    $('span[onclick], div[onclick], button[onclick]').each((_i, el) => {
      const node = $(el);
      const onclick = node.attr('onclick') || '';
      if (containsNavigation(onclick)) {
        const tag = (el as unknown as { tagName: string }).tagName || 'unknown';
        found.push({
          element: tag,
          onclick: onclick.slice(0, 100),
          text: node.text().trim().slice(0, 80) || '[no text]',
        });
      }
    });

    if (found.length > 0) {
      return fail(
        'links-onclick',
        `Found ${found.length} element(s) using onclick for navigation`,
        {
          onclickNavCount: found.length,
          elements: found.slice(0, 10),
          recommendation:
            'Use proper <a href="..."> links for navigation so search engines can discover and index linked pages',
        }
      );
    }

    return pass(
      'links-onclick',
      'No onclick-based navigation detected',
    );
  },
});
