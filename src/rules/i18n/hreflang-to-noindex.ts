import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Hreflang to Noindex Conflict
 *
 * Checks if the current page has both hreflang annotations AND a noindex directive.
 * These are conflicting signals:
 * - Hreflang tells search engines to index and serve this page to specific language users
 * - Noindex tells search engines not to index the page at all
 *
 * When both are present, search engines may ignore the hreflang or drop the page
 * from the index entirely, breaking international targeting.
 *
 * Noindex sources checked:
 * - <meta name="robots" content="noindex">
 * - <meta name="googlebot" content="noindex">
 * - X-Robots-Tag HTTP header containing "noindex"
 */
export const hreflangToNoindexRule = defineRule({
  id: 'i18n-hreflang-to-noindex',
  name: 'Hreflang to Noindex Conflict',
  description: 'Checks if page has both hreflang annotations and noindex directive',
  category: 'i18n',
  weight: 10,
  run: (context: AuditContext) => {
    const { $, headers } = context;

    const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;

    if (!hasHreflang) {
      return pass('i18n-hreflang-to-noindex', 'No hreflang tags found, no conflict possible', {
        hasHreflang: false,
        hasNoindex: false,
      });
    }

    // Check meta robots for noindex
    let hasNoindex = false;
    let noindexSource = '';

    $('meta[name="robots"], meta[name="googlebot"]').each((_, el) => {
      const content = ($(el).attr('content') || '').toLowerCase();
      if (content.includes('noindex')) {
        hasNoindex = true;
        const name = $(el).attr('name') || 'robots';
        noindexSource = `<meta name="${name}" content="${content}">`;
      }
    });

    // Check X-Robots-Tag HTTP header
    const xRobotsTag = headers['x-robots-tag'] || '';
    if (xRobotsTag.toLowerCase().includes('noindex')) {
      hasNoindex = true;
      noindexSource = noindexSource || `X-Robots-Tag: ${xRobotsTag}`;
    }

    if (!hasNoindex) {
      return pass('i18n-hreflang-to-noindex', 'No conflict between hreflang and indexing directives', {
        hasHreflang: true,
        hasNoindex: false,
      });
    }

    const hreflangCount = $('link[rel="alternate"][hreflang]').length;

    return fail(
      'i18n-hreflang-to-noindex',
      'Page has both hreflang annotations and noindex directive (conflicting signals)',
      {
        hasHreflang: true,
        hreflangCount,
        hasNoindex: true,
        noindexSource,
        recommendation:
          'Remove noindex to allow search engines to index this language version, or remove hreflang if the page should not be indexed',
      }
    );
  },
});
