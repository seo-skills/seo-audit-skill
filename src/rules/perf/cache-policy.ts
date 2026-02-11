import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Parse max-age value from a cache-control header string.
 * Returns the numeric value or -1 if not found.
 */
function parseMaxAge(cacheControl: string): number {
  const match = cacheControl.match(/max-age\s*=\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : -1;
}

/**
 * Rule: Check HTTP caching headers
 *
 * Proper caching headers reduce server load and improve repeat-visit
 * performance. For HTML documents, short or no caching is often appropriate
 * to ensure users see fresh content. This rule checks for the presence of
 * cache-control, expires, etag, and last-modified headers.
 */
export const cachePolicyRule = defineRule({
  id: 'perf-cache-policy',
  name: 'Cache Policy',
  description: 'Checks HTTP caching headers (cache-control, expires, etag, last-modified)',
  category: 'perf',
  weight: 7,
  run: (context: AuditContext) => {
    const cacheControl = (context.headers['cache-control'] || '').toLowerCase();
    const expires = context.headers['expires'] || '';
    const etag = context.headers['etag'] || '';
    const lastModified = context.headers['last-modified'] || '';

    const hasCacheControl = cacheControl.length > 0;
    const hasExpires = expires.length > 0;
    const hasEtag = etag.length > 0;
    const hasLastModified = lastModified.length > 0;
    const hasAnyCachingHeader = hasCacheControl || hasExpires || hasEtag || hasLastModified;

    const details: Record<string, unknown> = {
      cacheControl: cacheControl || 'not set',
      expires: expires || 'not set',
      etag: etag ? 'present' : 'not set',
      lastModified: lastModified || 'not set',
    };

    if (!hasAnyCachingHeader) {
      return warn(
        'perf-cache-policy',
        'No caching headers found — browsers cannot cache this response efficiently',
        details
      );
    }

    // Explicit no-store or no-cache is acceptable for HTML documents
    if (cacheControl.includes('no-store') || cacheControl.includes('no-cache')) {
      return pass(
        'perf-cache-policy',
        `Cache policy set to "${cacheControl}" — appropriate for dynamic HTML content`,
        details
      );
    }

    // Check for a positive max-age
    if (hasCacheControl) {
      const maxAge = parseMaxAge(cacheControl);
      if (maxAge > 0) {
        return pass(
          'perf-cache-policy',
          `Cache policy configured with max-age=${maxAge}s`,
          { ...details, maxAgeSeconds: maxAge }
        );
      }

      // max-age=0 effectively means no caching — still intentional
      if (maxAge === 0) {
        return pass(
          'perf-cache-policy',
          'Cache-control set with max-age=0 — revalidation required on every request',
          { ...details, maxAgeSeconds: 0 }
        );
      }
    }

    // Has some caching headers (etag, last-modified, expires) but no cache-control max-age
    if (hasEtag || hasLastModified) {
      return pass(
        'perf-cache-policy',
        `Validation caching enabled (${hasEtag ? 'ETag' : ''}${hasEtag && hasLastModified ? ', ' : ''}${hasLastModified ? 'Last-Modified' : ''})`,
        details
      );
    }

    if (hasExpires) {
      return pass(
        'perf-cache-policy',
        `Cache expiry set via Expires header: ${expires}`,
        details
      );
    }

    return warn(
      'perf-cache-policy',
      'Cache-control header present but no effective caching directives found',
      details
    );
  },
});
