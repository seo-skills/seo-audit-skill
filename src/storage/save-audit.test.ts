import { describe, it, expect, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { saveAuditToDatabase, stripUserinfo, withBusyRetry } from './save-audit.js';
import { getVersion } from '../version.js';
import { makeAuditResult, simpleSpec, tempDatabase } from './audits-db/test-fixtures.js';

describe('stripUserinfo', () => {
  it('drops credentials from a URL and keeps everything else', () => {
    expect(stripUserinfo('https://alice:s3cret@staging.example.com/path?q=1#frag')).toBe(
      'https://staging.example.com/path?q=1#frag'
    );
  });

  it('returns a URL without credentials untouched', () => {
    expect(stripUserinfo('https://example.com/a')).toBe('https://example.com/a');
  });

  it('returns unparseable input unchanged', () => {
    expect(stripUserinfo('not a url')).toBe('not a url');
  });
});

describe('withBusyRetry', () => {
  const busy = () => Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' });

  it('retries a busy write and returns the eventual result', () => {
    let calls = 0;
    const sleep = vi.fn();
    const value = withBusyRetry(
      () => {
        calls++;
        if (calls < 3) throw busy();
        return 'done';
      },
      { attempts: 5, delayMs: 7, sleep }
    );
    expect(value).toBe('done');
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(7);
  });

  it('gives up after the attempt budget and rethrows the busy error', () => {
    const sleep = vi.fn();
    expect(() => withBusyRetry(() => { throw busy(); }, { attempts: 3, sleep })).toThrow(/locked/);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does not retry errors that are not busy', () => {
    const sleep = vi.fn();
    expect(() => withBusyRetry(() => { throw new Error('constraint'); }, { attempts: 3, sleep })).toThrow(
      'constraint'
    );
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('saveAuditToDatabase', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  function open() {
    const t = tempDatabase();
    cleanups.push(t.cleanup);
    return t;
  }

  it('stores the audit with its provenance, run options and per-rule weight', () => {
    const { db } = open();
    const result = makeAuditResult('https://example.com/', {
      core: {
        'core-title': [{ pageUrl: 'https://example.com/', status: 'fail' }],
        'core-h1': [{ pageUrl: 'https://example.com/', status: 'warn', weight: 0 }],
      },
    });

    const saved = saveAuditToDatabase(result, {
      db,
      source: 'dashboard',
      projectName: 'demo',
      run: {
        crawl: false,
        maxPages: 1,
        concurrency: 3,
        measureCwv: true,
        mobile: false,
        simulateInteraction: false,
        categories: [],
        timeout: 30000,
      },
    });

    const audit = db.getAudit(saved.auditId);
    expect(audit).not.toBeNull();
    expect(audit!.source).toBe('dashboard');
    expect(audit!.engineVersion).toBe(getVersion());
    expect(audit!.run?.maxPages).toBe(1);
    expect(audit!.status).toBe('completed');
    expect(audit!.totalRules).toBe(2);
    expect(saved.previousAuditId).toBeNull();

    const rows = db.getAllResults(saved.id);
    const weights = Object.fromEntries(rows.map((r) => [r.ruleId, r.weight]));
    expect(weights).toEqual({ 'core-title': 1, 'core-h1': 0 });

    const summary = db.listAudits()[0]!;
    expect(summary.source).toBe('dashboard');
    expect(summary.engineVersion).toBe(getVersion());
  });

  it('defaults the source to cli', () => {
    const { db } = open();
    const saved = saveAuditToDatabase(makeAuditResult('https://a.test/', simpleSpec('https://a.test/')), { db });
    expect(db.getAudit(saved.auditId)!.source).toBe('cli');
  });

  it('never stores credentials from the audited URLs', () => {
    const { db } = open();
    const page = 'https://bob:hunter2@staging.test/page';
    const result = makeAuditResult(page, { core: { 'core-title': [{ pageUrl: page, status: 'pass' }] } });
    const saved = saveAuditToDatabase(result, { db });

    expect(db.getAudit(saved.auditId)!.startUrl).toBe('https://staging.test/page');
    expect(saved.domain).toBe('staging.test');
    for (const row of db.getAllResults(saved.id)) {
      expect(row.pageUrl).not.toContain('hunter2');
      expect(row.pageUrl).toBe('https://staging.test/page');
    }
  });

  it('records the comparison against the previous audit of the same domain', () => {
    const { db } = open();
    const url = 'https://trend.test/';
    const first = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url, 'fail'), 40), { db });
    const second = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url, 'pass'), 90), { db });

    expect(second.previousAuditId).toBe(first.auditId);
    const comparison = db.getComparison(second.id);
    expect(comparison).not.toBeNull();
    expect(comparison!.previousAuditId).toBe(first.id);
    expect(comparison!.scoreDelta).toBe(50);
    expect(comparison!.fixedIssuesCount).toBe(1);
    expect(db.getComparison(first.id)).toBeNull();
    expect(db.getStats().comparisons).toBe(1);
  });

  it('writes nothing when any part of the save fails', () => {
    const { db } = open();
    db.getDb().exec('DROP TABLE audit_categories');

    expect(() =>
      saveAuditToDatabase(makeAuditResult('https://x.test/', simpleSpec('https://x.test/')), { db })
    ).toThrow();

    expect(db.getAuditCount()).toBe(0);
    const results = db.getDb().prepare('SELECT COUNT(*) AS n FROM audit_results').get() as { n: number };
    expect(results.n).toBe(0);
  });

  it('retries while another connection holds the write lock', () => {
    const { db, file } = open();
    db.getDb().pragma('busy_timeout = 0');
    const other = new Database(file);
    cleanups.push(() => other.close());
    other.exec('BEGIN IMMEDIATE');

    const sleep = vi.fn();
    expect(() =>
      saveAuditToDatabase(makeAuditResult('https://y.test/', simpleSpec('https://y.test/')), {
        db,
        retry: { attempts: 3, delayMs: 1, sleep },
      })
    ).toThrow(/locked|busy/i);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(db.getAuditCount()).toBe(0);

    // The lock clears during the pause: the next attempt goes through.
    const release = vi.fn(() => other.exec('COMMIT'));
    const saved = saveAuditToDatabase(makeAuditResult('https://y.test/', simpleSpec('https://y.test/')), {
      db,
      retry: { attempts: 3, delayMs: 1, sleep: release },
    });
    expect(release).toHaveBeenCalledTimes(1);
    expect(db.getAudit(saved.auditId)).not.toBeNull();
  });
});
