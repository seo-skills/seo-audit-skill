/**
 * HTML Validation Rules
 *
 * This module exports all HTML validation audit rules and registers them.
 * Includes:
 * - DOCTYPE declaration
 * - Charset declaration
 * - Invalid elements in head
 * - Noscript content validation in head
 * - Multiple head elements
 * - Document size limits
 * - Placeholder text detection
 * - Multiple title elements
 * - Multiple meta description elements
 */

import { registerRule } from '../registry.js';

import { missingDoctypeRule } from './missing-doctype.js';
import { missingCharsetRule } from './missing-charset.js';
import { invalidHeadRule } from './invalid-head.js';
import { noscriptInHeadRule } from './noscript-in-head.js';
import { multipleHeadsRule } from './multiple-heads.js';
import { sizeLimitRule } from './size-limit.js';
import { loremIpsumRule } from './lorem-ipsum.js';
import { multipleTitlesRule } from './multiple-titles.js';
import { multipleDescriptionsRule } from './multiple-descriptions.js';

// Export all rules
export {
  missingDoctypeRule,
  missingCharsetRule,
  invalidHeadRule,
  noscriptInHeadRule,
  multipleHeadsRule,
  sizeLimitRule,
  loremIpsumRule,
  multipleTitlesRule,
  multipleDescriptionsRule,
};

// Register all rules
registerRule(missingDoctypeRule);
registerRule(missingCharsetRule);
registerRule(invalidHeadRule);
registerRule(noscriptInHeadRule);
registerRule(multipleHeadsRule);
registerRule(sizeLimitRule);
registerRule(loremIpsumRule);
registerRule(multipleTitlesRule);
registerRule(multipleDescriptionsRule);
