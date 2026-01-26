import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Common schema.org types that are SEO-relevant
 */
const COMMON_SCHEMA_TYPES = [
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Product',
  'Organization',
  'Person',
  'LocalBusiness',
  'WebPage',
  'WebSite',
  'BreadcrumbList',
  'FAQPage',
  'HowTo',
  'Recipe',
  'Event',
  'Review',
  'VideoObject',
  'ImageObject',
  'Course',
  'Book',
  'SoftwareApplication',
  'JobPosting',
];

/**
 * Extracts @type from JSON-LD object (handles nested @graph)
 */
function extractTypes(data: unknown): string[] {
  const types: string[] = [];

  if (!data || typeof data !== 'object') {
    return types;
  }

  const obj = data as Record<string, unknown>;

  // Check direct @type
  if (obj['@type']) {
    if (Array.isArray(obj['@type'])) {
      types.push(...(obj['@type'] as string[]));
    } else if (typeof obj['@type'] === 'string') {
      types.push(obj['@type']);
    }
  }

  // Check @graph array (common in WordPress and other CMSes)
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      types.push(...extractTypes(item));
    }
  }

  return types;
}

/**
 * Rule: Check @type field present in JSON-LD
 */
export const structuredDataTypeRule = defineRule({
  id: 'schema-type',
  name: 'Structured Data Type Present',
  description:
    'Checks that JSON-LD structured data includes the required @type field',
  category: 'schema',
  weight: 25,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const jsonLdScripts = $('script[type="application/ld+json"]');

    if (jsonLdScripts.length === 0) {
      return warn(
        'schema-type',
        'No JSON-LD scripts found to check for @type',
        { found: false }
      );
    }

    const allTypes: string[] = [];
    let scriptsWithType = 0;
    let scriptsWithoutType = 0;
    let parseErrors = 0;

    jsonLdScripts.each((index, element) => {
      const rawContent = $(element).html() || '';
      const trimmedContent = rawContent.trim();

      if (!trimmedContent) {
        parseErrors++;
        return;
      }

      try {
        const parsed = JSON.parse(trimmedContent);
        const types = extractTypes(parsed);

        if (types.length > 0) {
          allTypes.push(...types);
          scriptsWithType++;
        } else {
          scriptsWithoutType++;
        }
      } catch {
        parseErrors++;
      }
    });

    // Identify known schema.org types
    const recognizedTypes = allTypes.filter((t) =>
      COMMON_SCHEMA_TYPES.includes(t)
    );
    const uniqueTypes = [...new Set(allTypes)];

    if (scriptsWithType === 0 && parseErrors === 0) {
      return fail(
        'schema-type',
        'No JSON-LD scripts contain a @type field',
        {
          totalScripts: jsonLdScripts.length,
          scriptsWithType: 0,
          scriptsWithoutType,
          parseErrors,
        }
      );
    }

    if (scriptsWithType === 0 && parseErrors > 0) {
      return fail(
        'schema-type',
        'Could not check @type - all JSON-LD scripts have parse errors',
        {
          totalScripts: jsonLdScripts.length,
          scriptsWithType: 0,
          scriptsWithoutType,
          parseErrors,
        }
      );
    }

    if (scriptsWithoutType > 0 || parseErrors > 0) {
      return warn(
        'schema-type',
        `${scriptsWithType} of ${jsonLdScripts.length} JSON-LD script(s) have @type, found: ${uniqueTypes.join(', ')}`,
        {
          totalScripts: jsonLdScripts.length,
          scriptsWithType,
          scriptsWithoutType,
          parseErrors,
          types: uniqueTypes,
          recognizedTypes,
        }
      );
    }

    return pass(
      'schema-type',
      `All ${scriptsWithType} JSON-LD script(s) have @type: ${uniqueTypes.join(', ')}`,
      {
        totalScripts: jsonLdScripts.length,
        scriptsWithType,
        types: uniqueTypes,
        recognizedTypes,
      }
    );
  },
});
