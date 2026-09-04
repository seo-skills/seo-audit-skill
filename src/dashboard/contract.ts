/**
 * Transport-neutral shapes shared by every surface that shows stored audits:
 * the CLI `report` command, the Electron app (over IPC) and the web dashboard
 * (over HTTP). Dates travel as ISO strings so the same object can cross a
 * structured-clone boundary or a JSON one unchanged.
 */

import type { AuditResult, RuleResult } from '../types.js';
import type {
  AuditRunOptions,
  AuditSource,
  AuditStatus,
  AuditSummary,
  CategoryDelta,
  RuleResultStatus,
} from '../storage/types.js';
import type { RuleDiff } from '../storage/audits-db/rule-diff.js';

/** One row of the audit list */
export interface AuditSummaryDto {
  id: number;
  auditId: string;
  domain: string;
  projectName: string | null;
  startUrl: string;
  overallScore: number;
  pagesAudited: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  startedAt: string;
  completedAt: string | null;
  status: AuditStatus;
  /** null for audits stored before 3.4.0 */
  source: AuditSource | null;
  /** null for audits stored before 3.4.0 */
  engineVersion: string | null;
}

/** Everything about the stored audit row itself, without its results */
export interface AuditMetaDto extends AuditSummaryDto {
  totalRules: number;
  /** null for audits stored before 3.4.0 */
  run: AuditRunOptions | null;
}

/** A point on a domain's score history, oldest first */
export interface ScoreTrendPointDto {
  auditId: string;
  score: number;
  date: string;
  engineVersion: string | null;
}

/** Display metadata for a rule, resolved from the registry at read time */
export interface RuleMetadata {
  name: string;
  description: string;
  fix: string;
}

/**
 * A rule as the detail view shows it: one entry per rule, aggregated across
 * pages. Extends `RuleResult` so the existing reporters and the renderer keep
 * working unchanged; the extra fields let a crawl audit say "failed on 3 of
 * 12 pages" instead of listing the same rule twelve times.
 */
export interface RuleSummary extends RuleResult {
  ruleName: string;
  /**
   * How much attention this finding deserves relative to the others in its
   * audit; 0 means "not something to fix". Computed server-side, because the
   * weights behind it exist only once the whole rule registry has loaded.
   */
  priority: number;
  totalPages: number;
  measuredPages: number;
  affectedPages: number;
  notMeasured: boolean;
  samplePages: Array<{ pageUrl: string; status: RuleResultStatus; message: string }>;
}

/** A stored audit rebuilt for display */
export interface AuditDetail {
  audit: AuditMetaDto;
  /** `categoryResults[].results` entries are `RuleSummary` objects */
  result: AuditResult;
  ruleMetadata: Record<string, RuleMetadata>;
}

/** One row of the domain overview */
export interface DomainSummary {
  domain: string;
  auditCount: number;
  latest: AuditSummaryDto;
  /** Score movement since the previous audit; null when there is no previous one */
  scoreDelta: number | null;
  /** Rules that fail now and did not before; null when there is no previous one */
  regressedRules: number | null;
  /** Rules that failed before and do not now; null when there is no previous one */
  improvedRules: number | null;
  /** Up to the last ten scores, oldest first */
  sparkline: number[];
}

/** Two stored audits compared on demand */
export interface StoredComparison {
  current: AuditSummaryDto;
  previous: AuditSummaryDto;
  scoreDelta: number;
  categoryDeltas: CategoryDelta[];
  /** True when both engine versions are known and differ */
  engineChanged: boolean;
  rules: RuleDiff;
}

/** Serialize a storage summary for transport */
export function toAuditSummaryDto(summary: AuditSummary): AuditSummaryDto {
  return {
    id: summary.id,
    auditId: summary.auditId,
    domain: summary.domain,
    projectName: summary.projectName,
    startUrl: summary.startUrl,
    overallScore: summary.overallScore,
    pagesAudited: summary.pagesAudited,
    passedCount: summary.passedCount,
    warningCount: summary.warningCount,
    failedCount: summary.failedCount,
    startedAt: summary.startedAt.toISOString(),
    completedAt: summary.completedAt ? summary.completedAt.toISOString() : null,
    status: summary.status,
    source: summary.source,
    engineVersion: summary.engineVersion,
  };
}
