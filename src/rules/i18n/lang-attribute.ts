import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Lang Attribute
 *
 * Checks that the <html> element has a valid lang attribute.
 * This is important for:
 * - Accessibility: Screen readers use it to select correct pronunciation
 * - SEO: Helps search engines understand page language
 * - Browser features: Auto-translation, spell-check, hyphenation
 *
 * Valid formats: "en", "en-US", "zh-Hans", "pt-BR"
 * Reference: BCP 47 language tags
 */
export const langAttributeRule = defineRule({
  id: 'i18n-lang-attribute',
  name: 'Lang Attribute',
  description: 'Checks that the <html> element has a valid lang attribute',
  category: 'i18n',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;
    const htmlElement = $('html');

    if (htmlElement.length === 0) {
      return fail('i18n-lang-attribute', 'No <html> element found in the document', {
        found: false,
      });
    }

    const lang = htmlElement.attr('lang');

    if (!lang) {
      return fail(
        'i18n-lang-attribute',
        'Missing lang attribute on <html> element',
        {
          found: true,
          hasLang: false,
          recommendation: 'Add lang attribute: <html lang="en">',
        }
      );
    }

    const trimmedLang = lang.trim();

    if (!trimmedLang) {
      return fail('i18n-lang-attribute', 'The lang attribute on <html> is empty', {
        found: true,
        hasLang: true,
        empty: true,
      });
    }

    // BCP 47 language tag validation
    // Primary language (2-3 chars), optional script (4 chars), optional region (2 chars or 3 digits)
    const langPattern = /^[a-z]{2,3}(-[A-Za-z]{4})?(-[A-Za-z]{2}|\d{3})?$/;
    if (!langPattern.test(trimmedLang)) {
      return warn(
        'i18n-lang-attribute',
        `Lang attribute "${trimmedLang}" may not be valid BCP 47 format`,
        {
          found: true,
          lang: trimmedLang,
          validFormat: false,
          examples: ['en', 'en-US', 'zh-Hans', 'pt-BR'],
        }
      );
    }

    return pass('i18n-lang-attribute', `HTML lang attribute set to "${trimmedLang}"`, {
      found: true,
      lang: trimmedLang,
      validFormat: true,
    });
  },
});
