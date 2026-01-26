import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

// Global store for tracking titles across pages during a crawl
// This is reset at the start of each audit run
const titleRegistry = new Map<string, string[]>();

/**
 * Reset the title registry (call at start of audit)
 */
export function resetTitleRegistry(): void {
  titleRegistry.clear();
}

/**
 * Get title registry stats (for testing/debugging)
 */
export function getTitleRegistryStats(): { totalTitles: number; duplicateGroups: number } {
  let duplicateGroups = 0;
  for (const urls of titleRegistry.values()) {
    if (urls.length > 1) {
      duplicateGroups++;
    }
  }
  return {
    totalTitles: titleRegistry.size,
    duplicateGroups,
  };
}

/**
 * Normalize title for comparison
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Rule: Check that page titles are unique across the site
 *
 * This is a site-wide rule that tracks titles across all crawled pages.
 * Duplicate titles confuse search engines about which page to prioritize.
 */
export const titleUniqueRule = defineRule({
  id: 'core-title-unique',
  name: 'Title Uniqueness',
  description: 'Checks that page titles are unique across the site',
  category: 'core',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    // Get the page title
    const titleElement = $('title');
    const title = titleElement.first().text()?.trim();

    if (!title) {
      return fail(
        'core-title-unique',
        'Page has no title tag',
        { title: null, url }
      );
    }

    const normalizedTitle = normalizeTitle(title);

    // Check if this title already exists
    const existingUrls = titleRegistry.get(normalizedTitle);

    if (existingUrls) {
      // Title already seen - add this URL to the list
      existingUrls.push(url);

      return warn(
        'core-title-unique',
        `Duplicate title found on ${existingUrls.length} pages`,
        {
          title,
          normalizedTitle,
          duplicateUrls: existingUrls,
          impact: 'Duplicate titles confuse search engines about which page to prioritize',
          recommendation: 'Create unique, descriptive titles for each page (e.g., "Page Topic | Brand Name")',
        }
      );
    }

    // New title - register it
    titleRegistry.set(normalizedTitle, [url]);

    return pass(
      'core-title-unique',
      'Page title is unique',
      { title, normalizedTitle, url }
    );
  },
});
