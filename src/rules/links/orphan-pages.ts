import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured } from '../define-rule.js';

/**
 * Rule: Check for orphan pages (no incoming internal links)
 *
 * Orphan pages have no internal links pointing to them, making them
 * difficult for users and search engines to discover.
 *
 * Answering this needs a site-wide link graph: every page's inbound links,
 * collected across the whole crawl. Rules receive one page at a time and there
 * is no site-level context yet, so this check cannot run and reports as
 * unmeasured rather than passing every page unconditionally.
 *
 * `crawl-sitemap-orphan-urls` covers the partial case that is answerable
 * today: sitemap URLs that the crawl never reached.
 */
export const orphanPagesRule = defineRule({
  id: 'links-orphan-pages',
  name: 'No Orphan Pages',
  description:
    'Checks that pages have incoming internal links. Requires a site-wide link graph, which is not yet built.',
  category: 'links',
  weight: 1,
  run: (context: AuditContext) => {
    const outgoingInternalLinks = context.links.filter((link) => link.isInternal);

    return notMeasured(
      'links-orphan-pages',
      'Orphan page detection not available - it requires a site-wide inbound link graph, which SEOmator does not build yet',
      {
        outgoingInternalLinkCount: outgoingInternalLinks.length,
        note: 'A page is orphaned when no other page links to it, which can only be determined by inspecting every page in the site.',
        relatedRule: 'crawl-sitemap-orphan-urls',
      }
    );
  },
});
