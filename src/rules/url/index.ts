/**
 * URL Structure Rules
 *
 * This module exports all URL structure audit rules and registers them.
 * These rules check URL formatting, keywords, and stop words for SEO optimization.
 */

import { registerRule } from '../registry.js';

import { slugKeywordsRule } from './slug-keywords.js';
import { stopWordsRule } from './stop-words.js';

// Export all rules
export { slugKeywordsRule, stopWordsRule };

// Register all rules
registerRule(slugKeywordsRule);
registerRule(stopWordsRule);
