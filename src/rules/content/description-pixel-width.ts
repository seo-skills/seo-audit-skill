import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { estimatePixelWidth } from './utils/pixel-width.js';

/**
 * Google SERP meta description pixel width thresholds
 * Google truncates descriptions around 920px (roughly 155-160 characters).
 */
const MAX_GOOD_WIDTH = 920;
const MAX_WARN_WIDTH = 990;

/**
 * Rule: Estimate meta description pixel width for SERP display
 *
 * Google truncates meta descriptions in search results based on pixel width.
 * Descriptions wider than ~920px will be cut off, potentially losing the
 * call-to-action or important information at the end.
 */
export const descriptionPixelWidthRule = defineRule({
  id: 'content-description-pixel-width',
  name: 'Description Pixel Width',
  description:
    'Estimates meta description pixel width to predict SERP truncation',
  category: 'content',
  weight: 6,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const description = $('meta[name="description"]').attr('content');

    if (!description) {
      // Missing description is handled by other rules
      return pass(
        'content-description-pixel-width',
        'No meta description found (handled by other rules)',
        {
          description: null,
          reason: 'skipped',
        }
      );
    }

    const trimmedDescription = description.trim();
    const estimatedWidth = estimatePixelWidth(trimmedDescription);

    const details = {
      description: trimmedDescription,
      estimatedWidth,
      characterCount: trimmedDescription.length,
      thresholds: {
        good: MAX_GOOD_WIDTH,
        warn: MAX_WARN_WIDTH,
      },
    };

    if (estimatedWidth > MAX_WARN_WIDTH) {
      return fail(
        'content-description-pixel-width',
        `Meta description will be truncated in SERP: estimated ${estimatedWidth}px (max ~${MAX_GOOD_WIDTH}px)`,
        {
          ...details,
          impact:
            'Truncated descriptions lose the call-to-action and may reduce click-through rates',
          recommendation:
            'Shorten the description to fit within 920px (~155 characters). Place the most compelling information first.',
        }
      );
    }

    if (estimatedWidth > MAX_GOOD_WIDTH) {
      return warn(
        'content-description-pixel-width',
        `Meta description may be truncated in SERP: estimated ${estimatedWidth}px (max ~${MAX_GOOD_WIDTH}px)`,
        {
          ...details,
          impact:
            'Description is borderline and may be truncated depending on exact font rendering',
          recommendation:
            'Consider trimming a few characters to ensure the description displays fully in search results',
        }
      );
    }

    return pass(
      'content-description-pixel-width',
      `Meta description fits within SERP display: estimated ${estimatedWidth}px`,
      details
    );
  },
});
