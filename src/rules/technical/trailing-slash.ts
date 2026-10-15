import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Analyzes trailing slash usage across internal links, per distinct path.
 *
 * Linking different paths in different forms (/en-US/ for a directory,
 * /docs/a for a document) is ordinary. What can split one page across two
 * URLs is the same path linked both ways, so that is the inconsistency.
 */
function analyzeTrailingSlashes(currentUrl: string, internalLinks: string[]): {
  currentHasTrailingSlash: boolean;
  withSlash: string[];
  withoutSlash: string[];
  conflictingPaths: string[];
  dominantStyle: 'with-slash' | 'without-slash' | 'mixed';
} {
  let currentPath = '';
  try {
    currentPath = new URL(currentUrl).pathname;
  } catch {
    // Invalid URL
  }
  const currentHasTrailingSlash = currentPath.length > 1 && currentPath.endsWith('/');

  // Path without its trailing slash -> the forms it is linked in
  const forms = new Map<string, Set<'slash' | 'none'>>();
  for (const link of internalLinks) {
    try {
      const path = new URL(link).pathname;

      // Skip root path, files with extensions, and links to this page itself
      // (skip links and #fragments say nothing about URL style)
      if (path === '/' || /\.\w+$/.test(path) || path === currentPath) {
        continue;
      }

      const key = path.endsWith('/') ? path.slice(0, -1) : path;
      const seen = forms.get(key) ?? new Set();
      seen.add(path.endsWith('/') ? 'slash' : 'none');
      forms.set(key, seen);
    } catch {
      // Invalid URL, skip
    }
  }

  const withSlash: string[] = [];
  const withoutSlash: string[] = [];
  const conflictingPaths: string[] = [];
  for (const [key, seen] of forms) {
    if (seen.has('slash')) withSlash.push(`${key}/`);
    if (seen.has('none')) withoutSlash.push(key);
    if (seen.size > 1) conflictingPaths.push(key);
  }

  const dominantStyle: 'with-slash' | 'without-slash' | 'mixed' =
    withSlash.length === 0 && withoutSlash.length > 0
      ? 'without-slash'
      : withoutSlash.length === 0 && withSlash.length > 0
        ? 'with-slash'
        : 'mixed';

  return { currentHasTrailingSlash, withSlash, withoutSlash, conflictingPaths, dominantStyle };
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

    if (analysis.conflictingPaths.length === 0) {
      const total = analysis.withSlash.length + analysis.withoutSlash.length;
      return pass(
        'technical-trailing-slash',
        total === 0
          ? 'Trailing slash usage is consistent (no internal paths to analyze)'
          : `Each internal path is linked in one form (${analysis.withSlash.length} with a trailing slash, ${analysis.withoutSlash.length} without)`,
        details
      );
    }

    return warn(
      'technical-trailing-slash',
      `${analysis.conflictingPaths.length} path(s) linked both with and without a trailing slash: ${analysis.conflictingPaths.slice(0, 3).join(', ')}`,
      {
        ...details,
        conflictingPaths: analysis.conflictingPaths.slice(0, 10),
        recommendation: 'Link each page in the form the server serves, and redirect the other form to it',
      }
    );
  },
});
