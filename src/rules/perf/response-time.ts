import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Response time thresholds in milliseconds
 */
const THRESHOLDS = {
  good: 500,
  warning: 1000,
};

/**
 * Rule: Check page response time
 *
 * Response time (time to receive the HTML document) directly impacts
 * Time to First Byte (TTFB) and overall page load speed. Slow response
 * times indicate server-side performance issues, lack of caching, or
 * network latency.
 */
export const responseTimeRule = defineRule({
  id: 'perf-response-time',
  name: 'Response Time',
  description: 'Checks page response time against performance thresholds',
  category: 'perf',
  weight: 7,
  run: (context: AuditContext) => {
    const responseTime = context.responseTime;

    const details: Record<string, unknown> = {
      responseTimeMs: responseTime,
      thresholds: THRESHOLDS,
    };

    if (responseTime > THRESHOLDS.warning) {
      return fail(
        'perf-response-time',
        `Response time is ${responseTime}ms (threshold: ${THRESHOLDS.warning}ms) — consider server-side optimizations, caching, or a CDN`,
        details
      );
    }

    if (responseTime > THRESHOLDS.good) {
      return warn(
        'perf-response-time',
        `Response time is ${responseTime}ms (recommended: <${THRESHOLDS.good}ms) — may impact user experience`,
        details
      );
    }

    return pass(
      'perf-response-time',
      `Response time is ${responseTime}ms — within optimal range`,
      details
    );
  },
});
