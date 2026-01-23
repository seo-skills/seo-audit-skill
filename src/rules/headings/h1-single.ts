import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Check that only one <h1> tag exists in the document
 */
export const h1SingleRule = defineRule({
  id: 'headings-h1-single',
  name: 'Single H1 Tag',
  description: 'Checks that only one <h1> tag exists in the document',
  category: 'headings',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const h1Elements = $('h1');
    const count = h1Elements.length;

    if (count === 0) {
      return fail(
        'headings-h1-single',
        'No <h1> tag found in the document',
        { count: 0 }
      );
    }

    if (count > 1) {
      const h1Texts: string[] = [];
      h1Elements.each((_, el) => {
        h1Texts.push($(el).text().trim());
      });

      return warn(
        'headings-h1-single',
        `Multiple <h1> tags found (${count}). Best practice is to have only one <h1> per page`,
        { count, texts: h1Texts }
      );
    }

    return pass(
      'headings-h1-single',
      'Document has exactly one <h1> tag',
      { count: 1, text: h1Elements.first().text().trim() }
    );
  },
});
