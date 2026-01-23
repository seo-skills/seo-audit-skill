/**
 * URL Filter Module
 * Provides URL filtering with glob patterns and query parameter normalization
 */

export interface UrlFilterOptions {
  /** Patterns for URLs to include (if empty, all URLs are included) */
  include: string[];
  /** Patterns for URLs to exclude */
  exclude: string[];
  /** Query parameter names to keep */
  allowQueryParams: string[];
  /** Query parameter prefixes to remove (e.g., 'utm_') */
  dropQueryPrefixes: string[];
}

/**
 * Convert a glob pattern to a regular expression
 * Supports:
 * - `*` matches any character except `/`
 * - `**` matches any character including `/`
 * - `?` matches a single character
 * - Literal characters are escaped
 */
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except our glob ones
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Handle ** first (must come before * handling)
  // Use a placeholder to avoid double-processing
  regexStr = regexStr.replace(/\*\*/g, '\x00GLOBSTAR\x00');

  // Handle single * (matches anything except /)
  regexStr = regexStr.replace(/\*/g, '[^/]*');

  // Handle ? (matches single character)
  regexStr = regexStr.replace(/\?/g, '.');

  // Replace the placeholder with the real globstar pattern
  regexStr = regexStr.replace(/\x00GLOBSTAR\x00/g, '.*');

  // Handle pattern ending with /** - should also match the base path
  // e.g., /admin/** should match both /admin and /admin/users
  if (pattern.endsWith('/**')) {
    // Pattern like /admin/** should match /admin, /admin/, /admin/anything
    const basePattern = regexStr.slice(0, -3); // Remove '.*' at the end
    regexStr = `${basePattern}(/.*)?`;
  }

  return new RegExp(`^${regexStr}$`);
}

/**
 * URL Filter class for controlling which URLs should be crawled
 */
export class UrlFilter {
  private includePatterns: RegExp[];
  private excludePatterns: RegExp[];
  private allowQueryParams: Set<string>;
  private dropQueryPrefixes: string[];

  constructor(options: Partial<UrlFilterOptions> = {}) {
    this.includePatterns = (options.include ?? []).map(globToRegex);
    this.excludePatterns = (options.exclude ?? []).map(globToRegex);
    this.allowQueryParams = new Set(options.allowQueryParams ?? []);
    this.dropQueryPrefixes = options.dropQueryPrefixes ?? ['utm_', 'gclid', 'fbclid', 'mc_', '_ga'];
  }

  /**
   * Check if a URL should be crawled based on include/exclude patterns
   * @param url - Full URL or pathname to check
   * @returns true if the URL should be crawled
   */
  shouldCrawl(url: string): boolean {
    let pathname: string;

    try {
      const urlObj = new URL(url);
      pathname = urlObj.pathname;
    } catch {
      // If not a valid URL, treat as pathname
      pathname = url.startsWith('/') ? url : `/${url}`;
    }

    // If include patterns exist, URL must match at least one
    if (this.includePatterns.length > 0) {
      const matchesInclude = this.includePatterns.some(pattern => pattern.test(pathname));
      if (!matchesInclude) {
        return false;
      }
    }

    // Check exclude patterns - if any match, don't crawl
    if (this.excludePatterns.length > 0) {
      const matchesExclude = this.excludePatterns.some(pattern => pattern.test(pathname));
      if (matchesExclude) {
        return false;
      }
    }

    return true;
  }

  /**
   * Normalize a URL by removing unwanted query parameters
   * @param url - URL to normalize
   * @returns Normalized URL string
   */
  normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Remove hash fragment
      urlObj.hash = '';

      // Process query parameters
      const paramsToDelete: string[] = [];

      urlObj.searchParams.forEach((_, key) => {
        // Check if this param should be dropped by prefix
        const shouldDropByPrefix = this.dropQueryPrefixes.some(prefix =>
          key.toLowerCase().startsWith(prefix.toLowerCase())
        );

        // Keep the param only if it's in the allow list or not dropped by prefix
        if (this.allowQueryParams.size > 0) {
          // If allowQueryParams is specified, only keep those
          if (!this.allowQueryParams.has(key)) {
            paramsToDelete.push(key);
          }
        } else if (shouldDropByPrefix) {
          // If no allowQueryParams, just drop the prefix-matched ones
          paramsToDelete.push(key);
        }
      });

      // Delete the params after iteration
      for (const key of paramsToDelete) {
        urlObj.searchParams.delete(key);
      }

      // Sort remaining params for consistent normalization
      urlObj.searchParams.sort();

      // Get normalized href
      let normalized = urlObj.href;

      // Remove trailing slash (except for root)
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }

      return normalized;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL matches a specific pattern
   * @param url - URL or pathname to check
   * @param pattern - Glob pattern to match against
   * @returns true if URL matches the pattern
   */
  matchesPattern(url: string, pattern: string): boolean {
    let pathname: string;

    try {
      const urlObj = new URL(url);
      pathname = urlObj.pathname;
    } catch {
      pathname = url.startsWith('/') ? url : `/${url}`;
    }

    const regex = globToRegex(pattern);
    return regex.test(pathname);
  }
}

/**
 * Create a URL filter instance with options
 * @param options - Filter configuration
 * @returns UrlFilter instance
 */
export function createUrlFilter(options?: Partial<UrlFilterOptions>): UrlFilter {
  return new UrlFilter(options);
}

/**
 * Export globToRegex for testing
 */
export { globToRegex };
