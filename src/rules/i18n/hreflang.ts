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
/** A path segment shaped like a language tag: de, fr, pt-BR, zh-Hant */
const LOCALE_SEGMENT = /^[a-z]{2}(?:-[a-z0-9]{2,4})?$/i;

/**
 * Internal links to this page's path under another locale prefix, as in
 * /en-US/docs/Web/HTML -> /fr/docs/Web/HTML. Only when the page's own first
 * segment matches its <html lang>, so /api/users and /app/users never read as
 * translations of each other.
 */
function findTranslationLinks(context: AuditContext): string[] {
  let page: URL;
  try {
    page = new URL(context.url);
  } catch {
    return [];
  }
  const [locale, ...rest] = page.pathname.split('/').filter(Boolean);
  const lang = context.$('html').attr('lang')?.trim().toLowerCase();
  if (!locale || !lang || locale.toLowerCase() !== lang || rest.length === 0) return [];
  const remainder = rest.join('/').replace(/\/$/, '');

  const found = new Set<string>();
  for (const link of context.links) {
    if (!link.isInternal) continue;
    let target: URL;
    try {
      target = new URL(link.href);
    } catch {
      continue;
    }
    const [otherLocale, ...otherRest] = target.pathname.split('/').filter(Boolean);
    if (!otherLocale || otherLocale.toLowerCase() === locale.toLowerCase()) continue;
    if (!LOCALE_SEGMENT.test(otherLocale)) continue;
    if (otherRest.join('/').replace(/\/$/, '') !== remainder) continue;
    found.add(`${target.origin}${target.pathname}`);
  }
  return [...found];
}

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

    if (hreflangTags.length === 0) {
      // The HTTP Link header is an equally valid place for hreflang.
      if ((context.headers['link'] ?? '').toLowerCase().includes('hreflang')) {
        return pass('i18n-hreflang', 'Hreflang is declared in the HTTP Link header, not in the HTML', {
          count: 0,
          method: 'header',
        });
      }

      // Whether the site has other languages cannot be known from one page,
      // but a link to this same path under another locale shows that it does.
      const translationLinks = findTranslationLinks(context);
      if (translationLinks.length > 0) {
        return warn(
          'i18n-hreflang',
          `Page links to ${translationLinks.length} other-language version(s) of itself but declares no hreflang in the HTML or HTTP headers`,
          {
            count: 0,
            translationLinks: translationLinks.slice(0, 10),
            note: 'Ignore if hreflang is declared in the XML sitemap, which this rule does not read',
            recommendation:
              'Add <link rel="alternate" hreflang="..."> for every language version, including this page itself',
          }
        );
      }

      return pass('i18n-hreflang', 'No hreflang tags found, and no links to other-language versions of this page', {
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
