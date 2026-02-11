/**
 * Mobile Rules
 *
 * Mobile-friendliness and responsive design checks.
 * Ensures pages are optimized for mobile users.
 *
 * Rules:
 * - mobile-font-size: Checks for readable font sizes on mobile
 * - mobile-horizontal-scroll: Detects elements causing horizontal scroll
 * - mobile-interstitials: Detects intrusive popups and overlays
 * - mobile-viewport-width: Detects fixed viewport width instead of device-width
 * - mobile-multiple-viewports: Detects multiple viewport meta tags
 *
 * Note: Some mobile checks are in other categories:
 * - Viewport meta tag: meta-tags-viewport-present
 * - Viewport zoom: a11y-zoom-disabled
 * - Touch targets: a11y-touch-targets
 */

import { registerRule } from '../registry.js';
import { fontSizeRule } from './font-size.js';
import { horizontalScrollRule } from './horizontal-scroll.js';
import { interstitialsRule } from './interstitials.js';
import { viewportWidthRule } from './viewport-width.js';
import { multipleViewportsRule } from './multiple-viewports.js';

// Export rules
export {
  fontSizeRule,
  horizontalScrollRule,
  interstitialsRule,
  viewportWidthRule,
  multipleViewportsRule,
};

// Register rules
registerRule(fontSizeRule);
registerRule(horizontalScrollRule);
registerRule(interstitialsRule);
registerRule(viewportWidthRule);
registerRule(multipleViewportsRule);
