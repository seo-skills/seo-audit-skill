import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hint: indexability/url-contains-a-form-with-a-get-method

/**
 * Rule: Detect forms that use the GET method
 *
 * Forms submitted with GET append their input data to the action URL as a
 * query string. Those URLs can be crawled, cached and indexed, and
 * unrestricted inputs can generate an unbounded number of unique URLs —
 * hurting crawl efficiency and causing index bloat. The HTML default for
 * the method attribute is GET, so a form without a method attribute uses
 * GET too.
 */
export const formGetMethodRule = defineRule({
  id: 'technical-form-get-method',
  name: 'Form GET Method',
  description:
    'Detects forms that submit with the GET method, exposing query-string URLs',
  category: 'technical',
  weight: 4,
  run: async (context: AuditContext) => {
    const { $ } = context;

    if (!$) {
      return notMeasured(
        'technical-form-get-method',
        'Page HTML was not collected; cannot inspect forms'
      );
    }

    const getFormActions: string[] = [];

    $('form').each((_, form) => {
      // The method attribute defaults to GET when omitted
      const method = ($(form).attr('method') ?? 'get').trim().toLowerCase();
      if (method === 'get') {
        const action = ($(form).attr('action') ?? '').trim();
        getFormActions.push(action || '(current URL)');
      }
    });

    if (getFormActions.length > 0) {
      return warn(
        'technical-form-get-method',
        `Page contains ${getFormActions.length} form(s) using the GET method; submitted data will be appended to the URL`,
        {
          formCount: getFormActions.length,
          actions: getFormActions,
          fix: 'Switch the form method to POST, or block the form action URL from crawlers via robots.txt if GET URLs are intentional',
        }
      );
    }

    return pass(
      'technical-form-get-method',
      'No forms using the GET method found'
    );
  },
});
