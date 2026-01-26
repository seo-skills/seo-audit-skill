import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchPage } from '../../crawler/fetcher.js';

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
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Normalize: lowercase host, remove trailing slash, remove query params for comparison
    let path = urlObj.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${urlObj.protocol}//${urlObj.host.toLowerCase()}${path}`;
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Check if page has noindex directive
 */
function hasNoindex($: AuditContext['$'], headers: Record<string, string>): boolean {
  // Check meta robots
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  if (/noindex/i.test(robotsMeta)) {
    return true;
  }

  // Check googlebot meta
  const googlebotMeta = $('meta[name="googlebot"]').attr('content') || '';
  if (/noindex/i.test(googlebotMeta)) {
    return true;
  }

  // Check X-Robots-Tag header
  const xRobotsTag = headers['x-robots-tag'] || headers['X-Robots-Tag'] || '';
  if (/noindex/i.test(xRobotsTag)) {
    return true;
  }

  return false;
}

/**
 * Extracts sitemap URLs from robots.txt content
 */
function extractSitemapUrlsFromRobotsTxt(content: string): string[] {
  const sitemapUrls: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith('sitemap:')) {
      const url = line.substring(line.indexOf(':') + 1).trim();
      if (url) {
        sitemapUrls.push(url);
      }
    }
  }

  return sitemapUrls;
}

/**
 * Extracts URLs from sitemap XML content
 */
function extractUrlsFromSitemap(content: string): string[] {
  const urls: string[] = [];

  // Match <loc>...</loc> tags
  const locRegex = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(content)) !== null) {
    const url = match[1].trim();
    if (url) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * Check if sitemap is a sitemap index
 */
function isSitemapIndex(content: string): boolean {
  return /<sitemapindex[\s>]/i.test(content);
}

/**
 * Rule: Noindex in Sitemap
 *
 * Detects when the current page has a noindex directive but is listed
 * in the sitemap. This creates conflicting signals for search engines.
 */
export const noindexInSitemapRule = defineRule({
  id: 'crawl-noindex-in-sitemap',
  name: 'Noindex in Sitemap',
  description: 'Checks for noindexed pages listed in sitemap',
  category: 'crawl',
  weight: 15,
  run: async (context: AuditContext) => {
    const { $, url, headers } = context;

    // First check if current page is noindexed
    const isNoindexed = hasNoindex($, headers);

    // If page is not noindexed, this rule passes (no conflict possible)
    if (!isNoindexed) {
      return pass(
        'crawl-noindex-in-sitemap',
        'Page is indexable (no noindex directive)',
        { isNoindexed: false }
      );
    }

    // Page is noindexed - now check if it's in the sitemap
    const baseUrl = getBaseUrl(url);
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const robotsTxtUrl = `${baseUrl}/robots.txt`;

    // Try to fetch sitemap
    let sitemapContent: string | null = null;
    let fetchedSitemapUrl = sitemapUrl;

    try {
      const result = await fetchPage(sitemapUrl);
      if (result.statusCode === 200) {
        sitemapContent = result.html;
      }
    } catch {
      // Try from robots.txt
    }

    // If not found, try from robots.txt
    if (!sitemapContent) {
      try {
        const robotsResult = await fetchPage(robotsTxtUrl);
        if (robotsResult.statusCode === 200) {
          const sitemapsInRobots = extractSitemapUrlsFromRobotsTxt(robotsResult.html);
          if (sitemapsInRobots.length > 0) {
            fetchedSitemapUrl = sitemapsInRobots[0];
            const result = await fetchPage(fetchedSitemapUrl);
            if (result.statusCode === 200) {
              sitemapContent = result.html;
            }
          }
        }
      } catch {
        // Could not fetch
      }
    }

    // If we can't get the sitemap, we can't check for conflict
    if (!sitemapContent) {
      return warn(
        'crawl-noindex-in-sitemap',
        'Page has noindex but could not verify sitemap status',
        {
          isNoindexed: true,
          sitemapChecked: false,
          checkedUrls: [sitemapUrl, robotsTxtUrl],
        }
      );
    }

    // Handle sitemap index - check first level sitemaps
    const isIndex = isSitemapIndex(sitemapContent);
    let allSitemapUrls: string[] = [];

    if (isIndex) {
      // Get URLs of child sitemaps
      const childSitemapUrls = extractUrlsFromSitemap(sitemapContent);
      // Fetch first child sitemap to check (limit HTTP requests)
      for (const childUrl of childSitemapUrls.slice(0, 3)) {
        try {
          const childResult = await fetchPage(childUrl);
          if (childResult.statusCode === 200 && !isSitemapIndex(childResult.html)) {
            const urls = extractUrlsFromSitemap(childResult.html);
            allSitemapUrls.push(...urls);
          }
        } catch {
          // Skip failed child sitemaps
        }
      }
    } else {
      allSitemapUrls = extractUrlsFromSitemap(sitemapContent);
    }

    // Normalize current URL for comparison
    const normalizedCurrentUrl = normalizeUrl(url);

    // Check if current URL is in sitemap
    const isInSitemap = allSitemapUrls.some(
      (sitemapEntry) => normalizeUrl(sitemapEntry) === normalizedCurrentUrl
    );

    if (isInSitemap) {
      return fail(
        'crawl-noindex-in-sitemap',
        'Page has noindex directive but is listed in sitemap (conflicting signals)',
        {
          isNoindexed: true,
          isInSitemap: true,
          sitemapUrl: fetchedSitemapUrl,
          isSitemapIndex: isIndex,
          impact: 'Sitemaps indicate pages should be indexed; noindex contradicts this',
          recommendation: 'Either remove the page from sitemap or remove the noindex directive',
        }
      );
    }

    return pass(
      'crawl-noindex-in-sitemap',
      'Page has noindex and is not in sitemap (consistent)',
      {
        isNoindexed: true,
        isInSitemap: false,
        sitemapUrl: fetchedSitemapUrl,
        urlsChecked: allSitemapUrls.length,
      }
    );
  },
});
