import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Generic or non-descriptive alt text patterns
 */
const GENERIC_ALT_PATTERNS = [
  'image',
  'picture',
  'photo',
  'img',
  'pic',
  'graphic',
  'icon',
  'logo',
  'banner',
  'untitled',
  'screenshot',
  'screen shot',
  'placeholder',
  'test',
  'undefined',
  'null',
  'none',
  'blank',
  'spacer',
  '.',
  '-',
  '_',
];

/**
 * Minimum length for meaningful alt text
 */
const MIN_ALT_LENGTH = 5;

/**
 * Maximum reasonable alt text length
 */
const MAX_ALT_LENGTH = 125;

/**
 * Rule: Check alt text quality
 * Warns if alt text is too short, too generic, or has issues
 */
export const altQualityRule = defineRule({
  id: 'images-alt-quality',
  name: 'Image Alt Text Quality',
  description: 'Checks that image alt text is descriptive and not generic like "image" or "photo"',
  category: 'images',
  weight: 15,
  run: (context: AuditContext) => {
    const { images } = context;

    // Only check images that have alt attributes
    const imagesWithAlt = images.filter((img) => img.hasAlt);

    if (imagesWithAlt.length === 0) {
      return pass(
        'images-alt-quality',
        'No images with alt attributes to evaluate',
        { imageCount: 0 }
      );
    }

    const issues: Array<{
      src: string;
      alt: string;
      issue: string;
    }> = [];

    for (const img of imagesWithAlt) {
      const alt = img.alt.trim().toLowerCase();

      // Skip empty alt (handled by alt-present rule)
      if (!alt) {
        continue;
      }

      // Check for very short alt text
      if (alt.length < MIN_ALT_LENGTH && alt !== '') {
        issues.push({
          src: img.src,
          alt: img.alt,
          issue: `Alt text too short (${alt.length} chars, minimum ${MIN_ALT_LENGTH})`,
        });
        continue;
      }

      // Check for excessively long alt text
      if (alt.length > MAX_ALT_LENGTH) {
        issues.push({
          src: img.src,
          alt: img.alt.substring(0, 50) + '...',
          issue: `Alt text too long (${alt.length} chars, recommended max ${MAX_ALT_LENGTH})`,
        });
        continue;
      }

      // Check for generic patterns
      const isGeneric = GENERIC_ALT_PATTERNS.some(
        (pattern) => alt === pattern || alt.startsWith(pattern + ' ')
      );

      if (isGeneric) {
        issues.push({
          src: img.src,
          alt: img.alt,
          issue: 'Generic or non-descriptive alt text',
        });
        continue;
      }

      // Check for file name patterns (e.g., "IMG_1234.jpg", "DSC_0001")
      if (/^(img|dsc|pic|photo|image|screenshot)[_-]?\d+/i.test(alt)) {
        issues.push({
          src: img.src,
          alt: img.alt,
          issue: 'Alt text appears to be a file name',
        });
        continue;
      }

      // Check for keyword stuffing (repeated words)
      const words = alt.split(/\s+/);
      const wordCounts = new Map<string, number>();
      for (const word of words) {
        if (word.length > 2) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
      const maxRepeat = Math.max(...Array.from(wordCounts.values()), 0);
      if (maxRepeat > 3 && words.length > 5) {
        issues.push({
          src: img.src,
          alt: img.alt,
          issue: 'Alt text may contain keyword stuffing',
        });
      }
    }

    if (issues.length > 0) {
      const percentage = ((issues.length / imagesWithAlt.length) * 100).toFixed(1);

      return warn(
        'images-alt-quality',
        `Found ${issues.length} image(s) with low-quality alt text (${percentage}% of images with alt)`,
        {
          issueCount: issues.length,
          totalImagesWithAlt: imagesWithAlt.length,
          issues: issues.slice(0, 10),
          suggestion: 'Write descriptive alt text that explains the content and context of each image',
        }
      );
    }

    return pass(
      'images-alt-quality',
      `All ${imagesWithAlt.length} image(s) have quality alt text`,
      { totalImagesWithAlt: imagesWithAlt.length }
    );
  },
});
