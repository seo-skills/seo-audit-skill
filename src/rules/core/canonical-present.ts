import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that a <link rel="canonical"> tag exists in the document
 */
export const canonicalPresentRule = defineRule({
  id: 'core-canonical-present',
  name: 'Canonical URL Present',
  description: 'Checks that a <link rel="canonical"> tag exists in the document',
  category: 'core',
  // Raised from 1 in 5.0.0. Every core presence check sat at the bottom of a
  // scale running to 25, so a page missing this lost a single weight-point
  // while canonical edge cases passed vacuously at 6-8. A blank document
  // scored 84/100. Matters for duplicate content, but is genuinely optional on many pages, so
  // the lightest of the five.
  weight: 10,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const canonicalElement = $('link[rel="canonical"]');

    if (canonicalElement.length === 0) {
      return fail(
        'core-canonical-present',
        'No <link rel="canonical"> tag found in the document',
        { found: false }
      );
    }

    const href = canonicalElement.first().attr('href')?.trim();

    if (!href) {
      return fail(
        'core-canonical-present',
        'Canonical link tag exists but has no href',
        { found: true, empty: true }
      );
    }

    return pass(
      'core-canonical-present',
      'Canonical URL tag is present',
      { found: true, canonicalUrl: href }
    );
  },
});
