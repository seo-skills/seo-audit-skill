import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';
import { urlServiceFor } from '../../net/url-service.js';
import type { ImageSizingEntry } from '../../render/image-sizing.js';

const ID = 'images-oversized-delivery';
/** Judged at a 2x screen: an image sharp on a high-density display is not waste */
const PIXEL_RATIO = 2;
/** Below this an image's waste is not worth a line */
const FLAG_BYTES = 4 * 1024;
/** Total waste that fails the page */
const FAIL_BYTES = 200 * 1024;
const LISTED = 10;

interface Oversized {
  url: string;
  natural: string;
  displayed: string;
  bytes: number;
  wasteBytes: number;
}

const kib = (bytes: number) => `${Math.round(bytes / 1024)} KiB`;

/** An image's size in bytes: from the render's own record, else one HEAD per run */
async function imageBytes(context: AuditContext, url: string): Promise<number | null> {
  const asset = context.assets?.find((a) => a.url === url);
  const length = asset?.headers?.['content-length'];
  if (length !== undefined && /^\d+$/.test(length.trim())) return Number(length);
  if (!/^https?:/i.test(url)) return null;
  const info = await urlServiceFor(context).status(url);
  return info.status === 0 ? null : info.contentLength;
}

/**
 * Rule: images are not served much larger than they are shown
 *
 * A 2000 px photo shown in a 200 px box downloads a hundred times the pixels
 * the page needs. Each image resource is judged by the largest box it is shown
 * in, at a 2x pixel ratio; the estimated waste is the share of its bytes
 * holding pixels nobody sees.
 */
export const oversizedDeliveryRule = defineRule({
  id: ID,
  name: 'Images Sized For Display',
  description: 'Compares each image with the size it is displayed at and estimates the bytes wasted',
  category: 'images',
  weight: 5,
  advisory: true,
  requiresRender: true,
  run: async (context: AuditContext) => {
    const entries = context.probes?.['imageSizing'] as ImageSizingEntry[] | undefined;
    if (!Array.isArray(entries)) {
      return notMeasured(ID, 'The render did not report image sizes', undefined, 'probe-failed');
    }
    if (entries.length === 0) {
      return notMeasured(ID, 'No displayed images on this page', undefined, 'not-applicable');
    }

    // One resource can be shown several times; the largest box decides
    const byUrl = new Map<string, ImageSizingEntry>();
    for (const entry of entries) {
      const known = byUrl.get(entry.src);
      if (!known || entry.width * entry.height > known.width * known.height) byUrl.set(entry.src, entry);
    }

    const oversized: Oversized[] = [];
    let unknownSize = 0;
    for (const entry of byUrl.values()) {
      const needed = entry.width * entry.height * PIXEL_RATIO * PIXEL_RATIO;
      const natural = entry.naturalWidth * entry.naturalHeight;
      if (natural <= needed) continue;
      const bytes = await imageBytes(context, entry.src);
      if (bytes === null) {
        unknownSize++;
        continue;
      }
      const wasteBytes = Math.round(bytes * (1 - needed / natural));
      if (wasteBytes > FLAG_BYTES) {
        oversized.push({
          url: entry.src,
          natural: `${entry.naturalWidth}×${entry.naturalHeight}`,
          displayed: `${entry.width}×${entry.height}`,
          bytes,
          wasteBytes,
        });
      }
    }

    oversized.sort((a, b) => b.wasteBytes - a.wasteBytes);
    const total = oversized.reduce((sum, image) => sum + image.wasteBytes, 0);
    const details = {
      imagesChecked: byUrl.size,
      ...(unknownSize > 0 && { sizeUnknown: unknownSize }),
      ...(oversized.length > 0 && { oversizedCount: oversized.length, totalWasteBytes: total, oversized: oversized.slice(0, LISTED) }),
    };
    if (oversized.length === 0) {
      return pass(ID, `${byUrl.size} image(s) are served at about the size they are shown`, details);
    }
    const message = `${oversized.length} image(s) are larger than they are shown, wasting about ${kib(total)}`;
    const withFix = {
      ...details,
      recommendation: 'Serve each image at most twice its displayed size, with srcset for the sizes the layout uses.',
    };
    return total > FAIL_BYTES ? fail(ID, message, withFix) : warn(ID, message, withFix);
  },
});
