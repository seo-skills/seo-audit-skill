import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Hreflang Return Links (Self-Referencing)
 *
 * Checks if hreflang annotations include a self-referencing link.
 * Google requires every page in an hreflang set to include a self-referencing
 * hreflang tag. Without it, search engines cannot confirm the relationship
 * between language versions.
 *
 * A valid self-reference means a <link rel="alternate" hreflang="xx" href="...">
 * where href matches the current page URL.
 *
 * Reference: https://developers.google.com/search/docs/specialty/international/localized-versions
 */
export const hreflangReturnLinksRule = defineRule({
  id: 'i18n-hreflang-return-links',
  name: 'Hreflang Return Links',
  description: 'Checks if hreflang annotations include self-referencing link for the current page',
  category: 'i18n',
  weight: 12,
  run: (context: AuditContext) => {
    const { $, url } = context;
    const hreflangElements = $('link[rel="alternate"][hreflang]');

    if (hreflangElements.length === 0) {
      return pass('i18n-hreflang-return-links', 'No hreflang tags found (single-language site)', {
        count: 0,
      });
    }

    const hreflangUrls: Array<{ hreflang: string; href: string }> = [];
    let hasSelfReference = false;

    let currentUrl: URL;
    try {
      currentUrl = new URL(url);
    } catch {
      return pass('i18n-hreflang-return-links', 'Cannot parse current URL for comparison', {
        url,
      });
    }

    hreflangElements.each((_, el) => {
      const $el = $(el);
      const hreflang = $el.attr('hreflang') || '';
      const href = $el.attr('href') || '';

      hreflangUrls.push({ hreflang, href });

      if (href) {
        try {
          const hrefUrl = new URL(href, url);
          if (
            hrefUrl.host === currentUrl.host &&
            hrefUrl.pathname === currentUrl.pathname
          ) {
            hasSelfReference = true;
          }
        } catch {
          // Invalid URL, skip comparison
        }
      }
    });

    if (hasSelfReference) {
      return pass(
        'i18n-hreflang-return-links',
        'Hreflang set includes self-referencing link for current page',
        {
          count: hreflangUrls.length,
          hreflangUrls,
          hasSelfReference: true,
        }
      );
    }

    return warn(
      'i18n-hreflang-return-links',
      'Hreflang set does not include a self-referencing link for the current page',
      {
        count: hreflangUrls.length,
        hreflangUrls,
        hasSelfReference: false,
        currentUrl: url,
        recommendation:
          'Add a <link rel="alternate" hreflang="xx" href="..."> pointing to the current page URL',
      }
    );
  },
});
