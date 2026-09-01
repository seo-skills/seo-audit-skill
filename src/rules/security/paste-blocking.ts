import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/** Handler bodies that cancel the paste rather than observe it */
const BLOCKING_PATTERN = /return\s+false|preventDefault/i;

/**
 * Rule: Check that inputs do not block pasting
 *
 * Blocking paste breaks password managers, which pushes people toward weaker,
 * typeable passwords — so the practice makes the form less secure, not more.
 */
export const pasteBlockingRule = defineRule({
  id: 'security-paste-blocking',
  name: 'Inputs Allow Pasting',
  description: 'Checks that input fields do not prevent pasting',
  category: 'security',
  weight: 2,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const blocked: { tag: string; type?: string; name?: string; handler: string }[] = [];

    $('input[onpaste], textarea[onpaste]').each((_, el) => {
      const $el = $(el);
      const handler = $el.attr('onpaste') ?? '';
      if (!BLOCKING_PATTERN.test(handler)) return;

      blocked.push({
        tag: (el as { tagName?: string }).tagName ?? 'input',
        ...($el.attr('type') && { type: $el.attr('type') }),
        ...($el.attr('name') && { name: $el.attr('name') }),
        handler: handler.slice(0, 120),
      });
    });

    const details = { url, blocked };

    if (blocked.length > 0) {
      const passwordFields = blocked.filter((b) => b.type === 'password').length;
      return fail(
        'security-paste-blocking',
        `${blocked.length} input(s) block pasting${
          passwordFields > 0 ? `, including ${passwordFields} password field(s)` : ''
        }. This breaks password managers and encourages weaker passwords.`,
        details
      );
    }

    return pass('security-paste-blocking', 'No inputs block pasting', details);
  },
});
