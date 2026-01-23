import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check X-Content-Type-Options header
 */
export const xContentTypeRule = defineRule({
  id: 'security-x-content-type-options',
  name: 'X-Content-Type-Options',
  description: 'Checks that X-Content-Type-Options is set to nosniff to prevent MIME type sniffing',
  category: 'security',
  weight: 4,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    const xContentTypeOptions = headers['x-content-type-options'];

    if (!xContentTypeOptions) {
      return fail(
        'security-x-content-type-options',
        'X-Content-Type-Options header is missing. Add "nosniff" to prevent MIME type sniffing attacks.',
        { url }
      );
    }

    const normalizedValue = xContentTypeOptions.toLowerCase().trim();

    if (normalizedValue !== 'nosniff') {
      return fail(
        'security-x-content-type-options',
        `X-Content-Type-Options has invalid value "${xContentTypeOptions}". Should be "nosniff".`,
        { url, value: xContentTypeOptions }
      );
    }

    return pass(
      'security-x-content-type-options',
      'X-Content-Type-Options is correctly set to nosniff',
      { url, value: xContentTypeOptions }
    );
  },
});
