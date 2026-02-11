import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Response time thresholds in milliseconds
 */
const SLOW_THRESHOLD_MS = 3000;
const TIMEOUT_THRESHOLD_MS = 10000;

/**
 * Rule: Check for excessive response time indicating near-timeout
 *
 * Pages that take too long to respond may be dropped by search engine
 * crawlers, leading to incomplete indexing. Most crawlers impose a
 * timeout of 5-30 seconds per request.
 */
export const timeoutRule = defineRule({
  id: 'technical-timeout',
  name: 'Response Timeout Check',
  description:
    'Checks if the page response time is excessive, indicating a near-timeout condition',
  category: 'technical',
  weight: 8,
  run: async (context: AuditContext) => {
    const { responseTime } = context;

    if (responseTime > TIMEOUT_THRESHOLD_MS) {
      return fail(
        'technical-timeout',
        `Page response time is ${responseTime}ms (effectively a timeout for most crawlers)`,
        {
          responseTimeMs: responseTime,
          threshold: TIMEOUT_THRESHOLD_MS,
          fix: 'Investigate server performance; optimize database queries, enable caching, use a CDN, or scale server resources',
        }
      );
    }

    if (responseTime >= SLOW_THRESHOLD_MS) {
      return warn(
        'technical-timeout',
        `Page response time is ${responseTime}ms (slow; may timeout for some crawlers)`,
        {
          responseTimeMs: responseTime,
          threshold: SLOW_THRESHOLD_MS,
          fix: 'Optimize server response time to under 3 seconds; consider caching, CDN, or reducing server-side processing',
        }
      );
    }

    return pass(
      'technical-timeout',
      `Page response time is ${responseTime}ms`,
      { responseTimeMs: responseTime }
    );
  },
});
