import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { redirectChain, urlServiceFor } from '../../net/url-service.js';

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
  context: AuditContext,
  canonicalUrl: string
): Promise<{
  redirects: boolean;
  statusCode: number;
  finalUrl?: string;
  chainLength: number;
  error?: string;
}> {
  // The first hop's own status; asked once per run, and reused by the chain
  const first = await urlServiceFor(context).get(canonicalUrl, { method: 'HEAD', followRedirects: false });
  if (first.status === 0) {
    return { redirects: false, statusCode: 0, chainLength: 0, error: first.failure ?? 'network' };
  }
  if (!(first.status >= 300 && first.status < 400 && first.location)) {
    return { redirects: false, statusCode: first.status, chainLength: 0 };
  }
  // The first redirect, then up to five more hops
  const chain = await redirectChain(context, canonicalUrl, 6);
  return { redirects: true, statusCode: first.status, finalUrl: chain.finalUrl, chainLength: chain.redirectCount };
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
  category: 'crawl',
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
    const redirectInfo = await checkCanonicalRedirect(context, absoluteCanonical);

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
          impact: 'A canonical that redirects sends crawlers through extra hops before the URL you want indexed',
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
