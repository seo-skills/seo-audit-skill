/**
 * Security Rules
 *
 * This module exports all security audit rules and registers them.
 */

import { registerRule } from '../registry.js';

import { httpsRule } from './https.js';
import { httpsRedirectRule } from './https-redirect.js';
import { hstsRule } from './hsts.js';
import { cspRule } from './csp.js';
import { xFrameRule } from './x-frame.js';
import { xContentTypeRule } from './x-content-type.js';

// Export all rules
export {
  httpsRule,
  httpsRedirectRule,
  hstsRule,
  cspRule,
  xFrameRule,
  xContentTypeRule,
};

// Register all rules
registerRule(httpsRule);
registerRule(httpsRedirectRule);
registerRule(hstsRule);
registerRule(cspRule);
registerRule(xFrameRule);
registerRule(xContentTypeRule);
