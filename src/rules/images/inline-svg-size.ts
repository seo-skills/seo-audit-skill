import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Maximum recommended inline SVG size in bytes (5KB)
 * Larger SVGs should be external files for caching
 */
const MAX_INLINE_SVG_BYTES = 5 * 1024;

/**
 * Rule: Check for large inline SVGs that bloat HTML
 */
export const inlineSvgSizeRule = defineRule({
  id: 'images-inline-svg-size',
  name: 'Inline SVG Size',
  description:
    'Checks for large inline SVGs that bloat HTML (>5KB should be external)',
  category: 'images',
  weight: 5,
  run: (context: AuditContext) => {
    const { inlineSvgs } = context;

    if (inlineSvgs.length === 0) {
      return pass('images-inline-svg-size', 'No inline SVGs found on page', {
        svgCount: 0,
      });
    }

    const largeSvgs = inlineSvgs.filter(
      (svg) => svg.sizeBytes > MAX_INLINE_SVG_BYTES
    );
    const totalSvgBytes = inlineSvgs.reduce(
      (sum, svg) => sum + svg.sizeBytes,
      0
    );

    if (largeSvgs.length > 0) {
      const totalLargeBytes = largeSvgs.reduce(
        (sum, svg) => sum + svg.sizeBytes,
        0
      );
      return warn(
        'images-inline-svg-size',
        `Found ${largeSvgs.length} large inline SVG(s) (>${MAX_INLINE_SVG_BYTES / 1024}KB each, ${(totalLargeBytes / 1024).toFixed(1)}KB total)`,
        {
          largeSvgCount: largeSvgs.length,
          totalSvgCount: inlineSvgs.length,
          totalSvgBytesKB: (totalSvgBytes / 1024).toFixed(1),
          largeSvgs: largeSvgs.slice(0, 5).map((svg) => ({
            sizeKB: (svg.sizeBytes / 1024).toFixed(1),
            hasViewBox: svg.hasViewBox,
            snippet: svg.snippet,
          })),
          suggestion:
            'Move large SVGs to external files for better caching and smaller HTML payload',
        }
      );
    }

    return pass(
      'images-inline-svg-size',
      `All ${inlineSvgs.length} inline SVG(s) are appropriately sized (${(totalSvgBytes / 1024).toFixed(1)}KB total)`,
      {
        svgCount: inlineSvgs.length,
        totalSizeKB: (totalSvgBytes / 1024).toFixed(1),
        maxRecommendedKB: MAX_INLINE_SVG_BYTES / 1024,
      }
    );
  },
});
