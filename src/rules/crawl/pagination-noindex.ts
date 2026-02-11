import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Check if page has a noindex directive via meta tags or headers
 */
function hasNoindex($: AuditContext['$'], headers: Record<string, string>): {
  isNoindexed: boolean;
  sources: string[];
} {
  const sources: string[] = [];

  // Check meta robots
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  if (/noindex/i.test(robotsMeta)) {
    sources.push('meta[name="robots"]');
  }

  // Check googlebot meta
  const googlebotMeta = $('meta[name="googlebot"]').attr('content') || '';
  if (/noindex/i.test(googlebotMeta)) {
    sources.push('meta[name="googlebot"]');
  }

  // Check X-Robots-Tag header
  const xRobotsTag = headers['x-robots-tag'] || headers['X-Robots-Tag'] || '';
  if (/noindex/i.test(xRobotsTag)) {
    sources.push('X-Robots-Tag header');
  }

  return { isNoindexed: sources.length > 0, sources };
}

/**
 * Rule: Pagination Noindex Check
 *
 * Detects when paginated pages (those with rel="next" or rel="prev")
 * have a noindex directive. Google recommends NOT applying noindex to
 * paginated pages, as it prevents content on those pages from being
 * discovered and indexed.
 */
export const paginationNoindexRule = defineRule({
  id: 'crawl-pagination-noindex',
  name: 'Pagination Noindex Check',
  description: 'Checks if paginated pages have noindex directive',
  category: 'crawl',
  weight: 6,
  run: async (context: AuditContext) => {
    const { $, headers } = context;

    const nextLink = $('link[rel="next"]').attr('href');
    const prevLink = $('link[rel="prev"]').attr('href');
    const isPaginated = !!(nextLink || prevLink);

    // Rule only applies to paginated pages
    if (!isPaginated) {
      return pass(
        'crawl-pagination-noindex',
        'Page is not paginated (no rel="next"/"prev" links)',
        { isPaginated: false }
      );
    }

    const { isNoindexed, sources } = hasNoindex($, headers);

    const details = {
      isPaginated: true,
      hasNext: !!nextLink,
      hasPrev: !!prevLink,
      isNoindexed,
      noindexSources: sources,
    };

    if (isNoindexed) {
      return warn(
        'crawl-pagination-noindex',
        `Paginated page has noindex directive (via ${sources.join(', ')})`,
        {
          ...details,
          impact: 'Noindexing paginated pages prevents content discovery and can break pagination series',
          recommendation: 'Remove noindex from paginated pages; use rel="canonical" to consolidate signals instead',
        }
      );
    }

    return pass(
      'crawl-pagination-noindex',
      'Paginated page is not noindexed (correct)',
      details
    );
  },
});
