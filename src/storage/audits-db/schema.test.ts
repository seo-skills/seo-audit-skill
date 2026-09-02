import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ensureColumn, hasColumn, initializeAuditsSchema } from './schema.js';
import { tempDatabase } from './test-fixtures.js';

describe('audits schema migration', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  it('adds the 3.4.0 columns to a database created by an older version', () => {
    const raw = new Database(':memory:');
    cleanups.push(() => raw.close());
    // The pre-3.4.0 shape of the two tables that gained columns
    raw.exec(`
      CREATE TABLE audits (id INTEGER PRIMARY KEY, audit_id TEXT UNIQUE NOT NULL, domain TEXT NOT NULL,
        project_name TEXT, crawl_id TEXT, start_url TEXT NOT NULL, overall_score INTEGER NOT NULL,
        total_rules INTEGER NOT NULL DEFAULT 0, passed_count INTEGER NOT NULL DEFAULT 0,
        warning_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
        pages_audited INTEGER NOT NULL DEFAULT 1, config_json TEXT,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
        status TEXT NOT NULL DEFAULT 'running');
      CREATE TABLE audit_results (id INTEGER PRIMARY KEY, audit_id INTEGER NOT NULL, category_id TEXT NOT NULL,
        rule_id TEXT NOT NULL, rule_name TEXT NOT NULL, page_url TEXT NOT NULL, page_url_hash TEXT NOT NULL,
        status TEXT NOT NULL, score INTEGER NOT NULL, message TEXT NOT NULL, details_json TEXT,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    `);
    expect(hasColumn(raw, 'audits', 'source')).toBe(false);

    initializeAuditsSchema(raw);
    initializeAuditsSchema(raw); // idempotent

    for (const column of ['source', 'engine_version', 'run_json']) {
      expect(hasColumn(raw, 'audits', column)).toBe(true);
    }
    expect(hasColumn(raw, 'audit_results', 'weight')).toBe(true);
    expect(raw.pragma('busy_timeout', { simple: true })).toBe(500);
  });

  it('tolerates losing the check-then-alter race to another process', () => {
    const raw = new Database(':memory:');
    cleanups.push(() => raw.close());
    initializeAuditsSchema(raw);

    // The probe says "missing" although the column exists, which is exactly
    // what a second process sees when the first one adds it in between.
    expect(() => ensureColumn(raw, 'audits', 'source', 'TEXT', () => false)).not.toThrow();
    expect(hasColumn(raw, 'audits', 'source')).toBe(true);
  });

  it('still surfaces errors that are not the duplicate-column race', () => {
    const raw = new Database(':memory:');
    cleanups.push(() => raw.close());
    expect(() => ensureColumn(raw, 'no_such_table', 'x', 'TEXT', () => false)).toThrow(/no such table/);
  });

  it('reads rows written by an older CLI that knows nothing of the new columns', () => {
    const { db, cleanup } = tempDatabase();
    cleanups.push(cleanup);
    const raw = db.getDb();
    raw.prepare(
      `INSERT INTO audits (audit_id, domain, start_url, overall_score, status, completed_at)
       VALUES ('2026-01-01-old001', 'old.test', 'https://old.test/', 55, 'completed', CURRENT_TIMESTAMP)`
    ).run();
    const id = (raw.prepare("SELECT id FROM audits WHERE audit_id = '2026-01-01-old001'").get() as { id: number }).id;
    raw.prepare(
      `INSERT INTO audit_results (audit_id, category_id, rule_id, rule_name, page_url, page_url_hash, status, score, message)
       VALUES (?, 'core', 'core-title', 'Title', 'https://old.test/', 'h', 'warn', 50, 'old row')`
    ).run(id);

    const audit = db.getAudit('2026-01-01-old001')!;
    expect(audit.source).toBeNull();
    expect(audit.engineVersion).toBeNull();
    expect(audit.run).toBeNull();

    const [row] = db.getAllResults(id);
    expect(row!.weight).toBeNull();

    // A NULL weight is an ordinary measured result, as it always was
    const [summary] = db.getRuleSummaries(id);
    expect(summary!.notMeasured).toBe(false);
    expect(summary!.measuredPages).toBe(1);
    expect(summary!.status).toBe('warn');
  });
});
