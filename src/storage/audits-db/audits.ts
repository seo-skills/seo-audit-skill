import type Database from 'better-sqlite3';
import type {
  DbAudit,
  HydratedAudit,
  AuditSummary,
  AuditStatus,
  AuditQueryOptions,
  CreateAuditInput,
} from '../types.js';

/**
 * Hydrate an audit record
 */
function hydrateAudit(row: DbAudit): HydratedAudit {
  return {
    id: row.id,
    auditId: row.audit_id,
    domain: row.domain,
    projectName: row.project_name,
    crawlId: row.crawl_id,
    startUrl: row.start_url,
    overallScore: row.overall_score,
    totalRules: row.total_rules,
    passedCount: row.passed_count,
    warningCount: row.warning_count,
    failedCount: row.failed_count,
    pagesAudited: row.pages_audited,
    config: row.config_json ? JSON.parse(row.config_json) : null,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    status: row.status,
  };
}

/**
 * Create audit summary from row
 */
function toAuditSummary(row: DbAudit): AuditSummary {
  return {
    id: row.id,
    auditId: row.audit_id,
    domain: row.domain,
    projectName: row.project_name,
    startUrl: row.start_url,
    overallScore: row.overall_score,
    pagesAudited: row.pages_audited,
    passedCount: row.passed_count,
    warningCount: row.warning_count,
    failedCount: row.failed_count,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    status: row.status,
  };
}

/**
 * Create a new audit
 *
 * @param db - Database instance
 * @param input - Audit creation input
 * @returns Created audit
 */
export function createAudit(
  db: Database.Database,
  input: CreateAuditInput
): HydratedAudit {
  const result = db
    .prepare(
      `
    INSERT INTO audits (
      audit_id, domain, project_name, crawl_id, start_url,
      overall_score, config_json
    ) VALUES (?, ?, ?, ?, ?, 0, ?)
    RETURNING *
  `
    )
    .get(
      input.auditId,
      input.domain,
      input.projectName ?? null,
      input.crawlId ?? null,
      input.startUrl,
      input.config ? JSON.stringify(input.config) : null
    ) as DbAudit;

  return hydrateAudit(result);
}

/**
 * Get an audit by its unique audit_id
 *
 * @param db - Database instance
 * @param auditId - Audit ID (e.g., "2024-01-23-abc123")
 * @returns Audit record or null
 */
export function getAudit(
  db: Database.Database,
  auditId: string
): HydratedAudit | null {
  const row = db
    .prepare('SELECT * FROM audits WHERE audit_id = ?')
    .get(auditId) as DbAudit | undefined;

  return row ? hydrateAudit(row) : null;
}

/**
 * Get an audit by its database ID
 *
 * @param db - Database instance
 * @param id - Database ID
 * @returns Audit record or null
 */
export function getAuditById(
  db: Database.Database,
  id: number
): HydratedAudit | null {
  const row = db
    .prepare('SELECT * FROM audits WHERE id = ?')
    .get(id) as DbAudit | undefined;

  return row ? hydrateAudit(row) : null;
}

/**
 * Get the most recent audit for a domain
 *
 * @param db - Database instance
 * @param domain - Domain name
 * @returns Latest audit or null
 */
export function getLatestAudit(
  db: Database.Database,
  domain: string
): HydratedAudit | null {
  const row = db
    .prepare(
      `
    SELECT * FROM audits
    WHERE domain = ? AND status = 'completed'
    ORDER BY started_at DESC
    LIMIT 1
  `
    )
    .get(domain) as DbAudit | undefined;

  return row ? hydrateAudit(row) : null;
}

/**
 * Get the previous audit for comparison
 *
 * @param db - Database instance
 * @param domain - Domain name
 * @param beforeAuditId - Get audit before this one
 * @returns Previous audit or null
 */
