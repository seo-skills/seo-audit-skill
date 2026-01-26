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
 * Get hostname from URL
 */
function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
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
 * Rule: Sitemap Domain Validation
 *
 * Validates that all URLs in the sitemap belong to the expected domain.
 * Search engines will ignore URLs that don't match the sitemap's domain.
 */
export const sitemapDomainRule = defineRule({
  id: 'crawl-sitemap-domain',
  name: 'Sitemap Domain Validation',
  description: 'Checks that all sitemap URLs belong to the expected domain',
  category: 'crawl',
  weight: 15,
  run: async (context: AuditContext) => {
    const baseUrl = getBaseUrl(context.url);
    const expectedHostname = getHostname(baseUrl);

    if (!expectedHostname) {
      return fail(
        'crawl-sitemap-domain',
        'Could not determine expected domain from URL',
        { url: context.url }
      );
    }

    // Also accept www and non-www variants
    const acceptableHostnames = new Set<string>();
    acceptableHostnames.add(expectedHostname);
    if (expectedHostname.startsWith('www.')) {
      acceptableHostnames.add(expectedHostname.substring(4));
    } else {
      acceptableHostnames.add('www.' + expectedHostname);
    }

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

    if (!sitemapContent) {
      return warn(
        'crawl-sitemap-domain',
        'Could not find sitemap to validate',
        { checkedUrls: [sitemapUrl, robotsTxtUrl] }
      );
    }

    // Extract URLs from sitemap
    const sitemapUrls = extractUrlsFromSitemap(sitemapContent);
    const isIndex = isSitemapIndex(sitemapContent);

    if (sitemapUrls.length === 0) {
      return warn(
        'crawl-sitemap-domain',
        isIndex ? 'Sitemap index contains no sitemap URLs' : 'Sitemap contains no page URLs',
        { sitemapUrl: fetchedSitemapUrl, isSitemapIndex: isIndex }
      );
    }

    // Check each URL's domain
    const invalidDomainUrls: { url: string; hostname: string }[] = [];

    for (const url of sitemapUrls) {
      const hostname = getHostname(url);
      if (hostname && !acceptableHostnames.has(hostname)) {
        invalidDomainUrls.push({ url, hostname });
      }
    }

    const details = {
      sitemapUrl: fetchedSitemapUrl,
      isSitemapIndex: isIndex,
      totalUrls: sitemapUrls.length,
      expectedHostnames: Array.from(acceptableHostnames),
      invalidCount: invalidDomainUrls.length,
      invalidDomainUrls: invalidDomainUrls.slice(0, 10), // Limit to first 10
    };

    if (invalidDomainUrls.length === 0) {
      return pass(
        'crawl-sitemap-domain',
        `All ${sitemapUrls.length} sitemap URLs belong to the expected domain`,
        details
      );
    }

    // Calculate severity based on percentage
    const invalidPercent = (invalidDomainUrls.length / sitemapUrls.length) * 100;

    if (invalidPercent > 10) {
      return fail(
        'crawl-sitemap-domain',
        `${invalidDomainUrls.length} of ${sitemapUrls.length} sitemap URLs (${invalidPercent.toFixed(1)}%) have incorrect domain`,
        {
          ...details,
          impact: 'Search engines will ignore URLs that do not match the sitemap domain',
          recommendation: 'Remove cross-domain URLs from the sitemap or fix incorrect domain formatting',
        }
      );
    }

    return warn(
      'crawl-sitemap-domain',
      `${invalidDomainUrls.length} sitemap URL(s) have different domain than expected`,
      {
        ...details,
        recommendation: 'Review and remove cross-domain URLs from the sitemap',
      }
    );
  },
});
