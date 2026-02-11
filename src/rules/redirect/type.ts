import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/** HTTP status codes that represent permanent redirects */
const PERMANENT_REDIRECTS = new Set([301, 308]);

/** HTTP status codes that represent temporary redirects */
const TEMPORARY_REDIRECTS = new Set([302, 303, 307]);

/**
 * Rule: Redirect Type Check
 *
 * Validates the HTTP redirect type for SEO best practices.
 * Permanent redirects (301/308) pass link equity to the destination.
 * Temporary redirects (302/303/307) do not reliably pass link equity,
 * so they should only be used for genuinely temporary situations.
 */
export const redirectTypeRule = defineRule({
  id: 'redirect-type',
  name: 'Redirect Type',
  description: 'Checks that redirects use permanent (301/308) status codes for SEO',
  category: 'redirect',
  weight: 12,
  run: (context: AuditContext) => {
    const { statusCode } = context;

    // Not a redirect at all
    if (!PERMANENT_REDIRECTS.has(statusCode) && !TEMPORARY_REDIRECTS.has(statusCode)) {
      return pass('redirect-type', 'Page is not a redirect', {
        statusCode,
      });
    }

    // Permanent redirect - good for SEO
    if (PERMANENT_REDIRECTS.has(statusCode)) {
      return pass('redirect-type', `Permanent redirect (${statusCode}) correctly used`, {
        statusCode,
        type: 'permanent',
      });
    }

    // Temporary redirect - not ideal for SEO
    return warn(
      'redirect-type',
      `Temporary redirect (${statusCode}) detected; use 301 or 308 for permanent moves to preserve link equity`,
      {
        statusCode,
        type: 'temporary',
        recommendation: 'Change to 301 (Moved Permanently) or 308 (Permanent Redirect) if the move is permanent',
      }
    );
  },
});
