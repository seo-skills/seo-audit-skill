import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Validate that picture elements have required img fallback
 */
export const pictureElementRule = defineRule({
  id: 'images-picture-element',
  name: 'Picture Element Validation',
  description: 'Validates that picture elements have required img fallback',
  category: 'images',
  weight: 10,
  run: (context: AuditContext) => {
    const { pictureElements } = context;

    if (pictureElements.length === 0) {
      return pass('images-picture-element', 'No picture elements found on page', {
        pictureCount: 0,
      });
    }

    const missingFallback = pictureElements.filter((p) => !p.hasImgFallback);
    const noSources = pictureElements.filter((p) => p.sourceCount === 0);

    const issues: string[] = [];
    if (missingFallback.length > 0) {
      issues.push(
        `${missingFallback.length} picture element(s) missing img fallback`
      );
    }
    if (noSources.length > 0) {
      issues.push(
        `${noSources.length} picture element(s) without source elements`
      );
    }

    if (missingFallback.length > 0) {
      return fail('images-picture-element', issues.join('; '), {
        totalPictures: pictureElements.length,
        missingFallback: missingFallback.length,
        noSources: noSources.length,
        suggestion:
          'Every <picture> element must contain an <img> element as fallback for browsers that do not support picture',
      });
    }

    if (noSources.length > 0) {
      return fail('images-picture-element', issues.join('; '), {
        totalPictures: pictureElements.length,
        noSources: noSources.length,
        suggestion:
          'Add <source> elements inside <picture> to provide alternative image formats',
      });
    }

    // Check for modern format usage
    const withModernFormats = pictureElements.filter((p) =>
      p.sourceTypes.some((t) => t.includes('webp') || t.includes('avif'))
    );

    return pass(
      'images-picture-element',
      `All ${pictureElements.length} picture element(s) are valid (${withModernFormats.length} use modern formats)`,
      {
        totalPictures: pictureElements.length,
        withModernFormats: withModernFormats.length,
        avgSourcesPerPicture: (
          pictureElements.reduce((sum, p) => sum + p.sourceCount, 0) /
          pictureElements.length
        ).toFixed(1),
      }
    );
  },
});
