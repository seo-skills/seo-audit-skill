/**
 * Performance Rules
 *
 * This module exports all performance audit rules and registers them.
 * Includes:
 * - Core Web Vitals (LCP, CLS, INP, FCP, TTFB)
 * - Static performance hints (DOM size, CSS, fonts, preconnect, render-blocking)
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
