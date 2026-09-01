import type { AssetInfo, AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hint: performance/enable-text-compression

/**
 * Thresholds for the per-asset text compression check
 */
const THRESHOLDS = {
  /** Text assets below this size gain little from compression */
  minSizeBytes: 2048,
  /** How many offending asset URLs to list in the result message */
  maxListed: 5,
};

/**
 * Whether an asset is text-based and therefore benefits from gzip/brotli.
 * Stylesheets and scripts by resource type, plus anything served with a
 * text-like content type (covers JSON, XML, SVG fetched as other types).
 */
function isTextAsset(asset: AssetInfo): boolean {
  if (asset.resourceType === 'stylesheet' || asset.resourceType === 'script') return true;
  const contentType = asset.headers['content-type'] || '';
  return contentType.startsWith('text/') || /javascript|json|xml|svg/.test(contentType);
}

/**
 * Whether the response was served compressed. `content-length` reflects the
 * compressed size in that case, so an uncompressed reading is only trusted
 * when no content-encoding is present.
 */
function isCompressed(asset: AssetInfo): boolean {
  const encoding = asset.headers['content-encoding'] || '';
  return /gzip|br|deflate|zstd/i.test(encoding);
}

/**
 * Encoded size from the content-length header, or -1 when absent
 * (chunked responses carry none).
 */
function contentLength(asset: AssetInfo): number {
  const raw = asset.headers['content-length'];
  if (!raw) return -1;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}

/**
 * Rule: Check that text-based assets are served with compression
 *
 * Text resources (CSS, JavaScript, JSON, SVG) compress well and should be
 * served with gzip or Brotli. Assets observed uncompressed above 2KB waste
 * bandwidth on every load. Only assets observed during a rendered page load
 * can be checked, so the rule is not measured without render data.
 */
export const assetCompressionRule = defineRule({
  id: 'perf-asset-compression',
  name: 'Text Asset Compression',
  description:
    'Checks that text-based assets over 2KB are served with gzip or Brotli compression',
  category: 'perf',
  weight: 6,
  run: (context: AuditContext) => {
    const { assets } = context;

    if (!assets) {
      return notMeasured(
        'perf-asset-compression',
        'Could not measure text compression of assets — page was not rendered',
        { reason: 'Asset data not available' }
      );
    }

    const uncompressed = assets
      .filter(
        (a) =>
          a.statusCode >= 200 &&
          a.statusCode < 300 &&
          isTextAsset(a) &&
          !isCompressed(a) &&
          contentLength(a) > THRESHOLDS.minSizeBytes
      )
      .sort((a, b) => contentLength(b) - contentLength(a));

    const details: Record<string, unknown> = {
      assetCount: assets.length,
      uncompressedCount: uncompressed.length,
      thresholds: THRESHOLDS,
    };

    if (uncompressed.length > 0) {
      const listed = uncompressed
        .slice(0, THRESHOLDS.maxListed)
        .map((a) => `${a.url} (${contentLength(a)} bytes)`);
      const suffix =
        uncompressed.length > THRESHOLDS.maxListed
          ? `, and ${uncompressed.length - THRESHOLDS.maxListed} more`
          : '';
      return warn(
        'perf-asset-compression',
        `${uncompressed.length} text asset(s) served without compression: ${listed.join(', ')}${suffix}`,
        { ...details, uncompressed: uncompressed.map((a) => a.url) }
      );
    }

    return pass(
      'perf-asset-compression',
      'All sizable text assets are served with compression',
      details
    );
  },
});
