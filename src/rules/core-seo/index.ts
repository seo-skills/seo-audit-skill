/**
 * Core SEO Rules
 *
 * This module exports all core SEO related audit rules and registers them.
 * - Canonical header mismatch detection
 * - Nosnippet directive detection
 * - Robots meta indexing directives
 * - Title uniqueness across site
 */

import { registerRule } from '../registry.js';

import { canonicalHeaderRule } from './canonical-header.js';
import { nosnippetRule } from './nosnippet.js';
import { robotsMetaRule } from './robots-meta.js';
import { titleUniqueRule, resetTitleRegistry, getTitleRegistryStats } from './title-unique.js';

// Export all rules
export {
  canonicalHeaderRule,
  nosnippetRule,
  robotsMetaRule,
  titleUniqueRule,
};

// Export utility functions for title uniqueness tracking
export { resetTitleRegistry, getTitleRegistryStats };

// Register all rules
registerRule(canonicalHeaderRule);
registerRule(nosnippetRule);
registerRule(robotsMetaRule);
registerRule(titleUniqueRule);
