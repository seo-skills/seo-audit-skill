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
  // Raised from 1 in 5.0.0. Every core presence check sat at the bottom of a
  // scale running to 25, so a page missing this lost a single weight-point
  // while canonical edge cases passed vacuously at 6-8. A blank document
  // scored 84/100. Drives click-through from the SERP rather than ranking directly, so a tier
  // below title.
  weight: 15,
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
