import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Parse the HTTP Link header to extract a canonical URL.
 * Format: <https://example.com/page>; rel="canonical"
 */
function parseCanonicalFromLinkHeader(linkHeader: string): string | undefined {
  const match = linkHeader.match(/<([^>]+)>;\s*rel=["']?canonical["']?/i);
  return match ? match[1].trim() : undefined;
}

/**
 * Normalize a URL for comparison by lowercasing the origin and removing trailing slashes.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.replace(/\/$/, '').toLowerCase();
  }
}

/**
 * Rule: Conflicting Canonical URLs
 *
 * Detects when both an HTML <link rel="canonical"> tag and an HTTP Link header
 * specify canonical URLs that point to different destinations. Search engines
 * receive conflicting signals, which can lead to unexpected indexing behavior.
 */
export const canonicalConflictingRule = defineRule({
  id: 'core-canonical-conflicting',
  name: 'Conflicting Canonical URLs',
  description: 'Checks if multiple canonical URLs are specified via HTML and HTTP header pointing to different URLs',
  category: 'core',
  weight: 8,
  run: async (context: AuditContext) => {
    const { $, headers } = context;

    // Extract HTML canonical
    const htmlCanonical = $('link[rel="canonical"]').first().attr('href')?.trim();

    // Extract HTTP Link header canonical
    const linkHeader = headers['link'] || headers['Link'] || '';
    const headerCanonical = linkHeader ? parseCanonicalFromLinkHeader(linkHeader) : undefined;

    // If both are absent or only one exists, there is no conflict
    if (!htmlCanonical || !headerCanonical) {
      return pass(
        'core-canonical-conflicting',
        'No conflicting canonical URLs detected (at most one canonical source present)',
        {
          htmlCanonical: htmlCanonical || null,
          headerCanonical: headerCanonical || null,
        }
      );
    }

    // Both exist - compare normalized URLs
    const normalizedHtml = normalizeUrl(htmlCanonical);
    const normalizedHeader = normalizeUrl(headerCanonical);

    if (normalizedHtml === normalizedHeader) {
      return pass(
        'core-canonical-conflicting',
        'HTML canonical and Link header canonical point to the same URL',
        {
          htmlCanonical,
          headerCanonical,
          match: true,
        }
      );
    }

    return fail(
      'core-canonical-conflicting',
      `Conflicting canonical URLs: HTML tag specifies "${htmlCanonical}" but Link header specifies "${headerCanonical}"`,
      {
        htmlCanonical,
        headerCanonical,
        match: false,
        recommendation: 'Remove one canonical source to avoid conflicting signals; prefer the HTML <link rel="canonical"> tag',
      }
    );
  },
});
