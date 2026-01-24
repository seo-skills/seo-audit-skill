/**
 * Legal Compliance rules
 *
 * Privacy policy and legal compliance signals including:
 * - Cookie consent mechanism detection
 * - Privacy policy link presence
 * - Terms of service link presence
 */

import { registerRule } from '../registry.js';
import { cookieConsentRule } from './cookie-consent.js';
import { privacyPolicyRule } from './privacy-policy.js';
import { termsOfServiceRule } from './terms-of-service.js';

export { cookieConsentRule, privacyPolicyRule, termsOfServiceRule };

// Register all legal rules
registerRule(cookieConsentRule);
registerRule(privacyPolicyRule);
registerRule(termsOfServiceRule);
