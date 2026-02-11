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
      const paramCount = Array.from(params.keys()).length;
      const paramNames = Array.from(params.keys());

      const details = {
        url,
        parameterCount: paramCount,
        parameters: paramNames,
      };

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
