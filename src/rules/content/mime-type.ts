import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Validate Content-Type header
 *
 * Checks that:
 * - Content-Type header exists
 * - MIME type is text/html
 * - Charset is specified (utf-8 preferred)
 */
export const mimeTypeRule = defineRule({
  id: 'content-mime-type',
  name: 'MIME Type Validation',
  description: 'Validates Content-Type header for correct MIME type and charset',
  category: 'content',
  weight: 5,
  run: async (context: AuditContext) => {
    const { headers } = context;

    // Get Content-Type header (case-insensitive)
    const contentType =
      headers['content-type'] ||
      headers['Content-Type'] ||
      headers['CONTENT-TYPE'];

    if (!contentType) {
      return fail('content-mime-type', 'Missing Content-Type header', {
        header: null,
        recommendation: 'Configure your server to send the Content-Type header with every response',
        impact: 'Missing Content-Type can cause browsers to misinterpret the document type',
      });
    }

    // Parse Content-Type value
    const parts = contentType.toLowerCase().split(';').map((s) => s.trim());
    const mimeType = parts[0];

    // Check MIME type
    if (!mimeType.includes('text/html') && !mimeType.includes('application/xhtml+xml')) {
      return fail('content-mime-type', `Incorrect MIME type: ${mimeType}`, {
        header: contentType,
        mimeType,
        expectedMimeTypes: ['text/html', 'application/xhtml+xml'],
        recommendation: 'HTML pages should be served with text/html or application/xhtml+xml MIME type',
        impact: 'Incorrect MIME types can break page rendering and confuse search engine crawlers',
      });
    }

    // Check for charset
    const charsetPart = parts.find((p) => p.startsWith('charset='));
    const charset = charsetPart?.replace('charset=', '').trim();

    if (!charset) {
      return warn('content-mime-type', 'Content-Type header missing charset specification', {
        header: contentType,
        mimeType,
        charset: null,
        recommendation: 'Add charset=utf-8 to Content-Type header: "text/html; charset=utf-8"',
        impact: 'Missing charset can cause character encoding issues for international content',
      });
    }

    // Check charset value
    const normalizedCharset = charset.replace(/["']/g, '').toLowerCase();
    const isUtf8 = normalizedCharset === 'utf-8' || normalizedCharset === 'utf8';

    if (!isUtf8) {
      return warn(
        'content-mime-type',
        `Non-UTF-8 charset detected: ${charset}`,
        {
          header: contentType,
          mimeType,
          charset,
          recommendation: 'Use UTF-8 encoding for maximum compatibility: "text/html; charset=utf-8"',
          impact: 'Non-UTF-8 charsets may cause display issues with special characters',
        }
      );
    }

    return pass(
      'content-mime-type',
      'Content-Type header is correctly configured',
      {
        header: contentType,
        mimeType,
        charset,
      }
    );
  },
});
