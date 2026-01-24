import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';
import { fetchUrl } from '../../crawler/fetcher.js';

/**
 * Maximum images to check for performance
 */
const MAX_IMAGES_TO_CHECK = 20;

/**
 * Rule: Check for broken images (404/410 errors)
 */
export const brokenRule = defineRule({
  id: 'images-broken',
  name: 'No Broken Images',
  description: 'Checks that all images are accessible (no 404 errors)',
  category: 'images',
  weight: 15,
  run: async (context: AuditContext) => {
    const { images } = context;

    if (images.length === 0) {
      return pass('images-broken', 'No images found on page', { imageCount: 0 });
    }

    // Limit check to first N images for performance
    const imagesToCheck = images.slice(0, MAX_IMAGES_TO_CHECK);
    const brokenImages: Array<{ src: string; status: number }> = [];

    await Promise.all(
      imagesToCheck.map(async (img) => {
        try {
          const status = await fetchUrl(img.src, 5000);
          if (status === 404 || status === 410) {
            brokenImages.push({ src: img.src, status });
          }
        } catch {
          // Skip on network errors
        }
      })
    );

    if (brokenImages.length > 0) {
      return fail(
        'images-broken',
        `Found ${brokenImages.length} broken image(s) (404/410 errors)`,
        {
          brokenCount: brokenImages.length,
          checkedCount: imagesToCheck.length,
          totalImages: images.length,
          brokenImages: brokenImages.slice(0, 10),
          suggestion: 'Fix or remove broken image references',
        }
      );
    }

    return pass(
      'images-broken',
      `All ${imagesToCheck.length} checked image(s) are accessible`,
      {
        checkedCount: imagesToCheck.length,
        totalImages: images.length,
        note:
          images.length > MAX_IMAGES_TO_CHECK
            ? `Only first ${MAX_IMAGES_TO_CHECK} images were checked`
            : undefined,
      }
    );
  },
});
