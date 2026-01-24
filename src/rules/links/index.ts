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
import { deadEndPagesRule } from './dead-end-pages.js';
import { httpsDowngradeRule } from './https-downgrade.js';
import { externalCountRule } from './external-count.js';
import { invalidLinksRule } from './invalid-links.js';
import { telMailtoRule } from './tel-mailto.js';
import { redirectChainsRule } from './redirect-chains.js';
import { orphanPagesRule } from './orphan-pages.js';

// Export all rules
export {
  brokenInternalRule,
  externalValidRule,
  internalPresentRule,
  nofollowAppropriateRule,
  anchorTextRule,
  depthRule,
  deadEndPagesRule,
  httpsDowngradeRule,
  externalCountRule,
  invalidLinksRule,
  telMailtoRule,
  redirectChainsRule,
  orphanPagesRule,
};

// Register all rules
registerRule(brokenInternalRule);
registerRule(externalValidRule);
registerRule(internalPresentRule);
registerRule(nofollowAppropriateRule);
registerRule(anchorTextRule);
registerRule(depthRule);
registerRule(deadEndPagesRule);
registerRule(httpsDowngradeRule);
registerRule(externalCountRule);
registerRule(invalidLinksRule);
registerRule(telMailtoRule);
registerRule(redirectChainsRule);
registerRule(orphanPagesRule);
