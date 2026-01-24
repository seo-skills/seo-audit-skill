/**
 * Accessibility Rules
 *
 * This module exports all accessibility (a11y) audit rules and registers them.
 * Covers WCAG guidelines for users with disabilities.
 */

import { registerRule } from '../registry.js';

import { ariaLabelsRule } from './aria-labels.js';
import { colorContrastRule } from './color-contrast.js';
import { focusVisibleRule } from './focus-visible.js';
import { formLabelsRule } from './form-labels.js';
import { headingOrderRule } from './heading-order.js';
import { landmarkRegionsRule } from './landmark-regions.js';
import { linkTextRule } from './link-text.js';
import { skipLinkRule } from './skip-link.js';
import { tableHeadersRule } from './table-headers.js';
import { touchTargetsRule } from './touch-targets.js';
import { videoCaptionsRule } from './video-captions.js';
import { zoomDisabledRule } from './zoom-disabled.js';

// Export all rules
export {
  ariaLabelsRule,
  colorContrastRule,
  focusVisibleRule,
  formLabelsRule,
  headingOrderRule,
  landmarkRegionsRule,
  linkTextRule,
  skipLinkRule,
  tableHeadersRule,
  touchTargetsRule,
  videoCaptionsRule,
  zoomDisabledRule,
};

// Register all rules
registerRule(ariaLabelsRule);
registerRule(colorContrastRule);
registerRule(focusVisibleRule);
registerRule(formLabelsRule);
registerRule(headingOrderRule);
registerRule(landmarkRegionsRule);
registerRule(linkTextRule);
registerRule(skipLinkRule);
registerRule(tableHeadersRule);
registerRule(touchTargetsRule);
registerRule(videoCaptionsRule);
registerRule(zoomDisabledRule);
