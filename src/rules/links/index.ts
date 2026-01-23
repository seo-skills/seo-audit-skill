/**
 * Links Rules
 *
 * This module exports all links related audit rules and registers them.
 */

import { registerRule } from '../registry.js';

import { brokenInternalRule } from './broken-internal.js';
import { externalValidRule } from './external-valid.js';
import { internalPresentRule } from './internal-present.js';
import { nofollowAppropriateRule } from './nofollow-appropriate.js';
import { anchorTextRule } from './anchor-text.js';
import { depthRule } from './depth.js';

// Export all rules
export {
  brokenInternalRule,
  externalValidRule,
  internalPresentRule,
  nofollowAppropriateRule,
  anchorTextRule,
  depthRule,
};

// Register all rules
registerRule(brokenInternalRule);
registerRule(externalValidRule);
registerRule(internalPresentRule);
registerRule(nofollowAppropriateRule);
registerRule(anchorTextRule);
registerRule(depthRule);
