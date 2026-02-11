import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Threshold for acceptable URL length
 */
const URL_LENGTH_GOOD = 75;

/**
 * Threshold for warning-level URL length
 */
const URL_LENGTH_WARN = 200;

/**
 * Rule: Check full URL length
 *
 * Long URLs are harder to share, may be truncated in search results, and
 * can dilute keyword relevance. Keeping URLs concise improves usability
 * and SEO signal clarity.
 */
export const lengthRule = defineRule({
  id: 'url-length',
  name: 'URL Length',
  description:
    'Checks if the full URL length is within recommended limits for SEO',
  category: 'url',
  weight: 5,
  run: async (context: AuditContext) => {
    const { url } = context;
    const length = url.length;

    const details = {
      url,
      length,
      maxRecommended: URL_LENGTH_GOOD,
      maxAcceptable: URL_LENGTH_WARN,
    };

    if (length <= URL_LENGTH_GOOD) {
      return pass(
        'url-length',
        `URL length is ${length} characters (good, <= ${URL_LENGTH_GOOD})`,
        details
      );
    }

    if (length <= URL_LENGTH_WARN) {
      return warn(
        'url-length',
        `URL length is ${length} characters (recommended: <= ${URL_LENGTH_GOOD})`,
        details
      );
    }

    return fail(
      'url-length',
      `URL length is ${length} characters (exceeds ${URL_LENGTH_WARN} limit)`,
      details
    );
  },
});
