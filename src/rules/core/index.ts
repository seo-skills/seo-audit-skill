/**
 * Core Rules
 *
 * This module exports all core SEO audit rules and registers them.
 * Includes:
 * - Meta tags (title, description, canonical, viewport, favicon)
 * - H1 heading checks
 * - Indexing directives (robots meta, nosnippet)
 * - Canonical header validation
 * - Canonical conflict, protocol, loop, and homepage checks
 * - Title uniqueness
 */

import { registerRule } from '../registry.js';

// Meta tags rules
import { titlePresentRule } from './title-present.js';
import { titleLengthRule } from './title-length.js';
import { descriptionPresentRule } from './description-present.js';
import { descriptionLengthRule } from './description-length.js';
import { canonicalPresentRule } from './canonical-present.js';
import { canonicalValidRule } from './canonical-valid.js';
import { viewportPresentRule } from './viewport-present.js';
import { faviconPresentRule } from './favicon-present.js';

// H1 rules
import { h1PresentRule } from './h1-present.js';
import { h1SingleRule } from './h1-single.js';

// Core SEO rules
import { canonicalHeaderRule } from './canonical-header.js';
import { nosnippetRule } from './nosnippet.js';
import { robotsMetaRule } from './robots-meta.js';
import { titleUniqueRule, resetTitleRegistry, getTitleRegistryStats } from './title-unique.js';

// Canonical validation rules
import { canonicalConflictingRule } from './canonical-conflicting.js';
import { canonicalToHomepageRule } from './canonical-to-homepage.js';
import { canonicalHttpMismatchRule } from './canonical-http-mismatch.js';
import { canonicalLoopRule } from './canonical-loop.js';
import { canonicalToNoindexRule } from './canonical-to-noindex.js';

// Export all rules
export {
  // Meta tags
  titlePresentRule,
  titleLengthRule,
  descriptionPresentRule,
  descriptionLengthRule,
  canonicalPresentRule,
  canonicalValidRule,
  viewportPresentRule,
  faviconPresentRule,
  // H1
  h1PresentRule,
  h1SingleRule,
  // Core SEO
  canonicalHeaderRule,
  nosnippetRule,
  robotsMetaRule,
  titleUniqueRule,
  // Canonical validation
  canonicalConflictingRule,
  canonicalToHomepageRule,
  canonicalHttpMismatchRule,
  canonicalLoopRule,
  canonicalToNoindexRule,
};

// Export utility functions
export { resetTitleRegistry, getTitleRegistryStats };

// Register all rules
registerRule(titlePresentRule);
registerRule(titleLengthRule);
registerRule(descriptionPresentRule);
registerRule(descriptionLengthRule);
registerRule(canonicalPresentRule);
registerRule(canonicalValidRule);
registerRule(viewportPresentRule);
registerRule(faviconPresentRule);
registerRule(h1PresentRule);
registerRule(h1SingleRule);
registerRule(canonicalHeaderRule);
registerRule(nosnippetRule);
registerRule(robotsMetaRule);
registerRule(titleUniqueRule);
registerRule(canonicalConflictingRule);
registerRule(canonicalToHomepageRule);
registerRule(canonicalHttpMismatchRule);
registerRule(canonicalLoopRule);
registerRule(canonicalToNoindexRule);
