/**
 * Legal Compliance rules
 *
 * Legal compliance signals including:
 * - Cookie consent mechanism detection
 *
 * Note: Privacy policy and terms of service rules moved to E-E-A-T category
 */

import { registerRule } from '../registry.js';
import { cookieConsentRule } from './cookie-consent.js';

export { cookieConsentRule };

// Register all legal rules
registerRule(cookieConsentRule);
