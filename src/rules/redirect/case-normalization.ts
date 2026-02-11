import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: URL Case Normalization
 *
 * Checks if the canonical URL differs from the current URL only
 * by letter casing. This indicates the server is not performing
 * case normalization redirects, which can lead to duplicate content
 * issues when the same page is accessible via different URL casings.
 */
export const caseNormalizationRule = defineRule({
  id: 'redirect-case-normalization',
  name: 'URL Case Normalization',
  description: 'Checks that URLs are properly normalized by case to avoid duplicate content',
  category: 'redirect',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const canonicalElement = $('link[rel="canonical"]');

    if (canonicalElement.length === 0) {
      return pass('redirect-case-normalization', 'No canonical URL to compare');
    }

    const canonicalHref = canonicalElement.first().attr('href')?.trim();

    if (!canonicalHref) {
      return pass('redirect-case-normalization', 'Canonical tag has no href value');
    }

    // Normalize both URLs for comparison
    let normalizedUrl: string;
    let normalizedCanonical: string;

    try {
      normalizedUrl = new URL(url).href;
      normalizedCanonical = new URL(canonicalHref, url).href;
    } catch {
      return pass('redirect-case-normalization', 'Could not parse URLs for comparison');
    }

    // Exact match - no issue
    if (normalizedUrl === normalizedCanonical) {
      return pass('redirect-case-normalization', 'Current URL matches canonical URL', {
        url: normalizedUrl,
        canonical: normalizedCanonical,
      });
    }

    // Case-insensitive match but case-sensitive difference
    if (normalizedUrl.toLowerCase() === normalizedCanonical.toLowerCase()) {
      return warn(
        'redirect-case-normalization',
        'Canonical URL differs from current URL only by letter casing; add a case-normalization redirect',
        {
          url: normalizedUrl,
          canonical: normalizedCanonical,
          recommendation: 'Configure the server to redirect non-canonical URL casings to the canonical form',
        }
      );
    }

    // URLs differ by more than case - not this rule's concern
    return pass('redirect-case-normalization', 'URL and canonical differ by more than case (handled by other rules)', {
      url: normalizedUrl,
      canonical: normalizedCanonical,
    });
  },
});
