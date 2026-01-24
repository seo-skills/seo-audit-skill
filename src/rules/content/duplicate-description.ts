import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

// Global store for tracking descriptions across pages during a crawl
// This is reset at the start of each audit run
const descriptionRegistry = new Map<string, string[]>();

/**
 * Reset the description registry (call at start of audit)
 */
export function resetDescriptionRegistry(): void {
  descriptionRegistry.clear();
}

/**
 * Get description registry stats (for testing/debugging)
 */
export function getDescriptionRegistryStats(): {
  totalDescriptions: number;
  duplicateGroups: number;
} {
  let duplicateGroups = 0;
  for (const urls of descriptionRegistry.values()) {
    if (urls.length > 1) {
      duplicateGroups++;
    }
  }
  return {
    totalDescriptions: descriptionRegistry.size,
    duplicateGroups,
  };
}

/**
 * Normalize description for comparison
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces
 */
function normalizeDescription(description: string): string {
  return description.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Rule: Check that meta descriptions are unique across the site
 *
 * This is a site-wide rule that tracks descriptions across all crawled pages.
 * Duplicate descriptions reduce click-through rates and provide poor user experience
 * in search results.
 */
export const duplicateDescriptionRule = defineRule({
  id: 'content-duplicate-description',
  name: 'Duplicate Description',
  description: 'Checks for duplicate meta descriptions across the site',
  category: 'content',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    // Get the meta description
    const descriptionElement = $('meta[name="description"]');
    const description = descriptionElement.attr('content')?.trim();

    if (!description) {
      return fail('content-duplicate-description', 'Page has no meta description', {
        description: null,
        url,
        impact:
          'Missing meta description reduces control over how the page appears in search results',
        recommendation:
          'Add a unique, compelling meta description between 120-160 characters',
      });
    }

    // Check for very short descriptions
    if (description.length < 50) {
      // Still check for duplicates but note the length issue
      const normalizedDescription = normalizeDescription(description);
      const existingUrls = descriptionRegistry.get(normalizedDescription);

      if (existingUrls) {
        existingUrls.push(url);
        return warn(
          'content-duplicate-description',
          `Duplicate description found on ${existingUrls.length} pages (also too short)`,
          {
            description,
            normalizedDescription,
            length: description.length,
            duplicateUrls: existingUrls,
            impact:
              'Duplicate descriptions confuse search engines and reduce click-through rates',
            recommendation:
              'Create unique, compelling descriptions for each page (120-160 characters)',
          }
        );
      }

      descriptionRegistry.set(normalizedDescription, [url]);

      return warn('content-duplicate-description', 'Meta description is too short', {
        description,
        length: description.length,
        url,
        recommendation: 'Expand description to 120-160 characters for optimal display in search results',
      });
    }

    const normalizedDescription = normalizeDescription(description);

    // Check if this description already exists
    const existingUrls = descriptionRegistry.get(normalizedDescription);

    if (existingUrls) {
      // Description already seen - add this URL to the list
      existingUrls.push(url);

      return warn(
        'content-duplicate-description',
        `Duplicate description found on ${existingUrls.length} pages`,
        {
          description,
          normalizedDescription,
          length: description.length,
          duplicateUrls: existingUrls,
          impact:
            'Duplicate descriptions confuse search engines about which page to display. They also reduce click-through rates by not differentiating pages.',
          recommendation:
            'Create unique, descriptive meta descriptions for each page that accurately summarize the specific content',
        }
      );
    }

    // New description - register it
    descriptionRegistry.set(normalizedDescription, [url]);

    return pass('content-duplicate-description', 'Meta description is unique', {
      description,
      normalizedDescription,
      length: description.length,
      url,
      isOptimalLength: description.length >= 120 && description.length <= 160,
    });
  },
});
