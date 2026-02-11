import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * OS-specific absolute path prefixes that indicate local file references.
 */
const LOCAL_PATH_PREFIXES = [
  '/Users/',
  '/home/',
  'C:\\',
  'C:/',
  'D:\\',
  'D:/',
];

/**
 * Rule: Check for file:// protocol and local filesystem path references
 *
 * Links or resources referencing file:// URLs or absolute OS paths (e.g.
 * /Users/..., C:\...) will not work for visitors and indicate development
 * artifacts that were accidentally left in production markup.
 */
export const localFileRule = defineRule({
  id: 'links-local-file',
  name: 'No Local File References',
  description: 'Checks for file:// protocol links and absolute OS filesystem paths in href/src attributes',
  category: 'links',
  weight: 8,
  run: (context: AuditContext) => {
    const found: Array<{ element: string; href: string; reason: string }> = [];

    // 1. Check for file:// protocol via Cheerio selector
    context.$('[href^="file://"], [src^="file://"]').each((_i, el) => {
      const node = context.$(el);
      const href = node.attr('href') || node.attr('src') || '';
      const tag = (el as unknown as { tagName: string }).tagName || 'unknown';
      found.push({ element: tag, href, reason: 'file:// protocol' });
    });

    // 2. Check all href and src attributes for absolute OS paths
    context.$('[href], [src]').each((_i, el) => {
      const node = context.$(el);
      const href = node.attr('href') || node.attr('src') || '';
      if (!href) return;

      for (const prefix of LOCAL_PATH_PREFIXES) {
        if (href.startsWith(prefix)) {
          const tag = (el as unknown as { tagName: string }).tagName || 'unknown';
          // Avoid duplicates if already caught by file:// check
          const alreadyCaptured = found.some(
            (f) => f.href === href && f.element === tag
          );
          if (!alreadyCaptured) {
            found.push({ element: tag, href, reason: 'absolute OS path' });
          }
          break;
        }
      }
    });

    if (found.length > 0) {
      return fail(
        'links-local-file',
        `Found ${found.length} local file reference(s)`,
        {
          localFileCount: found.length,
          localFiles: found.slice(0, 10),
          recommendation:
            'Replace local file references with proper relative or absolute HTTP/HTTPS URLs',
        }
      );
    }

    return pass(
      'links-local-file',
      'No local file references found',
    );
  },
});
