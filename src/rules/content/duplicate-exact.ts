import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Module-level registry storing content hashes mapped to their first-seen URL.
 * This enables cross-page exact duplicate detection during multi-page crawls.
 */
const contentHashRegistry = new Map<string, string>();

/**
 * Reset the duplicate content registry (call at start of each audit run)
 */
export function resetDuplicateContentRegistry(): void {
  contentHashRegistry.clear();
}

/**
 * Get duplicate content registry stats (for testing/debugging)
 */
export function getDuplicateContentRegistryStats(): {
  totalHashes: number;
} {
  return {
    totalHashes: contentHashRegistry.size,
  };
}

/**
 * Rule: Detect exact duplicate content across crawled pages
 *
 * Exact duplicate content across multiple URLs confuses search engines
 * about which page to index and rank. It dilutes link equity and can
 * result in the wrong page appearing in search results.
 *
 * This is a Tier 3 cross-page rule that uses a module-level registry
 * to track content hashes across pages within a crawl session.
 */
export const duplicateExactRule = defineRule({
  id: 'content-duplicate-exact',
  name: 'Exact Duplicate Content',
  description:
    'Detects exact duplicate content across crawled pages using content hashing',
  category: 'content',
  weight: 8,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    if (!bodyText || bodyText.length < 50) {
      return pass(
        'content-duplicate-exact',
        'Page has insufficient content for duplicate detection',
        {
          url,
          textLength: bodyText.length,
          reason: 'skipped',
        }
      );
    }

    // Use Node.js crypto to create an MD5 hash of the body text
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('md5').update(bodyText).digest('hex');

    const existingUrl = contentHashRegistry.get(hash);

    if (existingUrl) {
      return fail(
        'content-duplicate-exact',
        `Exact duplicate content detected (matches ${existingUrl})`,
        {
          url,
          duplicateOf: existingUrl,
          contentHash: hash,
          textLength: bodyText.length,
          impact:
            'Exact duplicate content confuses search engines about which page to rank and dilutes link equity',
          recommendation:
            'Consolidate duplicate pages using canonical tags, 301 redirects, or by removing the duplicate. Ensure each URL serves unique content.',
        }
      );
    }

    // First occurrence of this content hash - register it
    contentHashRegistry.set(hash, url);

    return pass(
      'content-duplicate-exact',
      'Content is unique (no exact duplicates detected)',
      {
        url,
        contentHash: hash,
        textLength: bodyText.length,
      }
    );
  },
});
