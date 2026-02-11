import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Common query parameter names used by internal search implementations.
 */
const SEARCH_PARAMS = new Set([
  'q',
  'query',
  'search',
  's',
  'keyword',
  'keywords',
  'search_query',
  'searchterm',
  'search_term',
  'terme',
  'buscar',
  'recherche',
  'suche',
]);

/**
 * Path segments that commonly indicate search results pages.
 */
const SEARCH_PATH_PATTERNS = [
  /\/search\/?$/i,
  /\/results\/?$/i,
  /\/search-results\/?$/i,
  /\/site-search\/?$/i,
];

/**
 * Rule: Check if URL looks like an internal search results page
 *
 * Internal search results pages typically have thin, duplicate content
 * with little SEO value. They should be blocked from indexing using
 * noindex directives or robots.txt to prevent crawl budget waste.
 */
export const internalSearchRule = defineRule({
  id: 'url-internal-search',
  name: 'Internal Search URL',
  description:
    'Checks if the URL appears to be an internal search results page that should be noindexed',
  category: 'url',
  weight: 4,
  run: async (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const params = urlObj.searchParams;

      // Check if any query parameter matches search patterns
      let matchedParam: string | null = null;
      for (const key of params.keys()) {
        if (SEARCH_PARAMS.has(key.toLowerCase())) {
          matchedParam = key;
          break;
        }
      }

      // Check if the path matches search result patterns
      let matchedPath = false;
      for (const pattern of SEARCH_PATH_PATTERNS) {
        if (pattern.test(pathname)) {
          matchedPath = true;
          break;
        }
      }

      // Both a search path and search parameter strongly indicate a search page
      if (matchedPath && matchedParam) {
        return warn(
          'url-internal-search',
          `URL appears to be an internal search page (path: ${pathname}, param: ${matchedParam})`,
          {
            url,
            path: pathname,
            searchParameter: matchedParam,
            searchValue: params.get(matchedParam) || '',
            fix: 'Add noindex directive to prevent search result pages from being indexed',
          }
        );
      }

      // A search parameter alone is a strong signal
      if (matchedParam) {
        return warn(
          'url-internal-search',
          `URL may be an internal search page (param: ${matchedParam}=${params.get(matchedParam) || ''})`,
          {
            url,
            path: pathname,
            searchParameter: matchedParam,
            searchValue: params.get(matchedParam) || '',
            fix: 'Add noindex directive to prevent search result pages from being indexed',
          }
        );
      }

      // A search path without parameters could be a search landing page
      if (matchedPath && params.toString().length > 0) {
        return warn(
          'url-internal-search',
          `URL path suggests a search results page: ${pathname}`,
          {
            url,
            path: pathname,
            fix: 'Add noindex directive if this is an internal search results page',
          }
        );
      }

      return pass(
        'url-internal-search',
        'URL does not appear to be an internal search page',
        { url }
      );
    } catch {
      return pass('url-internal-search', 'Could not parse URL', { url });
    }
  },
});
