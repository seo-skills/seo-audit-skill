import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Conflicting Hreflang Annotations
 *
 * Checks for conflicting hreflang annotations where the same language/region
 * code points to multiple different URLs.
 *
 * Each language code should map to exactly one URL. When the same code points
 * to different URLs, search engines cannot determine which URL to serve,
 * potentially ignoring the hreflang set entirely.
 *
 * Example conflict:
 *   <link rel="alternate" hreflang="en" href="https://example.com/en/">
 *   <link rel="alternate" hreflang="en" href="https://example.com/english/">
 */
export const hreflangConflictingRule = defineRule({
  id: 'i18n-hreflang-conflicting',
  name: 'Conflicting Hreflang Annotations',
  description: 'Checks for same language code pointing to multiple different URLs',
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

    // Group hreflang entries by language code
    const langToUrls = new Map<string, Set<string>>();

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

    if (conflicts.length === 0) {
      return pass(
        'i18n-hreflang-conflicting',
        'No conflicting hreflang annotations found',
        {
          count: hreflangElements.length,
          uniqueLanguages: langToUrls.size,
        }
      );
    }

    return fail(
      'i18n-hreflang-conflicting',
      `Found ${conflicts.length} language code(s) with conflicting URLs`,
      {
        totalHreflang: hreflangElements.length,
        conflictCount: conflicts.length,
        conflicts: conflicts.slice(0, 10),
        recommendation:
          'Each language/region code should point to exactly one URL. Remove duplicate entries.',
      }
    );
  },
});
