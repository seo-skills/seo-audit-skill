import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hint: internal/url-contains-more-than-one-google-analytics-code

/**
 * Matches Google Analytics property IDs: Universal Analytics (UA-XXXXX-X)
 * and GA4 measurement IDs (G-XXXXXXX)
 */
const GA_ID_PATTERN = /\bUA-\d+(?:-\d+)?\b|\bG-[A-Z0-9]+\b/g;

/**
 * Collects the distinct GA property IDs referenced by script tags,
 * from both src attributes and inline snippets
 */
function collectGaPropertyIds($: AuditContext['$']): string[] {
  const ids = new Set<string>();

  $('script').each((_, script) => {
    const src = $(script).attr('src') ?? '';
    const inline = $(script).html() ?? '';

    for (const text of [src, inline]) {
      const matches = text.match(GA_ID_PATTERN);
      if (matches) {
        for (const id of matches) {
          ids.add(id);
        }
      }
    }
  });

  return [...ids].sort();
}

/**
 * Rule: Detect multiple Google Analytics properties on one page
 *
 * More than one distinct GA property ID embedded in the page may imply a
 * configuration error, such as a plugin inserting an additional tracking
 * code alongside the intended one.
 */
export const duplicateGaRule = defineRule({
  id: 'technical-duplicate-ga',
  name: 'Multiple Google Analytics Properties',
  description:
    'Detects pages embedding more than one distinct Google Analytics property ID (UA- or G-)',
  category: 'technical',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;

    if (!$) {
      return notMeasured(
        'technical-duplicate-ga',
        'Page HTML was not collected; cannot scan for Analytics properties'
      );
    }

    const propertyIds = collectGaPropertyIds($);

    if (propertyIds.length > 1) {
      return warn(
        'technical-duplicate-ga',
        `Page contains ${propertyIds.length} distinct Google Analytics properties: ${propertyIds.join(', ')}`,
        {
          propertyIds,
          fix: 'Verify all properties are intentional; remove duplicate or legacy tracking codes where possible',
        }
      );
    }

    return pass(
      'technical-duplicate-ga',
      propertyIds.length === 1
        ? `Page contains a single Google Analytics property: ${propertyIds[0]}`
        : 'No Google Analytics properties found',
      { propertyIds }
    );
  },
});
