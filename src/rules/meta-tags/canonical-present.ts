import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that a <link rel="canonical"> tag exists in the document
 */
export const canonicalPresentRule = defineRule({
  id: 'meta-tags-canonical-present',
  name: 'Canonical URL Present',
  description: 'Checks that a <link rel="canonical"> tag exists in the document',
  category: 'meta-tags',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const canonicalElement = $('link[rel="canonical"]');

    if (canonicalElement.length === 0) {
      return fail(
        'meta-tags-canonical-present',
        'No <link rel="canonical"> tag found in the document',
        { found: false }
      );
    }

    const href = canonicalElement.first().attr('href')?.trim();

    if (!href) {
      return fail(
        'meta-tags-canonical-present',
        'Canonical link tag exists but has no href',
        { found: true, empty: true }
      );
    }

    return pass(
      'meta-tags-canonical-present',
      'Canonical URL tag is present',
      { found: true, canonicalUrl: href }
    );
  },
});
