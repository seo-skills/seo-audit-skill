/**
 * Meta Tags Rules
 *
 * This module exports all meta tags related audit rules and registers them.
 */

import { registerRule } from '../registry.js';

import { titlePresentRule } from './title-present.js';
import { titleLengthRule } from './title-length.js';
import { descriptionPresentRule } from './description-present.js';
import { descriptionLengthRule } from './description-length.js';
import { canonicalPresentRule } from './canonical-present.js';
import { canonicalValidRule } from './canonical-valid.js';
import { viewportPresentRule } from './viewport-present.js';
import { faviconPresentRule } from './favicon-present.js';

// Export all rules
export {
  titlePresentRule,
  titleLengthRule,
  descriptionPresentRule,
  descriptionLengthRule,
  canonicalPresentRule,
  canonicalValidRule,
  viewportPresentRule,
  faviconPresentRule,
};

// Register all rules
registerRule(titlePresentRule);
registerRule(titleLengthRule);
registerRule(descriptionPresentRule);
registerRule(descriptionLengthRule);
registerRule(canonicalPresentRule);
registerRule(canonicalValidRule);
registerRule(viewportPresentRule);
registerRule(faviconPresentRule);
