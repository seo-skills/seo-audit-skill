import type Database from 'better-sqlite3';
import type {
  DbIssue,
  HydratedIssue,
  IssueSeverity,
  IssueQueryOptions,
  InsertIssueInput,
} from '../types.js';

/**
 * Hydrate an issue record
 */
function hydrateIssue(row: DbIssue): HydratedIssue {
  return {
    id: row.id,
    auditId: row.audit_id,
    ruleId: row.rule_id,
    categoryId: row.category_id,
    severity: row.severity as IssueSeverity,
    title: row.title,
    description: row.description,
    affectedPagesCount: row.affected_pages_count,
    affectedPages: row.affected_pages_json ? JSON.parse(row.affected_pages_json) : [],
    fixSuggestion: row.fix_suggestion,
    priorityScore: row.priority_score,
  };
}

/**
 * Calculate priority score based on severity and affected pages
 *
 * Formula: severityScore * log10(affectedPages + 1)
 * - Critical: base 100
 * - Warning: base 50
 * - Info: base 10
 */
export function calculatePriorityScore(
  severity: IssueSeverity,
  affectedPagesCount: number
): number {
  const severityScores: Record<IssueSeverity, number> = {
    critical: 100,
    warning: 50,
    info: 10,
  };

  const baseScore = severityScores[severity] ?? 0;
  const multiplier = Math.log10(affectedPagesCount + 1);
  return Math.round(baseScore * multiplier);
}

/**
 * Insert a single issue
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param input - Issue data
 * @returns Inserted issue
 */
export function insertIssue(
  db: Database.Database,
  auditId: number,
  input: InsertIssueInput
): HydratedIssue {
  const priorityScore = calculatePriorityScore(input.severity, input.affectedPages.length);

  const result = db
    .prepare(
      `
    INSERT INTO issues (
      audit_id, rule_id, category_id, severity, title,
      description, affected_pages_count, affected_pages_json,
      fix_suggestion, priority_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `
    )
    .get(
      auditId,
      input.ruleId,
      input.categoryId,
      input.severity,
      input.title,
      input.description ?? null,
      input.affectedPages.length,
      JSON.stringify(input.affectedPages),
      input.fixSuggestion ?? null,
      priorityScore
    ) as DbIssue;

  return hydrateIssue(result);
}

/**
 * Insert multiple issues in a transaction
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param issues - Array of issue inputs
 * @returns Number of issues inserted
 */
export function insertIssues(
  db: Database.Database,
  auditId: number,
  issues: InsertIssueInput[]
): number {
  if (issues.length === 0) return 0;

  const stmt = db.prepare(`
    INSERT INTO issues (
      audit_id, rule_id, category_id, severity, title,
      description, affected_pages_count, affected_pages_json,
      fix_suggestion, priority_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((inputs: InsertIssueInput[]) => {
    let count = 0;
    for (const input of inputs) {
      const priorityScore = calculatePriorityScore(input.severity, input.affectedPages.length);
      stmt.run(
        auditId,
        input.ruleId,
        input.categoryId,
        input.severity,
        input.title,
        input.description ?? null,
        input.affectedPages.length,
        JSON.stringify(input.affectedPages),
        input.fixSuggestion ?? null,
        priorityScore
      );
      count++;
    }
    return count;
  });

  return insertAll(issues);
}

/**
 * Get issues with filtering and sorting
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param options - Query options
 * @returns Array of issues
 */
export function getIssues(
  db: Database.Database,
  auditId: number,
  options: IssueQueryOptions = {}
): HydratedIssue[] {
  const conditions: string[] = ['audit_id = ?'];
  const params: unknown[] = [auditId];

  if (options.severity) {
    conditions.push('severity = ?');
    params.push(options.severity);
  }

  if (options.categoryId) {
    conditions.push('category_id = ?');
    params.push(options.categoryId);
  }

  if (options.ruleId) {
    conditions.push('rule_id = ?');
    params.push(options.ruleId);
  }

  if (options.minPriority !== undefined) {
    conditions.push('priority_score >= ?');
    params.push(options.minPriority);
  }

  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const rows = db
    .prepare(
      `
    SELECT * FROM issues
    WHERE ${conditions.join(' AND ')}
    ORDER BY priority_score DESC, affected_pages_count DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset) as DbIssue[];

  return rows.map(hydrateIssue);
}

