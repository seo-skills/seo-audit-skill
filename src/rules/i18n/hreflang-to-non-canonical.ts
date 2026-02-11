import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Hreflang to Non-Canonical URL
 *
 * Checks if the hreflang self-reference URL matches the canonical URL.
 * When hreflang points to a different URL than the canonical, search engines
 * receive conflicting signals about which URL represents the page.
 *
 * Google recommends that hreflang URLs should always point to canonical URLs.
 * A mismatch can cause:
 * - Search engines ignoring hreflang annotations
 * - Incorrect language versions shown in search results
 * - Diluted ranking signals across URL variants
 */
export const hreflangToNonCanonicalRule = defineRule({
  id: 'i18n-hreflang-to-non-canonical',
  name: 'Hreflang to Non-Canonical URL',
  description: 'Checks if hreflang annotations point to non-canonical URLs',
  category: 'i18n',
  weight: 10,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const hreflangElements = $('link[rel="alternate"][hreflang]');
    if (hreflangElements.length === 0) {
      return pass('i18n-hreflang-to-non-canonical', 'No hreflang tags found, no conflict possible', {
        hasHreflang: false,
      });
    }

    const canonicalHref = $('link[rel="canonical"]').attr('href');
    if (!canonicalHref) {
      return pass('i18n-hreflang-to-non-canonical', 'No canonical URL specified, cannot compare', {
        hasHreflang: true,
        hasCanonical: false,
      });
    }

    let canonicalUrl: URL;
    try {
      canonicalUrl = new URL(canonicalHref, url);
    } catch {
      return pass('i18n-hreflang-to-non-canonical', 'Cannot parse canonical URL for comparison', {
        hasHreflang: true,
        canonicalHref,
      });
    }

    let currentUrl: URL;
    try {
      currentUrl = new URL(url);
    } catch {
      return pass('i18n-hreflang-to-non-canonical', 'Cannot parse current URL for comparison', {
        url,
      });
    }

    // Find the hreflang entry that points to the current page (self-reference)
    const mismatches: Array<{ hreflang: string; href: string }> = [];

    hreflangElements.each((_, el) => {
      const $el = $(el);
      const hreflang = $el.attr('hreflang') || '';
      const href = $el.attr('href') || '';

      if (!href) return;

      try {
        const hrefUrl = new URL(href, url);

        // Check if this hreflang entry points to the current page
        if (
          hrefUrl.host === currentUrl.host &&
          hrefUrl.pathname === currentUrl.pathname
        ) {
          // This is a self-reference -- check if it matches canonical
          const normalizedHref = hrefUrl.origin + hrefUrl.pathname;
          const normalizedCanonical = canonicalUrl.origin + canonicalUrl.pathname;

          if (normalizedHref !== normalizedCanonical) {
            mismatches.push({ hreflang, href });
          }
        }
      } catch {
        // Invalid URL, skip
      }
    });

    if (mismatches.length === 0) {
      return pass(
        'i18n-hreflang-to-non-canonical',
        'Hreflang self-reference matches canonical URL',
        {
          hasHreflang: true,
          hasCanonical: true,
          canonicalUrl: canonicalUrl.href,
        }
      );
    }

    return warn(
      'i18n-hreflang-to-non-canonical',
      'Hreflang self-reference URL differs from canonical URL',
      {
        mismatches,
        canonicalUrl: canonicalUrl.href,
        recommendation:
          'Ensure hreflang URLs point to the canonical version of each page',
      }
    );
  },
});
