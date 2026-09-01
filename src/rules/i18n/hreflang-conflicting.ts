import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

// Reference hints: international/has-conflicting-outgoing-hreflang-annotations,
// international/has-multiple-self-referencing-hreflang-annotations

/**
 * Rule: Conflicting Hreflang Annotations
 *
 * Checks for conflicting hreflang annotations, in three forms:
 *
 * 1. The same language/region code points to multiple different URLs.
 * 2. The same URL is targeted by multiple different language/region codes.
 * 3. The current page is self-referenced by multiple different
 *    language/region codes.
 *
 * Each language code should map to exactly one URL, and each URL to exactly
 * one language. When annotations disagree, search engines cannot determine
 * which URL to serve, potentially ignoring the hreflang set entirely.
 *
 * The x-default code is excluded from these conflict checks: sharing a
 * target between a language annotation and x-default is a fallback
 * declaration, not a conflict (covered by an insight-level rule instead).
 *
 * Example conflict:
 *   <link rel="alternate" hreflang="en" href="https://example.com/en/">
 *   <link rel="alternate" hreflang="en" href="https://example.com/english/">
 */
export const hreflangConflictingRule = defineRule({
  id: 'i18n-hreflang-conflicting',
  name: 'Conflicting Hreflang Annotations',
  description:
    'Checks for hreflang conflicts: one language code pointing to multiple URLs, one URL targeted by multiple codes, or multiple self-referencing codes',
  category: 'i18n',
  weight: 10,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const hreflangElements = $('link[rel="alternate"][hreflang]');
    if (hreflangElements.length === 0) {
      return pass('i18n-hreflang-conflicting', 'No hreflang tags found', {
        count: 0,
      });
    }

    let normalizedCurrentUrl: string;
    try {
      normalizedCurrentUrl = new URL(url).href;
    } catch {
      normalizedCurrentUrl = url;
    }

    // Group hreflang entries by language code, and by target URL
    const langToUrls = new Map<string, Set<string>>();
    const urlToLangs = new Map<string, Set<string>>();

    hreflangElements.each((_, el) => {
      const $el = $(el);
      const hreflang = ($el.attr('hreflang') || '').trim().toLowerCase();
      const href = ($el.attr('href') || '').trim();

      if (!hreflang || !href) return;

      // Normalize the URL for comparison
      let normalizedHref: string;
      try {
        const parsed = new URL(href, url);
        normalizedHref = parsed.href;
      } catch {
        normalizedHref = href;
      }

      if (!langToUrls.has(hreflang)) {
        langToUrls.set(hreflang, new Set());
      }
      langToUrls.get(hreflang)!.add(normalizedHref);

      // x-default is a fallback declaration, not a language target — sharing
      // a URL with it is insight-level, not a conflict
      if (hreflang === 'x-default') return;

      if (!urlToLangs.has(normalizedHref)) {
        urlToLangs.set(normalizedHref, new Set());
      }
      urlToLangs.get(normalizedHref)!.add(hreflang);
    });

    // Find language codes with multiple different URLs
    const conflicts: Array<{ hreflang: string; urls: string[] }> = [];

    for (const [hreflang, urls] of langToUrls) {
      if (urls.size > 1) {
        conflicts.push({
          hreflang,
          urls: Array.from(urls),
        });
      }
    }

    // Find URLs targeted by multiple different language codes
    const urlConflicts: Array<{ url: string; hreflangs: string[] }> = [];

    for (const [targetUrl, hreflangs] of urlToLangs) {
      if (hreflangs.size > 1) {
        urlConflicts.push({
          url: targetUrl,
          hreflangs: Array.from(hreflangs),
        });
      }
    }

    // Find self-referencing annotations with different language codes
    const selfReferencingLangs = urlToLangs.get(normalizedCurrentUrl);
    const hasSelfReferenceConflict =
      selfReferencingLangs !== undefined && selfReferencingLangs.size > 1;

    if (conflicts.length === 0 && urlConflicts.length === 0 && !hasSelfReferenceConflict) {
      return pass(
        'i18n-hreflang-conflicting',
        'No conflicting hreflang annotations found',
        {
          count: hreflangElements.length,
          uniqueLanguages: langToUrls.size,
        }
      );
    }

    const conflictCount =
      conflicts.length + urlConflicts.length + (hasSelfReferenceConflict ? 1 : 0);

    return fail(
      'i18n-hreflang-conflicting',
      `Found ${conflictCount} hreflang conflict(s)`,
      {
        totalHreflang: hreflangElements.length,
        conflictCount,
        conflicts: conflicts.slice(0, 10),
        urlConflicts: urlConflicts.slice(0, 10),
        selfReferencingLangs: hasSelfReferenceConflict
          ? Array.from(selfReferencingLangs)
          : [],
        recommendation:
          'Each language/region code should point to exactly one URL, each URL should be targeted by exactly one code, and the page should self-reference under a single code. Remove duplicate entries.',
      }
    );
  },
});
