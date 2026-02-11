import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Redirect chain entry as provided by the crawler/fetcher.
 */
interface RedirectChainEntry {
  url: string;
  statusCode: number;
}

/**
 * Rule: Broken Redirect Detection
 *
 * Checks if a redirect chain ends in a non-200 status code (4xx or 5xx).
 * A broken redirect wastes crawl budget and results in a dead end
 * for both users and search engines.
 */
export const brokenRedirectRule = defineRule({
  id: 'redirect-broken',
  name: 'No Broken Redirects',
  description: 'Checks that redirect chains resolve to a valid (200) page',
  category: 'redirect',
  weight: 15,
  run: (context: AuditContext) => {
    const redirectChain = (context as AuditContext & { redirectChain?: RedirectChainEntry[] }).redirectChain;

    // No redirect chain or empty chain - nothing to check
    if (!redirectChain || redirectChain.length === 0) {
      return pass('redirect-broken', 'No redirect chain to check');
    }

    const { statusCode } = context;

    // Redirect chain exists and final status is an error
    if (statusCode >= 400) {
      const isClientError = statusCode >= 400 && statusCode < 500;
      const errorType = isClientError ? 'client error' : 'server error';

      return fail(
        'redirect-broken',
        `Redirect chain ends in ${statusCode} (${errorType}); the redirect destination is broken`,
        {
          finalStatusCode: statusCode,
          errorType,
          chainLength: redirectChain.length,
          chain: redirectChain.map((entry) => ({
            url: entry.url,
            statusCode: entry.statusCode,
          })),
        }
      );
    }

    return pass('redirect-broken', 'Redirect chain resolves to a valid page', {
      finalStatusCode: statusCode,
      chainLength: redirectChain.length,
    });
  },
});
