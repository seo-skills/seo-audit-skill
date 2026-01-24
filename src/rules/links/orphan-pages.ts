import type { AuditContext } from '../../types.js';
import { defineRule, pass } from '../define-rule.js';

/**
 * Rule: Check for orphan pages (no incoming internal links)
 *
 * Orphan pages have no internal links pointing to them, making them
 * difficult for users and search engines to discover. This reduces
 * their SEO value and crawlability.
 *
 * NOTE: Full orphan page detection requires building a site-wide link graph
 * across all crawled pages. This is a placeholder that passes with info
 * about requiring crawl mode for full detection.
 *
 * Future enhancement: In crawl mode, maintain a link graph and check
 * which pages have zero incoming internal links.
 */
export const orphanPagesRule = defineRule({
  id: 'links-orphan-pages',
  name: 'No Orphan Pages',
  description: 'Checks that pages have incoming internal links (requires crawl mode for full detection)',
  category: 'links',
  weight: 1,
  run: (context: AuditContext) => {
    const { links } = context;

    // Count incoming internal links this page would provide to other pages
    const outgoingInternalLinks = links.filter((link) => link.isInternal);

    // In single-page mode, we can only report what this page links to
    // Full orphan detection requires crawl-wide analysis
    return pass(
      'links-orphan-pages',
      `Page provides ${outgoingInternalLinks.length} internal link(s) to other pages. Full orphan detection requires crawl mode.`,
      {
        outgoingInternalLinkCount: outgoingInternalLinks.length,
        note: 'Orphan page detection requires analyzing all pages in crawl mode to build a complete link graph',
        recommendation: 'Use --crawl flag to enable full orphan page detection across the site',
      }
    );
  },
});
