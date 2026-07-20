import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import {
  extractMainContent,
  stripUrls,
  tokenize,
  getWordFrequency,
} from './utils/text-extractor.js';
import { getKeywordWords } from './utils/stopwords.js';

/**
 * Keyword density thresholds
 *
 * Term density is a noisy metric and was previously calibrated far too
 * aggressively, flagging ordinary prose as manipulation. The constants below
 * are deliberately conservative: this rule should only speak up when repetition
 * is extreme enough that a human reader would also notice it.
 */
const WARN_DENSITY = 4; // Percentage - unusual for a non-topical term
const SEVERE_DENSITY = 10; // Percentage - excessive for any term, topic included
const TOPIC_DENSITY_ALLOWANCE = 8; // The page's primary subject gets more headroom

/**
 * A term must appear at least this many times before density means anything.
 *
 * This is the single most important guard. Density alone is unstable on short
 * pages: a word used 3 times in 54 content words is 5.6%, which looks identical
 * to deliberate stuffing but is just ordinary writing.
 */
const MIN_OCCURRENCES = 5;

/**
 * Minimum *content* words (post-stopword) required to run the analysis.
 *
 * Gating on raw token count was the original defect: roughly half of English
 * prose is stopwords, so a page clearing a 100-raw-word gate was scored against
 * a sample of ~50 — small enough that arithmetic alone produced failures.
 */
const MIN_CONTENT_WORDS = 200;

const WARN_COUNT = 3; // Number of over-threshold terms needed to warn
const MIN_WORD_LENGTH = 3; // Ignore very short words

interface OverusedWord {
  word: string;
  count: number;
  density: number;
}

/**
 * Rule: Detect excessive keyword repetition in content
 *
 * Keyword stuffing is the practice of loading a webpage with keywords
 * in an attempt to manipulate search rankings. Search engines penalize this.
 *
 * This rule never returns `fail`. Term density cannot reliably distinguish
 * manipulation from a page that is simply about its topic, so its strongest
 * verdict is a warning that invites a human to look.
 */
export const keywordStuffingRule = defineRule({
  id: 'content-keyword-stuffing',
  name: 'Keyword Stuffing',
  description: 'Detects excessive keyword repetition in content',
  category: 'content',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $ } = context;

    // Extract main content, discarding URLs so domains don't tokenize into
    // fragments like "com" and register as keywords.
    const mainContent = stripUrls(extractMainContent($));
    const allWords = tokenize(mainContent);

    // Density is measured against content words, so the sample-size guard has
    // to be measured against content words too.
    const contentWords = getKeywordWords(allWords, MIN_WORD_LENGTH);

    if (contentWords.length < MIN_CONTENT_WORDS) {
      return pass(
        'content-keyword-stuffing',
        `Content too short for keyword analysis (${contentWords.length} content words)`,
        {
          totalWords: allWords.length,
          contentWords: contentWords.length,
          skipped: true,
          reason:
            `Minimum ${MIN_CONTENT_WORDS} content words required. Below this, keyword ` +
            `density is dominated by sample size rather than by word choice.`,
        }
      );
    }

    const frequency = getWordFrequency(contentWords);

    // The most frequent content word is, on almost any real page, the subject
    // of the page rather than an attempt to game rankings. A video platform
    // saying "video" is describing itself, not stuffing.
    let topicTerm = '';
    let topicCount = 0;
    for (const [word, count] of frequency.entries()) {
      if (count > topicCount) {
        topicTerm = word;
        topicCount = count;
      }
    }

    const overusedWords: OverusedWord[] = [];
    const severelyOverusedWords: OverusedWord[] = [];

    for (const [word, count] of frequency.entries()) {
      // Absolute floor first: repetition has to be sustained, not incidental.
      if (count < MIN_OCCURRENCES) continue;

      const density = parseFloat(((count / contentWords.length) * 100).toFixed(2));
      const threshold =
        word === topicTerm ? TOPIC_DENSITY_ALLOWANCE : WARN_DENSITY;

      if (density >= SEVERE_DENSITY) {
        severelyOverusedWords.push({ word, count, density });
      } else if (density >= threshold) {
        overusedWords.push({ word, count, density });
      }
    }

    overusedWords.sort((a, b) => b.density - a.density);
    severelyOverusedWords.sort((a, b) => b.density - a.density);

    const details = {
      totalWords: allWords.length,
      contentWords: contentWords.length,
      topicTerm,
      topicTermCount: topicCount,
      thresholds: {
        warnDensity: WARN_DENSITY,
        severeDensity: SEVERE_DENSITY,
        topicTermAllowance: TOPIC_DENSITY_ALLOWANCE,
        minOccurrences: MIN_OCCURRENCES,
      },
      overusedWords: overusedWords.slice(0, 10),
      severelyOverusedWords,
      note:
        `"${topicTerm}" is treated as this page's primary topic and allowed up to ` +
        `${TOPIC_DENSITY_ALLOWANCE}% density before being flagged.`,
    };

    if (severelyOverusedWords.length > 0) {
      const worst = severelyOverusedWords[0];
      return warn(
        'content-keyword-stuffing',
        `Very high keyword density: "${worst.word}" appears ${worst.count} times (${worst.density}%)`,
        {
          ...details,
          topOffenders: severelyOverusedWords.slice(0, 3),
          impact:
            `Density above ${SEVERE_DENSITY}% is high enough that the repetition is ` +
            `likely noticeable to readers. Verify it reads naturally before acting.`,
          recommendation:
            'Read the affected passages aloud. If the repetition sounds forced, vary the wording with synonyms and related terms. If it reads naturally, no change is needed.',
        }
      );
    }

    if (overusedWords.length >= WARN_COUNT) {
      return warn(
        'content-keyword-stuffing',
        `${overusedWords.length} terms exceed ${WARN_DENSITY}% density`,
        {
          ...details,
          topOffenders: overusedWords.slice(0, 3),
          impact:
            'Several terms repeat more than usual. This is often legitimate for a focused page, so treat it as a prompt to review rather than a defect.',
          recommendation:
            'Check whether the flagged terms read naturally in context. Vary the wording only where the repetition feels mechanical.',
        }
      );
    }

    return pass('content-keyword-stuffing', 'No keyword stuffing detected', {
      ...details,
      note: `Keyword density is within acceptable limits. ${details.note}`,
    });
  },
});
