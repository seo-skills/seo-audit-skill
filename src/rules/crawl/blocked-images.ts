import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';
import { RobotsMatcher } from '../../crawler/robots.js';
import { getUserAgent } from '../../crawler/user-agent.js';

// Reference hint: indexability/disallowed-image

/** How many offending image URLs to list in details before truncating. */
const MAX_LISTED = 10;

/**
 * Rule: Blocked Images
 *
 * Flags images on the page whose URLs are disallowed by robots.txt. A
 * disallowed image cannot be crawled, so search engines cannot index it for
 * image search. Unlike `crawl-blocked-resources` (which heuristically flags
 * suspicious Disallow patterns), this rule matches each image URL against the
 * same RFC 9309 matcher the crawler uses, so a hit is definitive.
 *
 * Only same-origin images are evaluated: another host's robots.txt governs
 * its own images.
 */
export const blockedImagesRule = defineRule({
  id: 'crawl-blocked-images',
  name: 'Blocked Images',
  description: 'Flags image URLs that are disallowed by robots.txt',
  category: 'crawl',
  weight: 7,
  run: (context: AuditContext) => {
    if (!context.robotsTxtContent) {
      return notMeasured(
        'crawl-blocked-images',
        'robots.txt was not fetched, so disallow status of image URLs is unknown'
      );
    }

    const matcher = new RobotsMatcher(context.robotsTxtContent, getUserAgent());

    let pageOrigin: string;
    try {
      pageOrigin = new URL(context.url).origin;
    } catch {
      return notMeasured(
        'crawl-blocked-images',
        'Page URL could not be parsed, so image URLs cannot be resolved against it'
      );
    }

    let imageCount = 0;
    const blockedImages: string[] = [];

    for (const image of context.images) {
      if (!image.src) continue;

      let absolute: string;
      try {
        const resolved = new URL(image.src, context.url);
        // Only the site's own robots.txt governs its images.
        if (resolved.origin !== pageOrigin) continue;
        absolute = resolved.href;
      } catch {
        continue;
      }

      imageCount++;
      if (!matcher.isAllowed(absolute)) {
        blockedImages.push(absolute);
      }
    }

    const details = {
      imageCount,
      blockedCount: blockedImages.length,
      blockedImages: blockedImages.slice(0, MAX_LISTED),
    };

    if (blockedImages.length > 0) {
      return fail(
        'crawl-blocked-images',
        `${blockedImages.length} image URL(s) are disallowed by robots.txt`,
        {
          ...details,
          impact:
            'Disallowed images cannot be crawled, so search engines cannot index them for image search.',
          recommendation:
            'Allow the image paths in robots.txt, or serve the images from a path that is not disallowed.',
        }
      );
    }

    return pass(
      'crawl-blocked-images',
      `No images are disallowed by robots.txt (${imageCount} checked)`,
      details
    );
  },
});
