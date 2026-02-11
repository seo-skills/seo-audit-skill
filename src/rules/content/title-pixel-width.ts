import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { estimatePixelWidth } from './utils/pixel-width.js';

/**
 * Google SERP title pixel width thresholds
 * Google typically truncates titles around 580px in desktop search results.
 */
const MAX_GOOD_WIDTH = 580;
const MAX_WARN_WIDTH = 620;

/**
 * Rule: Estimate title pixel width for SERP display
 *
 * Google truncates page titles in search results based on pixel width, not
 * character count. A title wider than ~580px will be cut off with an ellipsis,
 * reducing click-through rates and hiding important keywords.
 */
export const titlePixelWidthRule = defineRule({
  id: 'content-title-pixel-width',
  name: 'Title Pixel Width',
  description:
    'Estimates title tag pixel width to predict SERP truncation',
  category: 'content',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const title = $('title').text().trim();

    if (!title) {
      // Missing title is handled by core rules
      return pass(
        'content-title-pixel-width',
        'No title tag found (handled by core rules)',
        {
          title: null,
          reason: 'skipped',
        }
      );
    }

    const estimatedWidth = estimatePixelWidth(title);

    const details = {
      title,
      estimatedWidth,
      characterCount: title.length,
      thresholds: {
        good: MAX_GOOD_WIDTH,
        warn: MAX_WARN_WIDTH,
      },
    };

    if (estimatedWidth > MAX_WARN_WIDTH) {
      return fail(
        'content-title-pixel-width',
        `Title will be truncated in SERP: estimated ${estimatedWidth}px (max ~${MAX_GOOD_WIDTH}px)`,
        {
          ...details,
          impact:
            'Truncated titles hide important keywords and reduce click-through rates in search results',
          recommendation:
            'Shorten the title to fit within 580px. Move the most important keywords to the beginning.',
        }
      );
    }

    if (estimatedWidth > MAX_GOOD_WIDTH) {
      return warn(
        'content-title-pixel-width',
        `Title may be truncated in SERP: estimated ${estimatedWidth}px (max ~${MAX_GOOD_WIDTH}px)`,
        {
          ...details,
          impact:
            'Title is borderline and may be truncated depending on the exact font rendering',
          recommendation:
            'Consider trimming a few characters to ensure the title displays fully in search results',
        }
      );
    }

    return pass(
      'content-title-pixel-width',
      `Title fits within SERP display: estimated ${estimatedWidth}px`,
      details
    );
  },
});
