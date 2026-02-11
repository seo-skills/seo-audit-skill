import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check for multiple <meta name="description"> elements
 *
 * A document should have at most one meta description. Multiple descriptions
 * confuse search engines, which may select an unintended one or ignore them
 * entirely in favor of auto-generated snippets.
 */
export const multipleDescriptionsRule = defineRule({
  id: 'htmlval-multiple-descriptions',
  name: 'Single Meta Description',
  description: 'Checks that the document contains at most one <meta name="description"> element',
  category: 'htmlval',
  weight: 10,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const descriptions = $('meta[name="description"]');
    const count = descriptions.length;

    if (count <= 1) {
      return pass(
        'htmlval-multiple-descriptions',
        count === 0
          ? 'No meta description found (checked by core-description-present)'
          : 'Document has a single meta description',
        { count }
      );
    }

    const values: string[] = [];
    descriptions.each((_, el) => {
      values.push($(el).attr('content') || '');
    });

    return fail(
      'htmlval-multiple-descriptions',
      `Document has ${count} <meta name="description"> elements. Only one is allowed per document`,
      { count, descriptions: values }
    );
  },
});
