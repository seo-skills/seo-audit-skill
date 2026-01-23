import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { fetchUrl } from '../../crawler/fetcher.js';

/**
 * Rule: Check that external links are reachable (warn if unreachable)
 */
export const externalValidRule = defineRule({
  id: 'links-external-valid',
  name: 'External Links Valid',
  description: 'Checks that external links are reachable and return valid responses',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links } = context;
    const externalLinks = links.filter((link) => !link.isInternal);

    if (externalLinks.length === 0) {
      return pass(
        'links-external-valid',
        'No external links found to check',
        { totalLinks: 0 }
      );
    }

    const unreachableLinks: Array<{ href: string; statusCode: number }> = [];

    // Check each external link (limit to first 20 to avoid excessive requests)
    const linksToCheck = externalLinks.slice(0, 20);

    for (const link of linksToCheck) {
      try {
        const statusCode = await fetchUrl(link.href);

        // Consider link unreachable if 4xx, 5xx, or network error (0)
        if (statusCode === 0 || statusCode >= 400) {
          unreachableLinks.push({
            href: link.href,
            statusCode,
          });
        }
      } catch {
        unreachableLinks.push({
          href: link.href,
          statusCode: 0,
        });
      }
    }

    if (unreachableLinks.length > 0) {
      return warn(
        'links-external-valid',
        `Found ${unreachableLinks.length} unreachable external link(s) out of ${linksToCheck.length} checked`,
        {
          unreachableCount: unreachableLinks.length,
          totalChecked: linksToCheck.length,
          totalExternal: externalLinks.length,
          unreachableLinks: unreachableLinks.slice(0, 10), // Limit to first 10
        }
      );
    }

    return pass(
      'links-external-valid',
      `All ${linksToCheck.length} checked external link(s) are reachable`,
      {
        totalChecked: linksToCheck.length,
        totalExternal: externalLinks.length,
      }
    );
  },
});
