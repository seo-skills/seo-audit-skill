import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for non-ASCII characters in URL path
 *
 * Non-ASCII characters in URLs require percent-encoding which makes URLs
 * harder to read, share, and type. While modern browsers handle them,
 * some tools and crawlers may not process them correctly.
 */
export const nonAsciiRule = defineRule({
  id: 'url-non-ascii',
  name: 'Non-ASCII Characters in URL',
  description:
    'Checks for non-ASCII characters in the URL path that may cause encoding issues',
  category: 'url',
  weight: 4,
  run: async (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Decode percent-encoded sequences to reveal actual characters
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        // If decoding fails, the URL has malformed encoding
        return warn(
          'url-non-ascii',
          'URL contains malformed percent-encoding',
          { url, path: pathname }
        );
      }

      // Match characters outside basic ASCII printable range (0x20-0x7E),
      // excluding common URL characters already handled by the URL parser
      const nonAsciiChars = decodedPath.match(/[^\x20-\x7E]/g);

      if (!nonAsciiChars || nonAsciiChars.length === 0) {
        return pass('url-non-ascii', 'URL path contains only ASCII characters', {
          url,
          path: pathname,
        });
      }

      const uniqueNonAscii = [...new Set(nonAsciiChars)];

      return warn(
        'url-non-ascii',
        `URL path contains ${nonAsciiChars.length} non-ASCII character(s): ${uniqueNonAscii.join(', ')}`,
        {
          url,
          path: pathname,
          decodedPath,
          nonAsciiCharacters: uniqueNonAscii,
          nonAsciiCount: nonAsciiChars.length,
          fix: 'Replace non-ASCII characters with ASCII equivalents or transliterate',
        }
      );
    } catch {
      return pass('url-non-ascii', 'Could not parse URL', { url });
    }
  },
});
