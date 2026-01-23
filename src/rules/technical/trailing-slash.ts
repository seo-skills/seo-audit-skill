import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Analyzes trailing slash consistency across internal links
 */
function analyzeTrailingSlashes(currentUrl: string, internalLinks: string[]): {
  currentHasTrailingSlash: boolean;
  withSlash: string[];
  withoutSlash: string[];
  isConsistent: boolean;
  dominantStyle: 'with-slash' | 'without-slash' | 'mixed';
} {
  let currentHasTrailingSlash = false;

  try {
    const urlObj = new URL(currentUrl);
    // Ignore query strings and fragments
    const path = urlObj.pathname;
    // Check if path has trailing slash (excluding root "/")
    currentHasTrailingSlash = path.length > 1 && path.endsWith('/');
  } catch {
    // Invalid URL
  }

  const withSlash: string[] = [];
  const withoutSlash: string[] = [];

  for (const link of internalLinks) {
    try {
      const linkUrl = new URL(link);
      const path = linkUrl.pathname;

      // Skip root path, files with extensions, and paths that naturally don't have trailing slashes
      if (path === '/' || /\.\w+$/.test(path)) {
        continue;
      }

      if (path.endsWith('/')) {
        withSlash.push(link);
      } else {
        withoutSlash.push(link);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  const total = withSlash.length + withoutSlash.length;
  let isConsistent = true;
  let dominantStyle: 'with-slash' | 'without-slash' | 'mixed' = 'mixed';

  if (total === 0) {
    // No analyzable links, consider consistent
    isConsistent = true;
    dominantStyle = 'mixed';
  } else if (withSlash.length === 0) {
    dominantStyle = 'without-slash';
  } else if (withoutSlash.length === 0) {
    dominantStyle = 'with-slash';
  } else {
    // Mixed usage - determine dominant style
    isConsistent = false;
    dominantStyle = withSlash.length > withoutSlash.length ? 'with-slash' : 'without-slash';
  }

  return {
    currentHasTrailingSlash,
    withSlash,
    withoutSlash,
    isConsistent,
    dominantStyle,
  };
}

/**
 * Rule: Check for consistent trailing slash usage
 */
export const trailingSlashRule = defineRule({
  id: 'technical-trailing-slash',
  name: 'Trailing Slash Consistency',
  description:
    'Checks for consistent trailing slash usage across internal links',
  category: 'technical',
  weight: 1,
  run: async (context: AuditContext) => {
    const { url, links } = context;

    // Get internal links only
    const internalLinks = links
      .filter((link) => link.isInternal)
      .map((link) => link.href);

    const analysis = analyzeTrailingSlashes(url, internalLinks);

    const details = {
      url,
      currentHasTrailingSlash: analysis.currentHasTrailingSlash,
      withSlashCount: analysis.withSlash.length,
      withoutSlashCount: analysis.withoutSlash.length,
      dominantStyle: analysis.dominantStyle,
      sampleWithSlash: analysis.withSlash.slice(0, 3),
      sampleWithoutSlash: analysis.withoutSlash.slice(0, 3),
    };

    if (analysis.isConsistent) {
      return pass(
        'technical-trailing-slash',
        `Trailing slash usage is consistent (${analysis.dominantStyle === 'mixed' ? 'no internal paths to analyze' : analysis.dominantStyle})`,
        details
      );
    }

    // Calculate inconsistency percentage
    const total = analysis.withSlash.length + analysis.withoutSlash.length;
    const minority =
      analysis.dominantStyle === 'with-slash'
        ? analysis.withoutSlash.length
        : analysis.withSlash.length;
    const inconsistencyPercent = Math.round((minority / total) * 100);

    return warn(
      'technical-trailing-slash',
      `Inconsistent trailing slash usage: ${analysis.withSlash.length} URLs with slash, ${analysis.withoutSlash.length} without (${inconsistencyPercent}% inconsistency)`,
      details
    );
  },
});
