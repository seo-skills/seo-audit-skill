/**
 * Redirect Rules
 *
 * This module exports all redirect audit rules and registers them.
 * Includes:
 * - Meta refresh redirect detection
 * - JavaScript redirect detection
 * - HTTP Refresh header detection
 * - Redirect loop detection
 * - Redirect type validation (permanent vs temporary)
 * - Broken redirect detection
 * - HTTP resource redirect detection on HTTPS pages
 * - URL case normalization checks
 * - Broken resource redirect detection (redirected assets ending in 4xx/5xx)
 * - Resource redirect loop detection
 * - Multi-hop resource redirect chain detection
 */

import { registerRule } from '../registry.js';

// Redirect rules
import { metaRefreshRule } from './meta-refresh.js';
import { javascriptRedirectRule } from './javascript.js';
import { httpRefreshRule } from './http-refresh.js';
import { redirectLoopRule } from './loop.js';
import { redirectTypeRule } from './type.js';
import { brokenRedirectRule } from './broken.js';
import { resourceRedirectRule } from './resource.js';
import { caseNormalizationRule } from './case-normalization.js';
import { resourceBrokenRedirectRule } from './resource-broken.js';
import { resourceLoopRedirectRule } from './resource-loop.js';
import { resourceChainRedirectRule } from './resource-chain.js';

// Export all rules
export {
  metaRefreshRule,
  javascriptRedirectRule,
  httpRefreshRule,
  redirectLoopRule,
  redirectTypeRule,
  brokenRedirectRule,
  resourceRedirectRule,
  caseNormalizationRule,
  resourceBrokenRedirectRule,
  resourceLoopRedirectRule,
  resourceChainRedirectRule,
};

// Register all rules
registerRule(metaRefreshRule);
registerRule(javascriptRedirectRule);
registerRule(httpRefreshRule);
registerRule(redirectLoopRule);
registerRule(redirectTypeRule);
registerRule(brokenRedirectRule);
registerRule(resourceRedirectRule);
registerRule(caseNormalizationRule);
registerRule(resourceBrokenRedirectRule);
registerRule(resourceLoopRedirectRule);
registerRule(resourceChainRedirectRule);
