import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';
import { fetchUrl } from '../../crawler/fetcher.js';

/**
 * Rule: Check that internal links return 200 (fail if 404/5xx)
 */
export const brokenInternalRule = defineRule({
  id: 'links-broken-internal',
  name: 'No Broken Internal Links',
  description: 'Checks that all internal links return HTTP 200 status codes',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links } = context;
    const internalLinks = links.filter((link) => link.isInternal);

    if (internalLinks.length === 0) {
      return pass(
        'links-broken-internal',
        'No internal links found to check',
        { totalLinks: 0 }
      );
    }

    const brokenLinks: Array<{ href: string; statusCode: number }> = [];

    // Check each internal link
    for (const link of internalLinks) {
      try {
        const statusCode = await fetchUrl(link.href);

        if (statusCode === 404 || statusCode >= 500 || statusCode === 0) {
          brokenLinks.push({
            href: link.href,
            statusCode,
          });
        }
      } catch {
        brokenLinks.push({
          href: link.href,
          statusCode: 0,
        });
      }
    }

    if (brokenLinks.length > 0) {
      return fail(
        'links-broken-internal',
        `Found ${brokenLinks.length} broken internal link(s) out of ${internalLinks.length}`,
        {
          brokenCount: brokenLinks.length,
          totalChecked: internalLinks.length,
          brokenLinks: brokenLinks.slice(0, 10), // Limit to first 10
        }
      );
    }

    return pass(
      'links-broken-internal',
      `All ${internalLinks.length} internal link(s) are accessible`,
      { totalChecked: internalLinks.length }
    );
  },
});
