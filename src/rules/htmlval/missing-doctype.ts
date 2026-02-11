import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that the HTML document begins with a DOCTYPE declaration
 *
 * A missing DOCTYPE causes browsers to render in quirks mode, which can
 * lead to inconsistent rendering and unexpected layout behavior.
 */
export const missingDoctypeRule = defineRule({
  id: 'htmlval-missing-doctype',
  name: 'DOCTYPE Declaration',
  description: 'Checks that the HTML document starts with a <!DOCTYPE> declaration',
  category: 'htmlval',
  weight: 15,
  run: async (context: AuditContext) => {
    const trimmed = context.html.trimStart();
    const hasDoctypeRegex = /^<!doctype\s/i;

    if (hasDoctypeRegex.test(trimmed)) {
      return pass(
        'htmlval-missing-doctype',
        'DOCTYPE declaration is present'
      );
    }

    return fail(
      'htmlval-missing-doctype',
      'Missing DOCTYPE declaration. Add <!DOCTYPE html> at the beginning of the document',
      { found: false }
    );
  },
});
