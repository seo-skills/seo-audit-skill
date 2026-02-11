import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Semantic HTML5 elements that help AI systems understand content structure.
 * Ordered roughly by importance for machine comprehension.
 */
const SEMANTIC_ELEMENTS = [
  'article',
  'section',
  'nav',
  'aside',
  'main',
  'header',
  'footer',
  'figure',
  'figcaption',
  'time',
  'mark',
  'details',
  'summary',
] as const;

/**
 * Minimum recommended semantic elements for good AI readability.
 * These provide the structural backbone that LLMs and search engines rely on.
 */
const RECOMMENDED_ELEMENTS = ['main', 'article', 'header', 'footer', 'nav'];

/**
 * Rule: Semantic HTML for AI/GEO Readiness
 *
 * Checks whether the page uses semantic HTML5 elements that help AI systems
 * understand content structure. Generative Engine Optimization (GEO) depends
 * on machine-readable markup; semantic elements provide clear signals about
 * content roles, boundaries, and relationships.
 *
 * Scoring:
 * - 5+ distinct semantic elements: pass
 * - 3-4 distinct semantic elements: warn
 * - 0-2 distinct semantic elements: fail
 */
export const semanticHtmlRule = defineRule({
  id: 'geo-semantic-html',
  name: 'Semantic HTML Structure',
  description:
    'Checks if the page uses semantic HTML5 elements that help AI systems understand content structure',
  category: 'geo',
  weight: 25,
  run: (context: AuditContext) => {
    const { $ } = context;

    const found: string[] = [];
    const missing: string[] = [];
    const elementCounts: Record<string, number> = {};

    for (const element of SEMANTIC_ELEMENTS) {
      const count = $(element).length;
      if (count > 0) {
        found.push(element);
        elementCounts[element] = count;
      }
    }

    // Determine which recommended elements are missing
    for (const element of RECOMMENDED_ELEMENTS) {
      if (!found.includes(element)) {
        missing.push(element);
      }
    }

    const distinctCount = found.length;

    const details: Record<string, unknown> = {
      found,
      foundCount: distinctCount,
      elementCounts,
      missingRecommended: missing,
      totalSemanticChecked: SEMANTIC_ELEMENTS.length,
    };

    if (distinctCount >= 5) {
      return pass(
        'geo-semantic-html',
        `Excellent semantic HTML structure (${distinctCount} distinct semantic elements found)`,
        details
      );
    }

    if (distinctCount >= 3) {
      return warn(
        'geo-semantic-html',
        `Good semantic structure (${distinctCount} elements), could improve by adding: ${missing.join(', ') || 'more semantic elements'}`,
        details
      );
    }

    return fail(
      'geo-semantic-html',
      `Poor semantic HTML - AI systems struggle to parse content (only ${distinctCount} semantic element(s) found)`,
      {
        ...details,
        recommendation:
          'Add semantic elements like <main>, <article>, <header>, <footer>, and <nav> to help AI understand your content structure',
      }
    );
  },
});
