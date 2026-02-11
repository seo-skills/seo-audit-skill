import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check for spaces in URL
 *
 * Spaces in URLs get encoded as `%20` or `+`, making URLs ugly, harder to
 * share, and potentially problematic for crawlers. Hyphens should be used
 * as word separators instead.
 */
export const spacesRule = defineRule({
  id: 'url-spaces',
  name: 'Spaces in URL',
  description:
    'Checks for encoded spaces (%20) or literal spaces in the URL',
  category: 'url',
  weight: 6,
  run: async (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const search = urlObj.search;
      const fullPath = pathname + search;

      // Check for encoded spaces (%20) in the raw URL path
      const hasEncodedSpaces = fullPath.includes('%20');

      // Check for literal spaces (unusual but possible in malformed URLs)
      const decodedPath = decodeURIComponent(pathname);
      const hasLiteralSpaces = decodedPath.includes(' ');

      if (hasEncodedSpaces || hasLiteralSpaces) {
        const suggestedPath = decodedPath.replace(/\s+/g, '-');

        return fail(
          'url-spaces',
          'URL contains spaces; use hyphens as word separators',
          {
            url,
            path: pathname,
            hasEncodedSpaces,
            hasLiteralSpaces,
            fix: `Replace spaces with hyphens: ${suggestedPath}`,
          }
        );
      }

      return pass('url-spaces', 'URL contains no spaces', {
        url,
        path: pathname,
      });
    } catch {
      return pass('url-spaces', 'Could not parse URL', { url });
    }
  },
});
