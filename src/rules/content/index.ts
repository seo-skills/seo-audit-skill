/**
 * Content Rules
 *
 * This module exports all content-related audit rules and registers them.
 * - Word count (thin content detection)
 * - Reading level (Flesch-Kincaid)
 * - Keyword stuffing detection
 * - Article link density
 * - Author info (E-E-A-T)
 * - Content freshness signals
 * - Broken HTML structure
 * - Meta tags in body detection
 * - MIME type validation
 * - Duplicate description detection
 */

import { registerRule } from '../registry.js';

import { wordCountRule } from './word-count.js';
import { readingLevelRule } from './reading-level.js';
import { keywordStuffingRule } from './keyword-stuffing.js';
import { articleLinksRule } from './article-links.js';
import { authorInfoRule } from './author-info.js';
import { freshnessRule } from './freshness.js';
import { brokenHtmlRule } from './broken-html.js';
import { metaInBodyRule } from './meta-in-body.js';
import { mimeTypeRule } from './mime-type.js';
import {
  duplicateDescriptionRule,
  resetDescriptionRegistry,
  getDescriptionRegistryStats,
} from './duplicate-description.js';

// Export all rules
export {
  wordCountRule,
  readingLevelRule,
  keywordStuffingRule,
  articleLinksRule,
  authorInfoRule,
  freshnessRule,
  brokenHtmlRule,
  metaInBodyRule,
  mimeTypeRule,
  duplicateDescriptionRule,
};

// Export utility functions for duplicate description tracking
export { resetDescriptionRegistry, getDescriptionRegistryStats };

// Register all rules
registerRule(wordCountRule);
registerRule(readingLevelRule);
registerRule(keywordStuffingRule);
registerRule(articleLinksRule);
registerRule(authorInfoRule);
registerRule(freshnessRule);
registerRule(brokenHtmlRule);
registerRule(metaInBodyRule);
registerRule(mimeTypeRule);
registerRule(duplicateDescriptionRule);
