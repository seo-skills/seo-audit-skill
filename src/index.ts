/**
 * @seomator/seo-audit - Programmatic API
 *
 * Usage:
 *   import { createAuditor } from '@seomator/seo-audit';
 *
 *   const auditor = createAuditor({
 *     categories: ['core', 'security', 'perf'],
 *     measureCwv: false,
 *     onCategoryComplete: (id, name, result) => {
 *       console.log(`${name}: ${result.score}/100`);
 *     },
 *   });
 *
 *   const result = await auditor.audit('https://example.com');
 *   console.log(`Overall Score: ${result.overallScore}`);
 */

export { Auditor, createAuditor } from './auditor.js';

// Registering the rules on import means the counts below are live the moment a
// consumer imports the package, rather than zero until an audit has been run.
import './rules/loader.js';

// The registry and category table, so the rule count a consumer (or the docs
// sync script) reports is read from the same source the auditor runs, and can
// never be a number someone typed by hand.
export {
  getAllRules,
  getRuleById,
  getRulesByCategory,
  getRuleCount,
} from './rules/registry.js';
export { categories, getCategoryById, getCategoryIds } from './categories/index.js';
export type {
  AuditorOptions,
  OnCategoryStartCallback,
  OnCategoryCompleteCallback,
  OnRuleCompleteCallback,
  OnPageCompleteCallback,
} from './auditor.js';

export type {
  AuditResult,
  AuditContext,
  AuditRule,
  CategoryResult,
  CategoryDefinition,
  RuleResult,
  RuleStatus,
  CoreWebVitals,
  LinkInfo,
  ImageInfo,
  InvalidLinkInfo,
  SpecialLinkInfo,
  RedirectChainEntry,
  // Remaining AuditContext members, so every field of the context a custom
  // rule receives can be named by consumers.
  FigureInfo,
  InlineSvgInfo,
  PictureElementInfo,
  CookieInfo,
  SitemapEntry,
  SitemapFetchResult,
  RenderDiagnostics,
  ConsoleMessageInfo,
  FailedRequestInfo,
  AssetInfo,
  SiteContext,
  PageSnapshot,
} from './types.js';
