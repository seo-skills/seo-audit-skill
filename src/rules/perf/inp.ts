import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

/**
 * INP thresholds in milliseconds
 * Good: < 200ms
 * Needs Improvement: 200ms - 500ms
 * Poor: > 500ms
 */
const INP_GOOD = 200;
const INP_POOR = 500;

/**
 * Rule: Check Interaction to Next Paint (INP) metric
 * INP measures responsiveness - the time from when a user interacts
 * with the page to when the next frame is painted.
 */
export const inpRule = defineRule({
  id: 'cwv-inp',
  name: 'Interaction to Next Paint (INP)',
  description:
    'Measures responsiveness by checking the latency of user interactions',
  category: 'perf',
  weight: 20,
  run: async (context: AuditContext) => {
    const { cwv } = context;
    const inp = cwv.inp;

    if (inp === undefined) {
      return notMeasured(
        'cwv-inp',
        'INP not measured - it requires real user interaction, which an automated crawl does not perform. Use field data (CrUX or RUM) for INP, or --simulate-interaction for an indicative lab value.',
        {
          metric: 'INP',
          reason: 'INP requires user interaction and cannot be measured in a lab crawl',
        }
      );
    }

    // A synthetic INP measures whichever element the crawler happened to click,
    // not real usage. Reporting it as a graded pass/fail would give it more
    // authority than it has, so it is surfaced as an unweighted observation.
    if (cwv.inpSynthetic) {
      return notMeasured(
        'cwv-inp',
        `INP is ${inp}ms from a synthetic interaction (indicative only - not real user data)`,
        {
          metric: 'INP',
          value: inp,
          valueFormatted: `${inp}ms`,
          synthetic: true,
          reason:
            'Measured from a crawler-generated interaction, which reflects one arbitrary element rather than real usage',
          threshold: { good: INP_GOOD, poor: INP_POOR },
        }
      );
    }

    if (inp < INP_GOOD) {
      return pass('cwv-inp', `INP is ${inp}ms (good, under 200ms)`, {
        metric: 'INP',
        value: inp,
        valueFormatted: `${inp}ms`,
        threshold: {
          good: INP_GOOD,
          poor: INP_POOR,
        },
      });
    }

    if (inp <= INP_POOR) {
      return warn(
        'cwv-inp',
        `INP is ${inp}ms (needs improvement, should be under 200ms)`,
        {
          metric: 'INP',
          value: inp,
          valueFormatted: `${inp}ms`,
          threshold: {
            good: INP_GOOD,
            poor: INP_POOR,
          },
        }
      );
    }

    return fail(
      'cwv-inp',
      `INP is ${inp}ms (poor, should be under 200ms)`,
      {
        metric: 'INP',
        value: inp,
        valueFormatted: `${inp}ms`,
        threshold: {
          good: INP_GOOD,
          poor: INP_POOR,
        },
      }
    );
  },
});
