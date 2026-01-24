/**
 * Social Rules
 *
 * This module exports all social/Open Graph related audit rules and registers them.
 */

import { registerRule } from '../registry.js';

import { ogTitleRule } from './og-title.js';
import { ogDescriptionRule } from './og-description.js';
import { ogImageRule } from './og-image.js';
import { ogImageSizeRule } from './og-image-size.js';
import { twitterCardRule } from './twitter-card.js';
import { ogUrlRule } from './og-url.js';
import { ogUrlCanonicalRule } from './og-url-canonical.js';
import { shareButtonsRule } from './share-buttons.js';
import { socialProfilesRule } from './social-profiles.js';

// Export all rules
export {
  ogTitleRule,
  ogDescriptionRule,
  ogImageRule,
  ogImageSizeRule,
  twitterCardRule,
  ogUrlRule,
  ogUrlCanonicalRule,
  shareButtonsRule,
  socialProfilesRule,
};

// Register all rules
registerRule(ogTitleRule);
registerRule(ogDescriptionRule);
registerRule(ogImageRule);
registerRule(ogImageSizeRule);
registerRule(twitterCardRule);
registerRule(ogUrlRule);
registerRule(ogUrlCanonicalRule);
registerRule(shareButtonsRule);
registerRule(socialProfilesRule);
