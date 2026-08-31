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
 * Mobile-first parity (require a second render at a mobile viewport, --mobile):
 * - mobile-parity-content: mobile body content matches desktop
 * - mobile-parity-title: title and description match
 * - mobile-parity-canonical: canonical matches
 * - mobile-parity-structured-data: JSON-LD present on mobile as on desktop
 * - mobile-parity-links: comparable internal link count
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
import {
  mobileParityContentRule,
  mobileParityTitleRule,
  mobileParityCanonicalRule,
  mobileParityStructuredDataRule,
  mobileParityLinksRule,
} from './parity.js';

// Export rules
export {
  fontSizeRule,
  horizontalScrollRule,
  interstitialsRule,
  viewportWidthRule,
  multipleViewportsRule,
  mobileParityContentRule,
  mobileParityTitleRule,
  mobileParityCanonicalRule,
  mobileParityStructuredDataRule,
  mobileParityLinksRule,
};

// Register rules
registerRule(fontSizeRule);
registerRule(horizontalScrollRule);
registerRule(interstitialsRule);
registerRule(viewportWidthRule);
registerRule(multipleViewportsRule);
registerRule(mobileParityContentRule);
registerRule(mobileParityTitleRule);
registerRule(mobileParityCanonicalRule);
registerRule(mobileParityStructuredDataRule);
registerRule(mobileParityLinksRule);
