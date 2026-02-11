/**
 * Security Rules
 *
 * This module exports all security audit rules and registers them.
 * Covers HTTPS, security headers, mixed content, leaked secrets,
 * password safety, protocol-relative URLs, and SSL/TLS configuration.
 */

import { registerRule } from '../registry.js';

import { httpsRule } from './https.js';
import { httpsRedirectRule } from './https-redirect.js';
import { hstsRule } from './hsts.js';
import { cspRule } from './csp.js';
import { xFrameRule } from './x-frame.js';
import { xContentTypeRule } from './x-content-type.js';
import { externalLinksSecurityRule } from './external-links.js';
import { formHttpsRule } from './form-https.js';
import { mixedContentRule } from './mixed-content.js';
import { permissionsPolicyRule } from './permissions-policy.js';
import { referrerPolicyRule } from './referrer-policy.js';
import { leakedSecretsRule } from './leaked-secrets.js';

// New security rules
import { passwordHttpRule } from './password-http.js';
import { protocolRelativeRule } from './protocol-relative.js';
import { sslExpiryRule } from './ssl-expiry.js';
import { sslProtocolRule } from './ssl-protocol.js';

// Export all rules
export {
  httpsRule,
  httpsRedirectRule,
  hstsRule,
  cspRule,
  xFrameRule,
  xContentTypeRule,
  externalLinksSecurityRule,
  formHttpsRule,
  mixedContentRule,
  permissionsPolicyRule,
  referrerPolicyRule,
  leakedSecretsRule,
  passwordHttpRule,
  protocolRelativeRule,
  sslExpiryRule,
  sslProtocolRule,
};

// Register all rules
registerRule(httpsRule);
registerRule(httpsRedirectRule);
registerRule(hstsRule);
registerRule(cspRule);
registerRule(xFrameRule);
registerRule(xContentTypeRule);
registerRule(externalLinksSecurityRule);
registerRule(formHttpsRule);
registerRule(mixedContentRule);
registerRule(permissionsPolicyRule);
registerRule(referrerPolicyRule);
registerRule(leakedSecretsRule);
registerRule(passwordHttpRule);
registerRule(protocolRelativeRule);
registerRule(sslExpiryRule);
registerRule(sslProtocolRule);
