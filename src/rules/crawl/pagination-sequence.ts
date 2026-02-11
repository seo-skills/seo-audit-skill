import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Normalize URL for comparison
 * Lowercases host, removes trailing slash, preserves query string
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
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
 * Rule: Pagination Sequence Validation
 *
 * Validates that pagination rel="next" and rel="prev" links on the
 * same page are different from each other. If both point to the same
 * URL, the pagination sequence is broken, confusing search engines
 * about the page ordering.
 */
export const paginationSequenceRule = defineRule({
  id: 'crawl-pagination-sequence',
  name: 'Pagination Sequence Validation',
  description: 'Checks if pagination follows proper sequence (next and prev are different)',
  category: 'crawl',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    const nextHref = $('link[rel="next"]').attr('href');
    const prevHref = $('link[rel="prev"]').attr('href');

    // Rule only applies when both next and prev are present
    if (!nextHref || !prevHref) {
      return pass(
        'crawl-pagination-sequence',
        nextHref || prevHref
          ? 'Only one pagination direction present (sequence check not applicable)'
          : 'No pagination links found',
        {
          hasNext: !!nextHref,
          hasPrev: !!prevHref,
        }
      );
    }

    // Resolve both to absolute URLs
    let resolvedNext: string;
    let resolvedPrev: string;

    try {
      resolvedNext = new URL(nextHref, url).href;
    } catch {
      // Invalid URL handled by pagination-broken rule
      return pass(
        'crawl-pagination-sequence',
        'Cannot validate sequence: next link URL is invalid',
        { nextHref, prevHref }
      );
    }

    try {
      resolvedPrev = new URL(prevHref, url).href;
    } catch {
      // Invalid URL handled by pagination-broken rule
      return pass(
        'crawl-pagination-sequence',
        'Cannot validate sequence: prev link URL is invalid',
        { nextHref, prevHref }
      );
    }

    const normalizedNext = normalizeUrl(resolvedNext);
    const normalizedPrev = normalizeUrl(resolvedPrev);

    const details = {
      currentUrl: url,
      nextHref,
      prevHref,
      resolvedNext,
      resolvedPrev,
    };

    if (normalizedNext === normalizedPrev) {
      return fail(
        'crawl-pagination-sequence',
        'Pagination next and prev links point to the same URL (broken sequence)',
        {
          ...details,
          impact: 'Search engines cannot determine the correct page ordering',
          recommendation: 'Ensure rel="next" and rel="prev" point to different pages in the series',
        }
      );
    }

    return pass(
      'crawl-pagination-sequence',
      'Pagination next and prev links point to different pages (correct sequence)',
      details
    );
  },
});
