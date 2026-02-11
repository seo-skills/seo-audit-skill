import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Check if the page has a noindex directive from meta tags or X-Robots-Tag header.
 */
function hasNoindexDirective($: AuditContext['$'], headers: Record<string, string>): boolean {
  // Check meta robots
  const robotsContent = $('meta[name="robots"]').attr('content') || '';
  if (/noindex/i.test(robotsContent)) {
    return true;
  }

  // Check meta googlebot
  const googlebotContent = $('meta[name="googlebot"]').attr('content') || '';
  if (/noindex/i.test(googlebotContent)) {
    return true;
  }

  // Check X-Robots-Tag header
  const xRobotsTag = headers['x-robots-tag'] || headers['X-Robots-Tag'] || '';
  if (/noindex/i.test(xRobotsTag)) {
    return true;
  }

  return false;
}

/**
 * Normalize a URL for comparison.
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
 * Rule: Canonical to Noindex Conflict
 *
 * Detects when a page has both a noindex directive and a canonical URL pointing
 * to a different page. These are conflicting signals: noindex tells search engines
 * not to index the page, while canonical tells them this page is a duplicate of
 * another URL (implying it should pass signals to the canonical target).
 *
 * Google may follow the canonical and ignore noindex, or vice versa, leading
 * to unpredictable indexing behavior.
 */
export const canonicalToNoindexRule = defineRule({
  id: 'core-canonical-to-noindex',
  name: 'Canonical and Noindex Conflict',
  description: 'Checks if a page has both noindex and a canonical pointing to a different URL (conflicting signals)',
  category: 'core',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $, url, headers } = context;

    const canonicalHref = $('link[rel="canonical"]').first().attr('href')?.trim();

    // No canonical tag - no conflict possible
    if (!canonicalHref) {
      return pass(
        'core-canonical-to-noindex',
        'No canonical tag present; no noindex conflict possible',
        { canonicalFound: false, hasNoindex: false }
      );
    }

    // Resolve canonical to absolute URL
    let canonicalUrl: URL;
    try {
      canonicalUrl = new URL(canonicalHref, url);
    } catch {
      return pass(
        'core-canonical-to-noindex',
        'Canonical URL could not be parsed; skipping noindex conflict check',
        { canonicalHref }
      );
    }

    // Check if canonical is self-referencing (not a conflict even with noindex)
    const normalizedPage = normalizeUrl(url);
    const normalizedCanonical = normalizeUrl(canonicalUrl.href);
    const isSelfReferencing = normalizedPage === normalizedCanonical;

    // Check for noindex directive
    const pageHasNoindex = hasNoindexDirective($, headers);

    if (!pageHasNoindex) {
      return pass(
        'core-canonical-to-noindex',
        'No noindex directive found; no conflict with canonical',
        {
          canonicalUrl: canonicalUrl.href,
          hasNoindex: false,
          selfReferencing: isSelfReferencing,
        }
      );
    }

    // Page has noindex - check if canonical points elsewhere
    if (isSelfReferencing) {
      return pass(
        'core-canonical-to-noindex',
        'Page has noindex with self-referencing canonical; no conflicting signals',
        {
          canonicalUrl: canonicalUrl.href,
          hasNoindex: true,
          selfReferencing: true,
        }
      );
    }

    // Conflict: noindex + canonical to different URL
    return warn(
      'core-canonical-to-noindex',
      `Page has both noindex and a canonical pointing to "${canonicalUrl.href}" (conflicting signals)`,
      {
        canonicalUrl: canonicalUrl.href,
        pageUrl: url,
        hasNoindex: true,
        selfReferencing: false,
        recommendation: 'Remove the noindex directive to let the canonical signal work, or remove the canonical and keep noindex if the page should not be indexed',
      }
    );
  },
});
