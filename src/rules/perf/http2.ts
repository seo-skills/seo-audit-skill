import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for modern HTTP protocol support (HTTP/2, HTTP/3)
 *
 * HTTP/2 and HTTP/3 provide multiplexing, header compression, and
 * server push, significantly improving page load performance over
 * HTTP/1.1. The alt-svc header advertises HTTP/3 support, which is
 * a strong signal that the server uses modern protocols.
 *
 * Note: HTTP protocol version is not directly exposed through fetch
 * response headers, so we use the alt-svc header as a heuristic.
 */
export const http2Rule = defineRule({
  id: 'perf-http2',
  name: 'HTTP/2+ Support',
  description: 'Checks for indicators of HTTP/2 or HTTP/3 protocol support (alt-svc header)',
  category: 'perf',
  weight: 5,
  run: (context: AuditContext) => {
    const altSvc = context.headers['alt-svc'] || '';

    const details: Record<string, unknown> = {
      altSvc: altSvc || 'not set',
    };

    if (altSvc) {
      const supportsH3 = altSvc.includes('h3');

      if (supportsH3) {
        return pass(
          'perf-http2',
          'HTTP/3 support advertised via alt-svc header — optimal protocol performance',
          { ...details, protocol: 'h3' }
        );
      }

      return pass(
        'perf-http2',
        `alt-svc header present ("${altSvc.length > 80 ? altSvc.slice(0, 80) + '...' : altSvc}") — modern protocol support indicated`,
        details
      );
    }

    return warn(
      'perf-http2',
      'No alt-svc header found — server may not support HTTP/2 or HTTP/3 (informational)',
      details
    );
  },
});
