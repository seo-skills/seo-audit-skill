/**
 * Content Rules
 *
 * This module exports all content-related audit rules and registers them.
 * - Word count (thin content detection)
 * - Reading level (Flesch-Kincaid)
 * - Keyword stuffing detection
 * - Article link density
 * - Broken HTML structure
 * - Meta tags in body detection
 * - MIME type validation
 * - Duplicate description detection
 * - Heading hierarchy and structure
 *
 * Note: Author info and freshness rules moved to E-E-A-T category
 */

import { registerRule } from '../registry.js';

import { wordCountRule } from './word-count.js';
import { readingLevelRule } from './reading-level.js';
import { keywordStuffingRule } from './keyword-stuffing.js';
import { articleLinksRule } from './article-links.js';
import { brokenHtmlRule } from './broken-html.js';
import { metaInBodyRule } from './meta-in-body.js';
import { mimeTypeRule } from './mime-type.js';
import {
  duplicateDescriptionRule,
  resetDescriptionRegistry,
  getDescriptionRegistryStats,
} from './duplicate-description.js';

// Heading rules (moved from headings category)
import { hierarchyRule } from './heading-hierarchy.js';
import { contentLengthRule } from './heading-length.js';
import { contentUniqueRule } from './heading-unique.js';

// Export all rules
export {
  wordCountRule,
  readingLevelRule,
  keywordStuffingRule,
  articleLinksRule,
  brokenHtmlRule,
  metaInBodyRule,
  mimeTypeRule,
  duplicateDescriptionRule,
  // Heading rules
  hierarchyRule,
  contentLengthRule,
  contentUniqueRule,
};

// Export utility functions for duplicate description tracking
export { resetDescriptionRegistry, getDescriptionRegistryStats };

// Register all rules
registerRule(wordCountRule);
registerRule(readingLevelRule);
registerRule(keywordStuffingRule);
registerRule(articleLinksRule);
registerRule(brokenHtmlRule);
registerRule(metaInBodyRule);
registerRule(mimeTypeRule);
registerRule(duplicateDescriptionRule);
registerRule(hierarchyRule);
registerRule(contentLengthRule);
registerRule(contentUniqueRule);
