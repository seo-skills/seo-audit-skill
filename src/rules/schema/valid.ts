import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Represents parsed JSON-LD data
 */
interface JsonLdParseResult {
  index: number;
  valid: boolean;
  data?: unknown;
  error?: string;
  raw: string;
}

/**
 * Rule: Check JSON-LD is valid JSON (parse without errors)
 */
export const structuredDataValidRule = defineRule({
  id: 'schema-valid',
  name: 'Structured Data Valid JSON',
  description:
    'Checks that all JSON-LD scripts contain valid, parseable JSON',
  category: 'schema',
  weight: 25,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const jsonLdScripts = $('script[type="application/ld+json"]');

    if (jsonLdScripts.length === 0) {
      return warn(
        'schema-valid',
        'No JSON-LD scripts found to validate',
        { found: false }
      );
    }

    const parseResults: JsonLdParseResult[] = [];
    let validCount = 0;
    let invalidCount = 0;

    jsonLdScripts.each((index, element) => {
      const rawContent = $(element).html() || '';
      const trimmedContent = rawContent.trim();

      if (!trimmedContent) {
        parseResults.push({
          index,
          valid: false,
          error: 'Empty JSON-LD script',
          raw: rawContent,
        });
        invalidCount++;
        return;
      }

      try {
        const parsed = JSON.parse(trimmedContent);
        parseResults.push({
          index,
          valid: true,
          data: parsed,
          raw: trimmedContent.substring(0, 200), // Truncate for details
        });
        validCount++;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown parse error';
        parseResults.push({
          index,
          valid: false,
          error: errorMessage,
          raw: trimmedContent.substring(0, 200), // Truncate for details
        });
        invalidCount++;
      }
    });

    if (invalidCount === 0) {
      return pass(
        'schema-valid',
        `All ${validCount} JSON-LD script(s) contain valid JSON`,
        {
          totalScripts: jsonLdScripts.length,
          validCount,
          invalidCount: 0,
        }
      );
    }

    const invalidDetails = parseResults
      .filter((r) => !r.valid)
      .map((r) => ({
        scriptIndex: r.index,
        error: r.error,
      }));

    if (validCount === 0) {
      return fail(
        'schema-valid',
        `All ${invalidCount} JSON-LD script(s) contain invalid JSON`,
        {
          totalScripts: jsonLdScripts.length,
          validCount: 0,
          invalidCount,
          invalidScripts: invalidDetails,
        }
      );
    }

    return warn(
      'schema-valid',
      `${invalidCount} of ${jsonLdScripts.length} JSON-LD script(s) contain invalid JSON`,
      {
        totalScripts: jsonLdScripts.length,
        validCount,
        invalidCount,
        invalidScripts: invalidDetails,
      }
    );
  },
});
