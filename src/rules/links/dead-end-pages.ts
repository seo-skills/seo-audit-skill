import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for dead-end pages (no outgoing internal links)
 *
 * Dead-end pages have no internal links for users to navigate to other
 * pages on the site, which hurts both user experience and crawlability.
 */
export const deadEndPagesRule = defineRule({
  id: 'links-dead-end-pages',
  name: 'No Dead-End Pages',
  description: 'Checks that pages have at least one outgoing internal link for navigation',
  category: 'links',
  weight: 1,
  run: (context: AuditContext) => {
    const { links, url } = context;
    const pageUrl = new URL(url);

    // Filter to internal links, excluding self-anchors (same page with hash)
    const outgoingInternalLinks = links.filter((link) => {
      if (!link.isInternal) return false;

      try {
        const linkUrl = new URL(link.href);
        // Exclude links to the same page (only different by hash)
        if (
          linkUrl.hostname === pageUrl.hostname &&
          linkUrl.pathname === pageUrl.pathname &&
          linkUrl.search === pageUrl.search
        ) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    });

    if (outgoingInternalLinks.length === 0) {
      return warn(
        'links-dead-end-pages',
        'Page is a dead-end with no outgoing internal links',
        {
          internalLinkCount: 0,
          recommendation: 'Add navigation links, related content links, or breadcrumbs',
        }
      );
    }

    return pass(
      'links-dead-end-pages',
      `Page has ${outgoingInternalLinks.length} outgoing internal link(s)`,
      { internalLinkCount: outgoingInternalLinks.length }
    );
  },
});
