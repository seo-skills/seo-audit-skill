import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Recommended Open Graph image dimensions
 * Facebook/LinkedIn optimal: 1200x630 (1.91:1 aspect ratio)
 * Minimum: 200x200
 */
const RECOMMENDED_WIDTH = 1200;
const RECOMMENDED_HEIGHT = 630;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 200;

/**
 * Rule: Check that og:image has recommended dimensions
 *
 * Checks for og:image:width and og:image:height meta tags.
 * Recommended size is 1200x630 for optimal display on Facebook/LinkedIn.
 */
export const ogImageSizeRule = defineRule({
  id: 'social-og-image-size',
  name: 'Open Graph Image Size',
  description:
    'Checks that og:image has recommended dimensions (1200x630) via og:image:width and og:image:height meta tags',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;

    // First check if og:image exists
    const ogImage = $('meta[property="og:image"]').first().attr('content')?.trim();
    if (!ogImage) {
      return fail(
        'social-og-image-size',
        'No og:image found - cannot check dimensions',
        { hasImage: false }
      );
    }

    // Check for dimension meta tags
    const widthMeta = $('meta[property="og:image:width"]').first().attr('content')?.trim();
    const heightMeta = $('meta[property="og:image:height"]').first().attr('content')?.trim();

    const width = widthMeta ? parseInt(widthMeta, 10) : null;
    const height = heightMeta ? parseInt(heightMeta, 10) : null;

    // No dimension tags at all
    if (!widthMeta && !heightMeta) {
      return warn(
        'social-og-image-size',
        `Missing og:image:width and og:image:height meta tags. Add these with recommended size ${RECOMMENDED_WIDTH}x${RECOMMENDED_HEIGHT}`,
        {
          hasImage: true,
          ogImage,
          hasDimensions: false,
          recommendedWidth: RECOMMENDED_WIDTH,
          recommendedHeight: RECOMMENDED_HEIGHT,
        }
      );
    }

    // Invalid dimension values
    if ((widthMeta && (width === null || isNaN(width))) ||
        (heightMeta && (height === null || isNaN(height)))) {
      return warn(
        'social-og-image-size',
        'og:image dimension meta tags contain invalid values',
        {
          hasImage: true,
          ogImage,
          widthMeta,
          heightMeta,
          invalidValues: true,
        }
      );
    }

    // Only one dimension specified
    if (!width || !height) {
      return warn(
        'social-og-image-size',
        `Only ${width ? 'width' : 'height'} specified. Add both og:image:width and og:image:height`,
        {
          hasImage: true,
          ogImage,
          width,
          height,
          incomplete: true,
        }
      );
    }

    // Dimensions too small
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      return fail(
        'social-og-image-size',
        `og:image is too small (${width}x${height}). Minimum is ${MIN_WIDTH}x${MIN_HEIGHT}`,
        {
          hasImage: true,
          ogImage,
          width,
          height,
          minWidth: MIN_WIDTH,
          minHeight: MIN_HEIGHT,
          tooSmall: true,
        }
      );
    }

    // Check if matches recommended size
    if (width >= RECOMMENDED_WIDTH && height >= RECOMMENDED_HEIGHT) {
      return pass(
        'social-og-image-size',
        `og:image has optimal dimensions (${width}x${height})`,
        {
          hasImage: true,
          ogImage,
          width,
          height,
          optimal: true,
        }
      );
    }

    // Dimensions are valid but not optimal
    return warn(
      'social-og-image-size',
      `og:image dimensions (${width}x${height}) are below recommended ${RECOMMENDED_WIDTH}x${RECOMMENDED_HEIGHT}`,
      {
        hasImage: true,
        ogImage,
        width,
        height,
        recommendedWidth: RECOMMENDED_WIDTH,
        recommendedHeight: RECOMMENDED_HEIGHT,
        belowRecommended: true,
      }
    );
  },
});
