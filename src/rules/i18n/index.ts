/**
 * Internationalization (i18n) Rules
 *
 * This module exports all internationalization audit rules and registers them.
 * Covers language declarations, hreflang validation, and multi-region support.
 */

import { registerRule } from '../registry.js';

import { langAttributeRule } from './lang-attribute.js';
import { hreflangRule } from './hreflang.js';
import { hreflangReturnLinksRule } from './hreflang-return-links.js';
import { hreflangToNoindexRule } from './hreflang-to-noindex.js';
import { hreflangToNonCanonicalRule } from './hreflang-to-non-canonical.js';
import { hreflangToBrokenRule } from './hreflang-to-broken.js';
import { hreflangToRedirectRule } from './hreflang-to-redirect.js';
import { hreflangConflictingRule } from './hreflang-conflicting.js';
import { hreflangLangMismatchRule } from './hreflang-lang-mismatch.js';
import { hreflangMultipleMethodsRule } from './hreflang-multiple-methods.js';

// Export all rules
export {
  langAttributeRule,
  hreflangRule,
  hreflangReturnLinksRule,
  hreflangToNoindexRule,
  hreflangToNonCanonicalRule,
  hreflangToBrokenRule,
  hreflangToRedirectRule,
  hreflangConflictingRule,
  hreflangLangMismatchRule,
  hreflangMultipleMethodsRule,
};

// Register all rules
registerRule(langAttributeRule);
registerRule(hreflangRule);
registerRule(hreflangReturnLinksRule);
registerRule(hreflangToNoindexRule);
registerRule(hreflangToNonCanonicalRule);
registerRule(hreflangToBrokenRule);
registerRule(hreflangToRedirectRule);
registerRule(hreflangConflictingRule);
registerRule(hreflangLangMismatchRule);
registerRule(hreflangMultipleMethodsRule);
