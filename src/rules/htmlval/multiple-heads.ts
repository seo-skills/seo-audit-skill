import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that the document has only one <head> element
 *
 * Multiple <head> elements result in invalid HTML. Browsers will ignore
 * the contents of subsequent <head> tags, causing meta tags, stylesheets,
 * and other head-level resources to be missed.
 */
export const multipleHeadsRule = defineRule({
  id: 'htmlval-multiple-heads',
  name: 'Single Head Element',
  description: 'Checks that the document contains only one <head> element',
  category: 'htmlval',
  weight: 10,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const headCount = $('head').length;

    if (headCount <= 1) {
      return pass(
        'htmlval-multiple-heads',
        'Document has a single <head> element',
        { count: headCount }
      );
    }

    return fail(
      'htmlval-multiple-heads',
      `Document has ${headCount} <head> elements. Only one <head> is allowed per document`,
      { count: headCount }
    );
  },
});
