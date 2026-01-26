/**
 * E-E-A-T (Experience, Expertise, Authority, Trust) Rules
 *
 * This module exports all E-E-A-T audit rules and registers them.
 * - About page presence
 * - Affiliate disclosure
 * - Author bylines
 * - Author expertise indicators
 * - Citations to authoritative sources
 * - Contact page with methods
 * - Content dates (published/modified)
 * - Disclaimers for YMYL content
 * - Editorial policy
 * - Physical address
 * - Privacy policy
 * - Terms of service
 * - Trust signals (badges, reviews, certifications)
 * - YMYL content detection
 */

import { registerRule } from '../registry.js';

import { aboutPageRule } from './about-page.js';
import { affiliateDisclosureRule } from './affiliate-disclosure.js';
import { authorBylineRule } from './author-byline.js';
import { authorExpertiseRule } from './author-expertise.js';
import { citationsRule } from './citations.js';
import { contactPageRule } from './contact-page.js';
import { contentDatesRule } from './content-dates.js';
import { disclaimersRule } from './disclaimers.js';
import { editorialPolicyRule } from './editorial-policy.js';
import { physicalAddressRule } from './physical-address.js';
import { privacyPolicyRule } from './privacy-policy.js';
import { termsOfServiceRule } from './terms-of-service.js';
import { trustSignalsRule } from './trust-signals.js';
import { ymylDetectionRule, detectYMYL, YMYL_CATEGORIES } from './ymyl-detection.js';

// Export all rules
export {
  aboutPageRule,
  affiliateDisclosureRule,
  authorBylineRule,
  authorExpertiseRule,
  citationsRule,
  contactPageRule,
  contentDatesRule,
  disclaimersRule,
  editorialPolicyRule,
  physicalAddressRule,
  privacyPolicyRule,
  termsOfServiceRule,
  trustSignalsRule,
  ymylDetectionRule,
};

// Export YMYL detection utility for use by other rules
export { detectYMYL, YMYL_CATEGORIES };
export type { YMYLDetectionResult } from './ymyl-detection.js';

// Register all rules
registerRule(aboutPageRule);
registerRule(affiliateDisclosureRule);
registerRule(authorBylineRule);
registerRule(authorExpertiseRule);
registerRule(citationsRule);
registerRule(contactPageRule);
registerRule(contentDatesRule);
registerRule(disclaimersRule);
registerRule(editorialPolicyRule);
registerRule(physicalAddressRule);
registerRule(privacyPolicyRule);
registerRule(termsOfServiceRule);
registerRule(trustSignalsRule);
registerRule(ymylDetectionRule);
