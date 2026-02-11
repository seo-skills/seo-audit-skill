import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Detect placeholder/dummy text in the page
 *
 * Lorem ipsum and other placeholder text left in production pages signals
 * incomplete content and harms user trust and search engine quality assessment.
 */

const PLACEHOLDER_PATTERNS = [
  /lorem\s+ipsum/i,
  /dolor\s+sit\s+amet/i,
  /consectetur\s+adipiscing/i,
];

export const loremIpsumRule = defineRule({
  id: 'htmlval-lorem-ipsum',
  name: 'No Placeholder Text',
  description: 'Checks for lorem ipsum and other placeholder text in the page content',
  category: 'htmlval',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const bodyText = $('body').text();

    const matched: string[] = [];
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(bodyText)) {
        const match = bodyText.match(pattern);
        if (match) {
          matched.push(match[0]);
        }
      }
    }

    if (matched.length > 0) {
      return fail(
        'htmlval-lorem-ipsum',
        `Placeholder/dummy text detected: "${matched[0]}". Remove all placeholder text before publishing`,
        { matchedPhrases: matched, count: matched.length }
      );
    }

    return pass(
      'htmlval-lorem-ipsum',
      'No placeholder text detected'
    );
  },
});
