import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findOgTag, nameAttributeMessage } from './open-graph.js';

/**
 * Rule: Check that an og:description meta tag exists in the document
 */
export const ogDescriptionRule = defineRule({
  id: 'social-og-description',
  name: 'Open Graph Description',
  description: 'Checks that a <meta property="og:description"> tag exists in the document',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const tag = findOgTag($, 'og:description');

    if (!tag) {
      return fail(
        'social-og-description',
        'No <meta property="og:description"> tag found in the document',
        { found: false }
      );
    }

    const content = tag.content;

    if (!content) {
      return fail(
        'social-og-description',
        'Open Graph description tag exists but has no content',
        { found: true, empty: true }
      );
    }

    if (tag.attribute === 'name') {
      return warn(
        'social-og-description',
        nameAttributeMessage('Open Graph description', 'og:description'),
        { found: true, ogDescription: content, attribute: 'name' }
      );
    }

    return pass(
      'social-og-description',
      'Open Graph description tag is present',
      { found: true, ogDescription: content }
    );
  },
});