/**
 * Get issues by severity
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param severity - Issue severity
 * @returns Array of issues
 */
export function getIssuesBySeverity(
  db: Database.Database,
  auditId: number,
  severity: IssueSeverity
): HydratedIssue[] {
  return getIssues(db, auditId, { severity });
}

/**
 * Get critical issues
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @returns Array of critical issues
 */
export function getCriticalIssues(
  db: Database.Database,
  auditId: number
): HydratedIssue[] {
  return getIssues(db, auditId, { severity: 'critical' });
}

/**
 * Get top priority issues
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @param limit - Number of issues to return
 * @returns Array of top priority issues
 */
export function getTopPriorityIssues(
  db: Database.Database,
  auditId: number,
  limit = 10
): HydratedIssue[] {
  return getIssues(db, auditId, { limit });
}

/**
 * Get issue count by severity
 */
export function getIssueCounts(
  db: Database.Database,
  auditId: number
): { critical: number; warning: number; info: number; total: number } {
  const result = db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning,
      SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info,
      COUNT(*) as total
    FROM issues
    WHERE audit_id = ?
  `
    )
    .get(auditId) as { critical: number; warning: number; info: number; total: number };

  return result;
}

/**
 * Generate issues from failed audit results
 *
 * Groups failed results by rule and creates an issue for each unique failure
 *
 * @param db - Database instance
 * @param auditId - Database audit ID
 * @returns Number of issues generated
 */
export function generateIssuesFromResults(
  db: Database.Database,
  auditId: number
): number {
  // Get failed results grouped by rule
  const failedRules = db
    .prepare(
      `
    SELECT
      rule_id,
      category_id,
      rule_name,
      message,
      GROUP_CONCAT(page_url) as affected_pages
    FROM audit_results
    WHERE audit_id = ? AND status = 'fail'
    GROUP BY rule_id, category_id, rule_name, message
  `
    )
    .all(auditId) as Array<{
    rule_id: string;
    category_id: string;
    rule_name: string;
    message: string;
    affected_pages: string;
  }>;

  const issues: InsertIssueInput[] = failedRules.map((rule) => {
    const affectedPages = rule.affected_pages.split(',');
    return {
      ruleId: rule.rule_id,
      categoryId: rule.category_id,
      severity: 'critical' as IssueSeverity,
      title: rule.rule_name,
      description: rule.message,
      affectedPages,
      fixSuggestion: null,
    };
  });

  // Also get warnings (as warning severity)
  const warningRules = db
    .prepare(
      `
    SELECT
      rule_id,
      category_id,
      rule_name,
      message,
      GROUP_CONCAT(page_url) as affected_pages
    FROM audit_results
    WHERE audit_id = ? AND status = 'warn'
    GROUP BY rule_id, category_id, rule_name, message
  `
    )
    .all(auditId) as Array<{
    rule_id: string;
    category_id: string;
    rule_name: string;
    message: string;
    affected_pages: string;
  }>;

  const warningIssues: InsertIssueInput[] = warningRules.map((rule) => {
    const affectedPages = rule.affected_pages.split(',');
    return {
      ruleId: rule.rule_id,
      categoryId: rule.category_id,
      severity: 'warning' as IssueSeverity,
      title: rule.rule_name,
      description: rule.message,
      affectedPages,
      fixSuggestion: null,
    };
  });

  return insertIssues(db, auditId, [...issues, ...warningIssues]);
}
