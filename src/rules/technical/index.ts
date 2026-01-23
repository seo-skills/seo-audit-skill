/**
 * Technical SEO Rules
 *
 * This module exports all technical SEO audit rules and registers them.
 */

import { registerRule } from '../registry.js';

import { robotsTxtExistsRule } from './robots-txt-exists.js';
import { robotsTxtValidRule } from './robots-txt-valid.js';
import { sitemapExistsRule } from './sitemap-exists.js';
import { sitemapValidRule } from './sitemap-valid.js';
import { urlStructureRule } from './url-structure.js';
import { trailingSlashRule } from './trailing-slash.js';
import { wwwRedirectRule } from './www-redirect.js';
import { fourOhFourPageRule } from './404-page.js';

// Export all rules
export {
  robotsTxtExistsRule,
  robotsTxtValidRule,
  sitemapExistsRule,
  sitemapValidRule,
  urlStructureRule,
  trailingSlashRule,
  wwwRedirectRule,
  fourOhFourPageRule,
};

// Register all rules
registerRule(robotsTxtExistsRule);
registerRule(robotsTxtValidRule);
registerRule(sitemapExistsRule);
registerRule(sitemapValidRule);
registerRule(urlStructureRule);
registerRule(trailingSlashRule);
registerRule(wwwRedirectRule);
registerRule(fourOhFourPageRule);
