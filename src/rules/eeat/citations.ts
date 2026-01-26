import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';

/**
 * Authoritative domain patterns
 */
const AUTHORITATIVE_DOMAINS = {
  government: [
    /\.gov$/i,
    /\.gov\.[a-z]{2}$/i, // e.g., .gov.uk
    /\.mil$/i,
  ],
  education: [
    /\.edu$/i,
    /\.edu\.[a-z]{2}$/i,
    /\.ac\.[a-z]{2}$/i, // e.g., .ac.uk
  ],
  organizations: [
    /\.org$/i,
    /who\.int$/i,
    /cdc\.gov$/i,
    /nih\.gov$/i,
    /fda\.gov$/i,
    /mayoclinic\.org$/i,
    /webmd\.com$/i,
    /healthline\.com$/i,
  ],
  research: [
    /pubmed/i,
    /ncbi\.nlm\.nih\.gov/i,
    /scholar\.google/i,
    /jstor\.org/i,
    /sciencedirect\.com/i,
    /nature\.com/i,
    /springer\.com/i,
    /wiley\.com/i,
    /researchgate\.net/i,
    /arxiv\.org/i,
    /doi\.org/i,
  ],
  news: [
    /reuters\.com$/i,
    /apnews\.com$/i,
    /bbc\.(com|co\.uk)$/i,
    /nytimes\.com$/i,
    /washingtonpost\.com$/i,
    /theguardian\.com$/i,
    /wsj\.com$/i,
    /economist\.com$/i,
  ],
};

/**
 * Citation markup patterns
 */
const CITATION_SELECTORS = [
  '.citation',
  '.reference',
  '.footnote',
  '.endnote',
  '[class*="cite"]',
  '[class*="source"]',
  '[class*="reference"]',
  'sup a[href^="#"]', // Footnote-style
  '.bibliography',
  '.works-cited',
];

/**
 * Checks for citations to authoritative external sources
 *
 * Quality content often cites authoritative sources to back up claims.
 * This is especially important for YMYL content.
 */
export const citationsRule = defineRule({
  id: 'eeat-citations',
  name: 'Citations',
  description: 'Checks for citations to authoritative external sources',
  category: 'eeat',
  weight: 6,

  run(context: AuditContext): RuleResult {
    const { $, url } = context;
    const currentDomain = new URL(url).hostname;

    const citations: Array<{
      href: string;
      domain: string;
      type: string;
      hasNofollow: boolean;
    }> = [];

    // Check external links
    $('a[href^="http"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const rel = $(el).attr('rel') || '';

      try {
        const linkUrl = new URL(href);
        const domain = linkUrl.hostname;

        // Skip same-domain links
        if (domain === currentDomain || domain.endsWith(`.${currentDomain}`)) {
          return;
        }

        // Check if it's an authoritative domain
        for (const [type, patterns] of Object.entries(AUTHORITATIVE_DOMAINS)) {
          for (const pattern of patterns) {
            if (pattern.test(domain) || pattern.test(href)) {
              citations.push({
                href: href.slice(0, 100),
                domain,
                type,
                hasNofollow: rel.includes('nofollow'),
              });
              return; // Only count each link once
            }
          }
        }
      } catch {
        // Invalid URL, skip
      }
    });

    // Check for citation markup
    let hasCitationMarkup = false;
    for (const selector of CITATION_SELECTORS) {
      if ($(selector).length > 0) {
        hasCitationMarkup = true;
        break;
      }
    }

    // Check for references/sources section
    const hasReferencesSection = $('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return /references|sources|bibliography|works cited|further reading/i.test(text);
    }).length > 0;

    // Group citations by type
    const citationsByType: Record<string, number> = {};
    for (const citation of citations) {
      citationsByType[citation.type] = (citationsByType[citation.type] || 0) + 1;
    }

    // Check for nofollow on citations (generally not recommended)
    const nofollowedCitations = citations.filter((c) => c.hasNofollow);

    if (citations.length >= 3) {
      return {
        status: 'pass',
        score: 100,
        message: `Strong citation profile: ${citations.length} authoritative sources cited`,
        details: {
          citationCount: citations.length,
          citationsByType,
          hasCitationMarkup,
          hasReferencesSection,
          nofollowedCount: nofollowedCitations.length,
          citations: citations.slice(0, 5),
          ...(nofollowedCitations.length > 0 && {
            recommendation: 'Consider removing nofollow from citations to authoritative sources',
          }),
        },
      };
    }

    if (citations.length >= 1) {
      return {
        status: 'pass',
        score: 80,
        message: `${citations.length} authoritative source${citations.length > 1 ? 's' : ''} cited`,
        details: {
          citationCount: citations.length,
          citationsByType,
          hasCitationMarkup,
          hasReferencesSection,
          citations: citations.slice(0, 5),
          recommendation: 'Consider adding more citations to authoritative sources (.gov, .edu, research papers)',
        },
      };
    }

    // Check if page has external links at all
    const externalLinkCount = $('a[href^="http"]').filter((_, el) => {
      const href = $(el).attr('href') || '';
      try {
        const linkDomain = new URL(href).hostname;
        return linkDomain !== currentDomain;
      } catch {
        return false;
      }
    }).length;

    if (externalLinkCount > 0) {
      return {
        status: 'warn',
        score: 60,
        message: `${externalLinkCount} external links found, but none to recognized authoritative sources`,
        details: {
          citationCount: 0,
          externalLinkCount,
          hasCitationMarkup,
          hasReferencesSection,
          recommendation: 'Consider linking to authoritative sources like .gov, .edu, or peer-reviewed publications',
        },
      };
    }

    return {
      status: 'pass',
      score: 100,
      message: 'No external citations found (may not be needed for this content type)',
      details: {
        citationCount: 0,
        hasCitationMarkup,
        hasReferencesSection,
        recommendation: 'For content making claims, consider citing authoritative sources to build credibility',
      },
    };
  },
});
