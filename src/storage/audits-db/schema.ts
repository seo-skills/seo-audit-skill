import type Database from 'better-sqlite3';

/**
 * Initialize the audits database schema
 *
 * @param db - better-sqlite3 database instance
 */
export function initializeAuditsSchema(db: Database.Database): void {
  // Set pragmas. busy_timeout is short on purpose: better-sqlite3's busy wait
  // blocks the whole event loop, so callers that can afford to wait retry
  // asynchronously instead (see save-audit.ts).
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 500');

  // Audits table - main audit records
  db.prepare(`
    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER PRIMARY KEY,
      audit_id TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL,
      project_name TEXT,
      crawl_id TEXT,
      start_url TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      total_rules INTEGER DEFAULT 0,
      passed_count INTEGER DEFAULT 0,
      warning_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      pages_audited INTEGER DEFAULT 1,
      config_json TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT DEFAULT 'running'
    )
  `).run();

  // Category results table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_categories (
      id INTEGER PRIMARY KEY,
      audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      weight INTEGER NOT NULL,
      pass_count INTEGER DEFAULT 0,
      warn_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      UNIQUE(audit_id, category_id)
    )
  `).run();

  // Per-rule, per-page audit results
  db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_results (
      id INTEGER PRIMARY KEY,
      audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      page_url TEXT NOT NULL,
      page_url_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      score INTEGER NOT NULL,
      message TEXT NOT NULL,
      details_json TEXT,
      executed_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Aggregated issues table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY,
      audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      rule_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      affected_pages_count INTEGER DEFAULT 1,
      affected_pages_json TEXT,
      fix_suggestion TEXT,
      priority_score INTEGER DEFAULT 0
    )
  `).run();

  // Audit comparisons table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_comparisons (
      id INTEGER PRIMARY KEY,
      current_audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
      previous_audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
      domain TEXT NOT NULL,
      score_delta INTEGER NOT NULL,
      category_deltas_json TEXT,
      new_issues_count INTEGER DEFAULT 0,
      fixed_issues_count INTEGER DEFAULT 0,
      compared_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_audits_domain ON audits(domain)',
    'CREATE INDEX IF NOT EXISTS idx_audits_started ON audits(started_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_audits_score ON audits(overall_score)',
    'CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status)',
    'CREATE INDEX IF NOT EXISTS idx_categories_audit ON audit_categories(audit_id)',
    'CREATE INDEX IF NOT EXISTS idx_results_audit ON audit_results(audit_id)',
    'CREATE INDEX IF NOT EXISTS idx_results_rule ON audit_results(audit_id, rule_id)',
    'CREATE INDEX IF NOT EXISTS idx_results_status ON audit_results(audit_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_results_page ON audit_results(audit_id, page_url_hash)',
    'CREATE INDEX IF NOT EXISTS idx_issues_audit ON issues(audit_id)',
    'CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(audit_id, severity)',
    'CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(audit_id, priority_score DESC)',
    'CREATE INDEX IF NOT EXISTS idx_comparisons_current ON audit_comparisons(current_audit_id)',
    'CREATE INDEX IF NOT EXISTS idx_comparisons_domain ON audit_comparisons(domain)',
  ];

  for (const idx of indexes) {
    db.prepare(idx).run();
  }

  // Columns added after the tables above first shipped. Additive and
  // idempotent, so an older CLI can keep writing to a newer database.
  ensureColumn(db, 'audit_results', 'weight', 'INTEGER');
  ensureColumn(db, 'audits', 'source', 'TEXT');
  ensureColumn(db, 'audits', 'engine_version', 'TEXT');
  ensureColumn(db, 'audits', 'run_json', 'TEXT');
}

/**
 * Whether a table already has a column.
 */
export function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

/**
 * Add a column if it is missing.
 *
 * Check-then-alter is not atomic across processes: a CLI and the dashboard
 * opening a fresh file at the same moment can both see the column missing, and
 * the second ALTER then fails with "duplicate column name". That failure means
 * the column exists, which is what we wanted, so it is swallowed. Any other
 * error is real and propagates.
 *
 * @param check - The column-exists probe, injectable so the race can be tested
 */
export function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  type: string,
  check: (db: Database.Database, table: string, column: string) => boolean = hasColumn
): void {
  if (check(db, table, column)) return;
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column name/i.test(message)) throw error;
  }
}

/**
 * Get audits database statistics
 */
export function getAuditsDbStats(db: Database.Database): {
  audits: number;
  categories: number;
  results: number;
  issues: number;
  comparisons: number;
  dbSizeBytes: number;
} {
  const counts = db
    .prepare(
      `
    SELECT
      (SELECT COUNT(*) FROM audits) as audits,
      (SELECT COUNT(*) FROM audit_categories) as categories,
      (SELECT COUNT(*) FROM audit_results) as results,
      (SELECT COUNT(*) FROM issues) as issues,
      (SELECT COUNT(*) FROM audit_comparisons) as comparisons
  `
    )
    .get() as {
    audits: number;
    categories: number;
    results: number;
    issues: number;
    comparisons: number;
  };

  // Get database file size
  const pageCount = db.prepare('PRAGMA page_count').get() as { page_count: number };
  const pageSize = db.prepare('PRAGMA page_size').get() as { page_size: number };
  const dbSizeBytes = (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 4096);

  return { ...counts, dbSizeBytes };
}
