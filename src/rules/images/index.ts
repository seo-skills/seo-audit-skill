/**
 * Images Rules
 *
 * This module exports all image-related audit rules and registers them.
 */

import { registerRule } from '../registry.js';

import { altPresentRule } from './alt-present.js';
import { altQualityRule } from './alt-quality.js';
import { dimensionsRule } from './dimensions.js';
import { lazyLoadingRule } from './lazy-loading.js';
import { modernFormatRule } from './modern-format.js';
import { sizeRule } from './size.js';
import { responsiveRule } from './responsive.js';

// Export all rules
export {
  altPresentRule,
  altQualityRule,
  dimensionsRule,
  lazyLoadingRule,
  modernFormatRule,
  sizeRule,
  responsiveRule,
};

// Register all rules
registerRule(altPresentRule);
registerRule(altQualityRule);
registerRule(dimensionsRule);
registerRule(lazyLoadingRule);
registerRule(modernFormatRule);
registerRule(sizeRule);
registerRule(responsiveRule);
