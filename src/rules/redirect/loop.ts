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
 * Rule: Redirect Loop Detection
 *
 * Checks if the page's redirect chain contains a loop where the
 * same URL appears more than once. Redirect loops result in
 * ERR_TOO_MANY_REDIRECTS errors and make pages inaccessible
 * to both users and search engine crawlers.
 */
export const redirectLoopRule = defineRule({
  id: 'redirect-loop',
  name: 'No Redirect Loops',
  description: 'Checks that the redirect chain does not contain loops',
  category: 'redirect',
  weight: 15,
  run: (context: AuditContext) => {
    const redirectChain = (context as AuditContext & { redirectChain?: RedirectChainEntry[] }).redirectChain;

    if (!redirectChain || redirectChain.length === 0) {
      return pass('redirect-loop', 'No redirect chain to check');
    }

    const seenUrls = new Set<string>();
    const duplicates: string[] = [];

    for (const entry of redirectChain) {
      const normalizedUrl = entry.url.toLowerCase();
      if (seenUrls.has(normalizedUrl)) {
        duplicates.push(entry.url);
      }
      seenUrls.add(normalizedUrl);
    }

    if (duplicates.length === 0) {
      return pass('redirect-loop', 'No redirect loop detected', {
        chainLength: redirectChain.length,
      });
    }

    return fail(
      'redirect-loop',
      `Redirect loop detected: ${duplicates.length} URL(s) appear more than once in the chain`,
      {
        chainLength: redirectChain.length,
        duplicateUrls: duplicates,
        chain: redirectChain.map((entry) => ({
          url: entry.url,
          statusCode: entry.statusCode,
        })),
      }
    );
  },
});
