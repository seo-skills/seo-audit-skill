import type { AuditContext, RuleOptionValues } from '../../types.js';
import { defineRule, pass, warn, readRuleOptions } from '../define-rule.js';

const MIN_LENGTH = 120;
const MAX_LENGTH = 160;

/**
 * Rule: Check that the meta description is within the recommended length (120-160 characters)
 */
export const descriptionLengthRule = defineRule({
  id: 'core-description-length',
  name: 'Meta Description Length',
  description: `Checks that the meta description is between ${MIN_LENGTH} and ${MAX_LENGTH} characters`,
  category: 'core',
  weight: 1,
  options: {
    min_length: { type: 'number', default: MIN_LENGTH, min: 0, max: 1000, description: 'Shortest description that passes, in characters' },
    max_length: { type: 'number', default: MAX_LENGTH, min: 1, max: 1000, description: 'Longest description that passes, in characters' },
  },
  run: async (context: AuditContext, options?: RuleOptionValues) => {
    const { $ } = context;
    const opts = readRuleOptions(descriptionLengthRule, options);
    const minLength = opts.min_length as number;
    const maxLength = opts.max_length as number;
    const descriptionElement = $('meta[name="description"]');

    if (descriptionElement.length === 0) {
      return warn(
        'core-description-length',
        'No <meta name="description"> tag found in the document',
        { found: false }
      );
    }

    const content = descriptionElement.first().attr('content')?.trim();

    if (!content) {
      return warn(
        'core-description-length',
        'Meta description tag exists but has no content',
        { found: true, length: 0 }
      );
    }

    const length = content.length;

    if (length < minLength) {
      return warn(
        'core-description-length',
        `Meta description is too short (${length} characters). Recommended: ${minLength}-${maxLength} characters`,
        { length, minLength: minLength, maxLength: maxLength, description: content }
      );
    }

    if (length > maxLength) {
      return warn(
        'core-description-length',
        `Meta description is too long (${length} characters). Recommended: ${minLength}-${maxLength} characters`,
        { length, minLength: minLength, maxLength: maxLength, description: content }
      );
    }

    return pass(
      'core-description-length',
      `Meta description length is optimal (${length} characters)`,
      { length, minLength: minLength, maxLength: maxLength, description: content }
    );
  },
});
