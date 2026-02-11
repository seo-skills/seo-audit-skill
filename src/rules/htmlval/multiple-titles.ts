import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check for multiple <title> elements
 *
 * A document should have at most one <title> element. Multiple titles cause
 * confusion for search engines and browsers, which may pick an unexpected
 * title for display in search results and browser tabs.
 */
export const multipleTitlesRule = defineRule({
  id: 'htmlval-multiple-titles',
  name: 'Single Title Element',
  description: 'Checks that the document contains at most one <title> element',
  category: 'htmlval',
  weight: 12,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const titleCount = $('title').length;

    if (titleCount <= 1) {
      return pass(
        'htmlval-multiple-titles',
        titleCount === 0
          ? 'No <title> element found (checked by core-title-present)'
          : 'Document has a single <title> element',
        { count: titleCount }
      );
    }

    const titles: string[] = [];
    $('title').each((_, el) => {
      titles.push($(el).text().trim());
    });

    return fail(
      'htmlval-multiple-titles',
      `Document has ${titleCount} <title> elements. Only one <title> is allowed per document`,
      { count: titleCount, titles }
    );
  },
});
