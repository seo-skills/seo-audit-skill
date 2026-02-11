import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Hreflang to Redirect
 *
 * Checks if any hreflang URLs are likely to redirect.
 * The primary check is whether hreflang uses HTTP URLs when the current page
 * is served over HTTPS, which almost certainly triggers a redirect.
 *
 * Hreflang URLs should point to the final destination URL. When they redirect,
 * search engines may:
 * - Take longer to process the hreflang relationship
 * - Drop the hreflang annotation entirely
 * - Show the wrong language version in search results
 *
 * Reference: https://developers.google.com/search/docs/specialty/international/localized-versions
 */
export const hreflangToRedirectRule = defineRule({
  id: 'i18n-hreflang-to-redirect',
  name: 'Hreflang to Redirect',
  description: 'Checks if hreflang URLs may trigger redirects (HTTP on HTTPS site)',
  category: 'i18n',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const hreflangElements = $('link[rel="alternate"][hreflang]');
    if (hreflangElements.length === 0) {
      return pass('i18n-hreflang-to-redirect', 'No hreflang tags found', {
        count: 0,
      });
    }

    let currentUrl: URL;
    try {
      currentUrl = new URL(url);
    } catch {
      return pass('i18n-hreflang-to-redirect', 'Cannot parse current URL for comparison', {
        url,
      });
    }

    const isCurrentHttps = currentUrl.protocol === 'https:';

    // Only relevant when the current page is HTTPS
    if (!isCurrentHttps) {
      return pass(
        'i18n-hreflang-to-redirect',
        'Current page is HTTP; protocol mismatch check not applicable',
        {
          currentProtocol: 'http:',
          count: hreflangElements.length,
        }
      );
    }

    const httpUrls: Array<{ hreflang: string; href: string }> = [];

    hreflangElements.each((_, el) => {
      const $el = $(el);
      const hreflang = $el.attr('hreflang') || '';
      const href = ($el.attr('href') || '').trim();

      if (!href) return;

      // Check if the hreflang URL explicitly uses HTTP
      if (href.startsWith('http://')) {
        httpUrls.push({ hreflang, href });
      }
    });

    if (httpUrls.length === 0) {
      return pass(
        'i18n-hreflang-to-redirect',
        'All hreflang URLs use the same protocol as the current page',
        {
          count: hreflangElements.length,
          currentProtocol: 'https:',
        }
      );
    }

    return warn(
      'i18n-hreflang-to-redirect',
      `Found ${httpUrls.length} hreflang URL(s) using HTTP on an HTTPS site (likely redirects)`,
      {
        totalHreflang: hreflangElements.length,
        httpCount: httpUrls.length,
        httpUrls: httpUrls.slice(0, 10),
        recommendation:
          'Update hreflang URLs to use HTTPS to avoid redirect chains',
      }
    );
  },
});
