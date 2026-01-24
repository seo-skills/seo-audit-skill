import type Database from 'better-sqlite3';
import type {
  DbAuditComparison,
  HydratedAuditComparison,
  CategoryDelta,
  HydratedAudit,
  HydratedAuditCategory,
} from '../types.js';
import { getAuditById } from './audits.js';
import { getCategories } from './results.js';

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
    comparedAt: new Date(row.compared_at),
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
 * Compare two audits and store the comparison
 *
 * @param db - Database instance
 * @param currentAuditId - Current audit database ID
 * @param previousAuditId - Previous audit database ID
 * @returns Comparison record
 */
export function compareAudits(
  db: Database.Database,
  currentAuditId: number,
  previousAuditId: number
): HydratedAuditComparison | null {
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
      currentAudit.domain,
      scoreDelta,
      JSON.stringify(categoryDeltas),
      newIssuesCount,
      fixedIssuesCount
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
 * Get score trend for a domain
 *
 * @param db - Database instance
 * @param domain - Domain name
 * @param limit - Number of audits to include
 * @returns Array of scores with dates
 */
export function getScoreTrend(
  db: Database.Database,
  domain: string,
  limit = 10
): Array<{ auditId: string; score: number; date: Date }> {
  const rows = db
    .prepare(
      `
    SELECT audit_id, overall_score, started_at
    FROM audits
    WHERE domain = ? AND status = 'completed'
    ORDER BY started_at DESC
    LIMIT ?
  `
    )
    .all(domain, limit) as Array<{
    audit_id: string;
    overall_score: number;
    started_at: string;
  }>;

  return rows.map((r) => ({
    auditId: r.audit_id,
    score: r.overall_score,
    date: new Date(r.started_at),
  })).reverse(); // Oldest first for trend display
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
