import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Patterns in the page title that indicate a soft 404
 */
const TITLE_SOFT_404_PATTERNS = [
  '404',
  'not found',
  'page not found',
  'error',
];

/**
 * Patterns in the H1 that indicate a soft 404
 */
const H1_SOFT_404_PATTERNS = [
  '404',
  'not found',
  'page not found',
];

/**
 * Body text patterns that, combined with thin content, indicate a soft 404
 */
const BODY_SOFT_404_PATTERNS = [
  'not found',
  "doesn't exist",
  'does not exist',
  'no longer available',
  'page removed',
  'page has been removed',
  'page has been deleted',
  'could not be found',
  'cannot be found',
];

/**
 * Minimum word count threshold; pages below this with error-like
 * body text are flagged as soft 404s.
 */
const MIN_WORD_COUNT = 100;

/**
 * Counts the number of words in a text string
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Checks whether any pattern from the list appears in the text
 */
function matchesAny(text: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    if (text.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Rule: Detect soft 404 pages
 *
 * A soft 404 is a page that returns HTTP 200 but displays content
 * indicating the resource does not exist. Search engines may waste
 * crawl budget indexing these pages, and users receive mixed signals.
 */
export const soft404Rule = defineRule({
  id: 'technical-soft-404',
  name: 'Soft 404 Detection',
  description:
    'Detects pages that return HTTP 200 but display error page content (soft 404)',
  category: 'technical',
  weight: 10,
  run: async (context: AuditContext) => {
    const { statusCode, $ } = context;

    // If the server correctly returns 404, this rule passes
    if (statusCode === 404) {
      return pass(
        'technical-soft-404',
        'Page correctly returns 404 status code',
        { statusCode }
      );
    }

    // Only check for soft 404 when the status code is 200
    if (statusCode !== 200) {
      return pass(
        'technical-soft-404',
        'Page does not return 200 status code; not a soft 404 candidate',
        { statusCode }
      );
    }

    const indicators: string[] = [];

    // Check title for soft 404 patterns
    const title = $('title').text().toLowerCase();
    const titleMatch = matchesAny(title, TITLE_SOFT_404_PATTERNS);
    if (titleMatch) {
      indicators.push(`Title contains "${titleMatch}"`);
    }

    // Check H1 for soft 404 patterns
    const h1 = $('h1').text().toLowerCase();
    const h1Match = matchesAny(h1, H1_SOFT_404_PATTERNS);
    if (h1Match) {
      indicators.push(`H1 contains "${h1Match}"`);
    }

    // Check body text for soft 404 patterns combined with thin content
    const bodyText = $('body').text();
    const wordCount = countWords(bodyText);

    if (wordCount < MIN_WORD_COUNT) {
      const bodyLower = bodyText.toLowerCase();
      const bodyMatch = matchesAny(bodyLower, BODY_SOFT_404_PATTERNS);
      if (bodyMatch) {
        indicators.push(
          `Body has thin content (${wordCount} words) and contains "${bodyMatch}"`
        );
      }
    }

    if (indicators.length > 0) {
      return fail(
        'technical-soft-404',
        `Page returns 200 but appears to be a soft 404: ${indicators.join('; ')}`,
        {
          statusCode,
          indicators,
          title: title || '(empty)',
          h1: h1 || '(empty)',
          wordCount,
          fix: 'Return a proper 404 status code for pages that do not exist',
        }
      );
    }

    return pass(
      'technical-soft-404',
      'Page does not appear to be a soft 404',
      { statusCode, wordCount }
    );
  },
});
