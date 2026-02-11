import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Valid content types for HTML pages
 */
const VALID_HTML_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
];

/**
 * Rule: Check Content-Type header for HTML pages
 *
 * An incorrect or missing Content-Type header can cause browsers and
 * search engines to misinterpret the page content. HTML pages should
 * serve content with text/html or application/xhtml+xml.
 */
export const badContentTypeRule = defineRule({
  id: 'technical-bad-content-type',
  name: 'Content-Type Header Check',
  description:
    'Checks that the Content-Type header is correct for an HTML page',
  category: 'technical',
  weight: 8,
  run: async (context: AuditContext) => {
    const contentType = context.headers['content-type'];

    if (!contentType) {
      return warn(
        'technical-bad-content-type',
        'Content-Type header is missing',
        {
          contentType: null,
          fix: 'Add a Content-Type header to the response (e.g., "text/html; charset=utf-8")',
        }
      );
    }

    // Extract the media type portion before any parameters (e.g., charset)
    const mediaType = contentType.split(';')[0].trim().toLowerCase();

    const isValid = VALID_HTML_CONTENT_TYPES.some(
      (valid) => mediaType === valid
    );

    if (isValid) {
      return pass(
        'technical-bad-content-type',
        `Content-Type is correct: ${contentType}`,
        { contentType, mediaType }
      );
    }

    return fail(
      'technical-bad-content-type',
      `Incorrect Content-Type "${contentType}" for an HTML page`,
      {
        contentType,
        mediaType,
        expected: VALID_HTML_CONTENT_TYPES,
        fix: `Change the Content-Type header from "${mediaType}" to "text/html; charset=utf-8"`,
      }
    );
  },
});
