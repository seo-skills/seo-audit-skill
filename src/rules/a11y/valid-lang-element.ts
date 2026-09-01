import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Shape of a BCP 47 tag: a 2-3 letter primary subtag, then optional script,
 * region and variant subtags. Deliberately structural — validating against the
 * full IANA registry is not worth shipping a registry for.
 */
const BCP47_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i;

/**
 * Rule: Check element-level lang attributes are well-formed
 *
 * A lang attribute on a passage tells the screen reader which pronunciation
 * rules to switch to. An invalid tag is ignored, so the text is read with the
 * wrong accent — often to the point of being incomprehensible.
 */
export const validLangElementRule = defineRule({
  id: 'a11y-valid-lang-element',
  name: 'Valid Element Language Tags',
  description: 'Checks that lang attributes on elements are well-formed BCP 47 tags',
  category: 'a11y',
  weight: 2,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const invalid: { tag: string; lang: string }[] = [];
    let total = 0;

    // <html lang> is graded by i18n-lang-attribute; this covers passages.
    $('[lang]:not(html)').each((_, el) => {
      const $el = $(el);
      const lang = $el.attr('lang')?.trim();
      total++;
      if (lang && BCP47_PATTERN.test(lang)) return;

      invalid.push({
        tag: ((el as { tagName?: string }).tagName ?? '?').toLowerCase(),
        lang: lang || '(empty)',
      });
    });

    const details = { url, total, invalid };

    if (total === 0) {
      return pass('a11y-valid-lang-element', 'No element-level lang attributes to validate', details);
    }

    if (invalid.length > 0) {
      return warn(
        'a11y-valid-lang-element',
        `${invalid.length} of ${total} element lang attribute(s) are not valid BCP 47: ${invalid
          .map((i) => `${i.tag}="${i.lang}"`)
          .join(', ')}`,
        details
      );
    }

    return pass('a11y-valid-lang-element', `All ${total} element lang attribute(s) are valid`, details);
  },
});
