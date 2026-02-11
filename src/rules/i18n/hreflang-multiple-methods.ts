import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Hreflang Multiple Methods
 *
 * Checks if hreflang is specified via multiple methods simultaneously.
 * Hreflang can be declared via:
 * 1. HTML <link> tags in the <head>
 * 2. HTTP Link headers
 * 3. XML sitemap (not checkable from page context)
 *
 * Using multiple methods increases risk of inconsistencies. Google recommends
 * using one method consistently. If HTML tags and HTTP headers provide different
 * hreflang data, search engines may not know which to trust.
 *
 * Reference: https://developers.google.com/search/docs/specialty/international/localized-versions
 */
export const hreflangMultipleMethodsRule = defineRule({
  id: 'i18n-hreflang-multiple-methods',
  name: 'Hreflang Multiple Methods',
  description: 'Checks if hreflang is specified via both HTML link tags and HTTP headers',
  category: 'i18n',
  weight: 6,
  run: (context: AuditContext) => {
    const { $, headers } = context;

    // Check HTML link tags
    const hasHtmlHreflang = $('link[rel="alternate"][hreflang]').length > 0;

    // Check HTTP Link header for hreflang
    // Format: <URL>; rel="alternate"; hreflang="en"
    const linkHeader = headers['link'] || '';
    const hasHeaderHreflang = linkHeader.toLowerCase().includes('hreflang');

    if (!hasHtmlHreflang && !hasHeaderHreflang) {
      return pass('i18n-hreflang-multiple-methods', 'No hreflang declarations found', {
        htmlHreflang: false,
        headerHreflang: false,
      });
    }

    if (hasHtmlHreflang && !hasHeaderHreflang) {
      return pass(
        'i18n-hreflang-multiple-methods',
        'Hreflang declared via HTML link tags only (consistent method)',
        {
          htmlHreflang: true,
          headerHreflang: false,
          method: 'html',
          htmlCount: $('link[rel="alternate"][hreflang]').length,
        }
      );
    }

    if (!hasHtmlHreflang && hasHeaderHreflang) {
      return pass(
        'i18n-hreflang-multiple-methods',
        'Hreflang declared via HTTP Link header only (consistent method)',
        {
          htmlHreflang: false,
          headerHreflang: true,
          method: 'header',
        }
      );
    }

    // Both methods are used
    return warn(
      'i18n-hreflang-multiple-methods',
      'Hreflang declared via both HTML link tags and HTTP Link header (risk of inconsistency)',
      {
        htmlHreflang: true,
        headerHreflang: true,
        htmlCount: $('link[rel="alternate"][hreflang]').length,
        linkHeader,
        recommendation:
          'Use a single method for hreflang declaration to avoid conflicting annotations',
      }
    );
  },
});
