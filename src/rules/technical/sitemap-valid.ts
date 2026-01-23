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
 * Validates sitemap XML structure
 */
function validateSitemapXml(content: string): {
  isValid: boolean;
  isSitemapIndex: boolean;
  urlCount: number;
  issues: string[];
} {
  const issues: string[] = [];
  let isSitemapIndex = false;
  let urlCount = 0;

  // Check for XML declaration or root elements
  const trimmedContent = content.trim();

  // Check if it looks like XML
  if (!trimmedContent.startsWith('<?xml') && !trimmedContent.startsWith('<')) {
    issues.push('Content does not appear to be valid XML');
    return { isValid: false, isSitemapIndex: false, urlCount: 0, issues };
  }

  // Check for sitemap namespace or root element
  const hasUrlsetTag = /<urlset[\s>]/i.test(content);
  const hasSitemapindexTag = /<sitemapindex[\s>]/i.test(content);

  if (!hasUrlsetTag && !hasSitemapindexTag) {
    issues.push('Missing <urlset> or <sitemapindex> root element');
    return { isValid: false, isSitemapIndex: false, urlCount: 0, issues };
  }

  isSitemapIndex = hasSitemapindexTag;

  // Count URLs
  if (isSitemapIndex) {
    // Count <sitemap> entries in sitemap index
    const sitemapMatches = content.match(/<sitemap[\s>]/gi);
    urlCount = sitemapMatches ? sitemapMatches.length : 0;

    // Check for <loc> tags
    const locMatches = content.match(/<loc>/gi);
    if (!locMatches || locMatches.length === 0) {
      issues.push('Sitemap index contains no <loc> tags');
    }
  } else {
    // Count <url> entries in regular sitemap
    const urlMatches = content.match(/<url[\s>]/gi);
    urlCount = urlMatches ? urlMatches.length : 0;

    // Check for <loc> tags
    const locMatches = content.match(/<loc>/gi);
    if (!locMatches || locMatches.length === 0) {
      issues.push('Sitemap contains no <loc> tags');
    }

    // Warn if sitemap has no URLs
    if (urlCount === 0) {
      issues.push('Sitemap contains no <url> entries');
    }
  }

  // Check for proper closing tags
  if (hasUrlsetTag && !/<\/urlset>/i.test(content)) {
    issues.push('Missing closing </urlset> tag');
  }

  if (hasSitemapindexTag && !/<\/sitemapindex>/i.test(content)) {
    issues.push('Missing closing </sitemapindex> tag');
  }

  // Check for sitemap namespace (recommended)
  const hasSitemapNamespace =
    /xmlns\s*=\s*["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap/i.test(content);
  if (!hasSitemapNamespace) {
    issues.push(
      'Missing sitemap namespace (xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")'
    );
  }

  return {
    isValid: issues.length === 0,
    isSitemapIndex,
    urlCount,
    issues,
  };
}

/**
 * Rule: Check that sitemap has valid XML structure
 */
export const sitemapValidRule = defineRule({
  id: 'technical-sitemap-valid',
  name: 'Sitemap Valid Structure',
  description:
    'Checks that the sitemap has valid XML structure with proper elements',
  category: 'technical',
  weight: 1,
  run: async (context: AuditContext) => {
    const baseUrl = getBaseUrl(context.url);
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const robotsTxtUrl = `${baseUrl}/robots.txt`;

    // Try to find a sitemap
    let sitemapContent: string | null = null;
    let validatedUrl = sitemapUrl;

    // First try default location
    try {
      const result = await fetchPage(sitemapUrl);
      if (result.statusCode === 200) {
        sitemapContent = result.html;
      }
    } catch {
      // Continue to try robots.txt
    }

    // If not found, try from robots.txt
    if (!sitemapContent) {
      try {
        const robotsResult = await fetchPage(robotsTxtUrl);
        if (robotsResult.statusCode === 200) {
          const sitemapsInRobots = extractSitemapUrlsFromRobotsTxt(robotsResult.html);
          if (sitemapsInRobots.length > 0) {
            validatedUrl = sitemapsInRobots[0];
            const result = await fetchPage(validatedUrl);
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
        'technical-sitemap-valid',
        'Could not find sitemap to validate',
        { checkedUrls: [sitemapUrl, robotsTxtUrl] }
      );
    }

    const validation = validateSitemapXml(sitemapContent);

    if (validation.isValid) {
      return pass(
        'technical-sitemap-valid',
        `Sitemap has valid XML structure (${validation.urlCount} ${validation.isSitemapIndex ? 'sitemaps' : 'URLs'})`,
        {
          url: validatedUrl,
          isSitemapIndex: validation.isSitemapIndex,
          urlCount: validation.urlCount,
        }
      );
    }

    // Has issues but might still be functional
    if (validation.urlCount > 0) {
      return warn(
        'technical-sitemap-valid',
        `Sitemap has ${validation.issues.length} validation issue(s) but contains ${validation.urlCount} entries`,
        {
          url: validatedUrl,
          isSitemapIndex: validation.isSitemapIndex,
          urlCount: validation.urlCount,
          issues: validation.issues,
        }
      );
    }

    return fail(
      'technical-sitemap-valid',
      'Sitemap has invalid XML structure',
      {
        url: validatedUrl,
        issues: validation.issues,
      }
    );
  },
});
