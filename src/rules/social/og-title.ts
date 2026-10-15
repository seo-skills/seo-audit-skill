import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findOgTag, nameAttributeMessage } from './open-graph.js';

/**
 * Rule: Check that an og:title meta tag exists in the document
 */
export const ogTitleRule = defineRule({
  id: 'social-og-title',
  name: 'Open Graph Title',
  description: 'Checks that a <meta property="og:title"> tag exists in the document',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const tag = findOgTag($, 'og:title');

    if (!tag) {
      return fail(
        'social-og-title',
        'No <meta property="og:title"> tag found in the document',
        { found: false }
      );
    }

    const content = tag.content;

    if (!content) {
      return fail(
        'social-og-title',
        'Open Graph title tag exists but has no content',
        { found: true, empty: true }
      );
    }

    if (tag.attribute === 'name') {
      return warn(
        'social-og-title',
        nameAttributeMessage('Open Graph title', 'og:title'),
        { found: true, ogTitle: content, attribute: 'name' }
      );
    }

    return pass(
      'social-og-title',
      'Open Graph title tag is present',
      { found: true, ogTitle: content }
    );
  },
});
