import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';

// Reference hint: on-page/html-is-missing-or-empty

/**
 * Rule: Detect pages with missing or empty HTML
 *
 * A page that returns HTTP 200 with no meaningful HTML content gives users
 * and search engines nothing to see or index. This is usually an accident
 * or misconfiguration — an empty response body, a document with no <html>
 * content, or an empty/missing <body>.
 */
export const emptyHtmlRule = defineRule({
  id: 'technical-empty-html',
  name: 'Empty HTML',
  description:
    'Checks that the page returns meaningful HTML content rather than an empty document',
  category: 'technical',
  weight: 10,
  run: async (context: AuditContext) => {
    const { html, $, statusCode } = context;

    if (typeof html !== 'string' || !$) {
      return notMeasured(
        'technical-empty-html',
        'Page HTML was not collected; cannot check for empty HTML'
      );
    }

    // Only a 200 response is expected to carry HTML; error responses are
    // covered by the status-code rules.
    if (statusCode !== 200) {
      return pass(
        'technical-empty-html',
        `Page returns ${statusCode}; empty HTML check applies to 200 responses`,
        { statusCode }
      );
    }

    if (html.trim().length === 0) {
      return fail(
        'technical-empty-html',
        'Page returns 200 but the response HTML is missing (empty body)',
        {
          statusCode,
          htmlLength: html.length,
          fix: 'Investigate why the server returns no HTML; restore the content or serve a 404/410 if it should not exist',
        }
      );
    }

    const headContent = ($('head').html() ?? '').trim();
    const bodyContent = ($('body').html() ?? '').trim();

    if (headContent.length === 0 && bodyContent.length === 0) {
      return fail(
        'technical-empty-html',
        'Page returns 200 but the HTML has no meaningful content (empty <head> and empty or missing <body>)',
        {
          statusCode,
          htmlLength: html.length,
          fix: 'Investigate why the document renders no content; restore the content or serve a 404/410 if it should not exist',
        }
      );
    }

    return pass('technical-empty-html', 'Page contains meaningful HTML content', {
      statusCode,
      htmlLength: html.length,
    });
  },
});
