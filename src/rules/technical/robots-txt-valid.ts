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
 * Validates robots.txt content syntax
 * Returns an object with validation results
 */
function validateRobotsTxt(content: string): {
  isValid: boolean;
  hasUserAgent: boolean;
  hasDirectives: boolean;
  issues: string[];
  userAgents: string[];
  sitemapUrls: string[];
} {
  const lines = content.split('\n').map((line) => line.trim());
  const issues: string[] = [];
  const userAgents: string[] = [];
  const sitemapUrls: string[] = [];
  let hasUserAgent = false;
  let hasDirectives = false;
  let currentUserAgent = false;

  const validDirectives = [
    'user-agent',
    'allow',
    'disallow',
    'sitemap',
    'crawl-delay',
    'host',
    'clean-param',
    'request-rate',
    'visit-time',
    'noindex',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Check for directive format
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      issues.push(`Line ${lineNum}: Invalid format (no colon found): "${line}"`);
      continue;
    }

    const directive = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    // Validate directive name
    if (!validDirectives.includes(directive)) {
      issues.push(`Line ${lineNum}: Unknown directive "${directive}"`);
      continue;
    }

    // Track User-agent
    if (directive === 'user-agent') {
      hasUserAgent = true;
      currentUserAgent = true;
      if (value) {
        userAgents.push(value);
      } else {
        issues.push(`Line ${lineNum}: User-agent has no value`);
      }
    }

    // Track Allow/Disallow
    if (directive === 'allow' || directive === 'disallow') {
      hasDirectives = true;
      if (!currentUserAgent && userAgents.length === 0) {
        issues.push(`Line ${lineNum}: ${directive} directive before User-agent`);
      }
    }

    // Track Sitemap
    if (directive === 'sitemap') {
      if (value) {
        sitemapUrls.push(value);
      } else {
        issues.push(`Line ${lineNum}: Sitemap directive has no URL`);
      }
    }
  }

  // Overall validation
  if (!hasUserAgent) {
    issues.unshift('No User-agent directive found');
  }

  if (!hasDirectives && hasUserAgent) {
    issues.push('Has User-agent but no Allow or Disallow directives');
  }

  return {
    isValid: issues.length === 0,
    hasUserAgent,
    hasDirectives,
    issues,
    userAgents,
    sitemapUrls,
  };
}

/**
 * Rule: Check that robots.txt has valid syntax
 */
export const robotsTxtValidRule = defineRule({
  id: 'technical-robots-txt-valid',
  name: 'Robots.txt Valid Syntax',
  description:
    'Checks that robots.txt file has valid syntax with User-agent and Allow/Disallow directives',
  category: 'technical',
  weight: 1,
  run: async (context: AuditContext) => {
    const baseUrl = getBaseUrl(context.url);
    const robotsTxtUrl = `${baseUrl}/robots.txt`;

    try {
      const result = await fetchPage(robotsTxtUrl);

      if (result.statusCode !== 200) {
        return warn(
          'technical-robots-txt-valid',
          `robots.txt returned HTTP ${result.statusCode}, cannot validate`,
          { url: robotsTxtUrl, statusCode: result.statusCode }
        );
      }

      const content = result.html;
      const validation = validateRobotsTxt(content);

      if (validation.isValid) {
        return pass(
          'technical-robots-txt-valid',
          'robots.txt has valid syntax',
          {
            url: robotsTxtUrl,
            userAgents: validation.userAgents,
            sitemapUrls: validation.sitemapUrls,
            hasDirectives: validation.hasDirectives,
          }
        );
      }

      if (!validation.hasUserAgent) {
        return fail(
          'technical-robots-txt-valid',
          'robots.txt missing required User-agent directive',
          {
            url: robotsTxtUrl,
            issues: validation.issues,
          }
        );
      }

      return warn(
        'technical-robots-txt-valid',
        `robots.txt has ${validation.issues.length} syntax issue(s)`,
        {
          url: robotsTxtUrl,
          issues: validation.issues,
          userAgents: validation.userAgents,
          sitemapUrls: validation.sitemapUrls,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(
        'technical-robots-txt-valid',
        `Failed to fetch robots.txt for validation: ${message}`,
        { url: robotsTxtUrl, error: message }
      );
    }
  },
});
