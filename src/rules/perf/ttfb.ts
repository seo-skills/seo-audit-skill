import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * TTFB thresholds in milliseconds
 * Good: < 800ms
 * Needs Improvement: 800ms - 1800ms
 * Poor: > 1800ms
 */
const TTFB_GOOD = 800;
const TTFB_POOR = 1800;

/**
 * Rule: Check Time to First Byte (TTFB) metric
 * TTFB measures the time from when the browser requests a page
 * to when it receives the first byte of information from the server.
 */
export const ttfbRule = defineRule({
  id: 'cwv-ttfb',
  name: 'Time to First Byte (TTFB)',
  description:
    'Measures server response time by checking how long until the first byte is received',
  category: 'perf',
  weight: 15,
  run: async (context: AuditContext) => {
    const { cwv } = context;
    const ttfb = cwv.ttfb;

    if (ttfb === undefined) {
      return warn('cwv-ttfb', 'Could not measure Time to First Byte', {
        metric: 'TTFB',
        reason: 'Metric not available',
      });
    }

    if (ttfb < TTFB_GOOD) {
      return pass('cwv-ttfb', `TTFB is ${ttfb}ms (good, under 800ms)`, {
        metric: 'TTFB',
        value: ttfb,
        valueFormatted: `${ttfb}ms`,
        threshold: {
          good: TTFB_GOOD,
          poor: TTFB_POOR,
        },
      });
    }

    if (ttfb <= TTFB_POOR) {
      return warn(
        'cwv-ttfb',
        `TTFB is ${ttfb}ms (needs improvement, should be under 800ms)`,
        {
          metric: 'TTFB',
          value: ttfb,
          valueFormatted: `${ttfb}ms`,
          threshold: {
            good: TTFB_GOOD,
            poor: TTFB_POOR,
          },
        }
      );
    }

    return fail(
      'cwv-ttfb',
      `TTFB is ${ttfb}ms (poor, should be under 800ms)`,
      {
        metric: 'TTFB',
        value: ttfb,
        valueFormatted: `${ttfb}ms`,
        threshold: {
          good: TTFB_GOOD,
          poor: TTFB_POOR,
        },
      }
    );
  },
});
