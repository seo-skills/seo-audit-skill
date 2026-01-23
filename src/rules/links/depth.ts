import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Maximum recommended page depth from homepage
 */
const MAX_RECOMMENDED_DEPTH = 3;

/**
 * Rule: Check page depth from homepage (warn if >3 clicks deep)
 */
export const depthRule = defineRule({
  id: 'links-depth',
  name: 'Page Depth',
  description: 'Checks that pages are not too deep in the site hierarchy (more than 3 levels from homepage)',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { url } = context;

    let depth: number;
    try {
      const urlObj = new URL(url);
      // Get the pathname and split by /
      const pathname = urlObj.pathname;

      // Remove leading and trailing slashes, then split
      const segments = pathname
        .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
        .split('/')
        .filter((segment) => segment.length > 0); // Remove empty segments

      depth = segments.length;
    } catch {
      // If URL parsing fails, return a pass with note
      return pass(
        'links-depth',
        'Could not determine page depth from URL',
        { url, depth: null }
      );
    }

    // Homepage (depth 0) is always good
    if (depth === 0) {
      return pass(
        'links-depth',
        'This is the homepage (depth 0)',
        { depth: 0, url }
      );
    }

    if (depth > MAX_RECOMMENDED_DEPTH) {
      return warn(
        'links-depth',
        `Page is ${depth} levels deep (recommended: ${MAX_RECOMMENDED_DEPTH} or less)`,
        {
          depth,
          maxRecommended: MAX_RECOMMENDED_DEPTH,
          url,
          suggestion: 'Consider restructuring site hierarchy or adding more internal links to reduce page depth',
        }
      );
    }

    return pass(
      'links-depth',
      `Page depth is ${depth} level(s) from homepage`,
      {
        depth,
        maxRecommended: MAX_RECOMMENDED_DEPTH,
        url,
      }
    );
  },
});
