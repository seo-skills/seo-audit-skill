import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/** Compare on words only: case, punctuation and spacing are not meaningful */
function words(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Rule: Check accessible names contain their visible label
 *
 * Speech-recognition users say what they see: "click Submit". If the visible
 * text is "Submit" but aria-label is "Send form", the command matches nothing
 * and the control cannot be operated by voice.
 */
export const labelNameMismatchRule = defineRule({
  id: 'a11y-label-name-mismatch',
  name: 'Accessible Name Matches Visible Label',
  description: 'Checks that aria-label text contains the element visible text',
  category: 'a11y',
  weight: 3,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const mismatched: { tag: string; visible: string; accessible: string }[] = [];

    $('button[aria-label], a[href][aria-label], [role="button"][aria-label]').each((_, el) => {
      const $el = $(el);
      const visible = $el.text().trim();
      const accessible = $el.attr('aria-label')?.trim();
      if (!visible || !accessible) return;

      const visibleWords = words(visible);
      const accessibleWords = words(accessible);
      if (!visibleWords) return;

      // The name may add context ("Search products" for "Search"), so it only
      // has to contain the visible text, not equal it.
      if (accessibleWords.includes(visibleWords)) return;

      mismatched.push({
        tag: ((el as { tagName?: string }).tagName ?? '?').toLowerCase(),
        visible: visible.slice(0, 60),
        accessible: accessible.slice(0, 60),
      });
    });

    const details = { url, mismatched };

    if (mismatched.length > 0) {
      return warn(
        'a11y-label-name-mismatch',
        `${mismatched.length} control(s) have an accessible name that omits their visible text, breaking voice control`,
        details
      );
    }

    return pass('a11y-label-name-mismatch', 'Accessible names contain their visible labels', details);
  },
});