export function getPreviousAudit(
  db: Database.Database,
  domain: string,
  beforeAuditId: string
): HydratedAudit | null {
  const row = db
    .prepare(
      `
    SELECT * FROM audits
    WHERE domain = ? AND status = 'completed' AND audit_id != ?
    ORDER BY started_at DESC
    LIMIT 1
  `
    )
    .get(domain, beforeAuditId) as DbAudit | undefined;

  return row ? hydrateAudit(row) : null;
}

/**
 * List audits with optional filtering
 *
 * @param db - Database instance
 * @param options - Query options
 * @returns Array of audit summaries
 */
export function listAudits(
  db: Database.Database,
  options: AuditQueryOptions = {}
): AuditSummary[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.domain) {
    conditions.push('domain = ?');
    params.push(options.domain);
  }

  if (options.projectName) {
    conditions.push('project_name = ?');
    params.push(options.projectName);
  }

  if (options.minScore !== undefined) {
    conditions.push('overall_score >= ?');
    params.push(options.minScore);
  }

  if (options.maxScore !== undefined) {
    conditions.push('overall_score <= ?');
    params.push(options.maxScore);
  }

  if (options.since) {
    conditions.push('started_at >= ?');
    params.push(options.since.toISOString());
  }

  if (options.until) {
    conditions.push('started_at <= ?');
    params.push(options.until.toISOString());
  }

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const rows = db
    .prepare(
      `
    SELECT * FROM audits
    ${whereClause}
    ORDER BY started_at DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset) as DbAudit[];

  return rows.map(toAuditSummary);
}

/**
 * Complete an audit with final results
 *
 * @param db - Database instance
 * @param auditId - Audit ID
 * @param stats - Final statistics
 * @returns Updated audit or null
 */
export function completeAudit(
  db: Database.Database,
  auditId: string,
  stats: {
    overallScore: number;
    totalRules: number;
    passedCount: number;
    warningCount: number;
    failedCount: number;
    pagesAudited: number;
  }
): HydratedAudit | null {
  const result = db
    .prepare(
      `
    UPDATE audits
    SET status = 'completed',
        completed_at = datetime('now'),
        overall_score = ?,
        total_rules = ?,
        passed_count = ?,
        warning_count = ?,
        failed_count = ?,
        pages_audited = ?
    WHERE audit_id = ?
    RETURNING *
  `
    )
    .get(
      stats.overallScore,
      stats.totalRules,
      stats.passedCount,
      stats.warningCount,
      stats.failedCount,
      stats.pagesAudited,
      auditId
    ) as DbAudit | undefined;

  return result ? hydrateAudit(result) : null;
}

/**
 * Fail an audit with error
 *
 * @param db - Database instance
 * @param auditId - Audit ID
 * @returns Updated audit or null
 */
export function failAudit(
  db: Database.Database,
  auditId: string
): HydratedAudit | null {
  const result = db
    .prepare(
      `
    UPDATE audits
    SET status = 'failed',
        completed_at = datetime('now')
    WHERE audit_id = ?
    RETURNING *
  `
    )
    .get(auditId) as DbAudit | undefined;

  return result ? hydrateAudit(result) : null;
}

/**
 * Delete an audit and all associated data
 *
 * @param db - Database instance
 * @param auditId - Audit ID
 * @returns True if deleted
 */
export function deleteAudit(db: Database.Database, auditId: string): boolean {
  const result = db
    .prepare('DELETE FROM audits WHERE audit_id = ?')
    .run(auditId);
  return result.changes > 0;
}

/**
 * Get audit count
 */
export function getAuditCount(
  db: Database.Database,
  domain?: string
): number {
  if (domain) {
    const result = db
      .prepare('SELECT COUNT(*) as count FROM audits WHERE domain = ?')
      .get(domain) as { count: number };
    return result.count;
  }

  const result = db
    .prepare('SELECT COUNT(*) as count FROM audits')
    .get() as { count: number };
  return result.count;
}

/**
 * Get unique domains with audits
 */
export function getAuditedDomains(db: Database.Database): string[] {
  const rows = db
    .prepare('SELECT DISTINCT domain FROM audits ORDER BY domain')
    .all() as Array<{ domain: string }>;
  return rows.map((r) => r.domain);
}
