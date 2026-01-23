import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Non-descriptive anchor text patterns to flag
 */
const NON_DESCRIPTIVE_PATTERNS = [
  'click here',
  'click',
  'here',
  'read more',
  'more',
  'learn more',
  'info',
  'link',
  'this',
  'page',
  'website',
  'site',
  'go',
  'continue',
  'details',
];

/**
 * Rule: Check anchor text is descriptive (warn if "click here", "read more", empty)
 */
export const anchorTextRule = defineRule({
  id: 'links-anchor-text',
  name: 'Descriptive Anchor Text',
  description: 'Checks that link anchor text is descriptive and not generic like "click here" or "read more"',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links } = context;
    const issues: Array<{ href: string; text: string; issue: string }> = [];

    for (const link of links) {
      const text = link.text.trim().toLowerCase();

      // Check for empty anchor text
      if (!text) {
        issues.push({
          href: link.href,
          text: link.text,
          issue: 'Empty anchor text',
        });
        continue;
      }

      // Check for very short anchor text (less than 2 characters)
      if (text.length < 2) {
        issues.push({
          href: link.href,
          text: link.text,
          issue: 'Anchor text too short',
        });
        continue;
      }

      // Check for non-descriptive patterns
      const isNonDescriptive = NON_DESCRIPTIVE_PATTERNS.some(
        (pattern) => text === pattern || text === pattern + '...'
      );

      if (isNonDescriptive) {
        issues.push({
          href: link.href,
          text: link.text,
          issue: 'Non-descriptive anchor text',
        });
      }
    }

    if (issues.length > 0) {
      const percentage = ((issues.length / links.length) * 100).toFixed(1);

      return warn(
        'links-anchor-text',
        `Found ${issues.length} link(s) with non-descriptive anchor text (${percentage}% of all links)`,
        {
          issueCount: issues.length,
          totalLinks: links.length,
          issues: issues.slice(0, 10), // Limit to first 10
          suggestion: 'Use descriptive anchor text that tells users and search engines what the linked page is about',
        }
      );
    }

    return pass(
      'links-anchor-text',
      `All ${links.length} link(s) have descriptive anchor text`,
      { totalLinks: links.length }
    );
  },
});
