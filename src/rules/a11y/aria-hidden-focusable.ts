import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/** Elements that are keyboard-focusable without needing a tabindex */
const NATIVELY_FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, iframe, [tabindex]';

/**
 * Rule: Check aria-hidden is not applied over focusable content
 *
 * `aria-hidden="true"` removes an element from the accessibility tree but not
 * from the tab order. A focusable descendant therefore becomes reachable by
 * keyboard while being invisible to a screen reader — the user lands on a
 * control that announces nothing.
 */
export const ariaHiddenFocusableRule = defineRule({
  id: 'a11y-aria-hidden-focusable',
  name: 'aria-hidden Not Over Focusable Content',
  description: 'Checks that aria-hidden is not on the body or wrapping focusable elements',
  category: 'a11y',
  weight: 4,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const issues: { problem: string; detail: string }[] = [];

    if ($('body[aria-hidden="true"]').length > 0) {
      issues.push({ problem: 'aria-hidden-body', detail: 'aria-hidden="true" on <body>' });
    }

    $('[aria-hidden="true"]').each((_, el) => {
      const $el = $(el);
      const tag = ((el as { tagName?: string }).tagName ?? '?').toLowerCase();
      if (tag === 'body') return;

      // A negative tabindex on the hidden element itself is the correct fix,
      // so only count descendants that remain reachable.
      const focusable = $el.find(NATIVELY_FOCUSABLE).filter((__, child) => {
        const tabindex = $(child).attr('tabindex');
        return tabindex === undefined || Number(tabindex) >= 0;
      });

      if (focusable.length > 0) {
        issues.push({
          problem: 'focusable-descendant',
          detail: `<${tag}> hides ${focusable.length} focusable element(s)`,
        });
      }
    });

    const details = { url, issues };

    if (issues.length > 0) {
      return fail(
        'a11y-aria-hidden-focusable',
        `${issues.length} aria-hidden problem(s): content is hidden from screen readers but still reachable by keyboard`,
        details
      );
    }

    return pass('a11y-aria-hidden-focusable', 'aria-hidden is not hiding focusable content', details);
  },
});
