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
  weight: 1,
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
