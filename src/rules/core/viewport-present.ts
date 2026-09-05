import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that a <meta name="viewport"> tag exists in the document
 */
export const viewportPresentRule = defineRule({
  id: 'core-viewport-present',
  name: 'Viewport Meta Tag Present',
  description: 'Checks that a <meta name="viewport"> tag exists in the document',
  category: 'core',
  // Raised from 1 in 5.0.0. Every core presence check sat at the bottom of a
  // scale running to 25, so a page missing this lost a single weight-point
  // while canonical edge cases passed vacuously at 6-8. A blank document
  // scored 84/100. Mobile-first indexing: a missing viewport degrades every mobile result.
  // Matches images-alt-present.
  weight: 20,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const viewportElement = $('meta[name="viewport"]');

    if (viewportElement.length === 0) {
      return fail(
        'core-viewport-present',
        'No <meta name="viewport"> tag found in the document',
        { found: false }
      );
    }

    const content = viewportElement.first().attr('content')?.trim();

    if (!content) {
      return fail(
        'core-viewport-present',
        'Viewport meta tag exists but has no content',
        { found: true, empty: true }
      );
    }

    return pass(
      'core-viewport-present',
      'Viewport meta tag is present',
      { found: true, viewport: content }
    );
  },
});
