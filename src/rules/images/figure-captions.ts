import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for proper use of figure and figcaption elements
 */
export const figureCaptionsRule = defineRule({
  id: 'images-figure-captions',
  name: 'Figure Captions',
  description: 'Checks for proper use of figure and figcaption elements',
  category: 'images',
  weight: 5,
  run: (context: AuditContext) => {
    const { figures } = context;

    if (figures.length === 0) {
      return pass('images-figure-captions', 'No figure elements found on page', {
        figureCount: 0,
      });
    }

    const withoutCaptions = figures.filter((f) => !f.hasFigcaption);
    const emptyFigures = figures.filter((f) => f.imageCount === 0);

    const issues: string[] = [];
    if (withoutCaptions.length > 0) {
      issues.push(`${withoutCaptions.length} figure(s) missing figcaption`);
    }
    if (emptyFigures.length > 0) {
      issues.push(`${emptyFigures.length} figure(s) without images`);
    }

    if (issues.length > 0) {
      return warn('images-figure-captions', issues.join('; '), {
        totalFigures: figures.length,
        withoutCaptions: withoutCaptions.length,
        emptyFigures: emptyFigures.length,
        suggestion:
          'Add figcaption elements to describe figure content for accessibility',
      });
    }

    return pass(
      'images-figure-captions',
      `All ${figures.length} figure element(s) have proper figcaption`,
      { totalFigures: figures.length }
    );
  },
});
