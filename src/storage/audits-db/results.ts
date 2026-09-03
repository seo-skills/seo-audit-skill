import type Database from 'better-sqlite3';
import type {
  DbAuditResult,
  DbAuditCategory,
  HydratedAuditResult,
  HydratedAuditCategory,
  RuleResultQueryOptions,
  InsertResultInput,
  InsertCategoryInput,
  RuleResultStatus,
  StoredRuleSummary,
} from '../types.js';
import { hashUrl } from '../utils/hash.js';
import { parseSqliteUtc } from '../sqlite-time.js';

/**
 * Hydrate a category result record
 */
function hydrateCategory(row: DbAuditCategory): HydratedAuditCategory {
  return {
    id: row.id,
    auditId: row.audit_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    score: row.score,
    weight: row.weight,
    passCount: row.pass_count,
    warnCount: row.warn_count,
    failCount: row.fail_count,
  };
}

/**
 * Hydrate an audit result record
 */
function hydrateResult(row: DbAuditResult): HydratedAuditResult {
  return {
    id: row.id,
    auditId: row.audit_id,
    categoryId: row.category_id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    pageUrl: row.page_url,
    pageUrlHash: row.page_url_hash,
    status: row.status as RuleResultStatus,
    score: row.score,
    message: row.message,
    details: row.details_json ? JSON.parse(row.details_json) : null,
    executedAt: parseSqliteUtc(row.executed_at),
    weight: row.weight ?? null,
  };
}

// =============================================================================
// Category Operations
// =============================================================================

/**
 * Insert a category result
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param input - Category data
 * @returns Inserted category result
 */
export function insertCategory(
  db: Database.Database,
  auditId: number,
  input: InsertCategoryInput
): HydratedAuditCategory {
  const result = db
    .prepare(
      `
    INSERT INTO audit_categories (
      audit_id, category_id, category_name, score, weight,
      pass_count, warn_count, fail_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `
    )
    .get(
      auditId,
      input.categoryId,
      input.categoryName,
      input.score,
      input.weight,
      input.passCount,
      input.warnCount,
      input.failCount
    ) as DbAuditCategory;

  return hydrateCategory(result);
}

/**
 * Insert multiple category results in a transaction
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param categories - Array of category inputs
 * @returns Number of categories inserted
 */
