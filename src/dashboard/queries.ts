/**
 * Read-side queries over the audits database, shaped for display.
 *
 * Every function takes the database explicitly so tests and the dashboard can
 * point them at any file. Nothing here writes.
 */

import type { AuditsDatabase } from '../storage/audits-db/index.js';
import type { AuditQueryOptions, DbAudit, HydratedAudit } from '../storage/types.js';
import { toAuditSummary } from '../storage/audits-db/audits.js';
import { diffRules } from '../storage/audits-db/rule-diff.js';
import { categories as categoryDefinitions } from '../categories/index.js';
import { getRuleById } from '../rules/registry.js';
import { getFixSuggestion } from '../reporters/fix-suggestions.js';
import type { AuditResult, CategoryResult } from '../types.js';
import {
  toAuditSummaryDto,
  type AuditDetail,
  type AuditMetaDto,
  type AuditSummaryDto,
  type DomainSummary,
  type RuleMetadata,
  type RuleSummary,
  type ScoreTrendPointDto,
  type StoredComparison,
} from './contract.js';

/** Scores kept per domain for the overview sparkline */
export const SPARKLINE_POINTS = 10;

function toMeta(audit: HydratedAudit): AuditMetaDto {
  return {
    id: audit.id,
    auditId: audit.auditId,
    domain: audit.domain,
    projectName: audit.projectName,
    startUrl: audit.startUrl,
    overallScore: audit.overallScore,
    pagesAudited: audit.pagesAudited,
    passedCount: audit.passedCount,
    warningCount: audit.warningCount,
    failedCount: audit.failedCount,
    startedAt: audit.startedAt.toISOString(),
    completedAt: audit.completedAt ? audit.completedAt.toISOString() : null,
    status: audit.status,
    source: audit.source,
    engineVersion: audit.engineVersion,
    totalRules: audit.totalRules,
    run: audit.run,
  };
}

function summaryOf(audit: HydratedAudit): AuditSummaryDto {
  const meta = toMeta(audit);
  const { totalRules: _totalRules, run: _run, ...summary } = meta;
  return summary;
}

/**
 * List stored audits, newest first.
 */
export function listAudits(db: AuditsDatabase, options: AuditQueryOptions = {}): AuditSummaryDto[] {
  return db.listAudits(options).map(toAuditSummaryDto);
}

/**
 * Resolve display metadata for a set of rule ids from the registry, falling
 * back to the name stored with the result for rules this build no longer has.
 */
export function buildRuleMetadata(
  rules: Iterable<{ ruleId: string; ruleName: string }>
): Record<string, RuleMetadata> {
  const metadata: Record<string, RuleMetadata> = {};
  for (const { ruleId, ruleName } of rules) {
    if (metadata[ruleId]) continue;
    const rule = getRuleById(ruleId);
    metadata[ruleId] = {
      name: rule?.name ?? ruleName,
      description: rule?.description ?? '',
      fix: getFixSuggestion(ruleId),
    };
  }
  return metadata;
}

/**
 * Rebuild a stored audit for display.
 *
 * The result has one `RuleSummary` per rule per category, computed in SQL, so
 * a 1,000-page crawl costs the same two queries as a single page. Category
 * scores and counts come from the stored category rows, which were written
 * from the live result, so they match what the run printed. Categories come
 * back in definition order, the way a live audit reports them.
 */
export function getAuditDetail(db: AuditsDatabase, auditId: string): AuditDetail | null {
  const audit = db.getAudit(auditId);
  if (!audit) return null;

  const storedCategories = db.getCategories(audit.id);
  const summaries = db.getRuleSummaries(audit.id);

  const byCategory = new Map<string, RuleSummary[]>();
  for (const s of summaries) {
    const entry: RuleSummary = {
      ruleId: s.ruleId,
      ruleName: s.ruleName,
      status: s.status,
      message: s.message,
      score: s.score,
      weight: s.notMeasured ? 0 : 1,
      ...(s.details && { details: s.details }),
      totalPages: s.totalPages,
      measuredPages: s.measuredPages,
      affectedPages: s.affectedPages,
      notMeasured: s.notMeasured,
      samplePages: s.samplePages,
    };
    const list = byCategory.get(s.categoryId);
    if (list) list.push(entry);
    else byCategory.set(s.categoryId, [entry]);
  }

  const order = new Map(categoryDefinitions.map((c, i) => [c.id, i]));
  const ordered = [...storedCategories].sort(
    (a, b) => (order.get(a.categoryId) ?? Infinity) - (order.get(b.categoryId) ?? Infinity)
  );

  const categoryResults: CategoryResult[] = ordered.map((cat) => {
    const results = byCategory.get(cat.categoryId) ?? [];
    // Live audits count one entry per rule per page; unmeasured page rows are
    // what `notMeasuredCount` counted, so derive it the same way.
    const notMeasuredCount = results.reduce((n, r) => n + (r.totalPages - r.measuredPages), 0);
    return {
      categoryId: cat.categoryId,
      score: cat.score,
      passCount: cat.passCount,
      warnCount: cat.warnCount,
      failCount: cat.failCount,
      notMeasuredCount,
      results,
    };
  });

  const result: AuditResult = {
    url: audit.startUrl,
    overallScore: audit.overallScore,
    categoryResults,
    timestamp: audit.startedAt.toISOString(),
    crawledPages: audit.pagesAudited,
  };

  return {
    audit: toMeta(audit),
    result,
    ruleMetadata: buildRuleMetadata(summaries),
  };
}

