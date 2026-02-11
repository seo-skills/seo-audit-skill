import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Thresholds for text-to-HTML ratio
 */
const GOOD_RATIO = 25; // >= 25% is good
const LOW_RATIO = 10; // < 10% is too low

/**
 * Rule: Check text-to-HTML ratio
 *
 * A low text-to-HTML ratio indicates bloated markup with little visible content.
 * Search engines prefer pages with a healthy balance of code and readable text.
 * Ratios below 10% suggest excessive code or too little content.
 */
export const textHtmlRatioRule = defineRule({
  id: 'content-text-html-ratio',
  name: 'Text to HTML Ratio',
  description: 'Checks the ratio of visible text content to total HTML size',
  category: 'content',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $, html } = context;

    const htmlLength = html.length;

    if (htmlLength === 0) {
      return fail('content-text-html-ratio', 'Page has no HTML content', {
        htmlLength: 0,
        textLength: 0,
        ratio: 0,
      });
    }

    const visibleText = $('body').text().replace(/\s+/g, ' ').trim();
    const textLength = visibleText.length;
    const ratio = (textLength / htmlLength) * 100;
    const roundedRatio = Math.round(ratio * 10) / 10;

    const details = {
      textLength,
      htmlLength,
      ratio: roundedRatio,
      thresholds: {
        good: GOOD_RATIO,
        low: LOW_RATIO,
      },
    };

    if (ratio < LOW_RATIO) {
      return fail(
        'content-text-html-ratio',
        `Very low text-to-HTML ratio: ${roundedRatio}% (${textLength} text bytes / ${htmlLength} HTML bytes)`,
        {
          ...details,
          impact:
            'Extremely low text ratio suggests too much code and too little content for search engines to index',
          recommendation:
            'Reduce unnecessary markup, inline styles, and scripts. Add more meaningful text content.',
        }
      );
    }

    if (ratio < GOOD_RATIO) {
      return warn(
        'content-text-html-ratio',
        `Low text-to-HTML ratio: ${roundedRatio}% (${textLength} text bytes / ${htmlLength} HTML bytes)`,
        {
          ...details,
          impact:
            'Low text ratio may indicate bloated code or insufficient content',
          recommendation:
            'Aim for at least 25% text-to-HTML ratio by reducing code bloat or adding more content',
        }
      );
    }

    return pass(
      'content-text-html-ratio',
      `Good text-to-HTML ratio: ${roundedRatio}% (${textLength} text bytes / ${htmlLength} HTML bytes)`,
      details
    );
  },
});
