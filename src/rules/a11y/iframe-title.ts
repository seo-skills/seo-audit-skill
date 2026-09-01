import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that frames carry a title
 *
 * A screen reader announces a frame by its title. Without one the user is told
 * only "frame", with no way to decide whether its contents are worth entering.
 */
export const iframeTitleRule = defineRule({
  id: 'a11y-iframe-title',
  name: 'Frame Titles',
  description: 'Checks that <iframe> and <frame> elements have a title attribute',
  category: 'a11y',
  weight: 5,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const untitled: { src: string; hidden: boolean }[] = [];
    let total = 0;

    $('iframe, frame').each((_, el) => {
      const $el = $(el);
      total++;
      // A frame hidden from assistive technology needs no name.
      if ($el.attr('aria-hidden') === 'true') return;
      if ($el.attr('title')?.trim() || $el.attr('aria-label')?.trim()) return;
      if ($el.attr('aria-labelledby')?.trim()) return;

      untitled.push({
        src: $el.attr('src')?.slice(0, 200) ?? '(no src)',
        hidden: $el.attr('hidden') !== undefined,
      });
    });

    const details = { url, total, untitled };

    if (total === 0) {
      return pass('a11y-iframe-title', 'No frames on the page', details);
    }

    if (untitled.length > 0) {
      return fail(
        'a11y-iframe-title',
        `${untitled.length} of ${total} frame(s) have no title`,
        details
      );
    }

    return pass('a11y-iframe-title', `All ${total} frame(s) have a title`, details);
  },
});
