import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/** Whether a button-like element has an accessible name. */
export function hasName($: CheerioAPI, el: Element): boolean {
  const node = $(el);
  if (node.attr('aria-label')?.trim()) return true;
  if (node.attr('aria-labelledby')?.trim()) return true;
  if (node.attr('title')?.trim()) return true;
  if (node.text().replace(/\s+/g, ' ').trim()) return true;
  const alt = node.find('img[alt]').toArray().some((img) => !!$(img).attr('alt')?.trim());
  return alt;
}

/**
 * Rule: Button accessible name
 *
 * A button whose only content is an icon has no name for a screen reader.
 * Form labels cover text inputs and selects; they skip button elements.
 */
export const buttonNameRule = defineRule({
  id: 'a11y-button-name',
  name: 'Button Accessible Name',
  description: 'Checks that buttons and role=button controls have an accessible name',
  category: 'a11y',
  weight: 6,
  run: (context: AuditContext) => {
    const { $ } = context;
    const unnamed: string[] = [];

    $('button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]').each(
      (_, el) => {
        if (hasName($, el)) return;
        if (unnamed.length >= 8) return;
        const node = $(el);
        unnamed.push(node.attr('id') || node.attr('class') || node.prop('tagName')?.toString() || 'button');
      }
    );

    if (unnamed.length === 0) {
      return pass('a11y-button-name', 'Buttons have accessible names, or the page has none', {
        unnamed: [],
      });
    }

    return warn('a11y-button-name', `${unnamed.length} button(s) have no accessible name`, {
      unnamed,
      recommendation:
        'Give the button text, an aria-label, or an img alt. An icon alone is not a name.',
    });
  },
});
