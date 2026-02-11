import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Password Input on HTTP
 *
 * Detects pages served over plain HTTP that contain password input fields.
 * Browsers display prominent "Not Secure" warnings when users interact with
 * password fields on non-HTTPS pages, and credentials are transmitted in
 * plaintext, making them vulnerable to interception.
 *
 * This is a critical security issue that directly impacts user trust and
 * is flagged by all modern browsers.
 */
export const passwordHttpRule = defineRule({
  id: 'security-password-http',
  name: 'Password Input on HTTP',
  description: 'Checks if password inputs are served over insecure HTTP',
  category: 'security',
  weight: 10,
  run: (context: AuditContext) => {
    const { $, url } = context;

    // If page is served over HTTPS, password fields are safe
    if (url.startsWith('https://')) {
      return pass(
        'security-password-http',
        'Page is served over HTTPS; password inputs are secure',
        { isHttps: true }
      );
    }

    // Page is HTTP - check for password inputs
    const passwordInputs = $('input[type="password"]');
    const count = passwordInputs.length;

    if (count === 0) {
      return pass(
        'security-password-http',
        'No password input fields found on this HTTP page',
        { isHttps: false, passwordInputCount: 0 }
      );
    }

    return fail(
      'security-password-http',
      `Found ${count} password input(s) on an HTTP page; credentials will be transmitted in plaintext`,
      {
        isHttps: false,
        passwordInputCount: count,
        recommendation: 'Migrate the page to HTTPS to protect user credentials from interception',
      }
    );
  },
});
