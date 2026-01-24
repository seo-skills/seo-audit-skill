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
import { brokenRule } from './broken.js';
import { figureCaptionsRule } from './figure-captions.js';
import { filenameQualityRule } from './filename-quality.js';
import { inlineSvgSizeRule } from './inline-svg-size.js';
import { pictureElementRule } from './picture-element.js';

// Export all rules
export {
  altPresentRule,
  altQualityRule,
  dimensionsRule,
  lazyLoadingRule,
  modernFormatRule,
  sizeRule,
  responsiveRule,
  brokenRule,
  figureCaptionsRule,
  filenameQualityRule,
  inlineSvgSizeRule,
  pictureElementRule,
};

// Register all rules
registerRule(altPresentRule);
registerRule(altQualityRule);
registerRule(dimensionsRule);
registerRule(lazyLoadingRule);
registerRule(modernFormatRule);
registerRule(sizeRule);
registerRule(responsiveRule);
registerRule(brokenRule);
registerRule(figureCaptionsRule);
registerRule(filenameQualityRule);
registerRule(inlineSvgSizeRule);
registerRule(pictureElementRule);
