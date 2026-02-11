import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Human-readable labels for common 5xx status codes
 */
const SERVER_ERROR_LABELS: Record<number, string> = {
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  520: 'Unknown Error (Cloudflare)',
  521: 'Web Server Is Down (Cloudflare)',
  522: 'Connection Timed Out (Cloudflare)',
  523: 'Origin Is Unreachable (Cloudflare)',
  524: 'A Timeout Occurred (Cloudflare)',
  525: 'SSL Handshake Failed (Cloudflare)',
  526: 'Invalid SSL Certificate (Cloudflare)',
};

/**
 * Rule: Check for 5xx server errors
 *
 * Server errors indicate infrastructure or application problems that
 * prevent search engines from crawling and indexing the page. Persistent
 * 5xx errors can lead to deindexation.
 */
export const serverErrorRule = defineRule({
  id: 'technical-server-error',
  name: 'Server Error Detection',
  description: 'Checks if the page returns a 5xx server error status code',
  category: 'technical',
  weight: 10,
  run: async (context: AuditContext) => {
    const { statusCode } = context;

    if (statusCode >= 500) {
      const label = SERVER_ERROR_LABELS[statusCode] || 'Server Error';
      return fail(
        'technical-server-error',
        `Page returned ${statusCode} ${label}`,
        {
          statusCode,
          label,
          fix: 'Investigate server logs and resolve the underlying error; ensure the page returns a 200 status for valid content',
        }
      );
    }

    if (statusCode >= 200 && statusCode < 300) {
      return pass(
        'technical-server-error',
        'Page returned a successful response',
        { statusCode }
      );
    }

    // Other status codes (3xx, 4xx) are handled by dedicated rules
    return pass(
      'technical-server-error',
      'No server error detected',
      { statusCode }
    );
  },
});
