import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Hreflang to Broken URLs
 *
 * Checks hreflang URLs for obvious malformation issues.
 * Broken hreflang URLs prevent search engines from discovering language
 * alternatives, breaking international targeting entirely.
 *
 * Checks for:
 * - Empty href attributes
 * - Fragment-only URLs (#)
 * - javascript: pseudo-protocol
 * - URLs that fail to parse with the URL constructor
 * - Relative URLs without a valid base (cannot resolve to absolute)
 */
export const hreflangToBrokenRule = defineRule({
  id: 'i18n-hreflang-to-broken',
  name: 'Hreflang to Broken URLs',
  description: 'Checks hreflang URLs for malformed or obviously broken URLs',
  category: 'i18n',
  weight: 10,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const hreflangElements = $('link[rel="alternate"][hreflang]');
    if (hreflangElements.length === 0) {
      return pass('i18n-hreflang-to-broken', 'No hreflang tags found', {
        count: 0,
      });
    }

    const brokenUrls: Array<{ hreflang: string; href: string; reason: string }> = [];
    const validUrls: Array<{ hreflang: string; href: string }> = [];

    hreflangElements.each((_, el) => {
      const $el = $(el);
      const hreflang = $el.attr('hreflang') || '';
      const href = $el.attr('href') || '';
      const trimmedHref = href.trim();

      // Check for empty href
      if (!trimmedHref) {
        brokenUrls.push({ hreflang, href, reason: 'Empty href attribute' });
        return;
      }

      // Check for fragment-only URL
      if (trimmedHref === '#' || trimmedHref.startsWith('#')) {
        brokenUrls.push({ hreflang, href: trimmedHref, reason: 'Fragment-only URL' });
        return;
      }

      // Check for javascript: pseudo-protocol
      if (trimmedHref.toLowerCase().startsWith('javascript:')) {
        brokenUrls.push({ hreflang, href: trimmedHref, reason: 'javascript: pseudo-protocol' });
        return;
      }

      // Attempt to parse as absolute URL, then with base
      try {
        const parsed = new URL(trimmedHref, url);
        // Verify it resolved to an HTTP(S) URL
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          brokenUrls.push({
            hreflang,
            href: trimmedHref,
            reason: `Non-HTTP protocol: ${parsed.protocol}`,
          });
          return;
        }
        validUrls.push({ hreflang, href: parsed.href });
      } catch {
        brokenUrls.push({ hreflang, href: trimmedHref, reason: 'URL failed to parse' });
      }
    });

    if (brokenUrls.length === 0) {
      return pass(
        'i18n-hreflang-to-broken',
        `All ${validUrls.length} hreflang URL(s) are valid absolute URLs`,
        {
          count: validUrls.length,
          validUrls,
        }
      );
    }

    return fail(
      'i18n-hreflang-to-broken',
      `Found ${brokenUrls.length} malformed hreflang URL(s)`,
      {
        totalHreflang: hreflangElements.length,
        brokenCount: brokenUrls.length,
        brokenUrls: brokenUrls.slice(0, 10),
        recommendation: 'Ensure all hreflang href values are valid absolute HTTP(S) URLs',
      }
    );
  },
});
