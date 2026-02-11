/**
 * Performance Rules
 *
 * This module exports all performance audit rules and registers them.
 * Includes:
 * - Core Web Vitals (LCP, CLS, INP, FCP, TTFB)
 * - Static performance hints (DOM size, CSS, fonts, preconnect, render-blocking)
 * - Compression (text compression, Brotli)
 * - Caching (cache policy)
 * - Minification (inline CSS, inline JS)
 * - Network (response time, HTTP/2+)
 * - Page weight (HTML size, inline JS size)
 * - Media (video for animations)
 */

import { registerRule } from '../registry.js';

// Core Web Vitals
import { lcpRule } from './lcp.js';
import { clsRule } from './cls.js';
import { inpRule } from './inp.js';
import { ttfbRule } from './ttfb.js';
import { fcpRule } from './fcp.js';

// Performance hints
import { domSizeRule } from './dom-size.js';
import { cssFileSizeRule } from './css-file-size.js';
import { fontLoadingRule } from './font-loading.js';
import { preconnectRule } from './preconnect.js';
import { renderBlockingRule } from './render-blocking.js';
import { lazyAboveFoldRule } from './lazy-above-fold.js';
import { lcpHintsRule } from './lcp-hints.js';

// Compression
import { textCompressionRule } from './text-compression.js';
import { brotliRule } from './brotli.js';

// Caching
import { cachePolicyRule } from './cache-policy.js';

// Minification
import { minifyCssRule } from './minify-css.js';
import { minifyJsRule } from './minify-js.js';

// Network
import { responseTimeRule } from './response-time.js';
import { http2Rule } from './http2.js';

// Page weight
import { pageWeightRule } from './page-weight.js';
import { jsFileSizeRule } from './js-file-size.js';

// Media
import { videoForAnimationsRule } from './video-for-animations.js';

// Export all rules
export {
  // Core Web Vitals
  lcpRule,
  clsRule,
  inpRule,
  ttfbRule,
  fcpRule,
  // Performance hints
  domSizeRule,
  cssFileSizeRule,
  fontLoadingRule,
  preconnectRule,
  renderBlockingRule,
  lazyAboveFoldRule,
  lcpHintsRule,
  // Compression
  textCompressionRule,
  brotliRule,
  // Caching
  cachePolicyRule,
  // Minification
  minifyCssRule,
  minifyJsRule,
  // Network
  responseTimeRule,
  http2Rule,
  // Page weight
  pageWeightRule,
  jsFileSizeRule,
  // Media
  videoForAnimationsRule,
};

// Register all rules
registerRule(lcpRule);
registerRule(clsRule);
registerRule(inpRule);
registerRule(ttfbRule);
registerRule(fcpRule);
registerRule(domSizeRule);
registerRule(cssFileSizeRule);
registerRule(fontLoadingRule);
registerRule(preconnectRule);
registerRule(renderBlockingRule);
registerRule(lazyAboveFoldRule);
registerRule(lcpHintsRule);
registerRule(textCompressionRule);
registerRule(brotliRule);
registerRule(cachePolicyRule);
registerRule(minifyCssRule);
registerRule(minifyJsRule);
registerRule(responseTimeRule);
registerRule(http2Rule);
registerRule(pageWeightRule);
registerRule(jsFileSizeRule);
registerRule(videoForAnimationsRule);
