import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that an og:title meta tag exists in the document
 */
export const ogTitleRule = defineRule({
  id: 'social-og-title',
  name: 'Open Graph Title',
  description: 'Checks that a <meta property="og:title"> tag exists in the document',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const ogTitleElement = $('meta[property="og:title"]');

    if (ogTitleElement.length === 0) {
      return fail(
        'social-og-title',
        'No <meta property="og:title"> tag found in the document',
        { found: false }
      );
    }

    const content = ogTitleElement.first().attr('content')?.trim();

    if (!content) {
      return fail(
        'social-og-title',
        'Open Graph title tag exists but has no content',
        { found: true, empty: true }
      );
    }

    return pass(
      'social-og-title',
      'Open Graph title tag is present',
      { found: true, ogTitle: content }
    );
  },
});
