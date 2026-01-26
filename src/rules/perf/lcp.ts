import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * LCP thresholds in milliseconds
 * Good: < 2500ms
 * Needs Improvement: 2500ms - 4000ms
 * Poor: > 4000ms
 */
const LCP_GOOD = 2500;
const LCP_POOR = 4000;

/**
 * Rule: Check Largest Contentful Paint (LCP) metric
 * LCP measures loading performance - the time it takes for the largest
 * content element to become visible in the viewport.
 */
export const lcpRule = defineRule({
  id: 'cwv-lcp',
  name: 'Largest Contentful Paint (LCP)',
  description:
    'Measures loading performance by checking when the largest content element becomes visible',
  category: 'perf',
  weight: 25,
  run: async (context: AuditContext) => {
    const { cwv } = context;
    const lcp = cwv.lcp;

    if (lcp === undefined) {
      return warn('cwv-lcp', 'Could not measure Largest Contentful Paint', {
        metric: 'LCP',
        reason: 'Metric not available',
      });
    }

    const lcpSeconds = (lcp / 1000).toFixed(2);

    if (lcp < LCP_GOOD) {
      return pass('cwv-lcp', `LCP is ${lcpSeconds}s (good, under 2.5s)`, {
        metric: 'LCP',
        value: lcp,
        valueFormatted: `${lcpSeconds}s`,
        threshold: {
          good: LCP_GOOD,
          poor: LCP_POOR,
        },
      });
    }

    if (lcp <= LCP_POOR) {
      return warn(
        'cwv-lcp',
        `LCP is ${lcpSeconds}s (needs improvement, should be under 2.5s)`,
        {
          metric: 'LCP',
          value: lcp,
          valueFormatted: `${lcpSeconds}s`,
          threshold: {
            good: LCP_GOOD,
            poor: LCP_POOR,
          },
        }
      );
    }

    return fail(
      'cwv-lcp',
      `LCP is ${lcpSeconds}s (poor, should be under 2.5s)`,
      {
        metric: 'LCP',
        value: lcp,
        valueFormatted: `${lcpSeconds}s`,
        threshold: {
          good: LCP_GOOD,
          poor: LCP_POOR,
        },
      }
    );
  },
});
