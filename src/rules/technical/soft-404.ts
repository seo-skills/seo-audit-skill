import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';
import { DOCUMENT_TITLE } from '../document-title.js';
import { bodyText as visibleBodyText } from '../content/utils/visible-text.js';

/**
 * Title or H1 text that, as a whole segment, says the page does not exist.
 *
 * Matched against whole segments, never as substrings: "Error Handling in
 * Rust", "Terrorism Studies MA" and "Book Room 404" are real pages, and a
 * substring match failed all three. "error" alone is not on the list; it
 * matches too much.
 */
const TITLE_PHRASES = [
  '404',
  'page not found',
  'not found',
  'error 404',
  '404 not found',
  'this page could not be found',
  "oops! that page can't be found",
];

/**
 * Body text that, on a thin page, says the page does not exist.
 * Matched on word boundaries.
 */
const BODY_PHRASES = [
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
 * How thin a page must be for each signal to count.
 *
 * An error-shaped title or H1 is a strong signal, so it needs only a page
 * shorter than a real article. A body phrase alone is weak ("not found" is
 * ordinary prose in a FAQ), so it needs a nearly empty page.
 */
const MAX_WORDS_WITH_TITLE_SIGNAL = 500;
const MAX_WORDS_WITH_BODY_SIGNAL = 100;

/** Characters trimmed from the end of a segment */
const TRAILING = new Set([' ', '.', '!', '?', '\u2026', ':', ';', ',']);

/** Longest text normalised: a heading or a thin page's text is far shorter */
const MAX_NORMALIZED_CHARS = 10_000;

/**
 * Lower-case, straighten curly apostrophes and trim trailing punctuation,
 * so "Oops! That page can\u2019t be found." compares equal to the phrase.
 *
 * Trimmed with a loop, not an end-anchored regex: a pattern like `[.!?]+$`
 * backtracks quadratically over a long run of punctuation that is not at
 * the end, and page text is whatever the audited site serves.
 */
function normalize(text: string): string {
  const collapsed = text
    .slice(0, MAX_NORMALIZED_CHARS)
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  let end = collapsed.length;
  while (end > 0 && TRAILING.has(collapsed[end - 1])) end--;
  return collapsed.slice(0, end);
}

/**
 * Split a title into the segments a site name is joined with.
 *
 * "404 - Page Not Found | Shop" is three segments: "404", "Page Not Found"
 * and "Shop". A hyphen separates only when spaced, so "e-commerce" stays
 * whole; a colon separates when a space follows it, as in "404: This page
 * could not be found".
 */
export function titleSegments(text: string): string[] {
  return text
    .slice(0, MAX_NORMALIZED_CHARS)
    .split(/\s*[|·–—]\s*|\s+-\s+|:\s+/u)
    .map(normalize)
    .filter((segment) => segment.length > 0);
}

/** The phrase a title or H1 matches as a whole segment, or null */
export function errorShapedHeading(text: string): string | null {
  for (const segment of titleSegments(text)) {
    if (TITLE_PHRASES.includes(segment)) return segment;
  }
  return null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BODY_PATTERNS = BODY_PHRASES.map(
  (phrase) => [phrase, new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, 'u')] as const
);

/** The body phrase found on word boundaries, or null */
export function errorShapedBody(text: string): string | null {
  const normalized = normalize(text);
  for (const [phrase, pattern] of BODY_PATTERNS) {
    if (pattern.test(normalized)) return phrase;
  }
  return null;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Rule: Detect soft 404 pages
 *
 * A soft 404 is a page that returns HTTP 200 but says the thing it was asked
 * for does not exist. It takes two signals: an error-shaped phrase and a thin
 * page. One alone is ordinary: long articles about 404 errors exist, and so
 * do short pages that say "not found" about something else.
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
      return pass('technical-soft-404', 'Page correctly returns 404 status code', { statusCode });
    }

    // Only check for soft 404 when the status code is 200
    if (statusCode !== 200) {
      return pass(
        'technical-soft-404',
        'Page does not return 200 status code; not a soft 404 candidate',
        { statusCode }
      );
    }

    const title = $(DOCUMENT_TITLE).first().text().trim();
    const h1 = $('h1').first().text().trim();
    const bodyText = visibleBodyText($);
    const wordCount = countWords(bodyText);

    const indicators: string[] = [];

    if (wordCount < MAX_WORDS_WITH_TITLE_SIGNAL) {
      const titleMatch = errorShapedHeading(title);
      if (titleMatch) indicators.push(`title reads "${titleMatch}"`);
      const h1Match = errorShapedHeading(h1);
      if (h1Match) indicators.push(`H1 reads "${h1Match}"`);
    }

    if (wordCount < MAX_WORDS_WITH_BODY_SIGNAL) {
      const bodyMatch = errorShapedBody(bodyText);
      if (bodyMatch) indicators.push(`the text says "${bodyMatch}"`);
    }

    if (indicators.length > 0) {
      return fail(
        'technical-soft-404',
        `Page returns 200 but appears to be a soft 404: ${indicators.join('; ')}, on a page of ${wordCount} words`,
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

    return pass('technical-soft-404', 'Page does not appear to be a soft 404', { statusCode, wordCount });
  },
});
