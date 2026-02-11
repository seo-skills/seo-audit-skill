import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Check that a character encoding is declared in the HTML document
 *
 * A missing charset declaration can cause character rendering issues and
 * potential security vulnerabilities (charset sniffing attacks).
 */
export const missingCharsetRule = defineRule({
  id: 'htmlval-missing-charset',
  name: 'Charset Declaration',
  description: 'Checks for a <meta charset> or Content-Type meta tag in the document head',
  category: 'htmlval',
  weight: 15,
  run: async (context: AuditContext) => {
    const { $, headers } = context;

    // Check for <meta charset="...">
    const metaCharset = $('head meta[charset]');
    if (metaCharset.length > 0) {
      return pass(
        'htmlval-missing-charset',
        'Charset is declared via <meta charset>',
        { method: 'meta-charset', value: metaCharset.attr('charset') }
      );
    }

    // Check for <meta http-equiv="Content-Type" content="...charset=...">
    const httpEquiv = $('head meta[http-equiv="Content-Type"]');
    if (httpEquiv.length > 0) {
      return pass(
        'htmlval-missing-charset',
        'Charset is declared via <meta http-equiv="Content-Type">',
        { method: 'http-equiv', value: httpEquiv.attr('content') }
      );
    }

    // Check Content-Type header as fallback
    const contentType = headers['content-type'] || '';
    if (/charset=/i.test(contentType)) {
      return warn(
        'htmlval-missing-charset',
        'Charset is only declared in the HTTP Content-Type header, not in HTML. Add <meta charset="utf-8"> to <head>',
        { method: 'header-only', headerValue: contentType }
      );
    }

    return fail(
      'htmlval-missing-charset',
      'No charset declaration found. Add <meta charset="utf-8"> as the first element in <head>',
      { found: false }
    );
  },
});
