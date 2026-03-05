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
} from './types.js';
