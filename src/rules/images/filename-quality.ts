import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Patterns that indicate poor filename quality
 */
const BAD_FILENAME_PATTERNS = [
  /^IMG[_-]?\d+/i, // IMG_001, IMG-001
  /^DSC[_-]?\d+/i, // DSC_001 (camera default)
  /^DCIM[_-]?\d+/i, // DCIM folder naming
  /^image\d*\.(jpg|png|gif|webp|avif)/i, // image.jpg, image1.jpg
  /^photo\d*\.(jpg|png|gif|webp|avif)/i, // photo.jpg
  /^screenshot[_-]?\d*/i, // screenshot, screenshot_1
  /^untitled/i, // untitled
  /^unnamed/i, // unnamed
  /^\d+\.(jpg|png|gif|webp|avif)/i, // 12345.jpg
  /^[a-f0-9]{32}\./i, // MD5 hash filenames
  /^[a-f0-9-]{36}\./i, // UUID filenames
];

/**
 * Extract filename from URL
 */
function getFilename(src: string): string {
  try {
    const url = new URL(src);
    const path = url.pathname;
    return path.split('/').pop() || '';
  } catch {
    return src.split('/').pop() || '';
  }
}

/**
 * Check if filename is descriptive
 */
function hasDescriptiveFilename(
  filename: string
): { isGood: boolean; issue?: string } {
  if (!filename) {
    return { isGood: false, issue: 'Empty filename' };
  }

  for (const pattern of BAD_FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      return { isGood: false, issue: 'Non-descriptive filename pattern' };
    }
  }

  // Check if filename is too short (excluding extension)
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  if (nameWithoutExt.length < 3) {
    return { isGood: false, issue: 'Filename too short' };
  }

  return { isGood: true };
}

/**
 * Rule: Check for descriptive image filenames
 */
export const filenameQualityRule = defineRule({
  id: 'images-filename-quality',
  name: 'Image Filename Quality',
  description: 'Checks for descriptive image filenames (not IMG_001.jpg)',
  category: 'images',
  weight: 5,
  run: (context: AuditContext) => {
    const { images } = context;

    if (images.length === 0) {
      return pass('images-filename-quality', 'No images found on page', {
        imageCount: 0,
      });
    }

    const poorFilenames: Array<{
      src: string;
      filename: string;
      issue: string;
    }> = [];

    for (const img of images) {
      const filename = getFilename(img.src);
      const { isGood, issue } = hasDescriptiveFilename(filename);

      if (!isGood && issue) {
        poorFilenames.push({ src: img.src, filename, issue });
      }
    }

    if (poorFilenames.length > 0) {
      const percentage = ((poorFilenames.length / images.length) * 100).toFixed(
        1
      );
      return warn(
        'images-filename-quality',
        `Found ${poorFilenames.length} image(s) with non-descriptive filenames (${percentage}%)`,
        {
          poorFilenameCount: poorFilenames.length,
          totalImages: images.length,
          images: poorFilenames.slice(0, 10),
          suggestion:
            'Use descriptive filenames like "red-running-shoes.jpg" instead of "IMG_001.jpg"',
        }
      );
    }

    return pass(
      'images-filename-quality',
      `All ${images.length} image(s) have descriptive filenames`,
      { totalImages: images.length }
    );
  },
});
