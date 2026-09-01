import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

// Reference hint: international/has-outgoing-hreflang-annotations-to-broken-urls
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
 *
 * In crawl mode the per-page fetch results (`site.pages`) add a live check:
 * targets that returned 4xx/5xx fail, and targets whose fetch timed out
 * (statusCode 0) warn. Targets the crawl never visited are skipped.
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

    // Crawl-mode live check: targets whose fetch failed are as broken as a
    // malformed URL. statusCode 0 means the fetch timed out or never
    // completed, which is a warning rather than hard proof of brokenness.
    const pages = context.site?.pages;
    const errorUrls: Array<{ hreflang: string; href: string; statusCode: number }> = [];
    const timeoutUrls: Array<{ hreflang: string; href: string }> = [];

    if (pages) {
      const normalize = context.site!.normalize;
      for (const { hreflang, href } of validUrls) {
        const info = pages.get(normalize(href));
        if (!info) continue; // target was not crawled - nothing to check
        if (info.statusCode >= 400) {
          errorUrls.push({ hreflang, href, statusCode: info.statusCode });
        } else if (info.statusCode === 0) {
          timeoutUrls.push({ hreflang, href });
        }
      }
    }

    const brokenTotal = brokenUrls.length + errorUrls.length;

    if (brokenTotal === 0 && timeoutUrls.length === 0) {
      return pass(
        'i18n-hreflang-to-broken',
        `All ${validUrls.length} hreflang URL(s) are valid absolute URLs`,
        {
          count: validUrls.length,
          validUrls,
        }
      );
    }

    if (brokenTotal === 0) {
      return warn(
        'i18n-hreflang-to-broken',
        `${timeoutUrls.length} hreflang target(s) could not be fetched during the crawl (timeout)`,
        {
          totalHreflang: hreflangElements.length,
          timeoutCount: timeoutUrls.length,
          timeoutUrls: timeoutUrls.slice(0, 10),
          recommendation:
            'Re-crawl or fetch these URLs manually to confirm they are reachable',
        }
      );
    }

    return fail(
      'i18n-hreflang-to-broken',
      `Found ${brokenTotal} broken hreflang URL(s)`,
      {
        totalHreflang: hreflangElements.length,
        brokenCount: brokenTotal,
        brokenUrls: brokenUrls.slice(0, 10),
        errorCount: errorUrls.length,
        errorUrls: errorUrls.slice(0, 10),
        timeoutUrls: timeoutUrls.slice(0, 10),
        recommendation: 'Ensure all hreflang href values are valid absolute HTTP(S) URLs that return a 200 status',
      }
    );
  },
});
