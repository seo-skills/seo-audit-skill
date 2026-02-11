import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: HTTP Refresh Header
 *
 * Checks for the non-standard HTTP "Refresh" header.
 * This header functions similarly to a meta refresh tag but at
 * the HTTP level. It is not part of the HTTP specification and
 * should be replaced with proper 301/302 status codes.
 */
export const httpRefreshRule = defineRule({
  id: 'redirect-http-refresh',
  name: 'No HTTP Refresh Header',
  description: 'Checks for the non-standard Refresh HTTP header that should use 301/302 status codes',
  category: 'redirect',
  weight: 10,
  run: (context: AuditContext) => {
    const { headers } = context;

    const refreshHeader = headers['refresh'];

    if (!refreshHeader) {
      return pass('redirect-http-refresh', 'No Refresh HTTP header present');
    }

    // Parse the header value: "delay;url=destination" or just "delay"
    const delayMatch = refreshHeader.match(/^\s*(\d+)/);
    const delay = delayMatch ? parseInt(delayMatch[1], 10) : 0;
    const urlMatch = refreshHeader.match(/;\s*url\s*=\s*['"]?([^'">\s]+)/i);
    const targetUrl = urlMatch ? urlMatch[1] : undefined;

    return fail(
      'redirect-http-refresh',
      'Refresh HTTP header detected; use proper 301/302 status codes for redirects',
      {
        refreshHeader,
        delay,
        ...(targetUrl && { targetUrl }),
      }
    );
  },
});
