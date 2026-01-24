import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Normalize URL for comparison
 * Removes trailing slashes and lowercases the hostname
 */
function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    // Lowercase hostname, remove trailing slash from pathname
    let normalized = `${url.protocol}//${url.hostname.toLowerCase()}`;
    if (url.port) {
      normalized += `:${url.port}`;
    }
    // Remove trailing slash unless it's just the root
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    normalized += pathname;
    // Include search params if present
    if (url.search) {
      normalized += url.search;
    }
    return normalized;
  } catch {
    return urlString.toLowerCase();
  }
}

/**
 * Rule: Check that og:url matches the canonical URL
 *
 * The og:url should match the canonical URL to ensure consistent
 * signals to search engines and social platforms.
 */
export const ogUrlCanonicalRule = defineRule({
  id: 'social-og-url-canonical',
  name: 'Open Graph URL Matches Canonical',
  description:
    'Checks that og:url matches the canonical URL for consistent SEO signals',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;

    // Get og:url
    const ogUrl = $('meta[property="og:url"]').first().attr('content')?.trim();

    // Get canonical URL
    const canonical = $('link[rel="canonical"]').first().attr('href')?.trim();

    // Neither exists - can't compare
    if (!ogUrl && !canonical) {
      return warn(
        'social-og-url-canonical',
        'Neither og:url nor canonical URL found - add both for consistent SEO signals',
        { hasOgUrl: false, hasCanonical: false }
      );
    }

    // Only canonical exists
    if (!ogUrl && canonical) {
      return fail(
        'social-og-url-canonical',
        `Missing og:url - should match canonical: ${canonical}`,
        { hasOgUrl: false, hasCanonical: true, canonical }
      );
    }

    // Only og:url exists
    if (ogUrl && !canonical) {
      return warn(
        'social-og-url-canonical',
        'og:url exists but no canonical URL to compare against',
        { hasOgUrl: true, hasCanonical: false, ogUrl }
      );
    }

    // Both exist - compare them
    const normalizedOgUrl = normalizeUrl(ogUrl!);
    const normalizedCanonical = normalizeUrl(canonical!);

    if (normalizedOgUrl === normalizedCanonical) {
      return pass(
        'social-og-url-canonical',
        'og:url matches canonical URL',
        {
          hasOgUrl: true,
          hasCanonical: true,
          ogUrl,
          canonical,
          match: true,
        }
      );
    }

    // URLs don't match
    return fail(
      'social-og-url-canonical',
      `og:url (${ogUrl}) does not match canonical URL (${canonical})`,
      {
        hasOgUrl: true,
        hasCanonical: true,
        ogUrl,
        canonical,
        normalizedOgUrl,
        normalizedCanonical,
        match: false,
      }
    );
  },
});
