import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

// Reference hints: indexability/multiple-mismatched-canonical-tags,
// indexability/multiple-canonical-tags

/**
 * Normalize a URL for comparison by lowercasing the origin and removing trailing slashes.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.replace(/\/$/, '').toLowerCase();
  }
}

/**
 * Rule: Multiple canonical elements in the HTML
 *
 * More than one <link rel="canonical"> in the same document sends conflicting
 * or redundant signals. When the URLs disagree, search engines may ignore the
 * canonical instruction entirely; identical duplicates are error-prone but
 * harmless while they agree.
 *
 * Scope note: an HTML canonical combined with a Link response header is
 * covered by core-canonical-conflicting / core-canonical-header; this rule
 * counts elements within the HTML only.
 */
export const canonicalMultipleRule = defineRule({
  id: 'core-canonical-multiple',
  name: 'Multiple Canonical Tags',
  description: 'Checks for multiple <link rel="canonical"> elements in the HTML and whether they agree',
  category: 'core',
  weight: 6,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const hrefs: string[] = [];
    $('link[rel="canonical"]').each((_, el) => {
      hrefs.push($(el).attr('href')?.trim() || '');
    });

    if (hrefs.length <= 1) {
      return pass(
        'core-canonical-multiple',
        'At most one canonical element in the HTML',
        { count: hrefs.length }
      );
    }

    const distinct = [...new Set(hrefs.map(normalizeUrl))];

    if (distinct.length > 1) {
      return fail(
        'core-canonical-multiple',
        `${hrefs.length} canonical elements specify different URLs: ${hrefs.join(', ')}`,
        {
          count: hrefs.length,
          hrefs,
          match: false,
          impact: 'Conflicting canonical URLs may cause search engines to ignore the canonical instruction entirely',
          recommendation: 'Keep a single <link rel="canonical"> element pointing at the correct URL',
        }
      );
    }

    return warn(
      'core-canonical-multiple',
      `${hrefs.length} identical canonical elements found ("${hrefs[0]}")`,
      {
        count: hrefs.length,
        hrefs,
        match: true,
        impact: 'Duplicate canonicals are in agreement but make future configuration errors likely',
        recommendation: 'Specify the canonical only once per page',
      }
    );
  },
});
