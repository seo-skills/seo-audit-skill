import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * FCP thresholds in milliseconds
 * Good: < 1800ms
 * Needs Improvement: 1800ms - 3000ms
 * Poor: > 3000ms
 */
const FCP_GOOD = 1800;
const FCP_POOR = 3000;

/**
 * Rule: Check First Contentful Paint (FCP) metric
 * FCP measures the time from when the page starts loading to when
 * any part of the page's content is rendered on the screen.
 */
export const fcpRule = defineRule({
  id: 'cwv-fcp',
  name: 'First Contentful Paint (FCP)',
  description:
    'Measures perceived load speed by checking when the first content is rendered',
  category: 'core-web-vitals',
  weight: 15,
  run: async (context: AuditContext) => {
    const { cwv } = context;
    const fcp = cwv.fcp;

    if (fcp === undefined) {
      return warn('cwv-fcp', 'Could not measure First Contentful Paint', {
        metric: 'FCP',
        reason: 'Metric not available',
      });
    }

    const fcpSeconds = (fcp / 1000).toFixed(2);

    if (fcp < FCP_GOOD) {
      return pass('cwv-fcp', `FCP is ${fcpSeconds}s (good, under 1.8s)`, {
        metric: 'FCP',
        value: fcp,
        valueFormatted: `${fcpSeconds}s`,
        threshold: {
          good: FCP_GOOD,
          poor: FCP_POOR,
        },
      });
    }

    if (fcp <= FCP_POOR) {
      return warn(
        'cwv-fcp',
        `FCP is ${fcpSeconds}s (needs improvement, should be under 1.8s)`,
        {
          metric: 'FCP',
          value: fcp,
          valueFormatted: `${fcpSeconds}s`,
          threshold: {
            good: FCP_GOOD,
            poor: FCP_POOR,
          },
        }
      );
    }

    return fail(
      'cwv-fcp',
      `FCP is ${fcpSeconds}s (poor, should be under 1.8s)`,
      {
        metric: 'FCP',
        value: fcp,
        valueFormatted: `${fcpSeconds}s`,
        threshold: {
          good: FCP_GOOD,
          poor: FCP_POOR,
        },
      }
    );
  },
});
