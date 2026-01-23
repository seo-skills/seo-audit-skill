import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchUrl, fetchPage } from '../../crawler/fetcher.js';

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
 * Rule: Check that a sitemap exists
 */
export const sitemapExistsRule = defineRule({
  id: 'technical-sitemap-exists',
  name: 'Sitemap Exists',
  description:
    'Checks that a sitemap.xml exists at /sitemap.xml or is referenced in robots.txt',
  category: 'technical',
  weight: 1,
  run: async (context: AuditContext) => {
    const baseUrl = getBaseUrl(context.url);
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const robotsTxtUrl = `${baseUrl}/robots.txt`;

    const checkedLocations: string[] = [];
    const foundSitemaps: string[] = [];

    // Check default /sitemap.xml location
    try {
      const statusCode = await fetchUrl(sitemapUrl);
      checkedLocations.push(sitemapUrl);

      if (statusCode === 200) {
        foundSitemaps.push(sitemapUrl);
      }
    } catch {
      // Continue to check robots.txt
    }

    // Check robots.txt for sitemap references
    try {
      const robotsResult = await fetchPage(robotsTxtUrl);
      if (robotsResult.statusCode === 200) {
        const sitemapsInRobots = extractSitemapUrlsFromRobotsTxt(robotsResult.html);

        for (const sitemapUrlFromRobots of sitemapsInRobots) {
          if (!foundSitemaps.includes(sitemapUrlFromRobots)) {
            checkedLocations.push(sitemapUrlFromRobots);

            try {
              const statusCode = await fetchUrl(sitemapUrlFromRobots);
              if (statusCode === 200) {
                foundSitemaps.push(sitemapUrlFromRobots);
              }
            } catch {
              // Sitemap URL from robots.txt is not accessible
            }
          }
        }
      }
    } catch {
      // Could not check robots.txt
    }

    if (foundSitemaps.length > 0) {
      return pass(
        'technical-sitemap-exists',
        `Sitemap found: ${foundSitemaps.length} sitemap(s) accessible`,
        {
          foundSitemaps,
          checkedLocations,
        }
      );
    }

    if (checkedLocations.length === 1) {
      return fail(
        'technical-sitemap-exists',
        'No sitemap.xml found at default location and no sitemap referenced in robots.txt',
        {
          checkedLocations,
          foundSitemaps: [],
        }
      );
    }

    return warn(
      'technical-sitemap-exists',
      `Sitemap referenced in robots.txt but not accessible (checked ${checkedLocations.length} locations)`,
      {
        checkedLocations,
        foundSitemaps: [],
      }
    );
  },
});
