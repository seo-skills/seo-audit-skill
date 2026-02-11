import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Resolve a potentially relative canonical href to an absolute URL.
 */
function resolveCanonical(href: string, pageUrl: string): URL | null {
  try {
    return new URL(href, pageUrl);
  } catch {
    return null;
  }
}

/**
 * Rule: Canonical Pointing to Homepage
 *
 * Detects a common misconfiguration where non-homepage pages have their
 * canonical URL set to the site's homepage ("/"). This tells search engines
 * to treat every page as a duplicate of the homepage, which can cause
 * severe loss of organic traffic to inner pages.
 */
export const canonicalToHomepageRule = defineRule({
  id: 'core-canonical-to-homepage',
  name: 'Canonical Pointing to Homepage',
  description: 'Checks if a non-homepage has its canonical URL pointing to the homepage',
  category: 'core',
  weight: 6,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    const canonicalHref = $('link[rel="canonical"]').first().attr('href')?.trim();

    // No canonical tag - nothing to check (handled by canonical-present rule)
    if (!canonicalHref) {
      return pass(
        'core-canonical-to-homepage',
        'No canonical tag present; skipping homepage check',
        { canonicalFound: false }
      );
    }

    // Parse the page URL
    let pageUrl: URL;
    try {
      pageUrl = new URL(url);
    } catch {
      return pass(
        'core-canonical-to-homepage',
        'Could not parse page URL; skipping check',
        { url }
      );
    }

    // If the current page IS the homepage, canonicalizing to "/" is correct
    const pagePath = pageUrl.pathname.replace(/\/$/, '') || '/';
    if (pagePath === '/' || pagePath === '') {
      return pass(
        'core-canonical-to-homepage',
        'Page is the homepage; canonical to homepage is expected',
        { pageUrl: url, pagePath }
      );
    }

    // Resolve canonical to absolute URL
    const canonicalUrl = resolveCanonical(canonicalHref, url);
    if (!canonicalUrl) {
      return pass(
        'core-canonical-to-homepage',
        'Canonical URL could not be resolved; skipping homepage check',
        { canonicalHref }
      );
    }

    const canonicalPath = canonicalUrl.pathname.replace(/\/$/, '') || '/';

    if (canonicalPath === '/' || canonicalPath === '') {
      return fail(
        'core-canonical-to-homepage',
        `Non-homepage page canonicalizes to homepage: canonical is "${canonicalHref}" but page path is "${pageUrl.pathname}"`,
        {
          canonicalUrl: canonicalUrl.href,
          canonicalPath,
          pageUrl: url,
          pagePath: pageUrl.pathname,
          recommendation: 'Set the canonical URL to the current page URL (self-referencing canonical) unless this is an intentional redirect',
        }
      );
    }

    return pass(
      'core-canonical-to-homepage',
      'Canonical URL does not point to the homepage',
      {
        canonicalUrl: canonicalUrl.href,
        canonicalPath,
        pagePath: pageUrl.pathname,
      }
    );
  },
});
