/**
 * Count syllables in a word using simplified English rules
 * Based on CMU pronunciation dictionary heuristics
 */
export function countSyllables(word: string): number {
  word = word.toLowerCase().trim();

  // Handle empty or very short words
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  // Remove trailing 'e' (silent e)
  let processed = word;
  if (processed.endsWith('e') && !processed.endsWith('le')) {
    processed = processed.slice(0, -1);
  }

  // Handle -le endings (e.g., "table" has 2 syllables)
  if (word.endsWith('le') && word.length > 2) {
    const charBeforeLe = word[word.length - 3];
    if (!/[aeiouy]/.test(charBeforeLe)) {
      // consonant + le = extra syllable
      processed = word.slice(0, -2);
    }
  }

  // Handle -ed endings
  if (word.endsWith('ed') && word.length > 3) {
    const charBeforeEd = word[word.length - 3];
    // -ted, -ded add a syllable; others are silent
    if (charBeforeEd !== 't' && charBeforeEd !== 'd') {
      processed = word.slice(0, -2);
    }
  }

  // Count vowel groups
  const vowelGroups = processed.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Adjust for le ending we handled earlier
  if (word.endsWith('le') && word.length > 2) {
    const charBeforeLe = word[word.length - 3];
    if (!/[aeiouy]/.test(charBeforeLe)) {
      count++;
    }
  }

  // Minimum 1 syllable per word
  return Math.max(1, count);
}

/**
 * Calculate Flesch-Kincaid Reading Ease score
 * Score = 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
 *
 * Score interpretation:
 * - 90-100: Very Easy (5th grade)
 * - 80-90: Easy (6th grade)
 * - 70-80: Fairly Easy (7th grade)
 * - 60-70: Standard (8th-9th grade) - TARGET
 * - 50-60: Fairly Difficult (10th-12th grade)
 * - 30-50: Difficult (college)
 * - 0-30: Very Difficult (college graduate)
 */
export function calculateFleschKincaid(
  words: string[],
  sentenceCount: number
): number {
  if (words.length === 0 || sentenceCount === 0) return 0;

  const totalSyllables = words.reduce(
    (sum, word) => sum + countSyllables(word),
    0
  );

  const avgSentenceLength = words.length / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const score =
    206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, score));
}

/**
 * Get reading level description based on Flesch-Kincaid score
 */
export function getReadingLevelDescription(score: number): string {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (college level)';
  return 'Very Difficult (college graduate)';
}
