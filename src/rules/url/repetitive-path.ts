import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check for repeated segments in URL path
 *
 * Repetitive path segments like `/blog/blog/` or `/products/products/`
 * indicate misconfigured routing or URL generation. They waste crawl
 * budget and create confusing, non-canonical URLs.
 */
export const repetitivePathRule = defineRule({
  id: 'url-repetitive-path',
  name: 'Repetitive Path Segments',
  description:
    'Checks for consecutive duplicate segments in the URL path (e.g., /blog/blog/)',
  category: 'url',
  weight: 4,
  run: async (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      const segments = pathname
        .split('/')
        .filter((s) => s.length > 0)
        .map((s) => s.toLowerCase());

      const duplicates: string[] = [];

      for (let i = 1; i < segments.length; i++) {
        if (segments[i] === segments[i - 1]) {
          duplicates.push(segments[i]);
        }
      }

      if (duplicates.length === 0) {
        return pass(
          'url-repetitive-path',
          'URL path has no repetitive segments',
          { url, path: pathname, segments }
        );
      }

      const uniqueDuplicates = [...new Set(duplicates)];

      return fail(
        'url-repetitive-path',
        `URL path contains repetitive segments: ${uniqueDuplicates.map((d) => `/${d}/${d}/`).join(', ')}`,
        {
          url,
          path: pathname,
          segments,
          repeatedSegments: uniqueDuplicates,
          fix: 'Remove duplicate consecutive path segments',
        }
      );
    } catch {
      return pass('url-repetitive-path', 'Could not parse URL', { url });
    }
  },
});
