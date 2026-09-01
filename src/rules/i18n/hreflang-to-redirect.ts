import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

// Reference hint: international/has-outgoing-hreflang-annotations-to-redirecting-urls
/**
 * Rule: Hreflang to Redirect
 *
 * Checks if any hreflang URLs are likely to redirect.
 * The static check is whether hreflang uses HTTP URLs when the current page
 * is served over HTTPS, which almost certainly triggers a redirect.
 *
 * In crawl mode the per-page fetch results (`site.pages`) add a live check:
 * targets that answered with a 3xx status are reported directly, whatever
 * protocol heuristic the static check could apply.
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

    const httpUrls: Array<{ hreflang: string; href: string }> = [];
    const annotations: Array<{ hreflang: string; href: string }> = [];

    hreflangElements.each((_, el) => {
      const $el = $(el);
      const hreflang = $el.attr('hreflang') || '';
      const href = ($el.attr('href') || '').trim();

      if (!href) return;

      annotations.push({ hreflang, href });

      // Check if the hreflang URL explicitly uses HTTP
      if (isCurrentHttps && href.startsWith('http://')) {
        httpUrls.push({ hreflang, href });
      }
    });

    // Crawl-mode live check: a 3xx from the crawl is direct evidence of a
    // redirect, independent of the protocol heuristic. statusCode 0 (timeout)
    // says nothing about redirection and is ignored here.
    const pages = context.site?.pages;
    const redirectingUrls: Array<{ hreflang: string; href: string; statusCode: number }> = [];

    if (pages) {
      const normalize = context.site!.normalize;
      for (const { hreflang, href } of annotations) {
        let absolute: string;
        try {
          absolute = new URL(href, url).href;
        } catch {
          continue; // unresolvable target - broken-URL rules cover this
        }
        const info = pages.get(normalize(absolute));
        if (!info) continue; // target was not crawled - nothing to check
        if (info.statusCode >= 300 && info.statusCode < 400) {
          redirectingUrls.push({ hreflang, href: absolute, statusCode: info.statusCode });
        }
      }
    }

    if (httpUrls.length === 0 && redirectingUrls.length === 0) {
      // Only the protocol heuristic depends on the current page being HTTPS
      if (!isCurrentHttps) {
        return pass(
          'i18n-hreflang-to-redirect',
          pages
            ? 'No hreflang target redirected during the crawl'
            : 'Current page is HTTP; protocol mismatch check not applicable',
          {
            currentProtocol: 'http:',
            count: hreflangElements.length,
          }
        );
      }

      return pass(
        'i18n-hreflang-to-redirect',
        'All hreflang URLs use the same protocol as the current page',
        {
          count: hreflangElements.length,
          currentProtocol: 'https:',
        }
      );
    }

    const issues: string[] = [];
    if (httpUrls.length > 0) {
      issues.push(`${httpUrls.length} using HTTP on an HTTPS site`);
    }
    if (redirectingUrls.length > 0) {
      issues.push(`${redirectingUrls.length} returned a 3xx redirect during the crawl`);
    }

    return warn(
      'i18n-hreflang-to-redirect',
      `Found hreflang URL(s) likely to redirect: ${issues.join('; ')}`,
      {
        totalHreflang: hreflangElements.length,
        httpCount: httpUrls.length,
        httpUrls: httpUrls.slice(0, 10),
        redirectCount: redirectingUrls.length,
        redirectingUrls: redirectingUrls.slice(0, 10),
        recommendation:
          'Update hreflang URLs to point at the final HTTPS destination to avoid redirect chains',
      }
    );
  },
});
