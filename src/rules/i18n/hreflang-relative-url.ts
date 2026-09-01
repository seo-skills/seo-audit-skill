import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

// Reference hint: international/has-outgoing-hreflang-annotations-using-relative-urls

/** Hreflang targets must be fully qualified absolute URLs with a scheme */
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

interface RelativeHreflang {
  /** Language/region code on the annotation */
  hreflang: string;
  /** The relative href value, as written */
  href: string;
}

/**
 * Rule: Hreflang Annotations Using Relative URLs
 *
 * Checks that every hreflang annotation points to an absolute URL.
 *
 * Hreflang targets must be absolute URLs including the protocol. Relative
 * targets ("/fr/", "fr/page", or protocol-relative "//example.com/fr/") are
 * invalid per the hreflang specification and may be ignored by search
 * engines, breaking the entire annotation set.
 *
 * Example violation:
 *   <link rel="alternate" hreflang="fr" href="/fr/">
 */
export const hreflangRelativeUrlRule = defineRule({
  id: 'i18n-hreflang-relative-url',
  name: 'Hreflang Relative URLs',
  description: 'Checks that hreflang annotations use absolute URLs, not relative ones',
  category: 'i18n',
  weight: 6,
  run: (context: AuditContext) => {
    const { $ } = context;

    const hreflangElements = $('link[rel="alternate"][hreflang]');
    if (hreflangElements.length === 0) {
      return pass('i18n-hreflang-relative-url', 'No hreflang tags found', {
        count: 0,
      });
    }

    const relativeAnnotations: RelativeHreflang[] = [];

    hreflangElements.each((_, el) => {
      const $el = $(el);
      const hreflang = ($el.attr('hreflang') || '').trim();
      const href = ($el.attr('href') || '').trim();

      if (!href) return;

      if (!ABSOLUTE_URL_PATTERN.test(href)) {
        relativeAnnotations.push({ hreflang, href });
      }
    });

    if (relativeAnnotations.length === 0) {
      return pass(
        'i18n-hreflang-relative-url',
        `All ${hreflangElements.length} hreflang annotation(s) use absolute URLs`,
        { count: hreflangElements.length }
      );
    }

    return fail(
      'i18n-hreflang-relative-url',
      `Found ${relativeAnnotations.length} hreflang annotation(s) using relative URLs`,
      {
        totalHreflang: hreflangElements.length,
        relativeCount: relativeAnnotations.length,
        relativeAnnotations: relativeAnnotations.slice(0, 10),
        recommendation:
          'Hreflang targets must be absolute URLs including the protocol (e.g. https://example.com/fr/).',
      }
    );
  },
});
