import type { AuditContext } from '../../types.js';
import { defineRule, pass } from '../define-rule.js';

// Reference hint: international/hreflang-annotation-also-x-default

/**
 * Rule: Hreflang Annotation Also X-Default (insight)
 *
 * Insight-level check that reports when the URL targeted by the x-default
 * annotation is also targeted by a language/region annotation on the same
 * page.
 *
 * This is not an error — x-default is simply the fallback shown when no
 * language matches — but the overlap is worth surfacing so the intent is
 * deliberate. Always passes; the finding travels in the message and details.
 */
export const hreflangXDefaultRule = defineRule({
  id: 'i18n-hreflang-x-default',
  name: 'Hreflang Annotation Also X-Default',
  description:
    'Reports when an hreflang language annotation targets the same URL as x-default',
  category: 'i18n',
  weight: 1,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const hreflangElements = $('link[rel="alternate"][hreflang]');
    if (hreflangElements.length === 0) {
      return pass('i18n-hreflang-x-default', 'No hreflang tags found', {
        count: 0,
      });
    }

    const normalize = (href: string): string => {
      try {
        return new URL(href, url).href;
      } catch {
        return href;
      }
    };

    const xDefaultUrls = new Set<string>();
    /** Language codes whose target matches an x-default target */
    const overlapping: Array<{ hreflang: string; href: string }> = [];
    const languageAnnotations: Array<{ hreflang: string; href: string }> = [];

    hreflangElements.each((_, el) => {
      const $el = $(el);
      const hreflang = ($el.attr('hreflang') || '').trim().toLowerCase();
      const href = ($el.attr('href') || '').trim();

      if (!hreflang || !href) return;

      if (hreflang === 'x-default') {
        xDefaultUrls.add(normalize(href));
      } else {
        languageAnnotations.push({ hreflang, href });
      }
    });

    if (xDefaultUrls.size === 0) {
      return pass('i18n-hreflang-x-default', 'No x-default hreflang annotation found', {
        count: hreflangElements.length,
        hasXDefault: false,
      });
    }

    for (const annotation of languageAnnotations) {
      if (xDefaultUrls.has(normalize(annotation.href))) {
        overlapping.push(annotation);
      }
    }

    if (overlapping.length > 0) {
      return pass(
        'i18n-hreflang-x-default',
        `${overlapping.length} hreflang annotation(s) also target the x-default URL`,
        {
          count: hreflangElements.length,
          hasXDefault: true,
          alsoXDefault: true,
          overlapping: overlapping.slice(0, 10),
        }
      );
    }

    return pass(
      'i18n-hreflang-x-default',
      'No hreflang annotation duplicates the x-default target',
      {
        count: hreflangElements.length,
        hasXDefault: true,
        alsoXDefault: false,
      }
    );
  },
});
