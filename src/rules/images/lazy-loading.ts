import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Number of images to consider as "above the fold"
 * These should NOT be lazy loaded
 */
const ABOVE_FOLD_COUNT = 3;

/**
 * Rule: Check images below fold use lazy loading
 * Images below the initial viewport should use loading="lazy"
 */
export const lazyLoadingRule = defineRule({
  id: 'images-lazy-loading',
  name: 'Image Lazy Loading',
  description: 'Checks that images below the fold use loading="lazy" for better performance',
  category: 'images',
  weight: 10,
  run: (context: AuditContext) => {
    const { images } = context;

    if (images.length === 0) {
      return pass(
        'images-lazy-loading',
        'No images found on page',
        { imageCount: 0 }
      );
    }

    // Assume first few images are above fold and should not be lazy loaded
    const belowFoldImages = images.slice(ABOVE_FOLD_COUNT);

    if (belowFoldImages.length === 0) {
      return pass(
        'images-lazy-loading',
        `Only ${images.length} image(s) found (considered above fold)`,
        {
          totalImages: images.length,
          aboveFoldThreshold: ABOVE_FOLD_COUNT,
        }
      );
    }

    const notLazyLoaded = belowFoldImages.filter((img) => !img.isLazyLoaded);

    if (notLazyLoaded.length > 0) {
      const percentage = ((notLazyLoaded.length / belowFoldImages.length) * 100).toFixed(1);

      return warn(
        'images-lazy-loading',
        `Found ${notLazyLoaded.length} below-fold image(s) not using lazy loading (${percentage}%)`,
        {
          notLazyLoadedCount: notLazyLoaded.length,
          belowFoldCount: belowFoldImages.length,
          totalImages: images.length,
          images: notLazyLoaded.slice(0, 10).map((img) => ({
            src: img.src,
          })),
          suggestion: 'Add loading="lazy" to images below the fold to improve initial page load performance',
        }
      );
    }

    return pass(
      'images-lazy-loading',
      `All ${belowFoldImages.length} below-fold image(s) use lazy loading`,
      {
        belowFoldCount: belowFoldImages.length,
        totalImages: images.length,
      }
    );
  },
});
