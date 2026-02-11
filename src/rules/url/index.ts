/**
 * URL Structure Rules
 *
 * This module exports all URL structure audit rules and registers them.
 * These rules check URL formatting, keywords, and stop words for SEO optimization.
 */

import { registerRule } from '../registry.js';

import { slugKeywordsRule } from './slug-keywords.js';
import { stopWordsRule } from './stop-words.js';
import { uppercaseRule } from './uppercase.js';
import { underscoresRule } from './underscores.js';
import { doubleSlashRule } from './double-slash.js';
import { spacesRule } from './spaces.js';
import { nonAsciiRule } from './non-ascii.js';
import { lengthRule } from './length.js';
import { repetitivePathRule } from './repetitive-path.js';
import { parametersRule } from './parameters.js';
import { sessionIdsRule } from './session-ids.js';
import { trackingParamsRule } from './tracking-params.js';
import { internalSearchRule } from './internal-search.js';
import { httpHttpsDuplicateRule } from './http-https-duplicate.js';

// Export all rules
export {
  slugKeywordsRule,
  stopWordsRule,
  uppercaseRule,
  underscoresRule,
  doubleSlashRule,
  spacesRule,
  nonAsciiRule,
  lengthRule,
  repetitivePathRule,
  parametersRule,
  sessionIdsRule,
  trackingParamsRule,
  internalSearchRule,
  httpHttpsDuplicateRule,
};

// Register all rules
registerRule(slugKeywordsRule);
registerRule(stopWordsRule);
registerRule(uppercaseRule);
registerRule(underscoresRule);
registerRule(doubleSlashRule);
registerRule(spacesRule);
registerRule(nonAsciiRule);
registerRule(lengthRule);
registerRule(repetitivePathRule);
registerRule(parametersRule);
registerRule(sessionIdsRule);
registerRule(trackingParamsRule);
registerRule(internalSearchRule);
registerRule(httpHttpsDuplicateRule);
