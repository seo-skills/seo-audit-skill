/**
 * Performance Rules
 *
 * Static analysis for performance optimization hints.
 * Complements Core Web Vitals (real browser measurements) with
 * preventive checks that identify optimization opportunities.
 *
 * These rules analyze the HTML/CSS/JS structure without requiring
 * browser execution, providing actionable recommendations to
 * improve LCP, CLS, FCP, and overall page speed.
 */

import { registerRule } from '../registry.js';

import { domSizeRule } from './dom-size.js';
import { cssFileSizeRule } from './css-file-size.js';
import { fontLoadingRule } from './font-loading.js';
import { preconnectRule } from './preconnect.js';
import { renderBlockingRule } from './render-blocking.js';
import { lazyAboveFoldRule } from './lazy-above-fold.js';
import { lcpHintsRule } from './lcp-hints.js';

// Export all rules
export {
  domSizeRule,
  cssFileSizeRule,
  fontLoadingRule,
  preconnectRule,
  renderBlockingRule,
  lazyAboveFoldRule,
  lcpHintsRule,
};

// Register all rules
registerRule(domSizeRule);
registerRule(cssFileSizeRule);
registerRule(fontLoadingRule);
registerRule(preconnectRule);
registerRule(renderBlockingRule);
registerRule(lazyAboveFoldRule);
registerRule(lcpHintsRule);
