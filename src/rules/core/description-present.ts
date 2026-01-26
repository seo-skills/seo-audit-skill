import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that a <meta name="description"> tag exists in the document
 */
export const descriptionPresentRule = defineRule({
  id: 'core-description-present',
  name: 'Meta Description Present',
  description: 'Checks that a <meta name="description"> tag exists in the document',
  category: 'core',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const descriptionElement = $('meta[name="description"]');

    if (descriptionElement.length === 0) {
      return fail(
        'core-description-present',
        'No <meta name="description"> tag found in the document',
        { found: false }
      );
    }

    const content = descriptionElement.first().attr('content')?.trim();

    if (!content) {
      return fail(
        'core-description-present',
        'Meta description tag exists but has no content',
        { found: true, empty: true }
      );
    }

    return pass(
      'core-description-present',
      'Meta description tag is present',
      { found: true, description: content }
    );
  },
});
