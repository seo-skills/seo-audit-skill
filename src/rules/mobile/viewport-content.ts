import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hints:
// - mobile-friendly/the-viewport-meta-tag-does-not-have-a-width-set
// - mobile-friendly/the-viewport-meta-tag-is-missing-an-initial-scale
// - mobile-friendly/the-viewport-meta-tag-initial-scale-is-incorrect
// - mobile-friendly/the-viewport-meta-tag-has-a-minimum-scale-set

/** The only correct initial-scale value */
const CORRECT_INITIAL_SCALE = 1;

/**
 * Rule: Viewport Meta Content
 *
 * Validates the directives inside the viewport meta tag's content attribute:
 * - a `width` directive must be present
 * - an `initial-scale` directive must be present and equal to 1
 * - `minimum-scale` must not be set, as it limits how far users can zoom out
 *
 * Complements `mobile-viewport-width`, which flags a fixed pixel width; this
 * rule checks the remaining directives. When no viewport meta tag exists at
 * all the rule is not measured — that absence is reported by
 * `core-viewport-present`.
 */
export const viewportContentRule = defineRule({
  id: 'mobile-viewport-content',
  name: 'Viewport Meta Content',
  description: 'Checks the viewport meta tag for width, initial-scale, and minimum-scale directives',
  category: 'mobile',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;

    const viewport = $('meta[name="viewport"]').first().attr('content');

    // No viewport tag - handled by the viewport-present rule
    if (!viewport) {
      return notMeasured(
        'mobile-viewport-content',
        'No viewport meta tag present; content directives cannot be checked (handled by viewport-present rule)',
        { viewportFound: false }
      );
    }

    // Parse the comma-separated directives into a lowercase-keyed map
    const directives = new Map<string, string>();
    for (const part of viewport.split(',')) {
      const [key, ...rest] = part.split('=');
      const name = key?.trim().toLowerCase();
      if (name) {
        directives.set(name, rest.join('=').trim());
      }
    }

    const issues: string[] = [];

    if (!directives.has('width')) {
      issues.push('width directive is missing');
    }

    const initialScale = directives.get('initial-scale');
    if (initialScale === undefined) {
      issues.push('initial-scale directive is missing');
    } else {
      const value = parseFloat(initialScale);
      if (isNaN(value) || value !== CORRECT_INITIAL_SCALE) {
        issues.push(`initial-scale is set to "${initialScale}" instead of 1`);
      }
    }

    if (directives.has('minimum-scale')) {
      issues.push('minimum-scale is set, limiting how far users can zoom out');
    }

    if (issues.length === 0) {
      return pass(
        'mobile-viewport-content',
        'Viewport meta tag sets width and initial-scale=1, with no minimum-scale',
        { viewportContent: viewport }
      );
    }

    return warn(
      'mobile-viewport-content',
      `Viewport meta tag has ${issues.length} content issue(s): ${issues.join('; ')}`,
      {
        viewportContent: viewport,
        issues,
        recommendation: 'Use <meta name="viewport" content="width=device-width, initial-scale=1">',
      }
    );
  },
});
