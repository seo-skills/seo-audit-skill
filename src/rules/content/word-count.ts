import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { extractMainContent, countWords } from './utils/text-extractor.js';

/**
 * Thresholds for word count
 */
const EXTREMELY_THIN_THRESHOLD = 100; // Fail
const THIN_CONTENT_THRESHOLD = 300; // Warn
const OPTIMAL_MIN = 500;
const OPTIMAL_MAX = 2500;

/**
 * Rule: Check for thin content based on word count
 *
 * Pages with thin content (< 300 words) often struggle to rank well.
 * Search engines prefer comprehensive content that thoroughly covers a topic.
 */
export const wordCountRule = defineRule({
  id: 'content-word-count',
  name: 'Word Count',
  description: 'Checks content length for thin content issues',
  category: 'content',
  weight: 4,
  run: async (context: AuditContext) => {
    const { $ } = context;

    // Extract main content (excludes nav, footer, scripts, etc.)
    const mainContent = extractMainContent($);
    const wordCount = countWords(mainContent);

    const details = {
      wordCount,
      thresholds: {
        fail: EXTREMELY_THIN_THRESHOLD,
        warn: THIN_CONTENT_THRESHOLD,
        optimal: { min: OPTIMAL_MIN, max: OPTIMAL_MAX },
      },
    };

    if (wordCount < EXTREMELY_THIN_THRESHOLD) {
      return fail(
        'content-word-count',
        `Extremely thin content: ${wordCount} words (minimum ${EXTREMELY_THIN_THRESHOLD} recommended)`,
        {
          ...details,
          impact: 'Pages with very little content rarely rank well and may be seen as low quality',
          recommendation:
            'Expand content to at least 300 words, or consider consolidating with other pages',
        }
      );
    }

    if (wordCount < THIN_CONTENT_THRESHOLD) {
      return warn(
        'content-word-count',
        `Thin content detected: ${wordCount} words (${THIN_CONTENT_THRESHOLD}+ recommended)`,
        {
          ...details,
          impact:
            'Thin content may struggle to rank for competitive queries',
          recommendation:
            'Add more comprehensive content covering the topic thoroughly. Aim for 500+ words for standard pages, 1000+ for in-depth articles.',
        }
      );
    }

    // Check if content is very long (informational only)
    const isVeryLong = wordCount > OPTIMAL_MAX;
    const lengthNote = isVeryLong
      ? ` (consider breaking into multiple focused articles for very long content)`
      : wordCount >= OPTIMAL_MIN
        ? ' (optimal range)'
        : '';

    return pass(
      'content-word-count',
      `Adequate content length: ${wordCount} words${lengthNote}`,
      {
        ...details,
        isOptimal: wordCount >= OPTIMAL_MIN && wordCount <= OPTIMAL_MAX,
        isVeryLong,
      }
    );
  },
});
