import type { AssetInfo, AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hint: performance/serve-static-assets-with-an-efficient-cache-policy

/**
 * Thresholds for the per-asset cache policy check
 */
const THRESHOLDS = {
  /** Static assets should be cacheable for at least one hour */
  minMaxAgeSeconds: 3600,
  /** How many offending asset URLs to list in the result message */
  maxListed: 5,
};

/** Subresource types considered static, cacheable assets */
const STATIC_TYPES = new Set(['stylesheet', 'script', 'image', 'font']);

/**
 * Parse max-age value from a cache-control header string.
 * Returns the numeric value or -1 if not found.
 */
function parseMaxAge(cacheControl: string): number {
  const match = cacheControl.match(/max-age\s*=\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : -1;
}

/**
 * The effective cache lifetime of an asset in seconds, from cache-control.
 * -1 when the asset carries no usable caching directive. The Expires header
 * is intentionally not consulted: without the response's Date header its
 * freshness window cannot be computed, and cache-control is the signal the
 * reference hint checks for.
 */
function cacheLifetimeSeconds(asset: AssetInfo): number {
  const cacheControl = asset.headers['cache-control'];
  if (!cacheControl) return -1;
  return parseMaxAge(cacheControl);
}

/**
 * Rule: Check that static assets are served with an efficient cache policy
 *
 * Stylesheets, scripts, images, and fonts rarely change between deploys, so
 * they should carry a cache-control max-age of at least one hour. Assets
 * without one are re-downloaded on every repeat visit. Only assets observed
 * during a rendered page load can be checked, so the rule is not measured
 * without render data.
 */
export const assetCachePolicyRule = defineRule({
  id: 'perf-asset-cache-policy',
  name: 'Static Asset Cache Policy',
  description:
    'Checks that static assets (CSS, JS, images, fonts) carry a cache-control max-age of at least 1 hour',
  category: 'perf',
  weight: 6,
  run: (context: AuditContext) => {
    const { assets } = context;

    if (!assets) {
      return notMeasured(
        'perf-asset-cache-policy',
        'Could not measure static asset cache policies — page was not rendered',
        { reason: 'Asset data not available' }
      );
    }

    const staticAssets = assets.filter(
      (a) => STATIC_TYPES.has(a.resourceType) && a.statusCode >= 200 && a.statusCode < 300
    );

    const offenders = staticAssets
      .map((a) => ({ url: a.url, maxAge: cacheLifetimeSeconds(a) }))
      .filter((a) => a.maxAge < THRESHOLDS.minMaxAgeSeconds)
      // Worst first: no cache-control at all, then shortest max-age
      .sort((a, b) => a.maxAge - b.maxAge);

    const details: Record<string, unknown> = {
      staticAssetCount: staticAssets.length,
      uncachedCount: offenders.length,
      thresholds: THRESHOLDS,
    };

    if (staticAssets.length === 0) {
      return pass('perf-asset-cache-policy', 'No static assets observed during render', details);
    }

    if (offenders.length > 0) {
      const listed = offenders.slice(0, THRESHOLDS.maxListed).map((o) =>
        o.maxAge < 0 ? `${o.url} (no cache-control)` : `${o.url} (max-age=${o.maxAge}s)`
      );
      const suffix = offenders.length > THRESHOLDS.maxListed ? `, and ${offenders.length - THRESHOLDS.maxListed} more` : '';
      return warn(
        'perf-asset-cache-policy',
        `${offenders.length} of ${staticAssets.length} static asset(s) lack an efficient cache policy: ${listed.join(', ')}${suffix}`,
        { ...details, offenders: offenders.map((o) => o.url) }
      );
    }

    return pass(
      'perf-asset-cache-policy',
      `All ${staticAssets.length} static asset(s) are cacheable for at least ${THRESHOLDS.minMaxAgeSeconds / 3600}h`,
      details
    );
  },
});
