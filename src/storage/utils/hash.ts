import * as crypto from 'crypto';

/**
 * Generate a deterministic hash for a URL
 *
 * Uses SHA-256 truncated to 16 characters (64 bits) for:
 * - Sufficient uniqueness for deduplication
 * - Compact storage in indexes
 * - Deterministic results for the same URL
 *
 * @param url - URL to hash
 * @returns 16-character hex string
 */
export function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

/**
 * Generate a unique ID for crawls/audits
 * Format: YYYY-MM-DD-xxxxxx (date + 6 random chars)
 *
 * @returns Unique ID string
 */
export function generateId(): string {
  const date = new Date().toISOString().split('T')[0];
  const randomPart = crypto.randomBytes(3).toString('hex');
  return `${date}-${randomPart}`;
}

/**
 * Normalize a URL for consistent hashing
 *
 * - Removes trailing slashes (except for root)
 * - Lowercases scheme and host
 * - Sorts query parameters
 *
 * @param url - URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Lowercase scheme and host
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Sort query parameters
    const params = new URLSearchParams(parsed.search);
    const sortedParams = new URLSearchParams();
    const keys = Array.from(params.keys()).sort();
    for (const key of keys) {
      const values = params.getAll(key);
      for (const value of values) {
        sortedParams.append(key, value);
      }
    }
    parsed.search = sortedParams.toString();

    // Remove trailing slash (except for root path)
    let href = parsed.href;
    if (href.endsWith('/') && parsed.pathname !== '/') {
      href = href.slice(0, -1);
    }

    return href;
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}
