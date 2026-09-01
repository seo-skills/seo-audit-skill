import type { AuditContext } from '../../types.js';
import { defineRule, pass } from '../define-rule.js';

// Reference hint: indexability/canonical-points-to-external-url

/**
 * Rule: Canonical Points To External URL (insight)
 *
 * Insight-level check that reports when the page's canonical URL points to a
 * different host.
 *
 * This is not an error — cross-domain canonicals are the legitimate mechanism
 * for content syndication and consolidating duplicates across owned domains —
 * but handing another host the ranking signals for this page is a big move,
 * so it is worth surfacing for confirmation that it is deliberate. Always
 * passes; the finding travels in the message and details.
 */
export const canonicalExternalRule = defineRule({
  id: 'core-canonical-external',
  name: 'Canonical Points To External URL',
  description:
    'Reports when the canonical URL points to a different host (legitimate for syndication, worth verifying)',
  category: 'core',
  weight: 1,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const href = $('link[rel="canonical"]').first().attr('href')?.trim();
    if (!href) {
      return pass('core-canonical-external', 'No canonical tag declared', { found: false });
    }

    let canonical: URL;
    let page: URL;
    try {
      canonical = new URL(href, url);
      page = new URL(url);
    } catch {
      // An unparseable canonical is core-canonical-valid's finding.
      return pass(
        'core-canonical-external',
        'Canonical URL could not be parsed for host comparison',
        { found: true, canonicalUrl: href }
      );
    }

    if (canonical.host !== page.host) {
      return pass(
        'core-canonical-external',
        `Canonical points to an external host: ${canonical.host}`,
        {
          found: true,
          external: true,
          canonicalUrl: canonical.href,
          canonicalHost: canonical.host,
          pageHost: page.host,
          note: 'Cross-domain canonicals are legitimate for syndicated or consolidated content - verify the target is intentional, as this page cedes its ranking signals to the other host.',
        }
      );
    }

    return pass('core-canonical-external', 'Canonical points to a URL on the same host', {
      found: true,
      external: false,
      canonicalUrl: canonical.href,
    });
  },
});
