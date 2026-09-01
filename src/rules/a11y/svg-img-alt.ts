import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that SVGs exposed as images have a text alternative
 *
 * An inline <svg> given role="img" is announced as an image, so it needs a name
 * the same way <img> needs alt. Without one it is announced as an unlabelled
 * graphic.
 */
export const svgImgAltRule = defineRule({
  id: 'a11y-svg-img-alt',
  name: 'SVG Image Alt Text',
  description: 'Checks that SVGs with an img role have an accessible name',
  category: 'a11y',
  weight: 3,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const missing: { role: string; classes: string }[] = [];
    let total = 0;

    $('svg[role="img"], svg[role="graphics-document"], svg[role="graphics-symbol"]').each(
      (_, el) => {
        const $el = $(el);
        total++;
        if ($el.attr('aria-hidden') === 'true') return;
        if ($el.attr('aria-label')?.trim() || $el.attr('aria-labelledby')?.trim()) return;
        // <title> as the first child is the SVG-native way to name a graphic.
        if ($el.find('title').first().text().trim()) return;

        missing.push({
          role: $el.attr('role') ?? 'img',
          classes: $el.attr('class')?.slice(0, 80) ?? '(no class)',
        });
      }
    );

    const details = { url, total, missing };

    if (total === 0) {
      return pass('a11y-svg-img-alt', 'No SVGs with an image role on the page', details);
    }

    if (missing.length > 0) {
      return fail(
        'a11y-svg-img-alt',
        `${missing.length} of ${total} SVG image(s) have no accessible name`,
        details
      );
    }

    return pass('a11y-svg-img-alt', `All ${total} SVG image(s) have accessible names`, details);
  },
});
