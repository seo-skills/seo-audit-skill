/**
 * Crawlability Rules
 *
 * This module exports all crawlability audit rules and registers them.
 * These rules check for robots.txt conflicts, sitemap issues, and
 * indexability signal conflicts.
 */

import { registerRule } from '../registry.js';

import { schemaNoindexConflictRule } from './schema-noindex-conflict.js';
import { paginationCanonicalRule } from './pagination-canonical.js';
import { sitemapDomainRule } from './sitemap-domain.js';
import { noindexInSitemapRule } from './noindex-in-sitemap.js';
import { indexabilityConflictRule } from './indexability-conflict.js';
import { canonicalRedirectRule } from './canonical-redirect.js';

// Export all rules
export {
  schemaNoindexConflictRule,
  paginationCanonicalRule,
  sitemapDomainRule,
  noindexInSitemapRule,
  indexabilityConflictRule,
  canonicalRedirectRule,
};

// Register all rules
registerRule(schemaNoindexConflictRule);
registerRule(paginationCanonicalRule);
registerRule(sitemapDomainRule);
registerRule(noindexInSitemapRule);
registerRule(indexabilityConflictRule);
registerRule(canonicalRedirectRule);
