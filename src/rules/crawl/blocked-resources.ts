import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Common resource paths that should not be blocked by robots.txt
 */
const RESOURCE_PATH_PATTERNS = [
  '/css/',
  '/js/',
  '/assets/',
  '/static/',
  '/wp-content/',
  '/wp-includes/',
  '/themes/',
  '/scripts/',
  '/styles/',
];

/**
 * File extension patterns that indicate resource blocking
 */
const RESOURCE_EXTENSION_PATTERNS = [
  '.css',
  '.js',
];

/**
 * Parse robots.txt to extract Disallow rules for relevant user-agents
 */
function extractDisallowRules(content: string): string[] {
  const lines = content.split('\n').map((line) => line.trim());
  const disallowRules: string[] = [];

  let inRelevantUserAgent = false;
  let sawAnyUserAgent = false;

  for (const line of lines) {
    if (line.startsWith('#') || !line) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const directive = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    if (directive === 'user-agent') {
      sawAnyUserAgent = true;
      inRelevantUserAgent =
        value === '*' ||
        value.toLowerCase().includes('googlebot') ||
        value.toLowerCase().includes('bingbot');
    } else if ((inRelevantUserAgent || !sawAnyUserAgent) && directive === 'disallow' && value) {
      disallowRules.push(value);
    }
  }

  return disallowRules;
}

/**
 * Check if a disallow rule would block resource paths
 */
function findBlockedResources(disallowRules: string[]): {
  blockedPaths: string[];
  blockedExtensions: string[];
} {
  const blockedPaths: string[] = [];
  const blockedExtensions: string[] = [];

  for (const rule of disallowRules) {
    const lowerRule = rule.toLowerCase();

    // Check if rule matches any common resource path
    for (const pattern of RESOURCE_PATH_PATTERNS) {
      if (lowerRule === pattern || lowerRule.startsWith(pattern)) {
        blockedPaths.push(rule);
        break;
      }
    }

    // Check if rule blocks resource file extensions via wildcard patterns
    // e.g., "/*.css", "/*.css$", "/*.js", "/*.js$"
    for (const ext of RESOURCE_EXTENSION_PATTERNS) {
      if (lowerRule.includes('*' + ext) || lowerRule.endsWith(ext + '$')) {
        blockedExtensions.push(rule);
        break;
      }
    }
  }

  return { blockedPaths, blockedExtensions };
}

/**
 * Rule: Blocked Resources
 *
 * Checks if robots.txt blocks important CSS or JavaScript resources.
 * When search engines cannot access CSS and JS files, they cannot render
 * the page properly, which negatively impacts indexing and ranking.
 */
export const blockedResourcesRule = defineRule({
  id: 'crawl-blocked-resources',
  name: 'Blocked Resources',
  description: 'Checks if robots.txt blocks important CSS/JS resources',
  category: 'crawl',
  weight: 7,
  run: async (context: AuditContext) => {
    const robotsTxtContent = (context as any).robotsTxtContent as string | undefined;

    if (!robotsTxtContent) {
      return pass(
        'crawl-blocked-resources',
        'No robots.txt content available to check',
        { robotsTxtAvailable: false }
      );
    }

    const disallowRules = extractDisallowRules(robotsTxtContent);

    if (disallowRules.length === 0) {
      return pass(
        'crawl-blocked-resources',
        'No Disallow rules found in robots.txt',
        { disallowRuleCount: 0 }
      );
    }

    const { blockedPaths, blockedExtensions } = findBlockedResources(disallowRules);
    const allBlocked = new Set([...blockedPaths, ...blockedExtensions]);
    const totalBlocked = allBlocked.size;

    const details = {
      disallowRuleCount: disallowRules.length,
      blockedResourcePaths: blockedPaths,
      blockedResourceExtensions: blockedExtensions,
      totalBlockedRules: totalBlocked,
    };

    if (totalBlocked > 0) {
      const issues: string[] = [];
      if (blockedPaths.length > 0) {
        issues.push(`${blockedPaths.length} path rule(s) blocking resource directories`);
      }
      if (blockedExtensions.length > 0) {
        issues.push(`${blockedExtensions.length} rule(s) blocking CSS/JS file extensions`);
      }

      return warn(
        'crawl-blocked-resources',
        `robots.txt may block CSS/JS resources: ${issues.join('; ')}`,
        {
          ...details,
          impact: 'Search engines cannot render pages properly without CSS and JavaScript',
          recommendation: 'Allow search engines to access CSS and JS files by removing or adjusting these Disallow rules',
        }
      );
    }

    return pass(
      'crawl-blocked-resources',
      'robots.txt does not block important CSS/JS resources',
      details
    );
  },
});