/**
 * Every page a rule ran on, for the "failed on 3 of 12 pages" drill-down.
 *
 * Paged by offset: the ordering is stable and the pages are small, so a cursor
 * would be ceremony.
 */
export function getRulePages(
  db: AuditsDatabase,
  auditId: string,
  ruleId: string,
  options: { limit?: number; offset?: number } = {}
): { total: number; pages: Array<{ pageUrl: string; status: string; score: number; message: string; notMeasured: boolean }> } | null {
  const audit = db.getAudit(auditId);
  if (!audit) return null;

  const raw = db.getDb();
  const { total } = raw
    .prepare('SELECT COUNT(*) AS total FROM audit_results WHERE audit_id = ? AND rule_id = ?')
    .get(audit.id, ruleId) as { total: number };

  const rows = raw
    .prepare(
      `SELECT page_url, status, score, message, weight
       FROM audit_results
       WHERE audit_id = ? AND rule_id = ?
       ORDER BY id
       LIMIT ? OFFSET ?`
    )
    .all(audit.id, ruleId, options.limit ?? 100, options.offset ?? 0) as Array<{
    page_url: string;
    status: string;
    score: number;
    message: string;
    weight: number | null;
  }>;

  return {
    total,
    pages: rows.map((r) => ({
      pageUrl: r.page_url,
      status: r.status,
      score: r.score,
      message: r.message,
      notMeasured: r.weight === 0,
    })),
  };
}

/**
 * A domain's score history, oldest first.
 */
export function getTrend(db: AuditsDatabase, domain: string, limit = SPARKLINE_POINTS): ScoreTrendPointDto[] {
  return db.getScoreTrend(domain, limit).map((p) => ({
    auditId: p.auditId,
    score: p.score,
    date: p.date.toISOString(),
    engineVersion: p.engineVersion,
  }));
}

/**
 * One row per audited domain: its latest audit, how the score moved, and a
 * sparkline. Two queries however many domains there are.
 */
export function listDomains(db: AuditsDatabase): DomainSummary[] {
  const raw = db.getDb();

  const latestRows = raw
    .prepare(
      `
    WITH ranked AS (
      SELECT a.*,
        ROW_NUMBER() OVER (PARTITION BY domain ORDER BY started_at DESC, id DESC) AS rn,
        COUNT(*) OVER (PARTITION BY domain) AS audit_count
      FROM audits a
      WHERE status = 'completed'
    )
    SELECT r.*,
      (SELECT score_delta FROM audit_comparisons c WHERE c.current_audit_id = r.id ORDER BY c.id DESC LIMIT 1) AS score_delta,
      (SELECT new_issues_count FROM audit_comparisons c WHERE c.current_audit_id = r.id ORDER BY c.id DESC LIMIT 1) AS regressed_rules,
      (SELECT fixed_issues_count FROM audit_comparisons c WHERE c.current_audit_id = r.id ORDER BY c.id DESC LIMIT 1) AS improved_rules
    FROM ranked r
    WHERE rn = 1
    ORDER BY started_at DESC, id DESC
  `
    )
    .all() as Array<
    DbAudit & {
      audit_count: number;
      score_delta: number | null;
      regressed_rules: number | null;
      improved_rules: number | null;
    }
  >;

  const sparkRows = raw
    .prepare(
      `
    SELECT domain, overall_score FROM (
      SELECT domain, overall_score,
        ROW_NUMBER() OVER (PARTITION BY domain ORDER BY started_at DESC, id DESC) AS rn
      FROM audits
      WHERE status = 'completed'
    )
    WHERE rn <= ?
    ORDER BY domain, rn DESC
  `
    )
    .all(SPARKLINE_POINTS) as Array<{ domain: string; overall_score: number }>;

  const sparklines = new Map<string, number[]>();
  for (const row of sparkRows) {
    const list = sparklines.get(row.domain);
    if (list) list.push(row.overall_score);
    else sparklines.set(row.domain, [row.overall_score]);
  }

  return latestRows.map((row) => ({
    domain: row.domain,
    auditCount: row.audit_count,
    latest: toAuditSummaryDto(toAuditSummary(row)),
    scoreDelta: row.score_delta,
    regressedRules: row.regressed_rules,
    improvedRules: row.improved_rules,
    sparkline: sparklines.get(row.domain) ?? [],
  }));
}

/**
 * Compare a stored audit with the one before it, or with a named one.
 * Computed on demand; nothing is written.
 */
export function compareStored(
  db: AuditsDatabase,
  auditId: string,
  againstAuditId?: string
): StoredComparison | null {
  const current = db.getAudit(auditId);
  if (!current) return null;

  const previous = againstAuditId
    ? db.getAudit(againstAuditId)
    : db.getPreviousAudit(current.domain, current.auditId);
  if (!previous) return null;

  const comparison = db.buildComparison(current.id, previous.id);
  if (!comparison) return null;

  return {
    current: summaryOf(current),
    previous: summaryOf(previous),
    scoreDelta: comparison.scoreDelta,
    categoryDeltas: comparison.categoryDeltas,
    engineChanged: comparison.engineChanged,
    rules: diffRules(db.getAllResults(previous.id), db.getAllResults(current.id)),
  };
}
