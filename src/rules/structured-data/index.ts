/**
 * Structured Data Rules
 *
 * This module exports all structured data related audit rules and registers them.
 * Covers JSON-LD validation, type checking, and required field verification.
 */

import { registerRule } from '../registry.js';

import { structuredDataPresentRule } from './present.js';
import { structuredDataValidRule } from './valid.js';
import { structuredDataTypeRule } from './type.js';
import { structuredDataRequiredFieldsRule } from './required-fields.js';

// Export all rules
export {
  structuredDataPresentRule,
  structuredDataValidRule,
  structuredDataTypeRule,
  structuredDataRequiredFieldsRule,
};

// Register all rules
registerRule(structuredDataPresentRule);
registerRule(structuredDataValidRule);
registerRule(structuredDataTypeRule);
registerRule(structuredDataRequiredFieldsRule);
