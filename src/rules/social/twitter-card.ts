import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Valid Twitter card types
 */
const VALID_CARD_TYPES = [
  'summary',
  'summary_large_image',
  'app',
  'player',
] as const;

/**
 * Rule: Check that a twitter:card meta tag exists
 */
export const twitterCardRule = defineRule({
  id: 'social-twitter-card',
  name: 'Twitter Card',
  description: 'Checks that a <meta name="twitter:card"> tag exists with a valid card type',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const twitterCardElement = $('meta[name="twitter:card"]');

    if (twitterCardElement.length === 0) {
      return fail(
        'social-twitter-card',
        'No <meta name="twitter:card"> tag found in the document',
        { found: false }
      );
    }

    const content = twitterCardElement.first().attr('content')?.trim();

    if (!content) {
      return fail(
        'social-twitter-card',
        'Twitter card tag exists but has no content',
        { found: true, empty: true }
      );
    }

    if (!VALID_CARD_TYPES.includes(content as typeof VALID_CARD_TYPES[number])) {
      return warn(
        'social-twitter-card',
        `Twitter card type "${content}" is not a recognized type. Valid types: ${VALID_CARD_TYPES.join(', ')}`,
        { twitterCard: content, isValidType: false, validTypes: VALID_CARD_TYPES }
      );
    }

    return pass(
      'social-twitter-card',
      'Twitter card tag is present with a valid type',
      { found: true, twitterCard: content, isValidType: true }
    );
  },
});
