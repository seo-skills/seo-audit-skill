import type Database from 'better-sqlite3';
import type {
  DbCrawl,
  HydratedCrawl,
  CrawlSummary,
  CrawlStats,
  CrawlStatus,
  CrawlQueryOptions,
  CreateCrawlInput,
} from '../types.js';
import type { PartialSeomatorConfig } from '../../config/schema.js';

/**
 * Hydrate a crawl record from the database
 */
function hydrateCrawl(row: DbCrawl): HydratedCrawl {
  return {
    id: row.id,
    crawlId: row.crawl_id,
    projectId: row.project_id,
    startUrl: row.start_url,
    status: row.status,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    config: row.config_json ? JSON.parse(row.config_json) : null,
    stats: row.stats_json ? JSON.parse(row.stats_json) : null,
    errorMessage: row.error_message,
  };
}

/**
 * Create crawl summary from row
 */
function toCrawlSummary(row: DbCrawl): CrawlSummary {
  const stats: CrawlStats | null = row.stats_json
    ? JSON.parse(row.stats_json)
    : null;

  return {
    id: row.id,
    crawlId: row.crawl_id,
    startUrl: row.start_url,
    status: row.status,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    totalPages: stats?.totalPages ?? 0,
    errorCount: stats?.errorCount ?? 0,
  };
}

/**
 * Create a new crawl
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param input - Crawl creation input
 * @returns Created crawl
 */
export function createCrawl(
  db: Database.Database,
  projectId: number,
  input: CreateCrawlInput
): HydratedCrawl {
  const result = db
    .prepare(
      `
    INSERT INTO crawls (crawl_id, project_id, start_url, config_json)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `
    )
    .get(
      input.crawlId,
      projectId,
      input.startUrl,
      input.config ? JSON.stringify(input.config) : null
    ) as DbCrawl;

  return hydrateCrawl(result);
}

/**
 * Get a crawl by its unique crawl_id
 *
 * @param db - Database instance
 * @param crawlId - Crawl ID (e.g., "2024-01-23-abc123")
 * @returns Crawl record or null
 */
export function getCrawl(
  db: Database.Database,
  crawlId: string
): HydratedCrawl | null {
  const row = db
    .prepare('SELECT * FROM crawls WHERE crawl_id = ?')
    .get(crawlId) as DbCrawl | undefined;

  return row ? hydrateCrawl(row) : null;
}

/**
 * Get a crawl by its database ID
 *
 * @param db - Database instance
 * @param id - Database ID
 * @returns Crawl record or null
 */
export function getCrawlById(
  db: Database.Database,
  id: number
): HydratedCrawl | null {
  const row = db
    .prepare('SELECT * FROM crawls WHERE id = ?')
    .get(id) as DbCrawl | undefined;

  return row ? hydrateCrawl(row) : null;
}

/**
 * Get the most recent crawl for a project
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @returns Latest crawl or null
 */
export function getLatestCrawl(
  db: Database.Database,
  projectId: number
): HydratedCrawl | null {
  const row = db
    .prepare(
      `
    SELECT * FROM crawls
    WHERE project_id = ?
    ORDER BY started_at DESC
    LIMIT 1
  `
    )
    .get(projectId) as DbCrawl | undefined;

  return row ? hydrateCrawl(row) : null;
}

/**
 * List crawls for a project
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param options - Query options
 * @returns Array of crawl summaries
 */
export function listCrawls(
  db: Database.Database,
  projectId: number,
  options: CrawlQueryOptions = {}
): CrawlSummary[] {
  const conditions: string[] = ['project_id = ?'];
  const params: unknown[] = [projectId];

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  if (options.since) {
    conditions.push('started_at >= ?');
    params.push(options.since.toISOString());
  }

  if (options.until) {
    conditions.push('started_at <= ?');
    params.push(options.until.toISOString());
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const rows = db
    .prepare(
      `
    SELECT * FROM crawls
    WHERE ${conditions.join(' AND ')}
    ORDER BY started_at DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset) as DbCrawl[];

  return rows.map(toCrawlSummary);
}

/**
 * Update crawl status
 *
 * @param db - Database instance
 * @param crawlId - Crawl ID
 * @param status - New status
 * @returns Updated crawl or null
 */
export function updateCrawlStatus(
  db: Database.Database,
  crawlId: string,
  status: CrawlStatus
): HydratedCrawl | null {
  const result = db
    .prepare(
      `
    UPDATE crawls
    SET status = ?
    WHERE crawl_id = ?
    RETURNING *
  `
    )
    .get(status, crawlId) as DbCrawl | undefined;

  return result ? hydrateCrawl(result) : null;
}

/**
 * Complete a crawl with final stats
 *
 * @param db - Database instance
 * @param crawlId - Crawl ID
 * @param stats - Final crawl statistics
 * @returns Updated crawl or null
 */
export function completeCrawl(
  db: Database.Database,
  crawlId: string,
  stats: CrawlStats
): HydratedCrawl | null {
  const result = db
    .prepare(
      `
    UPDATE crawls
    SET status = 'completed',
        completed_at = datetime('now'),
        stats_json = ?
    WHERE crawl_id = ?
    RETURNING *
  `
    )
    .get(JSON.stringify(stats), crawlId) as DbCrawl | undefined;

  return result ? hydrateCrawl(result) : null;
}

/**
 * Fail a crawl with error message
 *
 * @param db - Database instance
 * @param crawlId - Crawl ID
 * @param errorMessage - Error message
 * @param stats - Partial stats (if any)
 * @returns Updated crawl or null
 */
export function failCrawl(
  db: Database.Database,
  crawlId: string,
  errorMessage: string,
  stats?: Partial<CrawlStats>
): HydratedCrawl | null {
  const result = db
    .prepare(
      `
    UPDATE crawls
    SET status = 'failed',
        completed_at = datetime('now'),
        error_message = ?,
        stats_json = ?
    WHERE crawl_id = ?
    RETURNING *
  `
    )
    .get(
      errorMessage,
      stats ? JSON.stringify(stats) : null,
      crawlId
    ) as DbCrawl | undefined;

  return result ? hydrateCrawl(result) : null;
}

/**
 * Cancel a crawl
 *
 * @param db - Database instance
 * @param crawlId - Crawl ID
 * @param stats - Partial stats at cancellation
 * @returns Updated crawl or null
 */
export function cancelCrawl(
  db: Database.Database,
  crawlId: string,
  stats?: Partial<CrawlStats>
): HydratedCrawl | null {
  const result = db
    .prepare(
      `
    UPDATE crawls
    SET status = 'cancelled',
        completed_at = datetime('now'),
        stats_json = ?
    WHERE crawl_id = ?
    RETURNING *
  `
    )
    .get(
      stats ? JSON.stringify(stats) : null,
      crawlId
    ) as DbCrawl | undefined;

  return result ? hydrateCrawl(result) : null;
}

/**
 * Delete a crawl and all associated data
 *
 * @param db - Database instance
 * @param crawlId - Crawl ID
 * @returns True if deleted
 */
export function deleteCrawl(db: Database.Database, crawlId: string): boolean {
  const result = db
    .prepare('DELETE FROM crawls WHERE crawl_id = ?')
    .run(crawlId);
  return result.changes > 0;
}

/**
 * Get crawl count for a project
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @returns Number of crawls
 */
export function getCrawlCount(db: Database.Database, projectId: number): number {
  const result = db
    .prepare('SELECT COUNT(*) as count FROM crawls WHERE project_id = ?')
    .get(projectId) as { count: number };
  return result.count;
}
