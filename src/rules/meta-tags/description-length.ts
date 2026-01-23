import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

const MIN_LENGTH = 120;
const MAX_LENGTH = 160;

/**
 * Rule: Check that the meta description is within the recommended length (120-160 characters)
 */
export const descriptionLengthRule = defineRule({
  id: 'meta-tags-description-length',
  name: 'Meta Description Length',
  description: `Checks that the meta description is between ${MIN_LENGTH} and ${MAX_LENGTH} characters`,
  category: 'meta-tags',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const descriptionElement = $('meta[name="description"]');

    if (descriptionElement.length === 0) {
      return warn(
        'meta-tags-description-length',
        'No <meta name="description"> tag found in the document',
        { found: false }
      );
    }

    const content = descriptionElement.first().attr('content')?.trim();

    if (!content) {
      return warn(
        'meta-tags-description-length',
        'Meta description tag exists but has no content',
        { found: true, length: 0 }
      );
    }

    const length = content.length;

    if (length < MIN_LENGTH) {
      return warn(
        'meta-tags-description-length',
        `Meta description is too short (${length} characters). Recommended: ${MIN_LENGTH}-${MAX_LENGTH} characters`,
        { length, minLength: MIN_LENGTH, maxLength: MAX_LENGTH, description: content }
      );
    }

    if (length > MAX_LENGTH) {
      return warn(
        'meta-tags-description-length',
        `Meta description is too long (${length} characters). Recommended: ${MIN_LENGTH}-${MAX_LENGTH} characters`,
        { length, minLength: MIN_LENGTH, maxLength: MAX_LENGTH, description: content }
      );
    }

    return pass(
      'meta-tags-description-length',
      `Meta description length is optimal (${length} characters)`,
      { length, minLength: MIN_LENGTH, maxLength: MAX_LENGTH, description: content }
    );
  },
});
