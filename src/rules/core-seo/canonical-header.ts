import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Detect mismatch between HTML canonical tag and HTTP Link header
 *
 * When both an HTML <link rel="canonical"> and HTTP Link header exist,
 * they should specify the same URL. Conflicting signals confuse search engines.
 */
export const canonicalHeaderRule = defineRule({
  id: 'core-seo-canonical-header',
  name: 'Canonical Header Validation',
  description: 'Detects mismatch between HTML canonical tag and HTTP Link header',
  category: 'core-seo',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $, headers } = context;

    // Get HTML canonical
    const htmlCanonical = $('link[rel="canonical"]').first().attr('href')?.trim();

    // Get HTTP Link header canonical
    // Format: <https://example.com/page>; rel="canonical"
    const linkHeader = headers['link'] || headers['Link'] || '';
    let headerCanonical: string | undefined;

    if (linkHeader) {
      const canonicalMatch = linkHeader.match(/<([^>]+)>;\s*rel=["']?canonical["']?/i);
      if (canonicalMatch) {
        headerCanonical = canonicalMatch[1].trim();
      }
    }

    // If neither exists, this rule doesn't apply (other rules check for presence)
    if (!htmlCanonical && !headerCanonical) {
      return pass(
        'core-seo-canonical-header',
        'No conflicting canonical signals (neither HTML tag nor Link header present)',
        { htmlCanonical: null, headerCanonical: null }
      );
    }

    // If only one exists, that's fine
    if (!htmlCanonical || !headerCanonical) {
      return pass(
        'core-seo-canonical-header',
        'Single canonical signal present (no conflict)',
        {
          htmlCanonical: htmlCanonical || null,
          headerCanonical: headerCanonical || null,
          source: htmlCanonical ? 'html' : 'header',
        }
      );
    }

    // Both exist - check if they match
    // Normalize URLs for comparison (remove trailing slashes, lowercase)
    const normalizeUrl = (url: string): string => {
      try {
        const parsed = new URL(url);
        return parsed.href.replace(/\/$/, '').toLowerCase();
      } catch {
        return url.replace(/\/$/, '').toLowerCase();
      }
    };

    const normalizedHtml = normalizeUrl(htmlCanonical);
    const normalizedHeader = normalizeUrl(headerCanonical);

    if (normalizedHtml === normalizedHeader) {
      return pass(
        'core-seo-canonical-header',
        'HTML canonical and Link header match',
        { htmlCanonical, headerCanonical, match: true }
      );
    }

    return warn(
      'core-seo-canonical-header',
      `Canonical mismatch: HTML tag "${htmlCanonical}" differs from Link header "${headerCanonical}"`,
      {
        htmlCanonical,
        headerCanonical,
        match: false,
        recommendation: 'Use HTML canonical tag exclusively; reserve Link header for non-HTML resources like PDFs',
      }
    );
  },
});
