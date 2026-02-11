import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Canonical Protocol Mismatch
 *
 * Detects when the canonical URL uses a different protocol (HTTP vs HTTPS) than
 * the page itself. For example, an HTTPS page with a canonical pointing to
 * the HTTP version sends conflicting signals to search engines and may cause
 * the non-secure version to be indexed instead.
 */
export const canonicalHttpMismatchRule = defineRule({
  id: 'core-canonical-http-mismatch',
  name: 'Canonical Protocol Mismatch',
  description: 'Checks if canonical URL protocol mismatches the page protocol (HTTP vs HTTPS)',
  category: 'core',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    const canonicalHref = $('link[rel="canonical"]').first().attr('href')?.trim();

    // No canonical tag - nothing to check
    if (!canonicalHref) {
      return pass(
        'core-canonical-http-mismatch',
        'No canonical tag present; skipping protocol check',
        { canonicalFound: false }
      );
    }

    // Resolve canonical to absolute URL
    let canonicalUrl: URL;
    try {
      canonicalUrl = new URL(canonicalHref, url);
    } catch {
      return pass(
        'core-canonical-http-mismatch',
        'Canonical URL could not be parsed; skipping protocol check',
        { canonicalHref }
      );
    }

    // Parse page URL
    let pageUrl: URL;
    try {
      pageUrl = new URL(url);
    } catch {
      return pass(
        'core-canonical-http-mismatch',
        'Page URL could not be parsed; skipping protocol check',
        { url }
      );
    }

    const pageProtocol = pageUrl.protocol;
    const canonicalProtocol = canonicalUrl.protocol;

    if (pageProtocol === canonicalProtocol) {
      return pass(
        'core-canonical-http-mismatch',
        `Page and canonical use the same protocol (${pageProtocol.replace(':', '')})`,
        {
          pageProtocol,
          canonicalProtocol,
          canonicalUrl: canonicalUrl.href,
        }
      );
    }

    // Protocol mismatch detected
    const isDowngrade = pageProtocol === 'https:' && canonicalProtocol === 'http:';

    return fail(
      'core-canonical-http-mismatch',
      `Protocol mismatch: page is ${pageProtocol.replace(':', '').toUpperCase()} but canonical points to ${canonicalProtocol.replace(':', '').toUpperCase()} ("${canonicalUrl.href}")`,
      {
        pageProtocol,
        canonicalProtocol,
        canonicalUrl: canonicalUrl.href,
        pageUrl: url,
        isDowngrade,
        recommendation: isDowngrade
          ? 'Update canonical to use HTTPS to match the page protocol and avoid indexing the insecure version'
          : 'Ensure canonical protocol matches the page protocol',
      }
    );
  },
});
