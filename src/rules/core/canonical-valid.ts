import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Validates if a string is a valid absolute URL
 */
function isValidAbsoluteUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Rule: Check that the canonical URL is a valid absolute URL
 */
export const canonicalValidRule = defineRule({
  id: 'core-canonical-valid',
  name: 'Canonical URL Valid',
  description: 'Checks that the canonical URL is a valid absolute URL',
  category: 'core',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const canonicalElement = $('link[rel="canonical"]');

    if (canonicalElement.length === 0) {
      return warn(
        'core-canonical-valid',
        'No <link rel="canonical"> tag found in the document',
        { found: false }
      );
    }

    const href = canonicalElement.first().attr('href')?.trim();

    if (!href) {
      return fail(
        'core-canonical-valid',
        'Canonical link tag exists but has no href',
        { found: true, empty: true }
      );
    }

    if (!isValidAbsoluteUrl(href)) {
      return fail(
        'core-canonical-valid',
        `Canonical URL is not a valid absolute URL: "${href}"`,
        { canonicalUrl: href, isAbsolute: false }
      );
    }

    return pass(
      'core-canonical-valid',
      'Canonical URL is a valid absolute URL',
      { canonicalUrl: href, isAbsolute: true }
    );
  },
});
