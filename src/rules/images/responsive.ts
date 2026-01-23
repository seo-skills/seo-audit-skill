import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for responsive image usage
 * Warns if images don't use srcset or picture elements
 */
export const responsiveRule = defineRule({
  id: 'images-responsive',
  name: 'Responsive Images',
  description: 'Checks that images use srcset or picture elements for responsive design',
  category: 'images',
  weight: 10,
  run: (context: AuditContext) => {
    const { images, $ } = context;

    if (images.length === 0) {
      return pass(
        'images-responsive',
        'No images found on page',
        { imageCount: 0 }
      );
    }

    // Count picture elements
    const pictureElements = $('picture').length;

    // Count images with srcset
    const imagesWithSrcset = $('img[srcset]').length;

    // Count images with sizes attribute
    const imagesWithSizes = $('img[sizes]').length;

    // Count source elements within picture
    const sourceElements = $('picture source').length;

    // Calculate responsive score
    const totalResponsive = pictureElements + imagesWithSrcset;
    const nonResponsiveImages: Array<{
      src: string;
      width?: string;
      height?: string;
    }> = [];

    // Find images that could benefit from responsive treatment
    for (const img of images) {
      // Check if this image is inside a picture element
      const imgSelector = `picture img[src="${img.src}"]`;
      const isInPicture = $(imgSelector).length > 0;

      // Check dimensions - larger images benefit more from responsive treatment
      const width = img.width ? parseInt(img.width, 10) : 0;
      const height = img.height ? parseInt(img.height, 10) : 0;
      const isLargeImage = (width >= 300 || height >= 300) || (!width && !height);

      // If not responsive and potentially large, flag it
      const imgElement = $(`img[src="${img.src}"]`);
      const hasSrcset = imgElement.attr('srcset') !== undefined;

      if (!isInPicture && !hasSrcset && isLargeImage) {
        nonResponsiveImages.push({
          src: img.src,
          width: img.width,
          height: img.height,
        });
      }
    }

    // If all images are small or responsive, pass
    if (nonResponsiveImages.length === 0) {
      return pass(
        'images-responsive',
        `Good responsive image usage (${pictureElements} picture element(s), ${imagesWithSrcset} srcset attribute(s))`,
        {
          totalImages: images.length,
          pictureElements,
          imagesWithSrcset,
          imagesWithSizes,
          sourceElements,
        }
      );
    }

    // Some images could be responsive
    const percentage = ((nonResponsiveImages.length / images.length) * 100).toFixed(1);

    if (totalResponsive === 0) {
      return warn(
        'images-responsive',
        `No responsive image techniques detected (${percentage}% of images could benefit)`,
        {
          nonResponsiveCount: nonResponsiveImages.length,
          totalImages: images.length,
          pictureElements: 0,
          imagesWithSrcset: 0,
          images: nonResponsiveImages.slice(0, 10),
          suggestion: 'Use srcset attribute or picture element to serve appropriately sized images for different screen sizes',
        }
      );
    }

    return warn(
      'images-responsive',
      `Found ${nonResponsiveImages.length} image(s) not using responsive techniques (${percentage}%)`,
      {
        nonResponsiveCount: nonResponsiveImages.length,
        totalImages: images.length,
        pictureElements,
        imagesWithSrcset,
        imagesWithSizes,
        images: nonResponsiveImages.slice(0, 10),
        suggestion: 'Consider adding srcset or picture element for larger images to improve performance on various devices',
      }
    );
  },
});
