import type Database from 'better-sqlite3';
import type {
  DbAuditComparison,
  HydratedAuditComparison,
  CategoryDelta,
  HydratedAuditCategory,
} from '../types.js';
import { getAuditById } from './audits.js';
import { getCategories } from './results.js';
import { parseSqliteUtc } from '../sqlite-time.js';

/**
 * Hydrate a comparison record
 */
function hydrateComparison(row: DbAuditComparison): HydratedAuditComparison {
  return {
    id: row.id,
    currentAuditId: row.current_audit_id,
    previousAuditId: row.previous_audit_id,
    domain: row.domain,
    scoreDelta: row.score_delta,
    categoryDeltas: row.category_deltas_json
      ? JSON.parse(row.category_deltas_json)
      : [],
    newIssuesCount: row.new_issues_count,
    fixedIssuesCount: row.fixed_issues_count,
    comparedAt: parseSqliteUtc(row.compared_at),
  };
}

/**
 * Calculate category deltas between two audits
 */
function calculateCategoryDeltas(
  currentCategories: HydratedAuditCategory[],
  previousCategories: HydratedAuditCategory[]
): CategoryDelta[] {
  const previousMap = new Map(
    previousCategories.map((c) => [c.categoryId, c])
  );

  const deltas: CategoryDelta[] = [];

  for (const current of currentCategories) {
    const previous = previousMap.get(current.categoryId);
    const previousScore = previous?.score ?? 0;

    deltas.push({
      categoryId: current.categoryId,
      categoryName: current.categoryName,
      previousScore,
      currentScore: current.score,
      delta: current.score - previousScore,
    });
  }

  return deltas;
}

/**
 * Count new issues (in current but not in previous)
 */
function countNewIssues(
  db: Database.Database,
  currentAuditId: number,
  previousAuditId: number
): number {
  // Count rules that failed in current but passed in previous
  const result = db
    .prepare(
      `
    SELECT COUNT(DISTINCT c.rule_id) as count
    FROM audit_results c
    LEFT JOIN audit_results p ON c.rule_id = p.rule_id AND p.audit_id = ?
    WHERE c.audit_id = ? AND c.status = 'fail'
      AND (p.id IS NULL OR p.status != 'fail')
  `
    )
    .get(previousAuditId, currentAuditId) as { count: number };

  return result.count;
}

/**
 * Count fixed issues (failed in previous but not in current)
 */
function countFixedIssues(
  db: Database.Database,
  currentAuditId: number,
  previousAuditId: number
): number {
  // Count rules that failed in previous but pass/warn in current
  const result = db
    .prepare(
      `
    SELECT COUNT(DISTINCT p.rule_id) as count
    FROM audit_results p
    LEFT JOIN audit_results c ON p.rule_id = c.rule_id AND c.audit_id = ?
    WHERE p.audit_id = ? AND p.status = 'fail'
      AND (c.id IS NULL OR c.status != 'fail')
  `
    )
    .get(currentAuditId, previousAuditId) as { count: number };

  return result.count;
}

/**
 * A comparison that has been computed but not stored.
 */
export type AuditComparison = Omit<HydratedAuditComparison, 'id' | 'comparedAt'> & {
  /** True when both engine versions are known and differ */
  engineChanged: boolean;
  currentEngineVersion: string | null;
  previousEngineVersion: string | null;
};

/**
 * Compute the comparison between two audits. Reads only.
 *
 * `seomator compare` and the dashboard call this; a read should never leave a
 * row behind. The save path calls `recordComparison()` to store the result of
 * this function once, inside its own transaction.
 *
 * @param db - Database instance
 * @param currentAuditId - Current audit database ID
 * @param previousAuditId - Previous audit database ID
 * @returns The comparison, or null when either audit is missing
 */
export function buildComparison(
  db: Database.Database,
  currentAuditId: number,
  previousAuditId: number
): AuditComparison | null {
  const currentAudit = getAuditById(db, currentAuditId);
  const previousAudit = getAuditById(db, previousAuditId);

  if (!currentAudit || !previousAudit) {
    return null;
  }

  const scoreDelta = currentAudit.overallScore - previousAudit.overallScore;

  const currentCategories = getCategories(db, currentAuditId);
  const previousCategories = getCategories(db, previousAuditId);
  const categoryDeltas = calculateCategoryDeltas(currentCategories, previousCategories);

  const newIssuesCount = countNewIssues(db, currentAuditId, previousAuditId);
  const fixedIssuesCount = countFixedIssues(db, currentAuditId, previousAuditId);

  const engineChanged =
    currentAudit.engineVersion !== null &&
    previousAudit.engineVersion !== null &&
    currentAudit.engineVersion !== previousAudit.engineVersion;

  return {
    currentAuditId,
    previousAuditId,
    domain: currentAudit.domain,
    scoreDelta,
    categoryDeltas,
    newIssuesCount,
    fixedIssuesCount,
    engineChanged,
    currentEngineVersion: currentAudit.engineVersion,
    previousEngineVersion: previousAudit.engineVersion,
  };
}

