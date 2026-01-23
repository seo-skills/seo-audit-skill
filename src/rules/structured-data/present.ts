import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Check JSON-LD or microdata structured data exists
 */
export const structuredDataPresentRule = defineRule({
  id: 'structured-data-present',
  name: 'Structured Data Present',
  description:
    'Checks that JSON-LD or microdata structured data exists on the page',
  category: 'structured-data',
  weight: 25,
  run: async (context: AuditContext) => {
    const { $ } = context;

    // Check for JSON-LD structured data
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const hasJsonLd = jsonLdScripts.length > 0;

    // Check for microdata
    const microdataElements = $('[itemscope]');
    const hasMicrodata = microdataElements.length > 0;

    // Check for RDFa (bonus check)
    const rdfaElements = $('[typeof], [property]');
    const hasRdfa = rdfaElements.length > 0;

    if (!hasJsonLd && !hasMicrodata && !hasRdfa) {
      return fail(
        'structured-data-present',
        'No structured data found on the page (JSON-LD, microdata, or RDFa)',
        {
          jsonLdCount: 0,
          microdataCount: 0,
          rdfaCount: 0,
        }
      );
    }

    const formats: string[] = [];
    if (hasJsonLd) formats.push('JSON-LD');
    if (hasMicrodata) formats.push('Microdata');
    if (hasRdfa) formats.push('RDFa');

    // Prefer JSON-LD for best SEO practices
    if (hasJsonLd) {
      return pass(
        'structured-data-present',
        `Structured data found: ${formats.join(', ')}`,
        {
          jsonLdCount: jsonLdScripts.length,
          microdataCount: microdataElements.length,
          rdfaCount: rdfaElements.length,
          formats,
        }
      );
    }

    // Microdata or RDFa present but no JSON-LD (warn, as JSON-LD is preferred)
    return warn(
      'structured-data-present',
      `Structured data found (${formats.join(', ')}), but consider using JSON-LD for better compatibility`,
      {
        jsonLdCount: 0,
        microdataCount: microdataElements.length,
        rdfaCount: rdfaElements.length,
        formats,
        recommendation: 'JSON-LD is recommended over microdata and RDFa',
      }
    );
  },
});
