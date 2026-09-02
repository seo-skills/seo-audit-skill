import type { AssetInfo, AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';
import { assetContentLength, partitionBySizeKnown, unsizedReason } from './asset-size.js';

// Reference hints: performance/efficiently-encode-images,
// performance/transferred-image-size-is-over-100kb

/**
 * Thresholds for the image encoding check
 */
const THRESHOLDS = {
  /** Transferred images above 100KB are generally considered large */
  oversizedBytes: 100 * 1024,
  /** How many offending image URLs to list in the result message */
  maxListed: 5,
};

/** Legacy image content types that modern formats (WebP/AVIF) replace */
const LEGACY_CONTENT_TYPES = new Set(['image/bmp', 'image/x-ms-bmp', 'image/tiff']);

/** Legacy image file extensions, checked when content-type is inconclusive */
const LEGACY_EXTENSION = /\.(bmp|tiff?)$/i;

/**
 * Whether an image asset uses a legacy, inefficiently-encoded format
 * (BMP/TIFF). Detected from the content-type header, falling back to the
 * file extension in the URL.
 */
function isLegacyFormat(asset: AssetInfo): boolean {
  const contentType = (asset.headers['content-type'] || '').split(';')[0].trim();
  if (LEGACY_CONTENT_TYPES.has(contentType)) return true;
  return LEGACY_EXTENSION.test(asset.url.split('?')[0]);
}

/**
 * Rule: Check that images are efficiently encoded and reasonably sized
 *
 * Images over 100KB transferred are generally considered large and should be
 * optimized. Legacy formats (BMP, TIFF) are fail-worthy: they are larger than
 * modern equivalents by an order of magnitude and should be replaced with
 * WebP or AVIF. Only images observed during a rendered page load can be
 * checked, so the rule is not measured without render data.
 */
export const imageEncodingRule = defineRule({
  id: 'perf-image-encoding',
  name: 'Efficient Image Encoding',
  description:
    'Checks rendered images for oversized transfers (>100KB) and legacy formats (BMP/TIFF)',
  category: 'perf',
  weight: 6,
  run: (context: AuditContext) => {
    const { assets } = context;

    if (!assets) {
      return notMeasured(
        'perf-image-encoding',
        'Could not measure image encoding — page was not rendered',
        { reason: 'Asset data not available' }
      );
    }

    const images = assets.filter(
      (a) => a.resourceType === 'image' && a.statusCode >= 200 && a.statusCode < 300
    );

    const legacy = images.filter(isLegacyFormat);
    // Only images carrying a content-length can be judged on transfer size.
    const { sized: sizedImages, unsized: unsizedImages } = partitionBySizeKnown(images);
    const oversized = sizedImages
      .filter((a) => (assetContentLength(a) ?? 0) > THRESHOLDS.oversizedBytes)
      .sort((a, b) => (assetContentLength(b) ?? 0) - (assetContentLength(a) ?? 0));

    const details: Record<string, unknown> = {
      imageCount: images.length,
      legacyCount: legacy.length,
      oversizedCount: oversized.length,
      unsizedCount: unsizedImages.length,
      thresholds: THRESHOLDS,
    };

    if (images.length === 0) {
      return pass('perf-image-encoding', 'No images observed during render', details);
    }

    const listUrls = (list: AssetInfo[], withSize: boolean) => {
      const listed = list
        .slice(0, THRESHOLDS.maxListed)
        .map((a) => (withSize ? `${a.url} (${Math.round((assetContentLength(a) ?? 0) / 1024)}KB)` : a.url));
      const suffix = list.length > THRESHOLDS.maxListed ? `, and ${list.length - THRESHOLDS.maxListed} more` : '';
      return listed.join(', ') + suffix;
    };

    if (legacy.length > 0) {
      const oversizedNote =
        oversized.length > 0 ? `; ${oversized.length} image(s) also exceed 100KB: ${listUrls(oversized, true)}` : '';
      return fail(
        'perf-image-encoding',
        `${legacy.length} image(s) use legacy formats (BMP/TIFF) — replace with WebP or AVIF: ${listUrls(legacy, false)}${oversizedNote}`,
        {
          ...details,
          legacy: legacy.map((a) => a.url),
          oversized: oversized.map((a) => a.url),
        }
      );
    }

    if (oversized.length > 0) {
      return warn(
        'perf-image-encoding',
        `${oversized.length} image(s) transferred over 100KB: ${listUrls(oversized, true)}`,
        { ...details, oversized: oversized.map((a) => a.url) }
      );
    }

    // Formats checked out, but transfer size — half of what this rule claims —
    // could not be read for some images, so "reasonably sized" is unearned.
    if (unsizedImages.length > 0) {
      return notMeasured(
        'perf-image-encoding',
        `No legacy image formats found, but transfer size could not be confirmed — ${unsizedReason(unsizedImages.length, 'image')}`,
        { ...details, unsized: unsizedImages.map((a) => a.url) }
      );
    }

    return pass(
      'perf-image-encoding',
      `All ${images.length} image(s) are reasonably sized and use efficient formats`,
      details
    );
  },
});
