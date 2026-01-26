import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * CLS thresholds (unitless score)
 * Good: < 0.1
 * Needs Improvement: 0.1 - 0.25
 * Poor: > 0.25
 */
const CLS_GOOD = 0.1;
const CLS_POOR = 0.25;

/**
 * Rule: Check Cumulative Layout Shift (CLS) metric
 * CLS measures visual stability - how much the page layout shifts
 * during the loading phase.
 */
export const clsRule = defineRule({
  id: 'cwv-cls',
  name: 'Cumulative Layout Shift (CLS)',
  description:
    'Measures visual stability by checking how much the page layout shifts during loading',
  category: 'perf',
  weight: 25,
  run: async (context: AuditContext) => {
    const { cwv } = context;
    const cls = cwv.cls;

    if (cls === undefined) {
      return warn('cwv-cls', 'Could not measure Cumulative Layout Shift', {
        metric: 'CLS',
        reason: 'Metric not available',
      });
    }

    const clsFormatted = cls.toFixed(3);

    if (cls < CLS_GOOD) {
      return pass('cwv-cls', `CLS is ${clsFormatted} (good, under 0.1)`, {
        metric: 'CLS',
        value: cls,
        valueFormatted: clsFormatted,
        threshold: {
          good: CLS_GOOD,
          poor: CLS_POOR,
        },
      });
    }

    if (cls <= CLS_POOR) {
      return warn(
        'cwv-cls',
        `CLS is ${clsFormatted} (needs improvement, should be under 0.1)`,
        {
          metric: 'CLS',
          value: cls,
          valueFormatted: clsFormatted,
          threshold: {
            good: CLS_GOOD,
            poor: CLS_POOR,
          },
        }
      );
    }

    return fail(
      'cwv-cls',
      `CLS is ${clsFormatted} (poor, should be under 0.1)`,
      {
        metric: 'CLS',
        value: cls,
        valueFormatted: clsFormatted,
        threshold: {
          good: CLS_GOOD,
          poor: CLS_POOR,
        },
      }
    );
  },
});