export function insertCategories(
  db: Database.Database,
  auditId: number,
  categories: InsertCategoryInput[]
): number {
  if (categories.length === 0) return 0;

  const stmt = db.prepare(`
    INSERT INTO audit_categories (
      audit_id, category_id, category_name, score, weight,
      pass_count, warn_count, fail_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((inputs: InsertCategoryInput[]) => {
    let count = 0;
    for (const input of inputs) {
      stmt.run(
        auditId,
        input.categoryId,
        input.categoryName,
        input.score,
        input.weight,
        input.passCount,
        input.warnCount,
        input.failCount
      );
      count++;
    }
    return count;
  });

  return insertAll(categories);
}

/**
 * Get category results for an audit
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @returns Array of category results
 */
export function getCategories(
  db: Database.Database,
  auditId: number
): HydratedAuditCategory[] {
  const rows = db
    .prepare('SELECT * FROM audit_categories WHERE audit_id = ? ORDER BY weight DESC')
    .all(auditId) as DbAuditCategory[];

  return rows.map(hydrateCategory);
}

/**
 * Get a specific category result
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param categoryId - Category ID
 * @returns Category result or null
 */
export function getCategory(
  db: Database.Database,
  auditId: number,
  categoryId: string
): HydratedAuditCategory | null {
  const row = db
    .prepare('SELECT * FROM audit_categories WHERE audit_id = ? AND category_id = ?')
    .get(auditId, categoryId) as DbAuditCategory | undefined;

  return row ? hydrateCategory(row) : null;
}

// =============================================================================
// Rule Result Operations
// =============================================================================

/**
 * Insert a single rule result
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param input - Result data
 * @returns Inserted result
 */
export function insertResult(
  db: Database.Database,
  auditId: number,
  input: InsertResultInput
): HydratedAuditResult {
  const pageUrlHash = hashUrl(input.pageUrl);

  const result = db
    .prepare(
      `
    INSERT INTO audit_results (
      audit_id, category_id, rule_id, rule_name,
      page_url, page_url_hash, status, score, message, details_json, weight
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `
    )
    .get(
      auditId,
      input.categoryId,
      input.ruleId,
      input.ruleName,
      input.pageUrl,
      pageUrlHash,
      input.status,
      input.score,
      input.message,
      input.details ? JSON.stringify(input.details) : null,
      input.weight ?? 1
    ) as DbAuditResult;

  return hydrateResult(result);
}

/**
 * Insert multiple rule results in a transaction
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param results - Array of result inputs
 * @returns Number of results inserted
 */
export function insertResults(
  db: Database.Database,
  auditId: number,
  results: InsertResultInput[]
): number {
  if (results.length === 0) return 0;

  const stmt = db.prepare(`
    INSERT INTO audit_results (
      audit_id, category_id, rule_id, rule_name,
      page_url, page_url_hash, status, score, message, details_json, weight
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((inputs: InsertResultInput[]) => {
    let count = 0;
    for (const input of inputs) {
      const pageUrlHash = hashUrl(input.pageUrl);
      stmt.run(
        auditId,
        input.categoryId,
        input.ruleId,
        input.ruleName,
        input.pageUrl,
        pageUrlHash,
        input.status,
        input.score,
        input.message,
        input.details ? JSON.stringify(input.details) : null,
        input.weight ?? 1
      );
      count++;
    }
    return count;
  });

  return insertAll(results);
}

/**
 * Get rule results with filtering
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param options - Query options
 * @returns Array of results
 */
export function getResults(
  db: Database.Database,
  auditId: number,
  options: RuleResultQueryOptions = {}
): HydratedAuditResult[] {
  const conditions: string[] = ['audit_id = ?'];
  const params: unknown[] = [auditId];

  if (options.categoryId) {
    conditions.push('category_id = ?');
    params.push(options.categoryId);
  }

  if (options.ruleId) {
    conditions.push('rule_id = ?');
    params.push(options.ruleId);
  }

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  if (options.pageUrl) {
    conditions.push('page_url_hash = ?');
    params.push(hashUrl(options.pageUrl));
  }

  const limit = options.limit ?? 1000;
  const offset = options.offset ?? 0;

  const rows = db
    .prepare(
      `
    SELECT * FROM audit_results
    WHERE ${conditions.join(' AND ')}
    ORDER BY id
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset) as DbAuditResult[];

  return rows.map(hydrateResult);
}

/**
 * Every result row of an audit, in insertion order, with no page cap.
 *
 * A 1,000-page crawl stores ~332,000 rows; `getResults()` stops at 1,000 by
 * default, which silently truncated exports and comparisons. Use this for
 * export, compare and reconstruction, and `getRuleSummaries()` for display.
 */
export function getAllResults(db: Database.Database, auditId: number): HydratedAuditResult[] {
  const rows = db
    .prepare('SELECT * FROM audit_results WHERE audit_id = ? ORDER BY id')
    .all(auditId) as DbAuditResult[];
  return rows.map(hydrateResult);
}

/**
 * Whether a stored row carries no reading, across all three encodings.
 *
 * A: `status='warn', weight=NULL` (pre-3.4.0) — **measured**, and stays so.
 * B: `status='warn', weight=0`    (3.4.0-3.5.0)
 * C: `status='not-measured'`      (3.6.0 onward)
 *
 * `weight = 0` is NULL for encoding A under SQL's three-valued logic, so A
 * falls through to measured without needing an explicit guard.
 */
const NOT_MEASURED_SQL = `(weight = 0 OR status = 'not-measured')`;

/** How a stored row ranks when picking a rule's worst page: unmeasured rows lose to everything */
const SEVERITY_SQL = `CASE
  WHEN ${NOT_MEASURED_SQL} THEN -1
  WHEN status = 'fail' THEN 2
  WHEN status = 'warn' THEN 1
  ELSE 0
END`;

/** Sample pages kept per rule in a summary */
export const RULE_SUMMARY_SAMPLE_PAGES = 5;

/**
 * Aggregate an audit's results per rule, in SQL.
 *
 * Two fixed queries regardless of page count: one GROUP BY for the counts and
 * one window query for the worst rows. A row with weight 0 was not measured
 * (the rule could not take a reading on that page); such rows count toward
 * `totalPages` but never toward the status. A rule whose rows are all
 * unmeasured comes back with `notMeasured: true`, status 'warn' and score 50,
 * which is exactly what `notMeasured()` produces live.
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @returns One summary per rule, in first-seen order
 */
export function getRuleSummaries(db: Database.Database, auditId: number): StoredRuleSummary[] {
  const counts = db
    .prepare(
      `
    SELECT category_id, rule_id, rule_name,
      COUNT(*) AS total_pages,
      SUM(CASE WHEN ${NOT_MEASURED_SQL} THEN 0 ELSE 1 END) AS measured_pages,
      SUM(CASE WHEN NOT ${NOT_MEASURED_SQL} AND status <> 'pass' THEN 1 ELSE 0 END) AS affected_pages,
      MIN(id) AS first_id
    FROM audit_results
    WHERE audit_id = ?
    GROUP BY category_id, rule_id
    ORDER BY first_id
  `
    )
    .all(auditId) as Array<{
    category_id: string;
    rule_id: string;
    rule_name: string;
    total_pages: number;
    measured_pages: number;
    affected_pages: number;
  }>;

  const samples = db
    .prepare(
      `
    WITH ranked AS (
      SELECT rule_id, page_url, score, message, details_json,
        CASE WHEN ${NOT_MEASURED_SQL} THEN 'not-measured' ELSE status END AS status,
        ROW_NUMBER() OVER (PARTITION BY rule_id ORDER BY (${SEVERITY_SQL}) DESC, id) AS rn
      FROM audit_results
      WHERE audit_id = ?
    )
    SELECT * FROM ranked WHERE rn <= ? ORDER BY rule_id, rn
  `
    )
    .all(auditId, RULE_SUMMARY_SAMPLE_PAGES) as Array<{
    rule_id: string;
    page_url: string;
    status: RuleResultStatus;
    score: number;
    message: string;
    details_json: string | null;
    rn: number;
  }>;

  const samplesByRule = new Map<string, typeof samples>();
  for (const row of samples) {
    const list = samplesByRule.get(row.rule_id);
    if (list) list.push(row);
    else samplesByRule.set(row.rule_id, [row]);
  }

  return counts.map((row) => {
    const ruleSamples = samplesByRule.get(row.rule_id) ?? [];
    const worst = ruleSamples[0];
    const notMeasured = row.measured_pages === 0;
    return {
      categoryId: row.category_id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      status: notMeasured ? 'warn' : (worst?.status ?? 'pass'),
      score: notMeasured ? 50 : (worst?.score ?? 100),
      message: worst?.message ?? '',
      details: worst?.details_json ? (JSON.parse(worst.details_json) as Record<string, unknown>) : null,
      totalPages: row.total_pages,
      measuredPages: row.measured_pages,
      affectedPages: row.affected_pages,
      notMeasured,
      samplePages: ruleSamples.map((s) => ({
        pageUrl: s.page_url,
        status: s.status,
        message: s.message,
      })),
    };
  });
}

/**
 * Get results by rule ID
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param ruleId - Rule ID
 * @returns Array of results for that rule
 */
export function getResultsByRule(
  db: Database.Database,
  auditId: number,
  ruleId: string
): HydratedAuditResult[] {
  return getResults(db, auditId, { ruleId });
}

/**
 * Get results by status
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param status - Result status
 * @returns Array of results with that status
 */
export function getResultsByStatus(
  db: Database.Database,
  auditId: number,
  status: RuleResultStatus
): HydratedAuditResult[] {
  return getResults(db, auditId, { status });
}

/**
 * Get results for a specific page
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param pageUrl - Page URL
 * @returns Array of results for that page
 */
export function getResultsByPage(
  db: Database.Database,
  auditId: number,
  pageUrl: string
): HydratedAuditResult[] {
  return getResults(db, auditId, { pageUrl });
}

/**
 * Get failed results
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @returns Array of failed results
 */
export function getFailedResults(
  db: Database.Database,
  auditId: number
): HydratedAuditResult[] {
  return getResults(db, auditId, { status: 'fail' });
}

/**
 * Get result counts by status
 */
export function getResultCounts(
  db: Database.Database,
  auditId: number
): { pass: number; warn: number; fail: number; notMeasured: number; total: number } {
  // Four buckets, and they sum. Bucketing by status alone left unmeasured rows
  // counted as warnings under the old encoding and unaccounted for under the
  // new one, so `pass + warn + fail` quietly fell short of `total`.
  const result = db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN ${NOT_MEASURED_SQL} THEN 0 WHEN status = 'pass' THEN 1 ELSE 0 END) as pass,
      SUM(CASE WHEN ${NOT_MEASURED_SQL} THEN 0 WHEN status = 'warn' THEN 1 ELSE 0 END) as warn,
      SUM(CASE WHEN ${NOT_MEASURED_SQL} THEN 0 WHEN status = 'fail' THEN 1 ELSE 0 END) as fail,
      SUM(CASE WHEN ${NOT_MEASURED_SQL} THEN 1 ELSE 0 END) as notMeasured,
      COUNT(*) as total
    FROM audit_results
    WHERE audit_id = ?
  `
    )
    .get(auditId) as { pass: number; warn: number; fail: number; notMeasured: number; total: number };

  return result;
}

/**
 * Get unique rules that failed
 */
export function getFailedRules(
  db: Database.Database,
  auditId: number
): Array<{ ruleId: string; ruleName: string; failCount: number }> {
  const rows = db
    .prepare(
      `
    SELECT rule_id, rule_name, COUNT(*) as fail_count
    FROM audit_results
    WHERE audit_id = ? AND status = 'fail'
    GROUP BY rule_id, rule_name
    ORDER BY fail_count DESC
  `
    )
    .all(auditId) as Array<{ rule_id: string; rule_name: string; fail_count: number }>;

  return rows.map((r) => ({
    ruleId: r.rule_id,
    ruleName: r.rule_name,
    failCount: r.fail_count,
  }));
}
