import { describe, it, expect, afterEach } from 'vitest';
import { saveAuditToDatabase } from '../save-audit.js';
import { diffRules } from './rule-diff.js';
import { makeAuditResult, simpleSpec, tempDatabase } from './test-fixtures.js';
import type { HydratedAuditResult } from '../types.js';

describe('comparisons', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  function open() {
    const t = tempDatabase();
    cleanups.push(t.cleanup);
    return t.db;
  }

  it('buildComparison reads only; recordComparison writes once', () => {
    const db = open();
    const url = 'https://cmp.test/';
    const a = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url, 'fail'), 40), { db });
    const b = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url, 'pass'), 90), { db });
    const before = db.getStats().comparisons; // the save of b recorded one

    const built = db.buildComparison(b.id, a.id);
    expect(built).not.toBeNull();
    expect(built!.scoreDelta).toBe(50);
    expect(built!.fixedIssuesCount).toBe(1);
    expect(built!.newIssuesCount).toBe(0);
    expect(built!.engineChanged).toBe(false);
    expect(db.getStats().comparisons).toBe(before);

    db.recordComparison(b.id, a.id);
    expect(db.getStats().comparisons).toBe(before + 1);
  });

  it('flags an engine change only when both versions are known and differ', () => {
    const db = open();
    const url = 'https://eng.test/';
    const a = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url)), { db });
    const b = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url)), { db });
    const raw = db.getDb();

    raw.prepare('UPDATE audits SET engine_version = ? WHERE id = ?').run('0.0.1', a.id);
    expect(db.buildComparison(b.id, a.id)!.engineChanged).toBe(true);

    raw.prepare('UPDATE audits SET engine_version = NULL WHERE id = ?').run(a.id);
    expect(db.buildComparison(b.id, a.id)!.engineChanged).toBe(false);
  });

  it('getPreviousAudit finds the run before a given one, not the newest other one', () => {
    const db = open();
    const url = 'https://prev.test/';
    const a = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url)), { db });
    const b = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url)), { db });
    const c = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url)), { db });
    // Same-second timestamps, which is what back-to-back runs produce
    db.getDb().prepare("UPDATE audits SET started_at = '2026-09-02 10:00:00'").run();

    expect(db.getPreviousAudit('prev.test', c.auditId)!.auditId).toBe(b.auditId);
    expect(db.getPreviousAudit('prev.test', b.auditId)!.auditId).toBe(a.auditId);
    expect(db.getPreviousAudit('prev.test', a.auditId)).toBeNull();
  });

  it('lists audits and the trend in a stable order', () => {
    const db = open();
    const url = 'https://order.test/';
    const ids = [1, 2, 3].map((score) =>
      saveAuditToDatabase(makeAuditResult(url, simpleSpec(url), score * 10), { db }).auditId
    );
    db.getDb().prepare("UPDATE audits SET started_at = '2026-09-02 10:00:00'").run();

    expect(db.listAudits().map((a) => a.auditId)).toEqual([...ids].reverse());
    expect(db.getLatestAudit('order.test')!.auditId).toBe(ids[2]);
    // Oldest first, reversed exactly once
    expect(db.getScoreTrend('order.test').map((p) => p.score)).toEqual([10, 20, 30]);
  });
});

describe('diffRules', () => {
  let nextId = 1;
  const row = (
    ruleId: string,
    status: HydratedAuditResult['status'],
    pageUrl = 'https://d.test/',
    weight: number | null = 1
  ): HydratedAuditResult => ({
    id: nextId++,
    auditId: 1,
    categoryId: 'core',
    ruleId,
    ruleName: ruleId,
    pageUrl,
    pageUrlHash: 'h',
    status,
    score: status === 'pass' ? 100 : status === 'warn' ? 50 : 0,
    message: `${ruleId} ${status}`,
    details: null,
    executedAt: new Date(),
    weight,
  });

  it('classifies regressed, improved, added and removed rules', () => {
    const diff = diffRules(
      [row('a', 'pass'), row('b', 'fail'), row('c', 'warn'), row('gone', 'pass')],
      [row('a', 'fail'), row('b', 'pass'), row('c', 'warn'), row('new', 'warn')]
    );
    expect(diff.regressed.map((c) => [c.ruleId, c.from, c.to])).toEqual([['a', 'pass', 'fail']]);
    expect(diff.improved.map((c) => [c.ruleId, c.from, c.to])).toEqual([['b', 'fail', 'pass']]);
    expect(diff.added.map((c) => [c.ruleId, c.from, c.to])).toEqual([['new', null, 'warn']]);
    expect(diff.removed.map((c) => [c.ruleId, c.from, c.to])).toEqual([['gone', 'pass', null]]);
  });

  it('uses the worst measured page and counts affected pages', () => {
    const diff = diffRules(
      [row('t', 'pass', '/1'), row('t', 'pass', '/2')],
      [row('t', 'pass', '/1'), row('t', 'fail', '/2'), row('t', 'warn', '/3'), row('t', 'warn', '/4', 0)]
    );
    expect(diff.regressed).toHaveLength(1);
    expect(diff.regressed[0]!.to).toBe('fail');
    expect(diff.regressed[0]!.affectedPages).toBe(2);
    expect(diff.regressed[0]!.totalPages).toBe(4);
  });

  it('treats a rule that took no reading as absent rather than changed', () => {
    const unmeasuredNow = diffRules([row('m', 'pass')], [row('m', 'warn', '/', 0)]);
    expect(unmeasuredNow.regressed).toHaveLength(0);
    expect(unmeasuredNow.removed.map((c) => c.ruleId)).toEqual(['m']);

    const unmeasuredBefore = diffRules([row('m', 'warn', '/', 0)], [row('m', 'fail')]);
    expect(unmeasuredBefore.regressed).toHaveLength(0);
    expect(unmeasuredBefore.added.map((c) => c.ruleId)).toEqual(['m']);

    // Legacy rows with no weight column are measured
    const legacy = diffRules([row('m', 'pass', '/', null)], [row('m', 'fail', '/', null)]);
    expect(legacy.regressed).toHaveLength(1);
  });
});
