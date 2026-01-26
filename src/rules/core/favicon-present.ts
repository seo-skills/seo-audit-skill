import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that a favicon link tag exists in the document
 * Looks for <link rel="icon"> or <link rel="shortcut icon">
 */
export const faviconPresentRule = defineRule({
  id: 'core-favicon-present',
  name: 'Favicon Present',
  description: 'Checks that a <link rel="icon"> or <link rel="shortcut icon"> tag exists',
  category: 'core',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;

    // Look for standard icon link
    const iconElement = $('link[rel="icon"]');

    // Look for shortcut icon link (legacy but still used)
    const shortcutIconElement = $('link[rel="shortcut icon"]');

    if (iconElement.length === 0 && shortcutIconElement.length === 0) {
      return fail(
        'core-favicon-present',
        'No favicon link tag found in the document',
        { found: false }
      );
    }

    // Get the href from whichever element is present
    const element = iconElement.length > 0 ? iconElement.first() : shortcutIconElement.first();
    const href = element.attr('href')?.trim();
    const rel = element.attr('rel');

    if (!href) {
      return fail(
        'core-favicon-present',
        'Favicon link tag exists but has no href',
        { found: true, empty: true }
      );
    }

    return pass(
      'core-favicon-present',
      'Favicon link tag is present',
      { found: true, faviconUrl: href, rel }
    );
  },
});
