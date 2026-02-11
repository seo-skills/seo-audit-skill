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
 * - Text-to-HTML ratio
 * - Title same as H1 detection
 * - Title pixel width estimation
 * - Description pixel width estimation
 * - Exact duplicate content detection (cross-page)
 * - Near-duplicate content detection (cross-page)
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

// New content rules
import { textHtmlRatioRule } from './text-html-ratio.js';
import { titleSameAsH1Rule } from './title-same-as-h1.js';
import { titlePixelWidthRule } from './title-pixel-width.js';
import { descriptionPixelWidthRule } from './description-pixel-width.js';
import {
  duplicateExactRule,
  resetDuplicateContentRegistry,
} from './duplicate-exact.js';
import {
  duplicateNearRule,
  resetNearDuplicateRegistry,
} from './duplicate-near.js';

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
  // New content rules
  textHtmlRatioRule,
  titleSameAsH1Rule,
  titlePixelWidthRule,
  descriptionPixelWidthRule,
  duplicateExactRule,
  duplicateNearRule,
};

// Export utility functions for duplicate description tracking
export { resetDescriptionRegistry, getDescriptionRegistryStats };

// Export reset functions for cross-page duplicate detection
export { resetDuplicateContentRegistry, resetNearDuplicateRegistry };

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
registerRule(textHtmlRatioRule);
registerRule(titleSameAsH1Rule);
registerRule(titlePixelWidthRule);
registerRule(descriptionPixelWidthRule);
registerRule(duplicateExactRule);
registerRule(duplicateNearRule);
