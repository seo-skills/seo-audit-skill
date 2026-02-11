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
import { soft404Rule } from './soft-404.js';
import { serverErrorRule } from './server-error.js';
import { fourXxNon404Rule } from './4xx-non-404.js';
import { timeoutRule } from './timeout.js';
import { badContentTypeRule } from './bad-content-type.js';

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
  soft404Rule,
  serverErrorRule,
  fourXxNon404Rule,
  timeoutRule,
  badContentTypeRule,
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
registerRule(soft404Rule);
registerRule(serverErrorRule);
registerRule(fourXxNon404Rule);
registerRule(timeoutRule);
registerRule(badContentTypeRule);
