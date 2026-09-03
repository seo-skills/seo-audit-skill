import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { getUserAgent } from '../../crawler/user-agent.js';
import { requestSignal } from '../../crawler/fetcher.js';
import { rethrowIfAborted, throwIfAborted } from '../../errors.js';

/**
 * Makes a fetch request without following redirects to check redirect behavior
 */
async function checkRedirect(
  url: string,
  timeout = 10000,
  signal?: AbortSignal
): Promise<{ statusCode: number; location: string | null }> {
  throwIfAborted(signal);
  const request = requestSignal(timeout, signal);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: request.signal,
      headers: {
        'User-Agent': getUserAgent(),
      },
      redirect: 'manual', // Don't follow redirects
    });

    const location = response.headers.get('location');
    return { statusCode: response.status, location };
  } catch (error) {
    rethrowIfAborted(error, signal);
    return { statusCode: 0, location: null }; // Timeout or network error
  } finally {
    request.dispose();
  }
}

/**
 * Rule: Check that HTTP redirects to HTTPS
 */
export const httpsRedirectRule = defineRule({
  id: 'security-https-redirect',
  name: 'HTTP to HTTPS Redirect',
  description: 'Checks that HTTP requests redirect to HTTPS',
  category: 'security',
  weight: 8,
  run: async (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);

      // If current URL is already HTTP, that's a separate issue
      // This rule focuses on whether HTTP would redirect to HTTPS
      const httpUrl = `http://${urlObj.host}${urlObj.pathname}${urlObj.search}`;
      const expectedHttpsUrl = `https://${urlObj.host}${urlObj.pathname}${urlObj.search}`;

      const { statusCode, location } = await checkRedirect(httpUrl, 10000, context.signal);

      const details = {
        httpUrl,
        expectedHttpsUrl,
        statusCode,
        redirectLocation: location,
      };

      if (statusCode === 0) {
        return warn(
          'security-https-redirect',
          'Could not connect to HTTP version (timeout or network error)',
          details
        );
      }

      // Check if it's a redirect status
      if (statusCode >= 300 && statusCode < 400) {
        if (location) {
          try {
            const locationUrl = new URL(location, httpUrl);
            if (locationUrl.protocol === 'https:') {
              return pass(
                'security-https-redirect',
                `HTTP redirects to HTTPS (${statusCode} -> ${location})`,
                details
              );
            } else {
              return fail(
                'security-https-redirect',
                `HTTP redirects to another HTTP URL instead of HTTPS (${statusCode} -> ${location})`,
                details
              );
            }
          } catch {
            return warn(
              'security-https-redirect',
              `HTTP redirects but location header is invalid: ${location}`,
              details
            );
          }
        }

        return warn(
          'security-https-redirect',
          `HTTP returns redirect status ${statusCode} but no Location header`,
          details
        );
      }

      // If HTTP returns 200, that's a problem
      if (statusCode === 200) {
        return fail(
          'security-https-redirect',
          'HTTP version is accessible without redirecting to HTTPS',
          details
        );
      }

      // Other status codes (4xx, 5xx) - might mean HTTP is blocked
      return warn(
        'security-https-redirect',
        `HTTP version returns status ${statusCode} (expected 301/302 redirect to HTTPS)`,
        details
      );
    } catch (error) {
      rethrowIfAborted(error, context.signal);
      const message = error instanceof Error ? error.message : String(error);
      return fail(
        'security-https-redirect',
        `Failed to check HTTP redirect: ${message}`,
        { url, error: message }
      );
    }
  },
});
