import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

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
    // The page's own status is the final one, after the fetcher followed any
    // redirects, so it can never be a 3xx. The hops live in the chain.
    const { redirectChain } = context;

    if (!redirectChain || redirectChain.length === 0) {
      return notMeasured('redirect-type', 'Redirect chain was not recorded for this page');
    }

    const hops = redirectChain.filter(
      (entry) => PERMANENT_REDIRECTS.has(entry.statusCode) || TEMPORARY_REDIRECTS.has(entry.statusCode)
    );

    if (hops.length === 0) {
      return pass('redirect-type', 'Page is not a redirect', {
        statusCode: context.statusCode,
      });
    }

    const statusCodes = hops.map((entry) => entry.statusCode);
    const temporary = hops.filter((entry) => TEMPORARY_REDIRECTS.has(entry.statusCode));

    // Permanent redirects only - good for SEO
    if (temporary.length === 0) {
      return pass(
        'redirect-type',
        `Permanent redirect (${statusCodes.join(' → ')}) correctly used`,
        { statusCodes, type: 'permanent' }
      );
    }

    // Temporary redirect - not ideal for SEO
    return warn(
      'redirect-type',
      `Temporary redirect (${temporary.map((entry) => entry.statusCode).join(', ')}) detected; use 301 or 308 for permanent moves to preserve link equity`,
      {
        statusCodes,
        type: 'temporary',
        temporaryHops: temporary.map((entry) => ({ url: entry.url, statusCode: entry.statusCode })),
        recommendation: 'Change to 301 (Moved Permanently) or 308 (Permanent Redirect) if the move is permanent',
      }
    );
  },
});
