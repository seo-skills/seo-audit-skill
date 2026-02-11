import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check for double slashes in URL path
 *
 * Double slashes in the path portion of a URL (not the protocol `://`)
 * indicate malformed URLs. Servers may treat `/path//to` differently from
 * `/path/to`, causing crawl waste or duplicate content.
 */
export const doubleSlashRule = defineRule({
  id: 'url-double-slash',
  name: 'Double Slashes in URL Path',
  description:
    'Checks for double slashes in the URL path which indicate malformed URLs',
  category: 'url',
  weight: 5,
  run: async (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      if (pathname.includes('//')) {
        return fail(
          'url-double-slash',
          'URL path contains double slashes',
          {
            url,
            path: pathname,
            fix: `Remove double slashes: ${pathname.replace(/\/{2,}/g, '/')}`,
          }
        );
      }

      return pass('url-double-slash', 'URL path has no double slashes', {
        url,
        path: pathname,
      });
    } catch {
      return pass('url-double-slash', 'Could not parse URL', { url });
    }
  },
});
