import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import {
  extractMainContent,
  tokenize,
  getWordFrequency,
} from './utils/text-extractor.js';
import { getContentWords } from './utils/stopwords.js';

/**
 * Keyword density thresholds
 */
const WARN_DENSITY = 2; // Percentage - start warning
const FAIL_DENSITY = 5; // Percentage - definite keyword stuffing
const WARN_COUNT = 2; // Number of words exceeding threshold to warn
const FAIL_COUNT = 3; // Number of words exceeding threshold to fail
const MIN_WORDS_FOR_CHECK = 100; // Need enough text for meaningful analysis
const MIN_WORD_LENGTH = 3; // Ignore very short words

/**
 * Rule: Detect excessive keyword repetition in content
 *
 * Keyword stuffing is the practice of loading a webpage with keywords
 * in an attempt to manipulate search rankings. Search engines penalize this.
 */
export const keywordStuffingRule = defineRule({
  id: 'content-keyword-stuffing',
  name: 'Keyword Stuffing',
  description: 'Detects excessive keyword repetition in content',
  category: 'content',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $ } = context;

    // Extract main content
    const mainContent = extractMainContent($);
    const allWords = tokenize(mainContent);

    // Skip check for very short content
    if (allWords.length < MIN_WORDS_FOR_CHECK) {
      return pass(
        'content-keyword-stuffing',
        `Content too short for keyword analysis (${allWords.length} words)`,
        {
          wordCount: allWords.length,
          skipped: true,
          reason: `Minimum ${MIN_WORDS_FOR_CHECK} words required for meaningful keyword density analysis`,
        }
      );
    }

    // Filter to content words only (remove stopwords)
    const contentWords = getContentWords(allWords).filter(
      (w) => w.length >= MIN_WORD_LENGTH
    );

    if (contentWords.length === 0) {
      return pass('content-keyword-stuffing', 'No significant content words to analyze', {
        wordCount: allWords.length,
        contentWordCount: 0,
      });
    }

    // Calculate word frequency
    const frequency = getWordFrequency(contentWords);

    // Find words exceeding density thresholds
    const overusedWords: Array<{
      word: string;
      count: number;
      density: number;
    }> = [];

    const severelyOverusedWords: Array<{
      word: string;
      count: number;
      density: number;
    }> = [];

    for (const [word, count] of frequency.entries()) {
      const density = (count / contentWords.length) * 100;

      if (density >= FAIL_DENSITY) {
        severelyOverusedWords.push({
          word,
          count,
          density: parseFloat(density.toFixed(2)),
        });
      } else if (density >= WARN_DENSITY) {
        overusedWords.push({
          word,
          count,
          density: parseFloat(density.toFixed(2)),
        });
      }
    }

    // Sort by density (highest first)
    overusedWords.sort((a, b) => b.density - a.density);
    severelyOverusedWords.sort((a, b) => b.density - a.density);

    const details = {
      totalWords: allWords.length,
      contentWords: contentWords.length,
      thresholds: {
        warnDensity: WARN_DENSITY,
        failDensity: FAIL_DENSITY,
      },
      overusedWords: overusedWords.slice(0, 10), // Limit to top 10
      severelyOverusedWords,
    };

    // Check for severe keyword stuffing
    if (
      severelyOverusedWords.length > 0 ||
      overusedWords.length >= FAIL_COUNT
    ) {
      const topOffenders = severelyOverusedWords.length > 0
        ? severelyOverusedWords.slice(0, 3)
        : overusedWords.slice(0, 3);

      return fail(
        'content-keyword-stuffing',
        `Keyword stuffing detected: ${severelyOverusedWords.length + overusedWords.length} words with excessive density`,
        {
          ...details,
          topOffenders,
          impact:
            'Search engines penalize keyword stuffing. This can result in ranking demotions or manual actions.',
          recommendation:
            'Rewrite content to sound natural. Use synonyms and related terms instead of repeating the same keywords. Aim for < 2% density for any single keyword.',
        }
      );
    }

    // Check for potential issues
    if (overusedWords.length >= WARN_COUNT) {
      return warn(
        'content-keyword-stuffing',
        `Potential keyword stuffing: ${overusedWords.length} words exceed ${WARN_DENSITY}% density`,
        {
          ...details,
          impact:
            'High keyword density may appear unnatural to search engines',
          recommendation:
            'Review flagged words and consider using synonyms or rephrasing. Write naturally for users first.',
        }
      );
    }

    // Single word slightly over threshold - minor warning
    if (overusedWords.length === 1) {
      return warn(
        'content-keyword-stuffing',
        `One word slightly overused: "${overusedWords[0].word}" at ${overusedWords[0].density}% density`,
        {
          ...details,
          impact: 'Minor issue - one keyword appears more frequently than ideal',
          recommendation: `Consider using synonyms for "${overusedWords[0].word}" in some instances`,
        }
      );
    }

    return pass(
      'content-keyword-stuffing',
      'No keyword stuffing detected',
      {
        ...details,
        note: 'Keyword density is within acceptable limits for all words',
      }
    );
  },
});
