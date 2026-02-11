import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Extracts the visible text content from the page, stripping scripts,
 * styles, and excess whitespace for comparison purposes.
 */
function getVisibleText($: AuditContext['$']): string {
  // Clone body to avoid mutating the original
  const body = $('body').clone();
  body.find('script, style, noscript').remove();
  return body.text().replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Checks whether a target string (or a meaningful substring of it)
 * appears in the source text. Uses a normalized, case-insensitive
 * comparison and allows partial matches for long strings.
 */
function textAppearsIn(target: string, source: string): boolean {
  if (!target || !source) return false;

  const normalizedTarget = target.replace(/\s+/g, ' ').trim().toLowerCase();
  if (normalizedTarget.length === 0) return false;

  // Direct inclusion check
  if (source.includes(normalizedTarget)) return true;

  // For longer strings, check if a significant portion appears
  // (at least first 40 characters or the whole string if shorter)
  if (normalizedTarget.length > 40) {
    const prefix = normalizedTarget.substring(0, 40);
    if (source.includes(prefix)) return true;
  }

  // Check if individual significant words overlap
  // (useful for slight rewordings between schema and visible text)
  const targetWords = normalizedTarget
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (targetWords.length === 0) return false;

  const matchedWords = targetWords.filter((w) => source.includes(w));
  const matchRatio = matchedWords.length / targetWords.length;

  // At least 60% of significant words must appear
  return matchRatio >= 0.6;
}

/**
 * Safely extracts a string value from a JSON-LD field that might be
 * a string, an object with a name property, or an array.
 */
function extractStringValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) {
    return extractStringValue(value[0]);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj['@value'] === 'string') return obj['@value'];
  }
  return null;
}

interface DriftCheck {
  field: string;
  schemaValue: string;
  foundOnPage: boolean;
}

/**
 * Rule: Schema Drift Detection
 *
 * Compares JSON-LD structured data against visible page content to
 * detect inconsistencies. When schema markup claims content that
 * doesn't appear on the page, search engines may treat it as
 * misleading, and AI systems may generate inaccurate citations.
 *
 * Checks:
 * - name/headline in schema vs. visible text
 * - description in schema vs. meta description or body text
 * - author.name in schema vs. visible text
 *
 * Scoring:
 * - No JSON-LD found: pass (nothing to check)
 * - All checked fields consistent: pass
 * - Some fields don't match: warn
 * - name/headline not found on page at all: fail
 */
export const schemaDriftRule = defineRule({
  id: 'geo-schema-drift',
  name: 'Schema Content Drift',
  description:
    'Compares JSON-LD structured data against visible page content for consistency',
  category: 'geo',
  weight: 15,
  run: (context: AuditContext) => {
    const { $ } = context;

    // Extract all JSON-LD blocks
    const jsonLdScripts = $('script[type="application/ld+json"]');

    if (jsonLdScripts.length === 0) {
      return pass('geo-schema-drift', 'No JSON-LD structured data to check', {
        jsonLdCount: 0,
      });
    }

    const schemas: Array<Record<string, unknown>> = [];

    jsonLdScripts.each((_, el) => {
      const raw = $(el).html();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        // Handle @graph arrays
        if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
          for (const item of parsed['@graph']) {
            if (item && typeof item === 'object') {
              schemas.push(item as Record<string, unknown>);
            }
          }
        } else if (parsed && typeof parsed === 'object') {
          schemas.push(parsed as Record<string, unknown>);
        }
      } catch {
        // Invalid JSON-LD is handled by the schema-valid rule
      }
    });

    if (schemas.length === 0) {
      return pass('geo-schema-drift', 'No parseable JSON-LD structured data found', {
        jsonLdCount: jsonLdScripts.length,
        parsedSchemas: 0,
      });
    }

    const visibleText = getVisibleText($);
    const metaDescription = (
      $('meta[name="description"]').attr('content') || ''
    ).toLowerCase();

    const checks: DriftCheck[] = [];
    let hasNameDrift = false;

    for (const schema of schemas) {
      // Check name / headline
      const nameValue =
        extractStringValue(schema.name) ||
        extractStringValue(schema.headline);

      if (nameValue) {
        const found = textAppearsIn(nameValue, visibleText);
        checks.push({
          field: 'name/headline',
          schemaValue: nameValue.substring(0, 100),
          foundOnPage: found,
        });
        if (!found) {
          hasNameDrift = true;
        }
      }

      // Check description
      const descValue = extractStringValue(schema.description);
      if (descValue) {
        // Check against both visible text and meta description
        const foundInBody = textAppearsIn(descValue, visibleText);
        const foundInMeta = textAppearsIn(descValue, metaDescription);
        checks.push({
          field: 'description',
          schemaValue: descValue.substring(0, 100),
          foundOnPage: foundInBody || foundInMeta,
        });
      }

      // Check author name
      const authorValue = extractStringValue(schema.author);
      if (authorValue) {
        const found = textAppearsIn(authorValue, visibleText);
        checks.push({
          field: 'author.name',
          schemaValue: authorValue.substring(0, 100),
          foundOnPage: found,
        });
      }
    }

    if (checks.length === 0) {
      return pass(
        'geo-schema-drift',
        'JSON-LD found but no name, description, or author fields to verify',
        {
          jsonLdCount: jsonLdScripts.length,
          parsedSchemas: schemas.length,
          checksPerformed: 0,
        }
      );
    }

    const driftChecks = checks.filter((c) => !c.foundOnPage);
    const consistentChecks = checks.filter((c) => c.foundOnPage);

    const details: Record<string, unknown> = {
      jsonLdCount: jsonLdScripts.length,
      parsedSchemas: schemas.length,
      totalChecks: checks.length,
      consistentFields: consistentChecks.map((c) => c.field),
      driftFields: driftChecks.map((c) => ({
        field: c.field,
        schemaValue: c.schemaValue,
      })),
    };

    if (driftChecks.length === 0) {
      return pass(
        'geo-schema-drift',
        `Schema data is consistent with visible content (${checks.length} field(s) verified)`,
        details
      );
    }

    if (hasNameDrift) {
      return fail(
        'geo-schema-drift',
        `Schema name/headline not found in visible page content`,
        {
          ...details,
          recommendation:
            'Ensure the name or headline in your JSON-LD matches text that actually appears on the page',
        }
      );
    }

    return warn(
      'geo-schema-drift',
      `${driftChecks.length} schema field(s) don't match visible content: ${driftChecks.map((c) => c.field).join(', ')}`,
      {
        ...details,
        recommendation:
          'Keep JSON-LD structured data consistent with visible page content to avoid misleading AI systems',
      }
    );
  },
});
