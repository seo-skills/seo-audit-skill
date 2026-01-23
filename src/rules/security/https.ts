import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that the URL uses HTTPS
 */
export const httpsRule = defineRule({
  id: 'security-https',
  name: 'HTTPS',
  description: 'Checks that the page is served over HTTPS',
  category: 'security',
  weight: 10,
  run: (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol;

      if (protocol === 'https:') {
        return pass(
          'security-https',
          'Page is served over HTTPS',
          { url, protocol }
        );
      }

      return fail(
        'security-https',
        'Page is served over HTTP instead of HTTPS',
        { url, protocol }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(
        'security-https',
        `Failed to parse URL: ${message}`,
        { url, error: message }
      );
    }
  },
});
