import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Patterns that suggest user-generated content
 */
const UGC_PATTERNS = [
  '/comment',
  '/comments',
  '/forum',
  '/forums',
  '/discussion',
  '/user',
  '/users',
  '/profile',
  '/profiles',
  '/review',
  '/reviews',
];

/**
 * Rule: Check nofollow used appropriately (external links, user-generated content)
 */
export const nofollowAppropriateRule = defineRule({
  id: 'links-nofollow-appropriate',
  name: 'Nofollow Used Appropriately',
  description: 'Checks that nofollow is used appropriately on external links and user-generated content',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links } = context;
    const issues: Array<{ href: string; text: string; issue: string }> = [];

    for (const link of links) {
      // Check for external links without nofollow that might be suspicious
      if (!link.isInternal && !link.isNoFollow) {
        // Check if link text contains suspicious patterns (ads, sponsored)
        const text = link.text.toLowerCase();
        if (
          text.includes('sponsor') ||
          text.includes('advertis') ||
          text.includes('partner') ||
          text.includes('paid')
        ) {
          issues.push({
            href: link.href,
            text: link.text,
            issue: 'Potentially sponsored external link without nofollow',
          });
        }
      }

      // Check for internal links with nofollow (usually unnecessary)
      if (link.isInternal && link.isNoFollow) {
        // Check if it might be UGC
        const isLikelyUgc = UGC_PATTERNS.some((pattern) =>
          link.href.toLowerCase().includes(pattern)
        );

        if (!isLikelyUgc) {
          issues.push({
            href: link.href,
            text: link.text,
            issue: 'Internal link with nofollow (may block PageRank flow)',
          });
        }
      }
    }

    if (issues.length > 0) {
      return warn(
        'links-nofollow-appropriate',
        `Found ${issues.length} link(s) with potentially inappropriate nofollow usage`,
        {
          issueCount: issues.length,
          issues: issues.slice(0, 10), // Limit to first 10
          suggestion: 'Review nofollow usage: use for sponsored/UGC external links, avoid on internal navigation links',
        }
      );
    }

    return pass(
      'links-nofollow-appropriate',
      'Nofollow attributes appear to be used appropriately',
      {
        totalLinks: links.length,
        externalNofollow: links.filter((l) => !l.isInternal && l.isNoFollow).length,
        internalNofollow: links.filter((l) => l.isInternal && l.isNoFollow).length,
      }
    );
  },
});
