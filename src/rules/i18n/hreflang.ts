import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface HreflangTag {
  /** Language/region code */
  hreflang: string;
  /** Target URL */
  href: string;
}

interface HreflangIssue {
  /** Issue description */
  issue: string;
  /** Related hreflang value */
  hreflang?: string;
  /** Related URL */
  href?: string;
}

/**
 * Rule: Hreflang Tags
 *
 * Checks for proper hreflang implementation for international SEO.
 * Hreflang tells search engines which language/region version to show users.
 *
 * Requirements:
 * - Each page should have self-referencing hreflang
 * - Should include x-default for fallback
 * - All URLs should be absolute
 * - Language codes should be valid ISO 639-1
 * - Region codes should be valid ISO 3166-1 Alpha-2
 *
 * Sources: <link rel="alternate" hreflang="..."> or HTTP headers
 */
export const hreflangRule = defineRule({
  id: 'i18n-hreflang',
  name: 'Hreflang Tags',
  description: 'Checks for hreflang link elements for international targeting',
  category: 'i18n',
  weight: 10,
  run: (context: AuditContext) => {
    const { $, url } = context;
    const issues: HreflangIssue[] = [];
    const hreflangTags: HreflangTag[] = [];

    // Collect hreflang from link elements
    $('link[rel="alternate"][hreflang]').each((_, el) => {
      const $el = $(el);
      const hreflang = $el.attr('hreflang') || '';
      const href = $el.attr('href') || '';

      hreflangTags.push({ hreflang, href });
    });

    // No hreflang tags - this is fine for single-language sites
    if (hreflangTags.length === 0) {
      return pass('i18n-hreflang', 'No hreflang tags found (single-language site)', {
        count: 0,
        note: 'Add hreflang tags if you have multi-language or regional versions',
      });
    }

    // Validate each hreflang tag
    let hasSelfReference = false;
    let hasXDefault = false;
    const seenLanguages = new Set<string>();

    for (const tag of hreflangTags) {
      const { hreflang, href } = tag;

      // Check for empty values
      if (!hreflang) {
        issues.push({ issue: 'Empty hreflang attribute', href });
        continue;
      }

      if (!href) {
        issues.push({ issue: 'Empty href attribute', hreflang });
        continue;
      }

      // Check for x-default
      if (hreflang === 'x-default') {
        hasXDefault = true;
        continue;
      }

      // Validate language code format
      const langPattern = /^[a-z]{2}(-[A-Z]{2})?$/;
      if (!langPattern.test(hreflang)) {
        issues.push({
          issue: `Invalid hreflang format: "${hreflang}"`,
          hreflang,
          href,
        });
      }

      // Check for duplicate language codes
      if (seenLanguages.has(hreflang)) {
        issues.push({
          issue: `Duplicate hreflang: "${hreflang}"`,
          hreflang,
        });
      }
      seenLanguages.add(hreflang);

      // Check for absolute URLs
      if (href && !href.startsWith('http://') && !href.startsWith('https://')) {
        issues.push({
          issue: 'Hreflang href should be absolute URL',
          hreflang,
          href,
        });
      }

      // Check for self-reference
      try {
        const hrefUrl = new URL(href, url);
        const currentUrl = new URL(url);
        if (hrefUrl.pathname === currentUrl.pathname && hrefUrl.host === currentUrl.host) {
          hasSelfReference = true;
        }
      } catch {
        // Invalid URL - already caught by absolute URL check
      }
    }

    // Check for missing self-reference
    if (!hasSelfReference) {
      issues.push({
        issue: 'Missing self-referencing hreflang for current page',
      });
    }

    // Check for missing x-default (warning, not required)
    if (!hasXDefault && hreflangTags.length > 1) {
      issues.push({
        issue: 'Consider adding x-default for fallback language',
      });
    }

    if (issues.length === 0) {
      return pass('i18n-hreflang', `Found ${hreflangTags.length} valid hreflang tags`, {
        count: hreflangTags.length,
        languages: Array.from(seenLanguages),
        hasXDefault,
        hasSelfReference,
      });
    }

    // Determine severity based on issue types
    const hasCriticalIssues = issues.some(
      (i) =>
        i.issue.includes('Empty') ||
        i.issue.includes('Invalid') ||
        i.issue.includes('Duplicate')
    );

    if (hasCriticalIssues) {
      return fail('i18n-hreflang', `Found ${issues.length} hreflang issue(s)`, {
        count: hreflangTags.length,
        issues: issues.slice(0, 10),
        totalIssues: issues.length,
      });
    }

    return warn('i18n-hreflang', `Found ${issues.length} hreflang recommendation(s)`, {
      count: hreflangTags.length,
      issues: issues.slice(0, 10),
      totalIssues: issues.length,
    });
  },
});
