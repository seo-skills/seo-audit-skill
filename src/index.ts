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
  OnCrawlProgressCallback,
} from './auditor.js';

// Two honest answers to "how many findings?" — per rule and per rule-page.
// Surfaces quote the one that matches what they are showing, and say which.
export { countLiveResult, countFromSummaries, ledgerSums } from './dashboard/counts.js';
export type { AuditCounts, CountLedger } from './dashboard/counts.js';

// What to fix first. Server-side only by design: the weights it reads exist
// only after the whole rule registry has loaded, so this must not be pulled
// into a browser bundle — surfaces receive the computed number instead.
export { rulePriority, byPriority } from './rules/priority.js';
export type { PriorityInput } from './rules/priority.js';

// One score, one verdict, shared by every surface. A consumer rendering an
// audit should derive its grade and label here rather than re-deriving them.
export { scoreToVerdict, verdictCssVar } from './verdict.js';
export type { Verdict, VerdictToken } from './verdict.js';
export { AUDIT_SCHEMA_VERSION } from './types.js';

// `audit()` rejects with these, so a consumer that catches needs to name them.
// `AuditAbortedError` is what an aborted `signal` produces; every other
// failure arrives as an `AuditError` carrying a code and often a hint.
export {
  AuditError,
  AuditAbortedError,
  classifyError,
  isAbortError,
} from './errors.js';
export type { AuditErrorCode } from './errors.js';

// A watchable run: start, cancel, and subscribe to one bounded state object.
// This is what the desktop app and the local dashboard are built on.
export { AuditSession, normalizeRunArgs } from './dashboard/audit-session.js';
export type {
  AuditRunArgs,
  Capabilities,
  CategoryProgress,
  NormalizedRunArgs,
  RunError,
  RunOutcome,
  RunPhase,
  RunState,
  RunStatus,
} from './dashboard/audit-session.js';

// Stored audits: the database, the read queries every surface shares, and the
// transport-neutral shapes they return.
export { AuditsDatabase, getAuditsDatabase, closeAuditsDatabase } from './storage/audits-db/index.js';
export { saveAuditToDatabase } from './storage/save-audit.js';
export { diffRules } from './storage/audits-db/rule-diff.js';
export {
  compareStored,
  getAuditDetail,
  getTrend,
  listAudits,
  listDomains,
} from './dashboard/queries.js';
export type {
  AuditDetail,
  AuditMetaDto,
  AuditSummaryDto,
  DomainSummary,
  RuleMetadata,
  RuleSummary,
  ScoreTrendPointDto,
  StoredComparison,
} from './dashboard/contract.js';
export type { RuleChange, RuleDiff } from './storage/audits-db/rule-diff.js';
export type { AuditRunOptions, AuditSource } from './storage/types.js';

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
