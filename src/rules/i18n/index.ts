/**
 * Internationalization (i18n) Rules
 *
 * This module exports all internationalization audit rules and registers them.
 * Covers language declarations and multi-region support.
 */

import { registerRule } from '../registry.js';

import { langAttributeRule } from './lang-attribute.js';
import { hreflangRule } from './hreflang.js';

// Export all rules
export { langAttributeRule, hreflangRule };

// Register all rules
registerRule(langAttributeRule);
registerRule(hreflangRule);
