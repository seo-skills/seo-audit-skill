import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchPage } from '../../crawler/fetcher.js';
import { RobotsMatcher } from '../../crawler/robots.js';

/**
 * Extracts the base URL (origin) from a full URL
 */
function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch {
    return url;
  }
}

/**
 * Get path from URL
 */
function getPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}

/**
 * Check if page has noindex directive
 */
function getNoindexDirectives(
  $: AuditContext['$'],
  headers: Record<string, string>
): string[] {
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

  return sources;
}

/**
 * Rule: Indexability Conflict
 *
 * Detects conflicting signals between robots.txt and meta/header directives.
 * Conflicts create ambiguous instructions for search engines.
 */
export const indexabilityConflictRule = defineRule({
  id: 'crawl-indexability-conflict',
  name: 'Indexability Conflict',
  description: 'Detects conflicts between robots.txt and noindex directives',
  category: 'crawl',
  weight: 15,
  run: async (context: AuditContext) => {
    const { $, url, headers } = context;

    // Get noindex sources
    const noindexSources = getNoindexDirectives($, headers);
    const hasNoindex = noindexSources.length > 0;

    // Fetch and parse robots.txt
    const baseUrl = getBaseUrl(url);
    const robotsTxtUrl = `${baseUrl}/robots.txt`;
    const pagePath = getPath(url);

    let robotsTxtStatus: 'accessible' | 'not-found' | 'error' = 'not-found';
    // The audit has usually fetched robots.txt already; fetch it here only to
    // tell a missing file from an unreachable one when it has not.
    let robotsTxt = context.robotsTxtContent;
    if (robotsTxt !== undefined) {
      robotsTxtStatus = 'accessible';
    } else {
      try {
        const result = await fetchPage(robotsTxtUrl);
        if (result.statusCode === 200) {
          robotsTxtStatus = 'accessible';
          robotsTxt = result.html;
        } else if (result.statusCode !== 404) {
          robotsTxtStatus = 'error';
        }
      } catch {
        robotsTxtStatus = 'error';
      }
    }

    // A search engine obeys only the most specific group naming it, so read
    // Googlebot's group, as the score cap does. Pooling the Disallow lines of
    // every group flagged pages Googlebot is allowed to crawl.
    const verdict =
      robotsTxt !== undefined
        ? new RobotsMatcher(robotsTxt, 'Googlebot').explain(url)
        : { allowed: true, pattern: null };
    const isDisallowed = !verdict.allowed;
    const matchedRule = verdict.pattern;

    const details = {
      url: pagePath,
      robotsTxtStatus,
      hasNoindex,
      noindexSources,
      isDisallowedByRobotsTxt: isDisallowed,
      matchedDisallowRule: matchedRule,
    };

    // No robots.txt - can't have conflict
    if (robotsTxtStatus !== 'accessible') {
      return pass(
        'crawl-indexability-conflict',
        robotsTxtStatus === 'not-found'
          ? 'No robots.txt found (no conflict possible)'
          : 'Could not access robots.txt to check for conflicts',
        details
      );
    }

    // Case 1: robots.txt disallows AND page has noindex
    // This is redundant - search engines can't crawl to see the noindex
    if (isDisallowed && hasNoindex) {
      return warn(
        'crawl-indexability-conflict',
        `Page is blocked by robots.txt AND has noindex (redundant)`,
        {
          ...details,
          conflictType: 'redundant-noindex',
          impact: 'Search engines cannot crawl the page to see the noindex directive',
          recommendation:
            'Choose one method: either block in robots.txt OR use noindex, not both',
        }
      );
    }

    // Case 2: robots.txt allows but page has noindex
    // This works but can be confusing
    if (!isDisallowed && hasNoindex) {
      return pass(
        'crawl-indexability-conflict',
        'robots.txt allows crawling, noindex prevents indexing (functional but check if intentional)',
        {
          ...details,
          conflictType: 'none',
          note: 'This is a valid configuration if you want the page crawlable but not indexed',
        }
      );
    }

    // Case 3: robots.txt disallows but page has no noindex
    // Page might get indexed via external links
    if (isDisallowed && !hasNoindex) {
      return warn(
        'crawl-indexability-conflict',
        `Page blocked by robots.txt (${matchedRule}) but has no noindex`,
        {
          ...details,
          conflictType: 'blocked-but-indexable',
          impact: 'Page could still be indexed if linked from other sites',
          recommendation:
            'Add noindex if you want to guarantee no indexing, or allow crawling in robots.txt',
        }
      );
    }

    // No conflict: robots.txt allows and page is indexable
    return pass(
      'crawl-indexability-conflict',
      'No indexability conflict detected',
      details
    );
  },
});
