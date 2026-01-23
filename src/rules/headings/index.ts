/**
 * Headings Rules
 *
 * This module exports all headings related audit rules and registers them.
 */

import { registerRule } from '../registry.js';

import { h1PresentRule } from './h1-present.js';
import { h1SingleRule } from './h1-single.js';
import { hierarchyRule } from './hierarchy.js';
import { contentLengthRule } from './content-length.js';
import { contentUniqueRule } from './content-unique.js';
import { langAttributeRule } from './lang-attribute.js';

// Export all rules
export {
  h1PresentRule,
  h1SingleRule,
  hierarchyRule,
  contentLengthRule,
  contentUniqueRule,
  langAttributeRule,
};

// Register all rules
registerRule(h1PresentRule);
registerRule(h1SingleRule);
registerRule(hierarchyRule);
registerRule(contentLengthRule);
registerRule(contentUniqueRule);
registerRule(langAttributeRule);
