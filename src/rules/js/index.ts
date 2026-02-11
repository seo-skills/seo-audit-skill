/**
 * JavaScript Rendering Rules
 *
 * This module exports all JavaScript rendering audit rules and registers them.
 * Includes:
 * - Rendered DOM presence checks (title, description, H1, canonical)
 * - Raw vs rendered DOM mismatch detection (canonical, noindex, title, description, H1)
 * - Content and link JS-dependency analysis
 * - Blocked JS resources detection
 * - Server-side rendering check
 */

import { registerRule } from '../registry.js';

// Rendered presence rules
import { renderedTitleRule } from './rendered-title.js';
import { renderedDescriptionRule } from './rendered-description.js';
import { renderedH1Rule } from './rendered-h1.js';
import { renderedCanonicalRule } from './rendered-canonical.js';

// Mismatch detection rules
import { canonicalMismatchRule } from './canonical-mismatch.js';
import { noindexMismatchRule } from './noindex-mismatch.js';
import { titleModifiedRule } from './title-modified.js';
import { descriptionModifiedRule } from './description-modified.js';
import { h1ModifiedRule } from './h1-modified.js';

// Content and link dependency rules
import { renderedContentRule } from './rendered-content.js';
import { renderedLinksRule } from './rendered-links.js';

// Resource and rendering rules
import { blockedResourcesRule } from './blocked-resources.js';
import { ssrCheckRule } from './ssr-check.js';

// Export all rules
export {
  // Rendered presence
  renderedTitleRule,
  renderedDescriptionRule,
  renderedH1Rule,
  renderedCanonicalRule,
  // Mismatch detection
  canonicalMismatchRule,
  noindexMismatchRule,
  titleModifiedRule,
  descriptionModifiedRule,
  h1ModifiedRule,
  // Content and links
  renderedContentRule,
  renderedLinksRule,
  // Resources and rendering
  blockedResourcesRule,
  ssrCheckRule,
};

// Register all rules
registerRule(renderedTitleRule);
registerRule(renderedDescriptionRule);
registerRule(renderedH1Rule);
registerRule(renderedCanonicalRule);
registerRule(canonicalMismatchRule);
registerRule(noindexMismatchRule);
registerRule(titleModifiedRule);
registerRule(descriptionModifiedRule);
registerRule(h1ModifiedRule);
registerRule(renderedContentRule);
registerRule(renderedLinksRule);
registerRule(blockedResourcesRule);
registerRule(ssrCheckRule);
