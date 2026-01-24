import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { extractMainContent, countWords } from './utils/text-extractor.js';

/**
 * Thresholds for link density (links per 100 words)
 */
const MIN_LINKS_PER_100_WORDS = 0.5; // Too sparse
const MAX_LINKS_PER_100_WORDS = 5; // Too dense
const MIN_WORDS_FOR_CHECK = 100; // Skip check for very short content

/**
 * Rule: Check article link density
 *
 * Articles should have appropriate internal and external links based on length.
 * Too few links = missed opportunities for internal linking and citations.
 * Too many links = potential link spam or poor user experience.
 */
export const articleLinksRule = defineRule({
  id: 'content-article-links',
  name: 'Article Link Density',
  description:
    'Checks that articles have appropriate internal and external links based on length',
  category: 'content',
  weight: 4,
  run: async (context: AuditContext) => {
    const { $, links } = context;

    // Extract main content and count words
    const mainContent = extractMainContent($);
    const wordCount = countWords(mainContent);

    // Skip check for very short content
    if (wordCount < MIN_WORDS_FOR_CHECK) {
      return pass(
        'content-article-links',
        `Content too short for link density check (${wordCount} words)`,
        {
          wordCount,
          linkCount: links.length,
          skipped: true,
          reason: `Minimum ${MIN_WORDS_FOR_CHECK} words required for meaningful link density analysis`,
        }
      );
    }

    // Count links (from context.links which are already extracted)
    const totalLinks = links.length;
    const internalLinks = links.filter((l) => l.isInternal).length;
    const externalLinks = links.filter((l) => !l.isInternal).length;

    // Calculate density (links per 100 words)
    const linksPer100Words = (totalLinks / wordCount) * 100;

    const details = {
      wordCount,
      totalLinks,
      internalLinks,
      externalLinks,
      linksPer100Words: parseFloat(linksPer100Words.toFixed(2)),
      thresholds: {
        min: MIN_LINKS_PER_100_WORDS,
        max: MAX_LINKS_PER_100_WORDS,
      },
    };

    // Too few links
    if (linksPer100Words < MIN_LINKS_PER_100_WORDS) {
      const suggestedLinks = Math.ceil(
        (wordCount * MIN_LINKS_PER_100_WORDS) / 100
      );

      return warn(
        'content-article-links',
        `Link density too low: ${details.linksPer100Words} links per 100 words (minimum ${MIN_LINKS_PER_100_WORDS})`,
        {
          ...details,
          impact:
            'Sparse linking misses opportunities for internal SEO and external citations',
          recommendation: `Add more relevant links. For ${wordCount} words, aim for at least ${suggestedLinks} links. Include internal links to related content and external links to authoritative sources.`,
        }
      );
    }

    // Too many links
    if (linksPer100Words > MAX_LINKS_PER_100_WORDS) {
      return warn(
        'content-article-links',
        `Link density too high: ${details.linksPer100Words} links per 100 words (maximum ${MAX_LINKS_PER_100_WORDS})`,
        {
          ...details,
          impact:
            'Excessive linking can appear spammy and dilute page authority',
          recommendation:
            'Remove less relevant links. Focus on quality over quantity - each link should provide clear value to users.',
        }
      );
    }

    return pass(
      'content-article-links',
      `Link density is appropriate: ${details.linksPer100Words} links per 100 words`,
      {
        ...details,
        recommendation:
          internalLinks === 0
            ? 'Consider adding internal links to related content'
            : externalLinks === 0
              ? 'Consider adding external links to authoritative sources'
              : 'Good mix of internal and external links',
      }
    );
  },
});
