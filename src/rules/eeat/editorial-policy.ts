import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';

/**
 * Editorial policy page detection patterns
 */
const EDITORIAL_PATTERNS = {
  // Link text patterns (case insensitive)
  linkText: [
    /^editorial\s*(policy|guidelines|standards)$/i,
    /^content\s*(policy|guidelines|standards)$/i,
    /^fact[-\s]?check(ing)?\s*(policy|process)?$/i,
    /^how\s+we\s+(write|review|research)/i,
    /^our\s+(editorial|content)\s+(process|standards)/i,
    /^review\s+(process|guidelines)$/i,
    /^ethics\s*(policy)?$/i,
    /^corrections?\s*(policy)?$/i,
  ],
  // URL path patterns
  urlPaths: [
    /\/editorial[-_]?(policy|guidelines|standards)/i,
    /\/content[-_]?(policy|guidelines)/i,
    /\/fact[-_]?check/i,
    /\/how[-_]?we[-_]?(write|review|work)/i,
    /\/review[-_]?(process|guidelines)/i,
    /\/ethics/i,
    /\/corrections/i,
    /\/about\/editorial/i,
  ],
};

/**
 * Editorial signals in page content
 */
const EDITORIAL_SIGNALS = {
  factCheck: [
    /fact[-\s]?check(ed|ing)?/i,
    /verified\s+by/i,
    /reviewed\s+by/i,
    /medically\s+reviewed/i,
    /expert\s+reviewed/i,
  ],
  corrections: [
    /correction\s*:/i,
    /update\s*:/i,
    /editor'?s?\s+note/i,
    /this\s+(article|post)\s+(has\s+been\s+)?(updated|corrected)/i,
  ],
  process: [
    /our\s+editorial\s+(team|staff|board)/i,
    /editorial\s+review\s+process/i,
    /independently\s+researched/i,
    /our\s+research\s+(process|methodology)/i,
  ],
};

/**
 * Checks for editorial and content policy pages
 *
 * Editorial policies demonstrate commitment to content quality
 * and fact-checking, which are important E-E-A-T signals,
 * especially for news and YMYL content.
 */
export const editorialPolicyRule = defineRule({
  id: 'eeat-editorial-policy',
  name: 'Editorial Policy',
  description: 'Checks for editorial and content policy pages',
  category: 'eeat',
  weight: 4,

  run(context: AuditContext): RuleResult {
    const { $ } = context;
    const foundLinks: Array<{ href: string; text: string }> = [];
    const foundSignals: string[] = [];

    // Check for editorial policy links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      // Check link text
      for (const pattern of EDITORIAL_PATTERNS.linkText) {
        if (pattern.test(text)) {
          foundLinks.push({ href, text: text.slice(0, 50) });
          return;
        }
      }

      // Check URL path
      for (const pattern of EDITORIAL_PATTERNS.urlPaths) {
        if (pattern.test(href)) {
          foundLinks.push({ href, text: text.slice(0, 50) || 'Editorial Policy' });
          return;
        }
      }
    });

    // Check for editorial signals in page content
    const bodyText = $('body').text();

    for (const [signalType, patterns] of Object.entries(EDITORIAL_SIGNALS)) {
      for (const pattern of patterns) {
        if (pattern.test(bodyText)) {
          foundSignals.push(signalType);
          break; // One match per signal type
        }
      }
    }

    // Check for Schema.org NewsArticle with review info
    let hasSchemaEditorial = false;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          const data = JSON.parse(content);
          const checkSchema = (obj: unknown): void => {
            if (!obj || typeof obj !== 'object') return;
            const record = obj as Record<string, unknown>;

            // Check for review/correction properties
            if (record.reviewedBy || record.correction || record.editor) {
              hasSchemaEditorial = true;
            }

            if (Array.isArray(record['@graph'])) {
              for (const item of record['@graph']) {
                checkSchema(item);
              }
            }
          };
          checkSchema(data);
        }
      } catch {
        // Invalid JSON, skip
      }
    });

    if (hasSchemaEditorial) {
      foundSignals.push('schema.org editorial markup');
    }

    // Determine if this is a content-heavy site that should have editorial policy
    const isContentSite = $(
      'article, .post, .blog-post, [class*="article"], [class*="blog"], [class*="news"]'
    ).length > 0;

    if (foundLinks.length > 0) {
      return {
        status: 'pass',
        score: 100,
        message: `Editorial policy page found${foundSignals.length > 0 ? ` with ${foundSignals.length} editorial signal${foundSignals.length > 1 ? 's' : ''}` : ''}`,
        details: {
          hasEditorialPolicy: true,
          links: foundLinks.slice(0, 3),
          signals: foundSignals,
        },
      };
    }

    if (foundSignals.length >= 2) {
      return {
        status: 'pass',
        score: 80,
        message: `Editorial signals found (${foundSignals.join(', ')}) but no dedicated policy page`,
        details: {
          hasEditorialPolicy: false,
          signals: foundSignals,
          recommendation: 'Consider creating a dedicated editorial policy page explaining your content standards',
        },
      };
    }

    if (foundSignals.length === 1) {
      return {
        status: 'info',
        score: 100,
        message: `Editorial signal found (${foundSignals[0]}) - consider adding editorial policy page`,
        details: {
          hasEditorialPolicy: false,
          signals: foundSignals,
          recommendation: 'Create an editorial policy page to document your content quality standards',
        },
      };
    }

    // No editorial policy - warn for content sites, info for others
    if (isContentSite) {
      return {
        status: 'info',
        score: 100,
        message: 'No editorial policy found - recommended for content-focused sites',
        details: {
          hasEditorialPolicy: false,
          signals: [],
          isContentSite: true,
          recommendation: 'Add an editorial policy page explaining your content creation, review, and correction processes',
        },
      };
    }

    return {
      status: 'pass',
      score: 100,
      message: 'No editorial policy (may not be applicable for this site type)',
      details: {
        hasEditorialPolicy: false,
        signals: [],
        isContentSite: false,
      },
    };
  },
});
