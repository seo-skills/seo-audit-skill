import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Normalize text for comparison: lowercase, collapse whitespace, trim
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Rule: Check if title tag and H1 are identical
 *
 * While it is acceptable for the title and H1 to be similar, having them
 * exactly identical misses an opportunity to target additional keywords
 * and provide SERP variety. A distinct title and H1 helps search engines
 * understand the page better and can improve click-through rates.
 */
export const titleSameAsH1Rule = defineRule({
  id: 'content-title-same-as-h1',
  name: 'Title Same as H1',
  description:
    'Checks if the title tag and H1 heading are identical (should differ for keyword variety)',
  category: 'content',
  weight: 6,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const title = $('title').text().trim();
    const h1 = $('h1').first().text().trim();

    // If either is missing, this rule is not applicable (other rules handle those)
    if (!title || !h1) {
      return pass(
        'content-title-same-as-h1',
        'Title or H1 is missing (handled by other rules)',
        {
          title: title || null,
          h1: h1 || null,
          reason: 'skipped',
        }
      );
    }

    const normalizedTitle = normalizeText(title);
    const normalizedH1 = normalizeText(h1);

    if (normalizedTitle === normalizedH1) {
      return warn(
        'content-title-same-as-h1',
        'Title tag and H1 heading are identical',
        {
          title,
          h1,
          normalizedTitle,
          normalizedH1,
          impact:
            'Identical title and H1 miss an opportunity for keyword variety in SERPs',
          recommendation:
            'Differentiate the title from the H1. For example, add your brand name to the title or use a slightly different phrasing to target additional keywords.',
        }
      );
    }

    return pass(
      'content-title-same-as-h1',
      'Title tag and H1 heading are different',
      {
        title,
        h1,
        normalizedTitle,
        normalizedH1,
      }
    );
  },
});
