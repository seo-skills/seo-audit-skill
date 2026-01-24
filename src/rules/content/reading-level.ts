import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { extractMainContent, tokenize, countSentences } from './utils/text-extractor.js';
import {
  calculateFleschKincaid,
  getReadingLevelDescription,
} from './utils/syllable-counter.js';

/**
 * Flesch-Kincaid score thresholds
 */
const OPTIMAL_MIN = 60; // Standard readability
const OPTIMAL_MAX = 70; // 8th-9th grade level
const ACCEPTABLE_MIN = 50; // Fairly difficult
const ACCEPTABLE_MAX = 80; // Easy
const MIN_WORDS_FOR_CHECK = 50; // Need enough text for meaningful analysis

/**
 * Rule: Analyze content readability using Flesch-Kincaid
 *
 * Flesch-Kincaid Reading Ease:
 * - 90-100: Very Easy (5th grade)
 * - 80-90: Easy (6th grade)
 * - 70-80: Fairly Easy (7th grade)
 * - 60-70: Standard (8th-9th grade) - TARGET for general audience
 * - 50-60: Fairly Difficult (10th-12th grade)
 * - 30-50: Difficult (college)
 * - 0-30: Very Difficult (college graduate)
 */
export const readingLevelRule = defineRule({
  id: 'content-reading-level',
  name: 'Reading Level',
  description: 'Analyzes content readability using Flesch-Kincaid score',
  category: 'content',
  weight: 3,
  run: async (context: AuditContext) => {
    const { $ } = context;

    // Extract main content
    const mainContent = extractMainContent($);
    const words = tokenize(mainContent);
    const sentenceCount = countSentences(mainContent);

    // Skip check for very short content
    if (words.length < MIN_WORDS_FOR_CHECK) {
      return pass(
        'content-reading-level',
        `Content too short for readability analysis (${words.length} words)`,
        {
          wordCount: words.length,
          sentenceCount,
          skipped: true,
          reason: `Minimum ${MIN_WORDS_FOR_CHECK} words required for meaningful readability analysis`,
        }
      );
    }

    // Calculate Flesch-Kincaid score
    const score = calculateFleschKincaid(words, sentenceCount);
    const levelDescription = getReadingLevelDescription(score);

    const details = {
      score: parseFloat(score.toFixed(1)),
      levelDescription,
      wordCount: words.length,
      sentenceCount,
      avgWordsPerSentence: parseFloat((words.length / sentenceCount).toFixed(1)),
      thresholds: {
        optimal: { min: OPTIMAL_MIN, max: OPTIMAL_MAX },
        acceptable: { min: ACCEPTABLE_MIN, max: ACCEPTABLE_MAX },
      },
    };

    // Optimal readability (60-70)
    if (score >= OPTIMAL_MIN && score <= OPTIMAL_MAX) {
      return pass(
        'content-reading-level',
        `Optimal readability: ${details.score} (${levelDescription})`,
        {
          ...details,
          note: 'Content is accessible to a general audience while maintaining substance',
        }
      );
    }

    // Acceptable but not optimal
    if (score >= ACCEPTABLE_MIN && score <= ACCEPTABLE_MAX) {
      const isSimple = score > OPTIMAL_MAX;
      const isComplex = score < OPTIMAL_MIN;

      return pass(
        'content-reading-level',
        `Acceptable readability: ${details.score} (${levelDescription})`,
        {
          ...details,
          recommendation: isSimple
            ? 'Content may be too simple for some topics. Consider adding more technical depth if appropriate.'
            : 'Content could be simplified for broader accessibility. Use shorter sentences and simpler vocabulary.',
        }
      );
    }

    // Outside acceptable range
    if (score < ACCEPTABLE_MIN) {
      return warn(
        'content-reading-level',
        `Content may be too complex: ${details.score} (${levelDescription})`,
        {
          ...details,
          impact:
            'Complex content may alienate general audiences and reduce engagement',
          recommendation:
            'Simplify language by: using shorter sentences, replacing jargon with common words, breaking long paragraphs into smaller chunks, and using bullet points for lists.',
          note: 'Technical content for expert audiences may legitimately score lower.',
        }
      );
    }

    // Too simple (score > 80)
    return warn(
      'content-reading-level',
      `Content may be too simplistic: ${details.score} (${levelDescription})`,
      {
        ...details,
        impact:
          'Overly simple content may appear thin or lack substance for competitive topics',
        recommendation:
          'Consider adding more depth and detail. Use varied sentence structures and include relevant technical terms where appropriate.',
      }
    );
  },
});
