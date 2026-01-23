/**
 * Social Rules
 *
 * This module exports all social/Open Graph related audit rules and registers them.
 */

import { registerRule } from '../registry.js';

import { ogTitleRule } from './og-title.js';
import { ogDescriptionRule } from './og-description.js';
import { ogImageRule } from './og-image.js';
import { twitterCardRule } from './twitter-card.js';
import { ogUrlRule } from './og-url.js';

// Export all rules
export {
  ogTitleRule,
  ogDescriptionRule,
  ogImageRule,
  twitterCardRule,
  ogUrlRule,
};

// Register all rules
registerRule(ogTitleRule);
registerRule(ogDescriptionRule);
registerRule(ogImageRule);
registerRule(twitterCardRule);
registerRule(ogUrlRule);
