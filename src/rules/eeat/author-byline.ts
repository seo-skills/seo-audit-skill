import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for author byline (E-E-A-T signal)
 *
 * Checks for:
 * - Schema.org author in JSON-LD
 * - rel="author" link
 * - meta author tag
 * - Visible byline patterns
 */
export const authorBylineRule = defineRule({
  id: 'eeat-author-byline',
  name: 'Author Bylines',
  description: 'Checks for visible author names on content pages',
  category: 'eeat',
  weight: 8,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const signals: string[] = [];

    // 1. Check for Schema.org author in JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]');
    let schemaAuthor: string | null = null;

    jsonLdScripts.each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          const data = JSON.parse(content);
          // Check for author property (could be nested or in @graph)
          const checkAuthor = (obj: unknown): string | null => {
            if (!obj || typeof obj !== 'object') return null;
            const record = obj as Record<string, unknown>;
            if (record.author) {
              if (typeof record.author === 'string') return record.author;
              if (typeof record.author === 'object') {
                const author = record.author as Record<string, unknown>;
                return (author.name as string) || null;
              }
            }
            if (Array.isArray(record['@graph'])) {
              for (const item of record['@graph']) {
                const found = checkAuthor(item);
                if (found) return found;
              }
            }
            return null;
          };
          const found = checkAuthor(data);
          if (found) schemaAuthor = found;
        }
      } catch {
        // Invalid JSON, skip
      }
    });

    if (schemaAuthor) {
      signals.push(`Schema.org author: "${schemaAuthor}"`);
    }

    // 2. Check for rel="author" link
    const authorLink = $('a[rel="author"]').first();
    if (authorLink.length > 0) {
      const authorName = authorLink.text().trim() || authorLink.attr('href');
      signals.push(`rel="author" link: "${authorName}"`);
    }

    // 3. Check for meta author tag
    const metaAuthor = $('meta[name="author"]').attr('content')?.trim();
    if (metaAuthor) {
      signals.push(`Meta author: "${metaAuthor}"`);
    }

    // 4. Check for common byline patterns
    const bylineSelectors = [
      '.author',
      '.byline',
      '.written-by',
      '.post-author',
      '.article-author',
      '[class*="author"]',
      '[class*="byline"]',
      '[rel="author"]',
      '[itemprop="author"]',
    ];

    for (const selector of bylineSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        if (text && text.length < 100) {
          // Avoid grabbing large blocks
          signals.push(`Byline element (${selector}): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
          break; // Only report first byline found
        }
      }
    }

    if (signals.length > 0) {
      return pass(
        'eeat-author-byline',
        `Author byline found (${signals.length} signal${signals.length > 1 ? 's' : ''})`,
        {
          signals,
          impact: 'Author attribution supports E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)',
        }
      );
    }

    return warn('eeat-author-byline', 'No author byline found', {
      signals: [],
      recommendation:
        'Add author attribution using Schema.org Person markup, meta author tag, or visible byline',
      impact:
        'Missing author info can negatively impact E-E-A-T signals, especially for YMYL content',
    });
  },
});
