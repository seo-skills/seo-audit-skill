import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Maximum number of GIF URLs to include in details
 */
const MAX_URLS_IN_DETAILS = 5;

/**
 * Rule: Check if page uses GIF images (should use video or WebP)
 *
 * Animated GIFs are significantly larger than modern alternatives.
 * A 10-second GIF can easily be 5-10MB, while an equivalent MP4 video
 * is often under 500KB. WebP animations also offer much better compression.
 * Consider using <video> with MP4/WebM or animated WebP/AVIF instead.
 */
export const videoForAnimationsRule = defineRule({
  id: 'perf-video-for-animations',
  name: 'Video for Animations',
  description: 'Checks if page uses GIF images that should be replaced with video or WebP',
  category: 'perf',
  weight: 4,
  run: (context: AuditContext) => {
    const { $, images } = context;
    const gifUrls: string[] = [];

    // Check images from context (already extracted by the auditor)
    for (const image of images) {
      if (image.src && /\.gif(\?|$)/i.test(image.src)) {
        gifUrls.push(image.src);
      }
    }

    // Also check <source> elements and any images not captured in context.images
    $('source[type="image/gif"]').each((_, el) => {
      const srcset = $(el).attr('srcset') || $(el).attr('src') || '';
      if (srcset && !gifUrls.includes(srcset)) {
        gifUrls.push(srcset);
      }
    });

    // Check for CSS background GIFs in inline styles
    $('[style*=".gif"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const matches = style.match(/url\s*\(\s*['"]?([^'")]+\.gif[^'")]*)/gi) || [];
      for (const match of matches) {
        const urlMatch = match.match(/url\s*\(\s*['"]?([^'")\s]+)/i);
        if (urlMatch && urlMatch[1] && !gifUrls.includes(urlMatch[1])) {
          gifUrls.push(urlMatch[1]);
        }
      }
    });

    const gifCount = gifUrls.length;

    const details: Record<string, unknown> = {
      gifCount,
      gifUrls: gifUrls.slice(0, MAX_URLS_IN_DETAILS),
    };

    if (gifCount > 0) {
      const truncatedNote = gifCount > MAX_URLS_IN_DETAILS
        ? ` (showing first ${MAX_URLS_IN_DETAILS})`
        : '';
      return warn(
        'perf-video-for-animations',
        `Found ${gifCount} GIF image(s)${truncatedNote} — consider using <video> (MP4/WebM) or animated WebP/AVIF for much smaller file sizes`,
        details
      );
    }

    return pass(
      'perf-video-for-animations',
      'No GIF images found — page uses appropriate media formats',
      details
    );
  },
});
