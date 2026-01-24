import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchUrl } from '../../crawler/fetcher.js';

/**
 * Normalize URL for comparison (lowercase host, consistent trailing slash)
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${urlObj.protocol}//${urlObj.host.toLowerCase()}${path}${urlObj.search}`;
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Check if canonical URL redirects
 * Returns final URL if redirect chain is detected
 */
async function checkCanonicalRedirect(
  canonicalUrl: string
): Promise<{
  redirects: boolean;
  statusCode: number;
  finalUrl?: string;
  chainLength: number;
  error?: string;
}> {
  try {
    // Use fetch with redirect: 'manual' to detect redirects
    const response = await fetch(canonicalUrl, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });

    const statusCode = response.status;

    // 3xx status means redirect
    if (statusCode >= 300 && statusCode < 400) {
      const location = response.headers.get('location');
      if (location) {
        // Resolve relative URLs
        const finalUrl = new URL(location, canonicalUrl).href;

        // Check if the redirect target also redirects (chain detection)
        let chainLength = 1;
        let currentUrl = finalUrl;

        for (let i = 0; i < 5; i++) {
          // Max 5 redirects
          try {
            const chainResponse = await fetch(currentUrl, {
              method: 'HEAD',
              redirect: 'manual',
              signal: AbortSignal.timeout(5000),
            });

            if (chainResponse.status >= 300 && chainResponse.status < 400) {
              const nextLocation = chainResponse.headers.get('location');
              if (nextLocation) {
                currentUrl = new URL(nextLocation, currentUrl).href;
                chainLength++;
              } else {
                break;
              }
            } else {
              break;
            }
          } catch {
            break;
          }
        }

        return {
          redirects: true,
          statusCode,
          finalUrl: currentUrl,
          chainLength,
        };
      }
    }

    return {
      redirects: false,
      statusCode,
      chainLength: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      redirects: false,
      statusCode: 0,
      chainLength: 0,
      error: message,
    };
  }
}

/**
 * Rule: Canonical Redirect Chain
 *
 * Checks if the canonical URL redirects to another URL.
 * Canonical URLs should point directly to the final destination.
 */
export const canonicalRedirectRule = defineRule({
  id: 'crawl-canonical-redirect',
  name: 'Canonical Redirect Chain',
  description: 'Checks that canonical URLs do not redirect',
  category: 'crawlability',
  weight: 15,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    // Get canonical URL
    const canonical = $('link[rel="canonical"]').attr('href');

    if (!canonical) {
      return warn(
        'crawl-canonical-redirect',
        'No canonical tag found',
        { hasCanonical: false }
      );
    }

    // Resolve relative canonical to absolute URL
    let absoluteCanonical: string;
    try {
      absoluteCanonical = new URL(canonical, url).href;
    } catch {
      return fail(
        'crawl-canonical-redirect',
        'Canonical URL is malformed',
        { canonical, error: 'Could not parse URL' }
      );
    }

    // Check if canonical is self-referencing
    const normalizedUrl = normalizeUrl(url);
    const normalizedCanonical = normalizeUrl(absoluteCanonical);
    const isSelfReferencing = normalizedUrl === normalizedCanonical;

    // Check if canonical redirects
    const redirectInfo = await checkCanonicalRedirect(absoluteCanonical);

    const details = {
      canonical: absoluteCanonical,
      currentUrl: url,
      isSelfReferencing,
      redirects: redirectInfo.redirects,
      statusCode: redirectInfo.statusCode,
      finalUrl: redirectInfo.finalUrl,
      chainLength: redirectInfo.chainLength,
    };

    // Error checking canonical
    if (redirectInfo.error) {
      return warn(
        'crawl-canonical-redirect',
        `Could not verify canonical URL: ${redirectInfo.error}`,
        { ...details, error: redirectInfo.error }
      );
    }

    // Canonical returns 4xx/5xx
    if (redirectInfo.statusCode >= 400) {
      return fail(
        'crawl-canonical-redirect',
        `Canonical URL returns HTTP ${redirectInfo.statusCode}`,
        {
          ...details,
          impact: 'Canonical pointing to an error page',
          recommendation: 'Update canonical to point to a valid URL',
        }
      );
    }

    // Canonical redirects (chain detected)
    if (redirectInfo.redirects) {
      const severity = redirectInfo.chainLength > 2 ? 'fail' : 'warn';
      const message =
        redirectInfo.chainLength > 1
          ? `Canonical URL has ${redirectInfo.chainLength}-redirect chain`
          : 'Canonical URL redirects to another URL';

      if (severity === 'fail') {
        return fail('crawl-canonical-redirect', message, {
          ...details,
          impact: 'Redirect chains waste crawl budget and dilute link equity',
          recommendation: `Update canonical to point directly to ${redirectInfo.finalUrl}`,
        });
      }

      return warn('crawl-canonical-redirect', message, {
        ...details,
        recommendation: `Update canonical to point directly to ${redirectInfo.finalUrl}`,
      });
    }

    // No redirect - canonical is good
    return pass(
      'crawl-canonical-redirect',
      isSelfReferencing
        ? 'Canonical is self-referencing and does not redirect'
        : 'Canonical URL does not redirect',
      details
    );
  },
});
