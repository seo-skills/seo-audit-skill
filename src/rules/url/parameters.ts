import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Maximum number of query parameters considered acceptable
 */
const PARAMS_GOOD = 2;

/**
 * Maximum number of query parameters before warning
 */
const PARAMS_WARN = 5;

/**
 * Rule: Check for excessive URL query parameters
 *
 * Too many query parameters can hurt SEO by creating numerous URL
 * variations that dilute page authority and waste crawl budget.
 * Search engines may also struggle to determine the canonical version.
 *
 * Also warns on malformed query strings: the same parameter name appearing
 * more than once, or more than one literal '?' character in the URL.
 * Reference hints: internal/query-string-contains-repetitive-parameters,
 * internal/query-string-contains-a-question-mark
 */
export const parametersRule = defineRule({
  id: 'url-parameters',
  name: 'Excessive URL Parameters',
  description:
    'Checks for excessive query parameters that can fragment crawl budget and dilute page authority',
  category: 'url',
  weight: 5,
  run: async (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      const paramNames = Array.from(params.keys());
      const paramCount = paramNames.length;

      const details = {
        url,
        parameterCount: paramCount,
        parameters: paramNames,
      };

      // More than one '?' means the query string itself contains a literal
      // question mark — almost always a concatenation mistake.
      const questionMarkCount = (url.match(/\?/g) || []).length;

      // Repetitive parameters: the same name appears more than once.
      const uniqueNames = new Set(paramNames);
      const repetitiveNames = [
        ...new Set(
          paramNames.filter((name) => paramNames.indexOf(name) !== paramNames.lastIndexOf(name))
        ),
      ];

      if (questionMarkCount > 1 || repetitiveNames.length > 0) {
        const issues: string[] = [];
        if (questionMarkCount > 1) {
          issues.push(`query string contains ${questionMarkCount} '?' characters`);
        }
        if (repetitiveNames.length > 0) {
          issues.push(`repetitive parameter(s): ${repetitiveNames.join(', ')}`);
        }

        return warn(
          'url-parameters',
          `URL query string is malformed: ${issues.join('; ')}`,
          {
            ...details,
            questionMarkCount,
            repetitiveParameters: repetitiveNames,
            uniqueParameterCount: uniqueNames.size,
            fix: 'Fix the query string: join values of repeated parameters and ensure only one \'?\' separates the path from the query',
          }
        );
      }

      if (paramCount <= PARAMS_GOOD) {
        return pass(
          'url-parameters',
          paramCount === 0
            ? 'URL has no query parameters'
            : `URL has ${paramCount} query parameter(s) (acceptable)`,
          details
        );
      }

      if (paramCount <= PARAMS_WARN) {
        return warn(
          'url-parameters',
          `URL has ${paramCount} query parameters: ${paramNames.join(', ')}`,
          {
            ...details,
            fix: 'Reduce query parameters or use canonical tags to consolidate variations',
          }
        );
      }

      return fail(
        'url-parameters',
        `URL has ${paramCount} query parameters (exceeds ${PARAMS_WARN}): ${paramNames.join(', ')}`,
        {
          ...details,
          fix: 'Reduce query parameters; use canonical tags or parameter handling in Google Search Console',
        }
      );
    } catch {
      return pass('url-parameters', 'Could not parse URL', { url });
    }
  },
});
