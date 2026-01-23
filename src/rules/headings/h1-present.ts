import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that at least one <h1> tag exists in the document
 */
export const h1PresentRule = defineRule({
  id: 'headings-h1-present',
  name: 'H1 Tag Present',
  description: 'Checks that at least one <h1> tag exists in the document',
  category: 'headings',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const h1Elements = $('h1');

    if (h1Elements.length === 0) {
      return fail(
        'headings-h1-present',
        'No <h1> tag found in the document',
        { found: false, count: 0 }
      );
    }

    const h1Text = h1Elements.first().text().trim();

    if (!h1Text) {
      return fail(
        'headings-h1-present',
        'H1 tag exists but is empty',
        { found: true, empty: true, count: h1Elements.length }
      );
    }

    return pass(
      'headings-h1-present',
      'H1 tag is present',
      { found: true, count: h1Elements.length, text: h1Text }
    );
  },
});
