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
 * Rule: Pagination Loop Detection
 *
 * Detects when pagination rel="next" or rel="prev" links point back
 * to the current page, creating an infinite loop. This causes search
 * engine crawlers to waste crawl budget and can prevent proper
 * indexing of paginated content.
 */
export const paginationLoopRule = defineRule({
  id: 'crawl-pagination-loop',
  name: 'Pagination Loop Detection',
  description: 'Checks if pagination creates a loop by pointing back to the current page',
  category: 'crawl',
  weight: 6,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    const nextHref = $('link[rel="next"]').attr('href');
    const prevHref = $('link[rel="prev"]').attr('href');

    // No pagination links - rule does not apply
    if (!nextHref && !prevHref) {
      return pass(
        'crawl-pagination-loop',
        'No pagination links found (rel="next"/"prev")',
        { hasPagination: false }
      );
    }

    const normalizedCurrentUrl = normalizeUrl(url);
    const loops: { rel: string; href: string }[] = [];

    if (nextHref) {
      try {
        const resolvedNext = new URL(nextHref, url).href;
        if (normalizeUrl(resolvedNext) === normalizedCurrentUrl) {
          loops.push({ rel: 'next', href: nextHref });
        }
      } catch {
        // Invalid URL handled by pagination-broken rule
      }
    }

    if (prevHref) {
      try {
        const resolvedPrev = new URL(prevHref, url).href;
        if (normalizeUrl(resolvedPrev) === normalizedCurrentUrl) {
          loops.push({ rel: 'prev', href: prevHref });
        }
      } catch {
        // Invalid URL handled by pagination-broken rule
      }
    }

    const details = {
      currentUrl: url,
      nextHref: nextHref || null,
      prevHref: prevHref || null,
      loops,
    };

    if (loops.length > 0) {
      const loopRels = loops.map((l) => `rel="${l.rel}"`).join(' and ');
      return fail(
        'crawl-pagination-loop',
        `Pagination ${loopRels} points back to the current page (infinite loop)`,
        {
          ...details,
          impact: 'Pagination loops waste crawl budget and prevent proper indexing of paginated series',
          recommendation: 'Fix pagination links to point to the correct next/previous page in the series',
        }
      );
    }

    return pass(
      'crawl-pagination-loop',
      'Pagination links do not create a loop',
      details
    );
  },
});
