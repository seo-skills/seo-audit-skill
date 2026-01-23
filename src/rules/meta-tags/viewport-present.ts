import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that a <meta name="viewport"> tag exists in the document
 */
export const viewportPresentRule = defineRule({
  id: 'meta-tags-viewport-present',
  name: 'Viewport Meta Tag Present',
  description: 'Checks that a <meta name="viewport"> tag exists in the document',
  category: 'meta-tags',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const viewportElement = $('meta[name="viewport"]');

    if (viewportElement.length === 0) {
      return fail(
        'meta-tags-viewport-present',
        'No <meta name="viewport"> tag found in the document',
        { found: false }
      );
    }

    const content = viewportElement.first().attr('content')?.trim();

    if (!content) {
      return fail(
        'meta-tags-viewport-present',
        'Viewport meta tag exists but has no content',
        { found: true, empty: true }
      );
    }

    return pass(
      'meta-tags-viewport-present',
      'Viewport meta tag is present',
      { found: true, viewport: content }
    );
  },
});
