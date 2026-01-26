import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, warn } from '../define-rule.js';

/**
 * Schema types that should typically be indexed for rich results
 */
const RICH_RESULT_TYPES = [
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Product',
  'Recipe',
  'Event',
  'FAQPage',
  'HowTo',
  'LocalBusiness',
  'Organization',
  'Person',
  'Review',
  'VideoObject',
  'Course',
  'JobPosting',
  'SoftwareApplication',
  'Book',
  'Movie',
  'MusicAlbum',
  'Dataset',
];

/**
 * Check if page has noindex directive
 */
function hasNoindex($: AuditContext['$'], headers: Record<string, string>): boolean {
  // Check meta robots
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  if (/noindex/i.test(robotsMeta)) {
    return true;
  }

  // Check googlebot meta
  const googlebotMeta = $('meta[name="googlebot"]').attr('content') || '';
  if (/noindex/i.test(googlebotMeta)) {
    return true;
  }

  // Check X-Robots-Tag header
  const xRobotsTag = headers['x-robots-tag'] || headers['X-Robots-Tag'] || '';
  if (/noindex/i.test(xRobotsTag)) {
    return true;
  }

  return false;
}

/**
 * Extract schema types from JSON-LD
 */
function extractSchemaTypes($: AuditContext['$']): string[] {
  const types: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;

      const data = JSON.parse(content);

      // Handle single object
      if (data['@type']) {
        const schemaType = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        types.push(...schemaType);
      }

      // Handle @graph
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        for (const item of data['@graph']) {
          if (item['@type']) {
            const schemaType = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            types.push(...schemaType);
          }
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  });

  return types;
}

/**
 * Rule: Schema + Noindex Conflict
 *
 * Detects pages with rich result schema that are blocked from indexing.
 * Having schema markup on noindexed pages wastes markup effort and
 * prevents rich results from being displayed.
 */
export const schemaNoindexConflictRule = defineRule({
  id: 'crawl-schema-noindex-conflict',
  name: 'Schema + Noindex Conflict',
  description: 'Detects pages with rich result schema that are blocked from indexing',
  category: 'crawl',
  weight: 15,
  run: async (context: AuditContext) => {
    const { $, headers } = context;

    const isNoindexed = hasNoindex($, headers);
    const schemaTypes = extractSchemaTypes($);

    // Filter to only rich result types
    const richResultTypes = schemaTypes.filter((type) =>
      RICH_RESULT_TYPES.some((richType) => type === richType || type.endsWith('/' + richType))
    );

    // No conflict if page is indexable or has no rich result schemas
    if (!isNoindexed || richResultTypes.length === 0) {
      return pass(
        'crawl-schema-noindex-conflict',
        isNoindexed
          ? 'Page is noindexed but has no rich result schema (no conflict)'
          : richResultTypes.length > 0
            ? `Page has ${richResultTypes.length} rich result schema type(s) and is indexable`
            : 'Page has no rich result schema',
        {
          isNoindexed,
          schemaTypes,
          richResultTypes,
        }
      );
    }

    // Conflict detected: rich schema on noindexed page
    return fail(
      'crawl-schema-noindex-conflict',
      `Page has ${richResultTypes.length} rich result schema type(s) but is blocked from indexing`,
      {
        isNoindexed: true,
        schemaTypes,
        richResultTypes,
        impact: 'Search engines cannot display rich results for noindexed pages',
        recommendation: 'Remove noindex to allow rich results, or remove schema markup if page should stay hidden',
      }
    );
  },
});
