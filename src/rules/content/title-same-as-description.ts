import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

// Reference hint: on-page/title-and-meta-description-are-the-same

/**
 * Normalize text for comparison: lowercase, collapse whitespace, trim
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Rule: Check if the title tag and meta description are identical
 *
 * The title and meta description serve different purposes in search results:
 * the title is the headline, the description the supporting snippet. Identical
 * text wastes the opportunity to give searchers more information and weakens
 * the snippet search engines can build for the page.
 */
export const titleSameAsDescriptionRule = defineRule({
  id: 'content-title-same-as-description',
  name: 'Title Same as Meta Description',
  description:
    'Checks if the title tag and meta description contain identical text (they should differ)',
  category: 'content',
  weight: 4,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const title = $('title').first().text().trim();
    const description = ($('meta[name="description"]').attr('content') || '').trim();

    // If either is missing, this rule is not applicable (other rules handle those)
    if (!title || !description) {
      return pass(
        'content-title-same-as-description',
        'Title or meta description is missing (handled by other rules)',
        {
          title: title || null,
          description: description || null,
          reason: 'skipped',
        }
      );
    }

    if (normalizeText(title) === normalizeText(description)) {
      return warn(
        'content-title-same-as-description',
        'Title tag and meta description are identical',
        {
          title,
          description,
          impact:
            'Identical title and description waste the SERP snippet and give searchers no additional context',
          recommendation:
            'Write a distinct meta description that expands on the title and encourages clicks from search results',
        }
      );
    }

    return pass(
      'content-title-same-as-description',
      'Title tag and meta description are different',
      { title, description }
    );
  },
});
