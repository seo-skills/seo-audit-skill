import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Common English stop words that don't add SEO value to URLs
 * Based on common SEO recommendations
 */
const STOP_WORDS = new Set([
  // Articles
  'a',
  'an',
  'the',

  // Prepositions
  'about',
  'above',
  'after',
  'at',
  'before',
  'below',
  'between',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'to',
  'under',
  'with',
  'without',

  // Conjunctions
  'and',
  'but',
  'or',
  'nor',
  'so',
  'yet',

  // Pronouns
  'i',
  'me',
  'my',
  'you',
  'your',
  'he',
  'she',
  'it',
  'its',
  'we',
  'our',
  'they',
  'their',
  'this',
  'that',
  'these',
  'those',
  'which',
  'who',
  'whom',

  // Common verbs
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'can',
  'could',
  'will',
  'would',
  'should',

  // Other common words
  'just',
  'only',
  'also',
  'very',
  'really',
  'now',
  'then',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'any',
  'no',
  'not',
]);

/**
 * Words that should be kept even if they appear in stop word lists
 * (they may be important for clarity)
 */
const KEEP_WORDS = new Set([
  'how-to',
  'howto',
  'what-is',
  'whatis',
]);

/**
 * Threshold for warning - if stop words make up this percentage of the slug
 */
const STOP_WORD_RATIO_THRESHOLD = 0.4; // 40%

/**
 * Analyze URL for stop words
 */
function analyzeStopWords(url: string): {
  path: string;
  words: string[];
  stopWords: string[];
  stopWordRatio: number;
  suggestions: string[];
} {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Extract words from path segments
    const segments = path.split('/').filter((s) => s.length > 0);

    // Split segments by hyphens/underscores to get individual words
    const words: string[] = [];
    for (const segment of segments) {
      // Remove file extension
      const cleanSegment = segment.replace(/\.[^.]+$/, '');
      // Split by hyphens, underscores, or camelCase
      const segmentWords = cleanSegment
        .split(/[-_]/)
        .flatMap((w) => w.split(/(?=[A-Z])/))
        .map((w) => w.toLowerCase())
        .filter((w) => w.length > 0);
      words.push(...segmentWords);
    }

    if (words.length === 0) {
      return {
        path,
        words: [],
        stopWords: [],
        stopWordRatio: 0,
        suggestions: [],
      };
    }

    // Find stop words (excluding important compound words)
    const stopWords = words.filter((word) => {
      // Check if it's part of a compound word we should keep
      for (const keep of KEEP_WORDS) {
        if (path.toLowerCase().includes(keep)) {
          const keepWords = keep.split('-');
          if (keepWords.includes(word)) {
            return false;
          }
        }
      }
      return STOP_WORDS.has(word);
    });

    const stopWordRatio = words.length > 0 ? stopWords.length / words.length : 0;

    // Generate suggestions
    const suggestions: string[] = [];
    if (stopWords.length > 0) {
      // Suggest URL without stop words
      const nonStopWords = words.filter((w) => !STOP_WORDS.has(w));
      if (nonStopWords.length > 0) {
        suggestions.push(`Consider: /${nonStopWords.join('-')}`);
      }
    }

    return {
      path,
      words,
      stopWords: [...new Set(stopWords)], // Unique stop words
      stopWordRatio,
      suggestions,
    };
  } catch {
    return {
      path: url,
      words: [],
      stopWords: [],
      stopWordRatio: 0,
      suggestions: [],
    };
  }
}

/**
 * Rule: Check for stop words in URL slugs
 */
export const stopWordsRule = defineRule({
  id: 'url-stop-words',
  name: 'URL Stop Words',
  description:
    'Flags common stop words (a, an, the, of, etc.) in URL slugs that add length without SEO value',
  category: 'url',
  weight: 10,
  run: async (context: AuditContext) => {
    const { url } = context;
    const analysis = analyzeStopWords(url);

    const details = {
      url,
      path: analysis.path,
      words: analysis.words,
      stopWordsFound: analysis.stopWords,
      stopWordCount: analysis.stopWords.length,
      stopWordRatio: Math.round(analysis.stopWordRatio * 100),
      suggestions: analysis.suggestions,
    };

    // No stop words found
    if (analysis.stopWords.length === 0) {
      return pass(
        'url-stop-words',
        'URL contains no stop words',
        details
      );
    }

    // Stop words found but ratio is acceptable
    if (analysis.stopWordRatio <= STOP_WORD_RATIO_THRESHOLD) {
      return pass(
        'url-stop-words',
        `URL contains ${analysis.stopWords.length} stop word(s) but ratio is acceptable (${Math.round(analysis.stopWordRatio * 100)}%)`,
        details
      );
    }

    // High ratio of stop words
    return warn(
      'url-stop-words',
      `URL contains ${analysis.stopWords.length} stop words (${analysis.stopWords.join(', ')}): ${Math.round(analysis.stopWordRatio * 100)}% of slug`,
      details
    );
  },
});
