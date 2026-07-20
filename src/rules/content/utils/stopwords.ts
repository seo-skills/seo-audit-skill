/**
 * Common English stopwords to exclude from keyword analysis
 * These words are too common to indicate keyword stuffing
 */
export const STOPWORDS = new Set([
  // Articles
  'a',
  'an',
  'the',
  // Conjunctions
  'and',
  'or',
  'but',
  'nor',
  'so',
  'yet',
  'for',
  // Prepositions
  'in',
  'on',
  'at',
  'to',
  'of',
  'with',
  'by',
  'from',
  'as',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'over',
  'out',
  'up',
  'down',
  'about',
  'against',
  'among',
  'around',
  // Pronouns
  'i',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'ourselves',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',
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
  'having',
  'do',
  'does',
  'did',
  'doing',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'shall',
  // Other common words
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'also',
  'now',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'any',
  'if',
  'then',
  'because',
  'while',
  'although',
  'though',
  'once',
  'until',
  'unless',
  'however',
  'therefore',
  // Numbers and misc
  'one',
  'two',
  'three',
  'first',
  'second',
  'new',
  'get',
  'make',
  'like',
  'even',
  'still',
  'well',
  'back',
  'way',
  'much',
  'many',
]);

/**
 * Interface chrome and technical tokens that leak into extracted body text.
 *
 * These are not prose and must never count as keywords. Sources include icon
 * font ligatures (`<i class="material-icons">settings</i>` renders its glyph
 * name as a text node), navigation labels, and file extensions.
 *
 * Deliberately excludes ambiguous words that are genuine topics for some sites
 * ("image", "search", "content", "video") — those are handled by the topical
 * term allowance in the keyword stuffing rule, not by filtering.
 */
export const WEB_BOILERPLATE = new Set([
  // URL and file fragments
  'com', 'www', 'http', 'https', 'html', 'htm', 'php', 'aspx',
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf',
  // Icon font ligatures and markup leftovers
  'icon', 'icons', 'logo', 'img', 'div', 'span', 'href', 'src',
  // Navigation and control chrome
  'menu', 'nav', 'navbar', 'navigation', 'sidebar', 'breadcrumb',
  'toggle', 'dropdown', 'modal', 'popup', 'overlay', 'widget',
  'login', 'logout', 'signin', 'signup', 'register', 'submit',
  'button', 'close', 'expand', 'collapse', 'skip',
  // Boilerplate footer and consent text
  'cookie', 'cookies', 'copyright', 'reserved', 'disclaimer',
  'newsletter', 'subscribe', 'unsubscribe',
]);

/**
 * Check if a word is a stopword
 */
export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}

/**
 * Filter words down to those eligible for keyword frequency analysis.
 *
 * Stricter than getContentWords: also drops interface chrome and enforces a
 * minimum length, since 1-2 character tokens are almost always markup noise.
 */
export function getKeywordWords(words: string[], minLength = 3): string[] {
  return words.filter((word) => {
    const w = word.toLowerCase();
    return w.length >= minLength && !STOPWORDS.has(w) && !WEB_BOILERPLATE.has(w);
  });
}

/**
 * Remove stopwords from an array of words
 */
export function removeStopwords(words: string[]): string[] {
  return words.filter((word) => !isStopword(word));
}

/**
 * Filter words to only include content words (non-stopwords)
 * Also filters out very short words (< 2 chars)
 */
export function getContentWords(words: string[]): string[] {
  return words.filter((word) => word.length >= 2 && !isStopword(word));
}
