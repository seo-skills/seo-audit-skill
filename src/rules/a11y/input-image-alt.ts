import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that image buttons have alt text
 *
 * `<input type="image">` is a submit button drawn as a picture. With no alt
 * text a screen reader announces only "button", leaving no clue what submitting
 * the form will do.
 */
export const inputImageAltRule = defineRule({
  id: 'a11y-input-image-alt',
  name: 'Image Button Alt Text',
  description: 'Checks that <input type="image"> elements have alt text',
  category: 'a11y',
  weight: 4,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const missing: { src: string; name: string }[] = [];
    let total = 0;

    $('input[type="image"]').each((_, el) => {
      const $el = $(el);
      total++;
      if ($el.attr('alt')?.trim()) return;
      if ($el.attr('aria-label')?.trim() || $el.attr('aria-labelledby')?.trim()) return;
      if ($el.attr('title')?.trim()) return;

      missing.push({
        src: $el.attr('src')?.slice(0, 200) ?? '(no src)',
        name: $el.attr('name') ?? '(unnamed)',
      });
    });

    const details = { url, total, missing };

    if (total === 0) {
      return pass('a11y-input-image-alt', 'No image buttons on the page', details);
    }

    if (missing.length > 0) {
      return fail(
        'a11y-input-image-alt',
        `${missing.length} of ${total} image button(s) have no alt text`,
        details
      );
    }

    return pass('a11y-input-image-alt', `All ${total} image button(s) have alt text`, details);
  },
});
