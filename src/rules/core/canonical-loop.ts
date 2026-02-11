import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Normalize a URL for comparison by lowercasing and removing trailing slashes.
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
 * Rule: Canonical Loop Detection
 *
 * Detects potential canonical loops where page A canonicalizes to page B,
 * which may canonicalize back to A. In single-page audit mode, this rule
 * verifies whether the canonical is self-referencing (correct behavior) or
 * points to a different URL (which should be verified to ensure it does not
 * create a loop).
 *
 * A self-referencing canonical is the recommended best practice. When the
 * canonical points elsewhere, it requires manual verification that the
 * target page does not point back to this page.
 */
export const canonicalLoopRule = defineRule({
  id: 'core-canonical-loop',
  name: 'Canonical Loop Detection',
  description: 'Checks if canonical URL may create a loop (non-self-referencing canonical)',
  category: 'core',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    const canonicalHref = $('link[rel="canonical"]').first().attr('href')?.trim();

    // No canonical tag
    if (!canonicalHref) {
      return pass(
        'core-canonical-loop',
        'No canonical tag present; no loop risk',
        { canonicalFound: false }
      );
    }

    // Resolve to absolute URL
    let canonicalUrl: URL;
    try {
      canonicalUrl = new URL(canonicalHref, url);
    } catch {
      return pass(
        'core-canonical-loop',
        'Canonical URL could not be parsed; skipping loop check',
        { canonicalHref }
      );
    }

    const normalizedPage = normalizeUrl(url);
    const normalizedCanonical = normalizeUrl(canonicalUrl.href);

    // Self-referencing canonical is correct and expected
    if (normalizedPage === normalizedCanonical) {
      return pass(
        'core-canonical-loop',
        'Canonical is self-referencing (best practice)',
        {
          pageUrl: url,
          canonicalUrl: canonicalUrl.href,
          selfReferencing: true,
        }
      );
    }

    // Canonical points to a different URL - potential loop risk
    return warn(
      'core-canonical-loop',
      `Canonical points to a different URL ("${canonicalUrl.href}"); verify the target does not canonicalize back to this page`,
      {
        pageUrl: url,
        canonicalUrl: canonicalUrl.href,
        selfReferencing: false,
        recommendation: 'Ensure the canonical target page does not point back to this page, which would create a loop that confuses search engines',
      }
    );
  },
});
