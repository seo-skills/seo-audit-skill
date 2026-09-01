/**
 * Crawlability Rules
 *
 * This module exports all crawlability audit rules and registers them.
 * These rules check for robots.txt conflicts, sitemap issues,
 * indexability signal conflicts, pagination problems, and resource
 * blocking issues.
 */

import { registerRule } from '../registry.js';

// Existing rules
import { schemaNoindexConflictRule } from './schema-noindex-conflict.js';
import { paginationCanonicalRule } from './pagination-canonical.js';
import { sitemapDomainRule } from './sitemap-domain.js';
import { noindexInSitemapRule } from './noindex-in-sitemap.js';
import { indexabilityConflictRule } from './indexability-conflict.js';
import { canonicalRedirectRule } from './canonical-redirect.js';

// Sitemap rules
import { sitemapUrlLimitRule } from './sitemap-url-limit.js';
import { sitemapSizeLimitRule } from './sitemap-size-limit.js';
import { sitemapDuplicateUrlsRule } from './sitemap-duplicate-urls.js';
import { sitemapOrphanUrlsRule, resetOrphanRegistry, getOrphanStats } from './sitemap-orphan-urls.js';
import { sitemapLastmodRule } from './sitemap-lastmod.js';

// Robots.txt rules
import { blockedResourcesRule } from './blocked-resources.js';
import { crawlDelayRule } from './crawl-delay.js';
import { sitemapInRobotstxtRule } from './sitemap-in-robotstxt.js';

// Pagination rules
import { paginationBrokenRule } from './pagination-broken.js';
import { paginationLoopRule } from './pagination-loop.js';
import { paginationSequenceRule } from './pagination-sequence.js';
import { paginationNoindexRule } from './pagination-noindex.js';
import { paginationOrphanedRule } from './pagination-orphaned.js';
import { paginationIsolatedRule } from './pagination-isolated.js';

// Cross-page rules (require SiteContext.pages, crawl mode only)
import { sitemapNon200Rule } from './sitemap-non-200.js';
import { sitemapNonCanonicalRule } from './sitemap-non-canonical.js';
import { sitemapDisallowedRule } from './sitemap-disallowed.js';
import { sitemapCrossDuplicatesRule } from './sitemap-cross-duplicates.js';
import { canonicalToNoindexRule } from './canonical-to-noindex.js';
import { canonicalToDisallowedRule } from './canonical-to-disallowed.js';
import { canonicalChainRule } from './canonical-chain.js';
import { canonicalLoopRule } from './canonical-loop.js';
import { hreflangToNoindexRule } from './hreflang-to-noindex.js';
import { hreflangToDisallowedRule } from './hreflang-to-disallowed.js';
import { hreflangDisallowedTargetRule } from './hreflang-disallowed-target.js';
import { hreflangIncomingConflictRule } from './hreflang-incoming-conflict.js';
import { hreflangReciprocityRule } from './hreflang-reciprocity.js';
import { crawlIsolatedUrlRule } from './isolated-url.js';

// Export all rules
export {
  // Existing rules
  schemaNoindexConflictRule,
  paginationCanonicalRule,
  sitemapDomainRule,
  noindexInSitemapRule,
  indexabilityConflictRule,
  canonicalRedirectRule,

  // Sitemap rules
  sitemapUrlLimitRule,
  sitemapSizeLimitRule,
  sitemapDuplicateUrlsRule,
  sitemapOrphanUrlsRule,

  // Robots.txt rules
  blockedResourcesRule,
  crawlDelayRule,
  sitemapInRobotstxtRule,

  // Pagination rules
  paginationBrokenRule,
  paginationLoopRule,
  paginationSequenceRule,
  paginationNoindexRule,
  paginationOrphanedRule,
  paginationIsolatedRule,

  // Cross-page rules (crawl mode only)
  sitemapNon200Rule,
  sitemapNonCanonicalRule,
  sitemapDisallowedRule,
  sitemapCrossDuplicatesRule,
  canonicalToNoindexRule,
  canonicalToDisallowedRule,
  canonicalChainRule,
  canonicalLoopRule,
  hreflangToNoindexRule,
  hreflangToDisallowedRule,
  hreflangDisallowedTargetRule,
  hreflangIncomingConflictRule,
  hreflangReciprocityRule,
  crawlIsolatedUrlRule,
};

// Export orphan registry utilities for testing and cross-page analysis
export { sitemapLastmodRule };
export { resetOrphanRegistry, getOrphanStats };

// Register all rules

// Existing rules
registerRule(schemaNoindexConflictRule);
registerRule(paginationCanonicalRule);
registerRule(sitemapDomainRule);
registerRule(noindexInSitemapRule);
registerRule(indexabilityConflictRule);
registerRule(canonicalRedirectRule);

// Sitemap rules
registerRule(sitemapUrlLimitRule);
registerRule(sitemapSizeLimitRule);
registerRule(sitemapDuplicateUrlsRule);
registerRule(sitemapOrphanUrlsRule);

// Robots.txt rules
registerRule(blockedResourcesRule);
registerRule(crawlDelayRule);
registerRule(sitemapInRobotstxtRule);

// Pagination rules
registerRule(paginationBrokenRule);
registerRule(paginationLoopRule);
registerRule(paginationSequenceRule);
registerRule(paginationNoindexRule);
registerRule(paginationOrphanedRule);
registerRule(sitemapLastmodRule);
registerRule(paginationIsolatedRule);

// Cross-page rules (crawl mode only; notMeasured in single-page audits)
registerRule(sitemapNon200Rule);
registerRule(sitemapNonCanonicalRule);
registerRule(sitemapDisallowedRule);
registerRule(sitemapCrossDuplicatesRule);
registerRule(canonicalToNoindexRule);
registerRule(canonicalToDisallowedRule);
registerRule(canonicalChainRule);
registerRule(canonicalLoopRule);
registerRule(hreflangToNoindexRule);
registerRule(hreflangToDisallowedRule);
registerRule(hreflangDisallowedTargetRule);
registerRule(hreflangIncomingConflictRule);
registerRule(hreflangReciprocityRule);
registerRule(crawlIsolatedUrlRule);
