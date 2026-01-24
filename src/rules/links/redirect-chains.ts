import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchUrlWithRedirects } from '../../crawler/fetcher.js';

/**
 * Rule: Check for redirect chains in internal links
 *
 * Links that go through multiple redirects waste crawl budget, slow down
 * user navigation, and dilute PageRank. Direct links are preferred.
 */
export const redirectChainsRule = defineRule({
  id: 'links-redirect-chains',
  name: 'No Redirect Chains',
  description: 'Checks that internal links do not go through multiple redirects',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links } = context;

    // Get unique internal links
    const internalLinks = links.filter((link) => link.isInternal);
    const uniqueUrls = [...new Set(internalLinks.map((l) => l.href))];

    if (uniqueUrls.length === 0) {
      return pass(
        'links-redirect-chains',
        'No internal links to check',
        { totalChecked: 0 }
      );
    }

    // Sample up to 20 links for performance
    const sampleSize = Math.min(uniqueUrls.length, 20);
    const sampled = uniqueUrls.slice(0, sampleSize);

    const redirectingLinks: Array<{
      url: string;
      finalUrl: string;
      redirectCount: number;
      chain: string[];
    }> = [];

    // Check each sampled link
    for (const url of sampled) {
      try {
        const result = await fetchUrlWithRedirects(url, 10000, 5);

        if (result.redirectCount > 0) {
          redirectingLinks.push({
            url,
            finalUrl: result.finalUrl,
            redirectCount: result.redirectCount,
            chain: result.chain,
          });
        }
      } catch {
        // Skip errors
      }
    }

    if (redirectingLinks.length === 0) {
      return pass(
        'links-redirect-chains',
        `All ${sampleSize} sampled internal link(s) resolve directly`,
        {
          totalChecked: sampleSize,
          totalInternalLinks: uniqueUrls.length,
        }
      );
    }

    // Separate by severity
    const longChains = redirectingLinks.filter((l) => l.redirectCount >= 3);
    const shortChains = redirectingLinks.filter((l) => l.redirectCount < 3);

    // Fail if any chains have 3+ redirects
    if (longChains.length > 0) {
      return fail(
        'links-redirect-chains',
        `Found ${longChains.length} link(s) with 3+ redirect hops`,
        {
          totalChecked: sampleSize,
          totalInternalLinks: uniqueUrls.length,
          longChainCount: longChains.length,
          shortChainCount: shortChains.length,
          longChains: longChains.slice(0, 5).map((l) => ({
            url: l.url,
            finalUrl: l.finalUrl,
            redirectCount: l.redirectCount,
            chain: l.chain,
          })),
          recommendation: 'Update links to point directly to final destination URLs',
        }
      );
    }

    // Warn for 1-2 redirect hops
    return warn(
      'links-redirect-chains',
      `Found ${shortChains.length} link(s) with 1-2 redirect hops`,
      {
        totalChecked: sampleSize,
        totalInternalLinks: uniqueUrls.length,
        redirectingLinkCount: shortChains.length,
        redirectingLinks: shortChains.slice(0, 10).map((l) => ({
          url: l.url,
          finalUrl: l.finalUrl,
          redirectCount: l.redirectCount,
        })),
        recommendation: 'Update links to point directly to final destination URLs',
      }
    );
  },
});
