import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Maximum uncompressed sitemap size in bytes (50 MB)
 */
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Warning threshold in bytes (40 MB)
 */
const WARN_SIZE_BYTES = 40 * 1024 * 1024;

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} bytes`;
}

/**
 * Rule: Sitemap Size Limit
 *
 * Validates that a sitemap file does not exceed the 50 MB uncompressed
 * size limit defined in the Sitemaps protocol specification. Oversized
 * sitemaps will be rejected by search engines.
 */
export const sitemapSizeLimitRule = defineRule({
  id: 'crawl-sitemap-size-limit',
  name: 'Sitemap Size Limit',
  description: 'Checks if sitemap exceeds the 50 MB uncompressed size limit',
  category: 'crawl',
  weight: 5,
  run: async (context: AuditContext) => {
    const sitemapContent = (context as any).sitemapContent as string | undefined;

    if (!sitemapContent) {
      return pass(
        'crawl-sitemap-size-limit',
        'No sitemap content available to check',
        { sitemapAvailable: false }
      );
    }

    const sizeBytes = Buffer.byteLength(sitemapContent, 'utf8');

    const details = {
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      maxSizeBytes: MAX_SIZE_BYTES,
      maxSizeFormatted: formatBytes(MAX_SIZE_BYTES),
    };

    if (sizeBytes > MAX_SIZE_BYTES) {
      return fail(
        'crawl-sitemap-size-limit',
        `Sitemap is ${formatBytes(sizeBytes)}, exceeding the 50 MB limit`,
        {
          ...details,
          impact: 'Search engines will reject sitemaps exceeding 50 MB uncompressed',
          recommendation: 'Split the sitemap into multiple smaller files using a sitemap index',
        }
      );
    }

    if (sizeBytes > WARN_SIZE_BYTES) {
      return warn(
        'crawl-sitemap-size-limit',
        `Sitemap is ${formatBytes(sizeBytes)}, approaching the 50 MB limit`,
        {
          ...details,
          recommendation: 'Consider splitting into multiple sitemaps before reaching the limit',
        }
      );
    }

    return pass(
      'crawl-sitemap-size-limit',
      `Sitemap size is ${formatBytes(sizeBytes)} (within 50 MB limit)`,
      details
    );
  },
});
