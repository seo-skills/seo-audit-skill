import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that a <title> tag exists in the document
 */
export const titlePresentRule = defineRule({
  id: 'core-title-present',
  name: 'Title Tag Present',
  description: 'Checks that a <title> tag exists in the document head',
  category: 'core',
  // Raised from 1 in 5.0.0. Every core presence check sat at the bottom of a
  // scale running to 25, so a page missing this lost a single weight-point
  // while canonical edge cases passed vacuously at 6-8. A blank document
  // scored 84/100. The single most important on-page element. Matches schema-present, the
  // heaviest presence check in the product.
  weight: 25,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const titleElement = $('title');

    if (titleElement.length === 0) {
      return fail(
        'core-title-present',
        'No <title> tag found in the document',
        { found: false }
      );
    }

    const titleText = titleElement.first().text().trim();

    if (!titleText) {
      return fail(
        'core-title-present',
        'Title tag exists but is empty',
        { found: true, empty: true }
      );
    }

    return pass(
      'core-title-present',
      'Title tag is present',
      { found: true, title: titleText }
    );
  },
});
