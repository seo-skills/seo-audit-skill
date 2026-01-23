import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Check that <html lang="..."> attribute exists
 */
export const langAttributeRule = defineRule({
  id: 'headings-lang-attribute',
  name: 'HTML Lang Attribute',
  description: 'Checks that the <html> element has a lang attribute',
  category: 'headings',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const htmlElement = $('html');

    if (htmlElement.length === 0) {
      return fail(
        'headings-lang-attribute',
        'No <html> element found in the document',
        { found: false }
      );
    }

    const lang = htmlElement.attr('lang');

    if (!lang) {
      return fail(
        'headings-lang-attribute',
        'Missing lang attribute on <html> element. This is important for accessibility and SEO',
        { found: true, hasLang: false }
      );
    }

    const trimmedLang = lang.trim();

    if (!trimmedLang) {
      return fail(
        'headings-lang-attribute',
        'The lang attribute on <html> is empty',
        { found: true, hasLang: true, empty: true }
      );
    }

    // Basic validation of lang format (e.g., "en", "en-US", "fr-CA")
    const langPattern = /^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z0-9]+)?$/;
    if (!langPattern.test(trimmedLang)) {
      return warn(
        'headings-lang-attribute',
        `The lang attribute "${trimmedLang}" may not be in a valid format. Expected formats: "en", "en-US", "fr-CA"`,
        { found: true, lang: trimmedLang, validFormat: false }
      );
    }

    return pass(
      'headings-lang-attribute',
      `HTML lang attribute is set to "${trimmedLang}"`,
      { found: true, lang: trimmedLang, validFormat: true }
    );
  },
});
