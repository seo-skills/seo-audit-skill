import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Common pagination query parameters
 */
const PAGINATION_PARAMS = ['page', 'p', 'pg', 'offset', 'start', 'paged'];

/**
 * Check if URL appears to be a paginated page
 */
function isPaginatedUrl(url: string): { isPaginated: boolean; pageNumber?: number; param?: string } {
  try {
    const urlObj = new URL(url);

    // Check query parameters
    for (const param of PAGINATION_PARAMS) {
      const value = urlObj.searchParams.get(param);
      if (value) {
        const pageNum = parseInt(value, 10);
        if (!isNaN(pageNum) && pageNum > 0) {
          return { isPaginated: true, pageNumber: pageNum, param };
        }
      }
    }

    // Check path patterns like /page/2/ or /2/
    const pathMatch = urlObj.pathname.match(/\/page\/(\d+)\/?$|\/(\d+)\/?$/);
    if (pathMatch) {
      const pageNum = parseInt(pathMatch[1] || pathMatch[2], 10);
      if (!isNaN(pageNum) && pageNum > 1) {
        return { isPaginated: true, pageNumber: pageNum, param: 'path' };
      }
    }

    return { isPaginated: false };
  } catch {
    return { isPaginated: false };
  }
}

/**
 * Normalize URLs for comparison (remove trailing slash, lowercase)
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Normalize: lowercase host, remove trailing slash from path
    let path = urlObj.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${urlObj.protocol}//${urlObj.host.toLowerCase()}${path}${urlObj.search}`;
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Rule: Pagination Canonical Check
 *
 * Verifies that paginated pages have self-referencing canonicals
 * rather than all canonicalizing to page 1.
 */
export const paginationCanonicalRule = defineRule({
  id: 'crawl-pagination-canonical',
  name: 'Pagination Canonical',
  description: 'Checks that paginated pages have self-referencing canonicals',
  category: 'crawl',
  weight: 10,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    // Check if page is paginated
    const paginationInfo = isPaginatedUrl(url);

    // Check for rel="prev" and rel="next" links
    const prevLink = $('link[rel="prev"]').attr('href');
    const nextLink = $('link[rel="next"]').attr('href');
    const hasPaginationLinks = !!(prevLink || nextLink);

    // Check canonical
    const canonical = $('link[rel="canonical"]').attr('href');

    // If not a paginated page and no pagination links, this rule doesn't apply
    if (!paginationInfo.isPaginated && !hasPaginationLinks) {
      return pass(
        'crawl-pagination-canonical',
        'Page does not appear to be paginated',
        {
          isPaginated: false,
          hasPaginationLinks: false,
        }
      );
    }

    // Page is paginated
    const details = {
      isPaginated: paginationInfo.isPaginated,
      pageNumber: paginationInfo.pageNumber,
      paginationMethod: paginationInfo.param,
      hasPrevLink: !!prevLink,
      hasNextLink: !!nextLink,
      canonical: canonical || null,
      currentUrl: url,
    };

    // No canonical tag
    if (!canonical) {
      return warn(
        'crawl-pagination-canonical',
        'Paginated page is missing canonical tag',
        {
          ...details,
          recommendation: 'Add a self-referencing canonical tag to this paginated page',
        }
      );
    }

    // Check if canonical is self-referencing
    const normalizedUrl = normalizeUrl(url);
    const normalizedCanonical = normalizeUrl(canonical);

    if (normalizedUrl === normalizedCanonical) {
      return pass(
        'crawl-pagination-canonical',
        'Paginated page has self-referencing canonical (correct)',
        details
      );
    }

    // Check if canonical points to page 1 (common mistake)
    const canonicalPagination = isPaginatedUrl(canonical);
    const pointsToPageOne =
      !canonicalPagination.isPaginated ||
      canonicalPagination.pageNumber === 1;

    if (pointsToPageOne && paginationInfo.pageNumber && paginationInfo.pageNumber > 1) {
      return fail(
        'crawl-pagination-canonical',
        `Paginated page ${paginationInfo.pageNumber} canonicalizes to page 1 (incorrect)`,
        {
          ...details,
          issue: 'Paginated pages should NOT all canonicalize to page 1',
          recommendation: 'Each paginated page should have a self-referencing canonical',
        }
      );
    }

    // Canonical points somewhere else
    return warn(
      'crawl-pagination-canonical',
      'Paginated page canonical does not match current URL',
      {
        ...details,
        recommendation: 'Verify this is intentional; typically each paginated page should self-reference',
      }
    );
  },
});
