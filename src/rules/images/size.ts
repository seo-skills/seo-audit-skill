import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Maximum recommended image size in bytes (200KB)
 */
const MAX_RECOMMENDED_SIZE_BYTES = 200 * 1024;

/**
 * Patterns that suggest an image might be large
 */
const LARGE_IMAGE_INDICATORS = [
  'hero',
  'banner',
  'background',
  'full-width',
  'fullwidth',
  'cover',
  'large',
  'big',
  'hd',
  '4k',
  '2x',
  '3x',
  'retina',
];

/**
 * Estimate if an image might be oversized based on URL patterns and attributes
 * This is a heuristic since we don't have actual file sizes without fetching
 */
function estimatePotentiallyOversized(
  src: string,
  width?: string,
  height?: string
): { isLikelyLarge: boolean; reason: string } {
  const srcLower = src.toLowerCase();

  // Check for large image indicators in filename
  for (const indicator of LARGE_IMAGE_INDICATORS) {
    if (srcLower.includes(indicator)) {
      return {
        isLikelyLarge: true,
        reason: `Filename suggests large image (contains "${indicator}")`,
      };
    }
  }

  // Check dimensions if provided
  if (width && height) {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);

    if (!isNaN(w) && !isNaN(h)) {
      // Very large dimensions suggest potentially large file size
      if (w >= 2000 || h >= 2000) {
        return {
          isLikelyLarge: true,
          reason: `Large dimensions (${w}x${h}px)`,
        };
      }

      // Calculate pixel count
      const pixels = w * h;
      if (pixels >= 2000000) {
        // 2 megapixels
        return {
          isLikelyLarge: true,
          reason: `High pixel count (${(pixels / 1000000).toFixed(1)} megapixels)`,
        };
      }
    }
  }

  // Check for unoptimized patterns
  if (srcLower.includes('original') || srcLower.includes('raw') || srcLower.includes('uncompressed')) {
    return {
      isLikelyLarge: true,
      reason: 'Filename suggests unoptimized image',
    };
  }

  return { isLikelyLarge: false, reason: '' };
}

/**
 * Rule: Check image file sizes aren't excessive
 * Warns if images are estimated to be over 200KB
 */
export const sizeRule = defineRule({
  id: 'images-size',
  name: 'Image File Size',
  description: 'Checks that images are not excessively large (warns if estimated >200KB)',
  category: 'images',
  weight: 10,
  run: (context: AuditContext) => {
    const { images } = context;

    if (images.length === 0) {
      return pass(
        'images-size',
        'No images found on page',
        { imageCount: 0 }
      );
    }

    const potentiallyOversized: Array<{
      src: string;
      reason: string;
      width?: string;
      height?: string;
    }> = [];

    for (const img of images) {
      const { isLikelyLarge, reason } = estimatePotentiallyOversized(
        img.src,
        img.width,
        img.height
      );

      if (isLikelyLarge) {
        potentiallyOversized.push({
          src: img.src,
          reason,
          width: img.width,
          height: img.height,
        });
      }
    }

    if (potentiallyOversized.length > 0) {
      return warn(
        'images-size',
        `Found ${potentiallyOversized.length} potentially oversized image(s) (may exceed 200KB)`,
        {
          potentiallyOversizedCount: potentiallyOversized.length,
          totalImages: images.length,
          maxRecommendedSizeKB: MAX_RECOMMENDED_SIZE_BYTES / 1024,
          images: potentiallyOversized.slice(0, 10),
          suggestion: 'Optimize large images using compression, resizing, or modern formats (WebP/AVIF)',
          note: 'File sizes are estimated based on image attributes and filenames. Use browser DevTools for actual sizes.',
        }
      );
    }

    return pass(
      'images-size',
      `No obviously oversized images detected among ${images.length} image(s)`,
      {
        totalImages: images.length,
        maxRecommendedSizeKB: MAX_RECOMMENDED_SIZE_BYTES / 1024,
        note: 'This is a heuristic check. Use browser DevTools to verify actual file sizes.',
      }
    );
  },
});
