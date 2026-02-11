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