/**
 * Compute and store the comparison between two audits.
 *
 * @param db - Database instance
 * @param currentAuditId - Current audit database ID
 * @param previousAuditId - Previous audit database ID
 * @returns Stored comparison record, or null when either audit is missing
 */
export function recordComparison(
  db: Database.Database,
  currentAuditId: number,
  previousAuditId: number
): HydratedAuditComparison | null {
  const comparison = buildComparison(db, currentAuditId, previousAuditId);
  if (!comparison) return null;

  const result = db
    .prepare(
      `
    INSERT INTO audit_comparisons (
      current_audit_id, previous_audit_id, domain,
      score_delta, category_deltas_json,
      new_issues_count, fixed_issues_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `
    )
    .get(
      currentAuditId,
      previousAuditId,
      comparison.domain,
      comparison.scoreDelta,
      JSON.stringify(comparison.categoryDeltas),
      comparison.newIssuesCount,
      comparison.fixedIssuesCount
    ) as DbAuditComparison;

  return hydrateComparison(result);
}

/**
 * Get comparison for an audit
 *
 * @param db - Database instance
 * @param currentAuditId - Current audit database ID
 * @returns Comparison record or null
 */
export function getComparison(
  db: Database.Database,
  currentAuditId: number
): HydratedAuditComparison | null {
  const row = db
    .prepare('SELECT * FROM audit_comparisons WHERE current_audit_id = ?')
    .get(currentAuditId) as DbAuditComparison | undefined;

  return row ? hydrateComparison(row) : null;
}

/**
 * Get comparisons for a domain
 *
 * @param db - Database instance
 * @param domain - Domain name
 * @param limit - Maximum number of comparisons to return
 * @returns Array of comparisons
 */
export function getComparisonsByDomain(
  db: Database.Database,
  domain: string,
  limit = 10
): HydratedAuditComparison[] {
  const rows = db
    .prepare(
      `
    SELECT * FROM audit_comparisons
    WHERE domain = ?
    ORDER BY compared_at DESC
    LIMIT ?
  `
    )
    .all(domain, limit) as DbAuditComparison[];

  return rows.map(hydrateComparison);
}

/**
 * One point of a domain's score history.
 */
export interface ScoreTrendPoint {
  auditId: string;
  score: number;
  date: Date;
  /** null for audits stored before 3.4.0 */
  engineVersion: string | null;
}

/**
 * Get score trend for a domain, oldest first.
 *
 * This is the only place the order is reversed; consumers must not reverse
 * again.
 *
 * @param db - Database instance
 * @param domain - Domain name
 * @param limit - Number of audits to include
 * @returns Array of scores with dates, oldest first
 */
export function getScoreTrend(
  db: Database.Database,
  domain: string,
  limit = 10
): ScoreTrendPoint[] {
  const rows = db
    .prepare(
      `
    SELECT audit_id, overall_score, started_at, engine_version
    FROM audits
    WHERE domain = ? AND status = 'completed'
    ORDER BY started_at DESC, id DESC
    LIMIT ?
  `
    )
    .all(domain, limit) as Array<{
    audit_id: string;
    overall_score: number;
    started_at: string;
    engine_version: string | null;
  }>;

  return rows
    .map((r) => ({
      auditId: r.audit_id,
      score: r.overall_score,
      date: parseSqliteUtc(r.started_at),
      engineVersion: r.engine_version ?? null,
    }))
    .reverse();
}

/**
 * Delete comparison
 *
 * @param db - Database instance
 * @param comparisonId - Comparison ID
 * @returns True if deleted
 */
export function deleteComparison(
  db: Database.Database,
  comparisonId: number
): boolean {
  const result = db
    .prepare('DELETE FROM audit_comparisons WHERE id = ?')
    .run(comparisonId);
  return result.changes > 0;
}
