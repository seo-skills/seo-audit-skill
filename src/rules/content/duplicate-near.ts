import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Similarity thresholds for near-duplicate detection
 */
const DUPLICATE_THRESHOLD = 0.8; // Jaccard > 0.8 = near duplicate (fail)
const SIMILAR_THRESHOLD = 0.6; // Jaccard > 0.6 = similar content (warn)

/**
 * Maximum number of words to consider for trigram generation.
 * Using the first 500 words keeps the comparison efficient while capturing
 * enough content to detect similarity.
 */
const MAX_WORDS = 500;

/**
 * Stored page data for cross-page comparison
 */
interface StoredPage {
  url: string;
  trigrams: Set<string>;
}

/**
 * Module-level registry storing trigram sets per URL.
 * This enables cross-page near-duplicate detection during multi-page crawls.
 */
const nearDuplicateRegistry: StoredPage[] = [];

/**
 * Reset the near-duplicate registry (call at start of each audit run)
 */
export function resetNearDuplicateRegistry(): void {
  nearDuplicateRegistry.length = 0;
}

/**
 * Get near-duplicate registry stats (for testing/debugging)
 */
export function getNearDuplicateRegistryStats(): {
  totalPages: number;
} {
  return {
    totalPages: nearDuplicateRegistry.length,
  };
}

/**
 * Extract word trigrams from text.
 * Splits text into words, takes the first MAX_WORDS, and generates
 * all consecutive 3-word sequences as a Set for Jaccard comparison.
 */
function extractTrigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, MAX_WORDS);

  const trigrams = new Set<string>();

  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  return trigrams;
}

/**
 * Compute Jaccard similarity between two sets.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }

  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  // Iterate over the smaller set for efficiency
  const [smaller, larger] =
    setA.size <= setB.size ? [setA, setB] : [setB, setA];

  for (const item of smaller) {
    if (larger.has(item)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Rule: Detect near-duplicate content using trigram-based Jaccard similarity
 *
 * Near-duplicate content (e.g., pages with only minor text differences)
 * can cause keyword cannibalization and confuse search engines about
 * which page to rank. This rule compares word trigram sets between
 * crawled pages to detect high similarity.
 *
 * This is a Tier 3 cross-page rule that uses a module-level registry
 * to store trigram sets across pages within a crawl session.
 */
export const duplicateNearRule = defineRule({
  id: 'content-duplicate-near',
  name: 'Near-Duplicate Content',
  description:
    'Detects near-duplicate content across crawled pages using trigram similarity',
  category: 'content',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    if (!bodyText || bodyText.length < 100) {
      return pass(
        'content-duplicate-near',
        'Page has insufficient content for near-duplicate detection',
        {
          url,
          textLength: bodyText.length,
          reason: 'skipped',
        }
      );
    }

    const trigrams = extractTrigrams(bodyText);

    // Need at least a few trigrams for meaningful comparison
    if (trigrams.size < 5) {
      nearDuplicateRegistry.push({ url, trigrams });
      return pass(
        'content-duplicate-near',
        'Page has too few word trigrams for reliable comparison',
        {
          url,
          trigramCount: trigrams.size,
          reason: 'skipped',
        }
      );
    }

    // Compare with all stored pages
    let highestSimilarity = 0;
    let mostSimilarUrl = '';

    for (const stored of nearDuplicateRegistry) {
      const similarity = jaccardSimilarity(trigrams, stored.trigrams);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        mostSimilarUrl = stored.url;
      }
    }

    // Register this page for future comparisons
    nearDuplicateRegistry.push({ url, trigrams });

    const roundedSimilarity = Math.round(highestSimilarity * 100) / 100;

    const details = {
      url,
      trigramCount: trigrams.size,
      highestSimilarity: roundedSimilarity,
      mostSimilarUrl: mostSimilarUrl || null,
      thresholds: {
        duplicate: DUPLICATE_THRESHOLD,
        similar: SIMILAR_THRESHOLD,
      },
    };

    if (highestSimilarity > DUPLICATE_THRESHOLD) {
      return fail(
        'content-duplicate-near',
        `Near-duplicate content detected: ${Math.round(highestSimilarity * 100)}% similar to ${mostSimilarUrl}`,
        {
          ...details,
          impact:
            'Near-duplicate pages cause keyword cannibalization and confuse search engines about which page to rank',
          recommendation:
            'Consolidate similar pages, differentiate their content significantly, or use canonical tags to indicate the preferred version.',
        }
      );
    }

    if (highestSimilarity > SIMILAR_THRESHOLD) {
      return warn(
        'content-duplicate-near',
        `Similar content detected: ${Math.round(highestSimilarity * 100)}% similar to ${mostSimilarUrl}`,
        {
          ...details,
          impact:
            'Highly similar content may compete with itself in search rankings',
          recommendation:
            'Review both pages and differentiate their content, titles, and meta descriptions to target different search intents.',
        }
      );
    }

    return pass(
      'content-duplicate-near',
      mostSimilarUrl
        ? `Content is sufficiently unique (highest similarity: ${Math.round(highestSimilarity * 100)}%)`
        : 'First page analyzed (no comparison available yet)',
      details
    );
  },
});
