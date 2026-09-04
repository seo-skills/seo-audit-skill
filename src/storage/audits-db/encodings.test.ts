/**
 * Three encodings of "not measured" live in the same column.
 *
 * | Encoding | Written by     | status          | weight | Means        |
 * |----------|----------------|-----------------|--------|--------------|
 * | A        | before 3.4.0   | 'warn'          | NULL   | **measured** |
 * | B        | 3.4.0 – 3.5.0  | 'warn'          | 0      | not measured |
 * | C        | 3.6.0 onward   | 'not-measured'  | 0      | not measured |
 *
 * A real user database contains A and B together — one checked here held 15,979
 * rows of A and 142 of B. Encoding A must keep reading as *measured*: those
 * audits predate the weight column and every check in them was a real result.
 *
 * A predicate keying on `status` alone would re-read every 3.4.0 and 3.5.0
 * unmeasured check as a genuine warning, which is the exact bug this repo has
 * already fixed three times. These tests exist so the fix cannot reintroduce it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { tempDatabase } from './test-fixtures.js';
import { diffRules } from './rule-diff.js';
import type { AuditsDatabase } from './index.js';

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function open(): AuditsDatabase {
  const t = tempDatabase();
  cleanups.push(t.cleanup);
  return t.db;
}

/** Insert an audit whose single rule row uses the given encoding */
function seed(
  db: AuditsDatabase,
  auditId: string,
  encoding: { status: string; weight: number | null }
): number {
  const raw = db.getDb();
  raw
    .prepare(
      `INSERT INTO audits (audit_id, domain, start_url, overall_score, status, completed_at)
       VALUES (?, 'enc.test', 'https://enc.test/', 70, 'completed', CURRENT_TIMESTAMP)`
    )
    .run(auditId);
  const id = (raw.prepare('SELECT id FROM audits WHERE audit_id = ?').get(auditId) as { id: number }).id;
  raw
    .prepare(
      `INSERT INTO audit_results
         (audit_id, category_id, rule_id, rule_name, page_url, page_url_hash, status, score, message, weight)
       VALUES (?, 'core', 'cwv-lcp', 'LCP', 'https://enc.test/', 'h', ?, 50, 'no reading', ?)`
    )
    .run(id, encoding.status, encoding.weight);
  return id;
}

const A = { status: 'warn', weight: null };
const B = { status: 'warn', weight: 0 };
const C = { status: 'not-measured', weight: 0 };

describe('the three encodings read correctly', () => {
  it('A (pre-3.4.0, weight NULL) stays MEASURED', () => {
    const db = open();
    const id = seed(db, '2026-01-01-enca01', A);
    const [summary] = db.getRuleSummaries(id);

    expect(summary!.notMeasured, 'encoding A must not become not-measured').toBe(false);
    expect(summary!.measuredPages).toBe(1);
    expect(summary!.status).toBe('warn');
  });

  it('B (3.4.0-3.5.0, warn + weight 0) reads as NOT MEASURED', () => {
    const db = open();
    const id = seed(db, '2026-01-01-encb01', B);
    const [summary] = db.getRuleSummaries(id);

    expect(summary!.notMeasured).toBe(true);
    expect(summary!.measuredPages).toBe(0);
  });

  it('C (new encoding) reads as NOT MEASURED', () => {
    const db = open();
    const id = seed(db, '2026-01-01-encc01', C);
    const [summary] = db.getRuleSummaries(id);

    expect(summary!.notMeasured).toBe(true);
    expect(summary!.measuredPages).toBe(0);
  });

  it('B and C are indistinguishable to every reader', () => {
    const db = open();
    const b = db.getRuleSummaries(seed(db, '2026-01-01-encb02', B))[0]!;
    const c = db.getRuleSummaries(seed(db, '2026-01-01-encc02', C))[0]!;

    expect({ ...c, ruleName: b.ruleName }).toEqual(b);
  });
});

describe('upgrading must not manufacture a regression', () => {
  it('a B audit diffed against a C audit of the same site yields NO changes', () => {
    // The highest-value test in this release. Without it the first
    // `compare --fail-on-regression` after upgrading turns every unmeasured
    // check into a `removed` rule and fails CI on the upgrade itself.
    const db = open();
    const before = seed(db, '2026-01-01-encb03', B);
    const after = seed(db, '2026-01-02-encc03', C);

    const diff = diffRules(db.getAllResults(before), db.getAllResults(after));

    expect(diff.regressed).toEqual([]);
    expect(diff.improved).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('an A audit diffed against a C audit reports the rule as no longer measured', () => {
    // This one SHOULD show a change: encoding A really was a measured warning,
    // and the new audit really did not measure it. Silence here would be a lie.
    const db = open();
    const before = seed(db, '2026-01-01-enca04', A);
    const after = seed(db, '2026-01-02-encc04', C);

    const diff = diffRules(db.getAllResults(before), db.getAllResults(after));

    expect(diff.removed.map((c) => c.ruleId)).toEqual(['cwv-lcp']);
    expect(diff.regressed).toEqual([]);
  });
});
