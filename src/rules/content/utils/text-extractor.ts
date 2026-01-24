import type { CheerioAPI } from 'cheerio';

/**
 * Extract readable text content from page body
 * Excludes: scripts, styles, navigation, headers, footers
 */
export function extractMainContent($: CheerioAPI): string {
  // Clone to avoid modifying original
  const body = $('body').clone();

  // Remove non-content elements
  body
    .find(
      'script, style, noscript, nav, footer, header, aside, ' +
        '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
        '[aria-hidden="true"], .nav, .navigation, .footer, .header, .sidebar'
    )
    .remove();

  return body.text().trim();
}

/**
 * Tokenize text into words
 * Removes punctuation and splits on whitespace
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return tokenize(text).length;
}

/**
 * Count sentences in text
 * Splits on sentence-ending punctuation
 */
export function countSentences(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return Math.max(1, sentences.length);
}

/**
 * Calculate word frequency map
 * Returns map of word -> count
 */
export function getWordFrequency(words: string[]): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const word of words) {
    const count = frequency.get(word) || 0;
    frequency.set(word, count + 1);
  }
  return frequency;
}
