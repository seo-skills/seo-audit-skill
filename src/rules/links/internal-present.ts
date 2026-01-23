import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check that page has internal links (warn if no internal links)
 */
export const internalPresentRule = defineRule({
  id: 'links-internal-present',
  name: 'Internal Links Present',
  description: 'Checks that the page contains internal links for navigation and crawlability',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links, url } = context;
    const internalLinks = links.filter((link) => link.isInternal);

    // Filter out self-referencing links (same page anchors)
    const uniqueInternalLinks = internalLinks.filter((link) => {
      try {
        const linkUrl = new URL(link.href);
        const currentUrl = new URL(url);
        // Remove hash and compare
        linkUrl.hash = '';
        currentUrl.hash = '';
        return linkUrl.href !== currentUrl.href;
      } catch {
        return true;
      }
    });

    if (uniqueInternalLinks.length === 0) {
      return warn(
        'links-internal-present',
        'No internal links found on this page',
        {
          internalLinkCount: 0,
          selfLinks: internalLinks.length,
          suggestion: 'Add internal links to improve site navigation and help search engines crawl your site',
        }
      );
    }

    return pass(
      'links-internal-present',
      `Found ${uniqueInternalLinks.length} internal link(s) on this page`,
      {
        internalLinkCount: uniqueInternalLinks.length,
        examples: uniqueInternalLinks.slice(0, 5).map((link) => link.href),
      }
    );
  },
});
