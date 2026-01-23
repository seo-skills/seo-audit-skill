import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchUrl } from '../../crawler/fetcher.js';

/**
 * Gets the www and non-www versions of a URL
 */
function getWwwVariants(url: string): { wwwUrl: string; nonWwwUrl: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    let wwwHostname: string;
    let nonWwwHostname: string;

    if (hostname.startsWith('www.')) {
      wwwHostname = hostname;
      nonWwwHostname = hostname.substring(4);
    } else {
      wwwHostname = `www.${hostname}`;
      nonWwwHostname = hostname;
    }

    // Create URLs with swapped hostnames
    const wwwUrl = new URL(url);
    wwwUrl.hostname = wwwHostname;

    const nonWwwUrl = new URL(url);
    nonWwwUrl.hostname = nonWwwHostname;

    return {
      wwwUrl: wwwUrl.href,
      nonWwwUrl: nonWwwUrl.href,
    };
  } catch {
    return null;
  }
}

/**
 * Determines the canonical hostname from the page
 */
function getCanonicalHostname(context: AuditContext): string | null {
  const { $ } = context;
  const canonicalLink = $('link[rel="canonical"]').attr('href');

  if (canonicalLink) {
    try {
      const canonicalUrl = new URL(canonicalLink);
      return canonicalUrl.hostname;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Rule: Check www and non-www redirect to one canonical version
 */
export const wwwRedirectRule = defineRule({
  id: 'technical-www-redirect',
  name: 'WWW Redirect',
  description:
    'Checks that www and non-www versions redirect to one canonical version',
  category: 'technical',
  weight: 1,
  run: async (context: AuditContext) => {
    const { url } = context;
    const variants = getWwwVariants(url);

    if (!variants) {
      return warn(
        'technical-www-redirect',
        'Could not determine www/non-www variants for this URL',
        { url }
      );
    }

    const { wwwUrl, nonWwwUrl } = variants;
    const currentHostname = new URL(url).hostname;
    const isWww = currentHostname.startsWith('www.');

    // Check canonical link
    const canonicalHostname = getCanonicalHostname(context);

    // Check if both www and non-www are accessible
    const results = {
      wwwStatus: 0,
      nonWwwStatus: 0,
    };

    try {
      results.wwwStatus = await fetchUrl(wwwUrl);
    } catch {
      results.wwwStatus = 0;
    }

    try {
      results.nonWwwStatus = await fetchUrl(nonWwwUrl);
    } catch {
      results.nonWwwStatus = 0;
    }

    const details = {
      url,
      wwwUrl,
      nonWwwUrl,
      currentIsWww: isWww,
      wwwStatus: results.wwwStatus,
      nonWwwStatus: results.nonWwwStatus,
      canonicalHostname,
    };

    // If one version is not accessible, that's fine (means redirect is working)
    if (results.wwwStatus === 0 || results.nonWwwStatus === 0) {
      // One version is not directly accessible - likely redirecting
      const accessibleVersion = results.wwwStatus !== 0 ? 'www' : 'non-www';

      return pass(
        'technical-www-redirect',
        `Only ${accessibleVersion} version is directly accessible (redirect likely in place)`,
        details
      );
    }

    // Both are accessible - check if they redirect to same location
    // This is a simplified check; a full check would follow redirects

    // If canonical is set, use that to verify
    if (canonicalHostname) {
      const canonicalIsWww = canonicalHostname.startsWith('www.');
      const canonicalMatchesCurrent =
        (canonicalIsWww && isWww) || (!canonicalIsWww && !isWww);

      if (canonicalMatchesCurrent) {
        return pass(
          'technical-www-redirect',
          `Canonical URL is set to ${canonicalIsWww ? 'www' : 'non-www'} version`,
          { ...details, canonicalMatchesCurrent }
        );
      } else {
        return warn(
          'technical-www-redirect',
          `Current page is ${isWww ? 'www' : 'non-www'} but canonical points to ${canonicalIsWww ? 'www' : 'non-www'}`,
          { ...details, canonicalMatchesCurrent }
        );
      }
    }

    // Both accessible, no canonical - this is a problem
    if (results.wwwStatus === 200 && results.nonWwwStatus === 200) {
      return fail(
        'technical-www-redirect',
        'Both www and non-www versions are accessible (should redirect to one canonical version)',
        details
      );
    }

    // One returns non-200 status
    return warn(
      'technical-www-redirect',
      `WWW version returned ${results.wwwStatus}, non-www returned ${results.nonWwwStatus}`,
      details
    );
  },
});
