import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/** Maximum recommended alt text length */
const MAX_RECOMMENDED = 125;
/** Alt text beyond this length is excessive */
const MAX_EXCESSIVE = 250;

interface AltLengthIssue {
  /** Image source URL */
  src: string;
  /** The alt text (truncated for readability) */
  alt: string;
  /** Length of the alt text */
  length: number;
  /** Severity: 'long' (125-250) or 'excessive' (>250) */
  severity: 'long' | 'excessive';
}

/**
 * Rule: Image Alt Text Length
 *
 * Checks that image alt text is not excessively long. Screen readers typically
 * read alt text in full without pause, so very long alt text creates a poor
 * experience for users relying on assistive technology. Additionally, search
 * engines may discount extremely long alt text as keyword stuffing.
 *
 * Recommended maximum: 125 characters (fits most screen reader buffer sizes).
 * Excessive: over 250 characters.
 */
export const altLengthRule = defineRule({
  id: 'images-alt-length',
  name: 'Image Alt Text Length',
  description: 'Checks that image alt text is not excessively long (over 125 characters)',
  category: 'images',
  weight: 6,
  run: (context: AuditContext) => {
    const { images } = context;

    // Only check images that have alt text
    const imagesWithAlt = images.filter((img) => img.hasAlt && img.alt.trim().length > 0);

    if (imagesWithAlt.length === 0) {
      return pass(
        'images-alt-length',
        'No images with alt text to evaluate for length',
        { imageCount: 0 }
      );
    }

    const issues: AltLengthIssue[] = [];

    for (const img of imagesWithAlt) {
      const altLength = img.alt.trim().length;

      if (altLength > MAX_EXCESSIVE) {
        issues.push({
          src: img.src,
          alt: img.alt.substring(0, 60) + '...',
          length: altLength,
          severity: 'excessive',
        });
      } else if (altLength > MAX_RECOMMENDED) {
        issues.push({
          src: img.src,
          alt: img.alt.substring(0, 60) + '...',
          length: altLength,
          severity: 'long',
        });
      }
    }

    if (issues.length === 0) {
      return pass(
        'images-alt-length',
        `All ${imagesWithAlt.length} image(s) have alt text within the recommended length (${MAX_RECOMMENDED} chars)`,
        {
          totalImagesWithAlt: imagesWithAlt.length,
          maxRecommended: MAX_RECOMMENDED,
        }
      );
    }

    const excessiveCount = issues.filter((i) => i.severity === 'excessive').length;
    const longCount = issues.filter((i) => i.severity === 'long').length;

    // Excessive alt text (>250 chars) is a fail
    if (excessiveCount > 0) {
      return fail(
        'images-alt-length',
        `Found ${excessiveCount} image(s) with excessively long alt text (over ${MAX_EXCESSIVE} chars)`,
        {
          totalImagesWithAlt: imagesWithAlt.length,
          excessiveCount,
          longCount,
          issues: issues.slice(0, 10),
          recommendation: `Keep alt text concise and under ${MAX_RECOMMENDED} characters; use longdesc or figcaption for detailed descriptions`,
        }
      );
    }

    // Long but not excessive (125-250 chars) is a warning
    return warn(
      'images-alt-length',
      `Found ${longCount} image(s) with long alt text (${MAX_RECOMMENDED}-${MAX_EXCESSIVE} chars)`,
      {
        totalImagesWithAlt: imagesWithAlt.length,
        longCount,
        issues: issues.slice(0, 10),
        recommendation: `Aim for alt text under ${MAX_RECOMMENDED} characters for optimal screen reader and SEO performance`,
      }
    );
  },
});
