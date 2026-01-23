import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that an og:description meta tag exists in the document
 */
export const ogDescriptionRule = defineRule({
  id: 'social-og-description',
  name: 'Open Graph Description',
  description: 'Checks that a <meta property="og:description"> tag exists in the document',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const ogDescElement = $('meta[property="og:description"]');

    if (ogDescElement.length === 0) {
      return fail(
        'social-og-description',
        'No <meta property="og:description"> tag found in the document',
        { found: false }
      );
    }

    const content = ogDescElement.first().attr('content')?.trim();

    if (!content) {
      return fail(
        'social-og-description',
        'Open Graph description tag exists but has no content',
        { found: true, empty: true }
      );
    }

    return pass(
      'social-og-description',
      'Open Graph description tag is present',
      { found: true, ogDescription: content }
    );
  },
});
