import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface LcpCandidate {
  type: 'image' | 'background' | 'video-poster';
  element: string;
  src: string;
  hasPreload: boolean;
  hasFetchPriority: boolean;
  fetchPriority: string | null;
  isLazyLoaded: boolean;
}

interface LcpAnalysis {
  candidate: LcpCandidate | null;
  preloadedImages: string[];
  hasAnyLcpOptimization: boolean;
}

/**
 * Identify likely LCP candidate and check optimizations
 */
function analyzeLcpHints($: AuditContext['$']): LcpAnalysis {
  const preloadedImages: string[] = [];
  let candidate: LcpCandidate | null = null;

  // Collect preloaded images
  $('link[rel="preload"][as="image"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      preloadedImages.push(href);
    }
  });

  // Heuristics to identify LCP candidate
  // 1. Look for hero image patterns
  const heroSelectors = [
    'img.hero',
    'img.banner',
    '.hero img',
    '.banner img',
    'header img',
    '[class*="hero"] img',
    '[class*="banner"] img',
    'main > img:first-child',
    'main > figure:first-child img',
    'main > section:first-child img',
  ];

  for (const selector of heroSelectors) {
    const $hero = $(selector).first();
    if ($hero.length) {
      const src = $hero.attr('src') || '';
      const fetchPriority = $hero.attr('fetchpriority');
      const loading = $hero.attr('loading');

      candidate = {
        type: 'image',
        element: selector,
        src,
        hasPreload: preloadedImages.includes(src),
        hasFetchPriority: fetchPriority === 'high',
        fetchPriority: fetchPriority || null,
        isLazyLoaded: loading === 'lazy',
      };
      break;
    }
  }

  // 2. Fallback: first large image (likely hero)
  if (!candidate) {
    const $firstImg = $('img').first();
    if ($firstImg.length) {
      const src = $firstImg.attr('src') || '';
      const fetchPriority = $firstImg.attr('fetchpriority');
      const loading = $firstImg.attr('loading');

      // Check for size hints (width/height attributes or class names)
      const width = parseInt($firstImg.attr('width') || '0', 10);
      const height = parseInt($firstImg.attr('height') || '0', 10);
      const isLarge = width > 400 || height > 300;
      const className = $firstImg.attr('class') || '';
      const hasLargeClass = /hero|banner|featured|cover|main/i.test(className);

      if (isLarge || hasLargeClass || !width) {
        // If no size specified, assume first image is LCP
        candidate = {
          type: 'image',
          element: 'img:first',
          src,
          hasPreload: preloadedImages.includes(src),
          hasFetchPriority: fetchPriority === 'high',
          fetchPriority: fetchPriority || null,
          isLazyLoaded: loading === 'lazy',
        };
      }
    }
  }

  // 3. Check for video poster (can be LCP)
  if (!candidate) {
    const $video = $('video[poster]').first();
    if ($video.length) {
      const poster = $video.attr('poster') || '';
      candidate = {
        type: 'video-poster',
        element: 'video[poster]',
        src: poster,
        hasPreload: preloadedImages.includes(poster),
        hasFetchPriority: false,
        fetchPriority: null,
        isLazyLoaded: false,
      };
    }
  }

  const hasAnyLcpOptimization =
    preloadedImages.length > 0 || (candidate?.hasFetchPriority ?? false);

  return {
    candidate,
    preloadedImages,
    hasAnyLcpOptimization,
  };
}

/**
 * Rule: Check LCP optimization hints
 *
 * The Largest Contentful Paint (LCP) element should be prioritized:
 * - Preload the LCP image: <link rel="preload" as="image" href="...">
 * - Add fetchpriority="high" to the LCP image
 * - Never lazy-load the LCP element
 */
export const lcpHintsRule = defineRule({
  id: 'perf-lcp-hints',
  name: 'LCP Optimization Hints',
  description: 'Checks for Largest Contentful Paint optimization (preload, fetchpriority)',
  category: 'perf',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;
    const analysis = analyzeLcpHints($);

    const details = {
      candidate: analysis.candidate,
      preloadedImages: analysis.preloadedImages.slice(0, 5),
      hasAnyOptimization: analysis.hasAnyLcpOptimization,
    };

    // No LCP candidate identified
    if (!analysis.candidate) {
      // Check if there are any preloaded images (good practice even without detection)
      if (analysis.preloadedImages.length > 0) {
        return pass(
          'perf-lcp-hints',
          `${analysis.preloadedImages.length} image(s) preloaded`,
          details
        );
      }
      return pass('perf-lcp-hints', 'No clear LCP image candidate detected', details);
    }

    const candidate = analysis.candidate;
    const issues: string[] = [];

    // Critical: LCP is lazy loaded
    if (candidate.isLazyLoaded) {
      return fail(
        'perf-lcp-hints',
        `LCP candidate (${candidate.element}) has loading="lazy" - this severely impacts LCP`,
        details
      );
    }

    // Check for optimizations
    if (!candidate.hasPreload && !candidate.hasFetchPriority) {
      issues.push('no preload or fetchpriority');
    } else if (!candidate.hasPreload) {
      issues.push('missing preload');
    } else if (!candidate.hasFetchPriority) {
      issues.push('missing fetchpriority="high"');
    }

    if (issues.length > 0) {
      return warn(
        'perf-lcp-hints',
        `LCP candidate (${candidate.element}) could be optimized: ${issues.join(', ')}`,
        details
      );
    }

    return pass(
      'perf-lcp-hints',
      `LCP candidate (${candidate.element}) is optimized with preload and fetchpriority`,
      details
    );
  },
});
