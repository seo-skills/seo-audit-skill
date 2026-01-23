import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check all images have alt attribute
 * Images must have alt attributes for accessibility and SEO
 */
export const altPresentRule = defineRule({
  id: 'images-alt-present',
  name: 'Image Alt Attribute Present',
  description: 'Checks that all images have alt attributes for accessibility and SEO',
  category: 'images',
  weight: 20,
  run: (context: AuditContext) => {
    const { images } = context;

    if (images.length === 0) {
      return pass(
        'images-alt-present',
        'No images found on page',
        { imageCount: 0 }
      );
    }

    const missingAlt = images.filter((img) => !img.hasAlt);

    if (missingAlt.length > 0) {
      const percentage = ((missingAlt.length / images.length) * 100).toFixed(1);

      return fail(
        'images-alt-present',
        `Found ${missingAlt.length} image(s) missing alt attribute (${percentage}% of images)`,
        {
          missingCount: missingAlt.length,
          totalImages: images.length,
          missingAltImages: missingAlt.slice(0, 10).map((img) => ({
            src: img.src,
          })),
          suggestion: 'Add descriptive alt text to all images for accessibility and SEO benefits',
        }
      );
    }

    return pass(
      'images-alt-present',
      `All ${images.length} image(s) have alt attributes`,
      { totalImages: images.length }
    );
  },
});
