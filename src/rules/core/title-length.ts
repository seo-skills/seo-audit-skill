import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

const MIN_LENGTH = 30;
const MAX_LENGTH = 60;

/**
 * Rule: Check that the title tag is within the recommended length (30-60 characters)
 */
export const titleLengthRule = defineRule({
  id: 'core-title-length',
  name: 'Title Tag Length',
  description: `Checks that the title tag is between ${MIN_LENGTH} and ${MAX_LENGTH} characters`,
  category: 'core',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const titleElement = $('title');

    if (titleElement.length === 0) {
      return fail(
        'core-title-length',
        'No <title> tag found in the document',
        { found: false }
      );
    }

    const titleText = titleElement.first().text().trim();

    if (!titleText) {
      return fail(
        'core-title-length',
        'Title tag exists but is empty',
        { found: true, length: 0 }
      );
    }

    const length = titleText.length;

    if (length < MIN_LENGTH) {
      return warn(
        'core-title-length',
        `Title is too short (${length} characters). Recommended: ${MIN_LENGTH}-${MAX_LENGTH} characters`,
        { length, minLength: MIN_LENGTH, maxLength: MAX_LENGTH, title: titleText }
      );
    }

    if (length > MAX_LENGTH) {
      return warn(
        'core-title-length',
        `Title is too long (${length} characters). Recommended: ${MIN_LENGTH}-${MAX_LENGTH} characters`,
        { length, minLength: MIN_LENGTH, maxLength: MAX_LENGTH, title: titleText }
      );
    }

    return pass(
      'core-title-length',
      `Title length is optimal (${length} characters)`,
      { length, minLength: MIN_LENGTH, maxLength: MAX_LENGTH, title: titleText }
    );
  },
});
