import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Patterns in URLs that indicate a paginated page
 */
const PAGINATION_URL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /[?&]page=\d+/i, label: '?page=N' },
  { pattern: /[?&]p=\d+/i, label: '?p=N' },
  { pattern: /[?&]pg=\d+/i, label: '?pg=N' },
  { pattern: /[?&]offset=\d+/i, label: '?offset=N' },
  { pattern: /[?&]start=\d+/i, label: '?start=N' },
  { pattern: /[?&]paged=\d+/i, label: '?paged=N' },
  { pattern: /\/page\/\d+\/?$/i, label: '/page/N' },
];

/**
 * Check if a URL appears to be a paginated page based on common patterns
 */
function hasPaginationPattern(url: string): { matches: boolean; label?: string } {
  for (const { pattern, label } of PAGINATION_URL_PATTERNS) {
    if (pattern.test(url)) {
      return { matches: true, label };
    }
  }
  return { matches: false };
}

/**
 * Rule: Pagination Orphaned
 *
 * Detects pages that appear to be paginated (based on URL patterns)
 * but lack rel="next" or rel="prev" links. Without these link
 * relationships, search engines cannot understand the pagination
 * series and may treat each page as standalone content.
 */
export const paginationOrphanedRule = defineRule({
  id: 'crawl-pagination-orphaned',
  name: 'Pagination Orphaned',
  description: 'Checks if paginated pages are missing rel="next"/"prev" relationships',
  category: 'crawl',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    const nextLink = $('link[rel="next"]').attr('href');
    const prevLink = $('link[rel="prev"]').attr('href');
    const hasPaginationLinks = !!(nextLink || prevLink);

    // If pagination links are present, the page is properly linked
    if (hasPaginationLinks) {
      return pass(
        'crawl-pagination-orphaned',
        'Paginated page has rel="next" and/or rel="prev" links',
        {
          hasNext: !!nextLink,
          hasPrev: !!prevLink,
          nextHref: nextLink || null,
          prevHref: prevLink || null,
        }
      );
    }

    // Check if the URL looks like a paginated page
    const { matches, label } = hasPaginationPattern(url);

    if (!matches) {
      return pass(
        'crawl-pagination-orphaned',
        'Page does not appear to be paginated',
        { isPaginated: false, hasPaginationLinks: false }
      );
    }

    // URL looks paginated but has no rel="next"/"prev"
    return warn(
      'crawl-pagination-orphaned',
      `URL appears paginated (${label}) but is missing rel="next"/"prev" link tags`,
      {
        url,
        matchedPattern: label,
        hasPaginationLinks: false,
        impact: 'Search engines may not understand the pagination series without rel="next"/"prev"',
        recommendation: 'Add <link rel="next"> and/or <link rel="prev"> to declare the pagination relationship',
      }
    );
  },
});
