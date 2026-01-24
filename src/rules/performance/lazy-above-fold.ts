import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Number of images considered "above the fold"
 * These should NOT use lazy loading
 */
const ABOVE_FOLD_COUNT = 3;

interface LazyAboveFoldAnalysis {
  aboveFoldImages: Array<{
    src: string;
    isLazy: boolean;
    hasFetchPriority: boolean;
    fetchPriority: string | null;
  }>;
  firstImageLazy: boolean;
  lazyAboveFoldCount: number;
}

/**
 * Analyze above-fold images for lazy loading anti-pattern
 */
function analyzeLazyAboveFold($: AuditContext['$']): LazyAboveFoldAnalysis {
  const aboveFoldImages: LazyAboveFoldAnalysis['aboveFoldImages'] = [];
  let firstImageLazy = false;
  let lazyAboveFoldCount = 0;

  // Get first N images (considered above fold)
  $('img').slice(0, ABOVE_FOLD_COUNT).each((index, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    const loading = $(el).attr('loading');
    const fetchPriority = $(el).attr('fetchpriority');
    const isLazy = loading === 'lazy';

    aboveFoldImages.push({
      src,
      isLazy,
      hasFetchPriority: !!fetchPriority,
      fetchPriority: fetchPriority || null,
    });

    if (isLazy) {
      lazyAboveFoldCount++;
      if (index === 0) {
        firstImageLazy = true;
      }
    }
  });

  return {
    aboveFoldImages,
    firstImageLazy,
    lazyAboveFoldCount,
  };
}

/**
 * Rule: Detect lazy loading on above-fold images
 *
 * Lazy loading above-fold images delays their loading and hurts LCP.
 * The first 3 images (assumed above-fold) should:
 * - NOT have loading="lazy"
 * - Optionally have fetchpriority="high" for the hero image
 */
export const lazyAboveFoldRule = defineRule({
  id: 'perf-lazy-above-fold',
  name: 'Lazy Loading Above Fold',
  description: 'Detects lazy loading on above-fold images that should load immediately',
  category: 'performance',
  weight: 15,
  run: (context: AuditContext) => {
    const { images } = context;

    // No images on page
    if (images.length === 0) {
      return pass('perf-lazy-above-fold', 'No images found on page', {
        aboveFoldImages: [],
        totalImages: 0,
      });
    }

    // Use context.images with isLazyLoaded property
    const aboveFoldImages = images.slice(0, ABOVE_FOLD_COUNT);
    const lazyAboveFold = aboveFoldImages.filter((img) => img.isLazyLoaded);
    const firstImageLazy = aboveFoldImages[0]?.isLazyLoaded ?? false;

    const details = {
      aboveFoldImages: aboveFoldImages.map((img) => ({
        src: img.src,
        isLazy: img.isLazyLoaded,
      })),
      lazyAboveFoldCount: lazyAboveFold.length,
      firstImageLazy,
      totalImages: images.length,
      aboveFoldThreshold: ABOVE_FOLD_COUNT,
    };

    // First/hero image is lazy loaded - fail
    if (firstImageLazy) {
      return fail(
        'perf-lazy-above-fold',
        `Hero image has loading="lazy" - this delays LCP`,
        details
      );
    }

    // Some above-fold images are lazy loaded - warn
    if (lazyAboveFold.length > 0) {
      return warn(
        'perf-lazy-above-fold',
        `${lazyAboveFold.length} above-fold image(s) have loading="lazy"`,
        details
      );
    }

    // All good
    const message =
      aboveFoldImages.length < ABOVE_FOLD_COUNT
        ? `${aboveFoldImages.length} image(s) correctly without lazy loading`
        : `First ${ABOVE_FOLD_COUNT} images correctly without lazy loading`;

    return pass('perf-lazy-above-fold', message, details);
  },
});
