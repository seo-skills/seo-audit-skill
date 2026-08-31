import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Hreflang Lang Mismatch
 *
 * Checks if the page's <html lang="..."> attribute matches the hreflang
 * self-reference language code.
 *
 * When the lang attribute says "en" but the hreflang self-reference says "de",
 * search engines receive conflicting signals about the page language. This can
 * cause the wrong language version to appear in search results.
 *
 * Comparison is done on the primary language subtag (first 2 characters),
 * so "en-US" matches hreflang "en" and vice versa.
 */
export const hreflangLangMismatchRule = defineRule({
  id: 'i18n-hreflang-lang-mismatch',
  name: 'Hreflang Lang Mismatch',
  description: 'Checks if page lang attribute matches hreflang self-reference language code',
  category: 'i18n',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const htmlLang = ($('html').attr('lang') || '').trim().toLowerCase();
    const hreflangElements = $('link[rel="alternate"][hreflang]');

    if (hreflangElements.length === 0) {
      return pass('i18n-hreflang-lang-mismatch', 'No hreflang tags found, no mismatch possible', {
        hasHreflang: false,
      });
    }

    if (!htmlLang) {
      return pass(
        'i18n-hreflang-lang-mismatch',
        'No html lang attribute set, cannot compare with hreflang',
        {
          hasHreflang: true,
          hasLang: false,
        }
      );
    }

    // Find the hreflang entry that points to the current page (self-reference)
    let currentUrl: URL;
    try {
      currentUrl = new URL(url);
    } catch {
      return pass('i18n-hreflang-lang-mismatch', 'Cannot parse current URL for comparison', {
        url,
      });
    }

    // Iterated with a plain loop rather than .each() so the assignment below is
    // visible to control-flow analysis. Assigning inside a callback leaves the
    // variable narrowed to its initialiser, which made the later guard look
    // like it always returned and the code after it unreachable.
    let selfReferenceHreflang: string | null = null;

    for (const el of hreflangElements.toArray()) {
      const $el = $(el);
      const hreflang = ($el.attr('hreflang') || '').trim().toLowerCase();
      const href = ($el.attr('href') || '').trim();

      if (!href || !hreflang || hreflang === 'x-default') continue;

      try {
        const hrefUrl = new URL(href, url);
        if (
          hrefUrl.host === currentUrl.host &&
          hrefUrl.pathname === currentUrl.pathname
        ) {
          selfReferenceHreflang = hreflang;
        }
      } catch {
        // Invalid URL, skip
      }
    }

    if (!selfReferenceHreflang) {
      return pass(
        'i18n-hreflang-lang-mismatch',
        'No hreflang self-reference found, cannot compare with lang attribute',
        {
          hasHreflang: true,
          hasLang: true,
          htmlLang,
          hasSelfReference: false,
        }
      );
    }

    // Compare primary language subtags (first 2 characters)
    const langPrimary = htmlLang.split('-')[0];
    const hreflangPrimary = selfReferenceHreflang.split('-')[0];

    if (langPrimary === hreflangPrimary) {
      return pass(
        'i18n-hreflang-lang-mismatch',
        `HTML lang "${htmlLang}" matches hreflang self-reference "${selfReferenceHreflang}"`,
        {
          htmlLang,
          hreflangLang: selfReferenceHreflang,
          primaryLanguage: langPrimary,
          match: true,
        }
      );
    }

    return warn(
      'i18n-hreflang-lang-mismatch',
      `HTML lang "${htmlLang}" does not match hreflang self-reference "${selfReferenceHreflang}"`,
      {
        htmlLang,
        hreflangLang: selfReferenceHreflang,
        langPrimary,
        hreflangPrimary,
        match: false,
        recommendation:
          'Ensure the html lang attribute and hreflang self-reference use the same primary language code',
      }
    );
  },
});
