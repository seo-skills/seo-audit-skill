import { describe, it, expect, afterEach } from 'vitest';
import { saveAuditToDatabase } from '../storage/save-audit.js';
import { makeAuditResult, simpleSpec, tempDatabase } from '../storage/audits-db/test-fixtures.js';
import { compareStored, getAuditDetail, getTrend, listDomains } from './queries.js';
import type { RuleSummary } from './contract.js';

describe('dashboard queries', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  function open() {
    const t = tempDatabase();
    cleanups.push(t.cleanup);
    return t.db;
  }

  it('getAuditDetail matches the live result category by category and rule by rule', () => {
    const db = open();
    const live = makeAuditResult('https://parity.test/', {
      core: {
        'core-title': [
          { pageUrl: 'https://parity.test/', status: 'pass' },
          { pageUrl: 'https://parity.test/a', status: 'fail' },
        ],
        'core-h1': [
          { pageUrl: 'https://parity.test/', status: 'warn', weight: 0 },
          { pageUrl: 'https://parity.test/a', status: 'warn', weight: 0 },
        ],
      },
      perf: {
        'perf-ttfb': [
          { pageUrl: 'https://parity.test/', status: 'warn' },
          { pageUrl: 'https://parity.test/a', status: 'pass' },
        ],
      },
    });
    const saved = saveAuditToDatabase(live, { db, source: 'cli' });

    const detail = getAuditDetail(db, saved.auditId)!;
    expect(detail).not.toBeNull();
    expect(detail.audit.source).toBe('cli');
    expect(detail.result.url).toBe(live.url);
    expect(detail.result.overallScore).toBe(live.overallScore);
    expect(detail.result.crawledPages).toBe(2);
    // Definition order: core before perf
    expect(detail.result.categoryResults.map((c) => c.categoryId)).toEqual(['core', 'perf']);

    for (const liveCategory of live.categoryResults) {
      const stored = detail.result.categoryResults.find((c) => c.categoryId === liveCategory.categoryId)!;
      expect(stored.score).toBe(liveCategory.score);
      expect(stored.passCount).toBe(liveCategory.passCount);
      expect(stored.warnCount).toBe(liveCategory.warnCount);
      expect(stored.failCount).toBe(liveCategory.failCount);
      expect(stored.notMeasuredCount).toBe(liveCategory.notMeasuredCount);

      // One entry per rule, carrying the worst status of that rule live
      const liveRules = new Set(liveCategory.results.map((r) => r.ruleId));
      expect(new Set(stored.results.map((r) => r.ruleId))).toEqual(liveRules);
    }

    const rules = Object.fromEntries(
      detail.result.categoryResults.flatMap((c) => c.results as RuleSummary[]).map((r) => [r.ruleId, r])
    );
    expect(rules['core-title']!.status).toBe('fail');
    expect(rules['core-title']!.affectedPages).toBe(1);
    expect(rules['core-title']!.totalPages).toBe(2);
    expect(rules['core-h1']!.notMeasured).toBe(true);
    expect(rules['core-h1']!.weight).toBe(0);
    expect(rules['perf-ttfb']!.status).toBe('warn');
    expect(detail.ruleMetadata['core-title']!.name).toBeTruthy();
  });

  it('returns null for an unknown audit', () => {
    const db = open();
    expect(getAuditDetail(db, 'nope')).toBeNull();
  });

  it('listDomains reports the latest audit, its movement and a sparkline per domain', () => {
    const db = open();
    const a = 'https://alpha.test/';
    const b = 'https://beta.test/';
    saveAuditToDatabase(makeAuditResult(a, simpleSpec(a, 'fail'), 40), { db });
    saveAuditToDatabase(makeAuditResult(a, simpleSpec(a, 'pass'), 70), { db });
    saveAuditToDatabase(makeAuditResult(a, simpleSpec(a, 'fail'), 60), { db });
    saveAuditToDatabase(makeAuditResult(b, simpleSpec(b), 95), { db });

    const domains = listDomains(db);
    expect(domains.map((d) => d.domain)).toEqual(['beta.test', 'alpha.test']);

    const alpha = domains[1]!;
    expect(alpha.auditCount).toBe(3);
    expect(alpha.latest.overallScore).toBe(60);
    expect(alpha.scoreDelta).toBe(-10);
    expect(alpha.regressedRules).toBe(1);
    expect(alpha.improvedRules).toBe(0);
    expect(alpha.sparkline).toEqual([40, 70, 60]);

    const beta = domains[0]!;
    expect(beta.auditCount).toBe(1);
    expect(beta.scoreDelta).toBeNull();
    expect(beta.regressedRules).toBeNull();
    expect(beta.sparkline).toEqual([95]);

    expect(getTrend(db, 'alpha.test').map((p) => p.score)).toEqual([40, 70, 60]);
  });

  it('compareStored diffs against the previous run or a named one', () => {
    const db = open();
    const url = 'https://cs.test/';
    const first = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url, 'pass'), 90), { db });
    const second = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url, 'fail'), 50), { db });
    const third = saveAuditToDatabase(makeAuditResult(url, simpleSpec(url, 'warn'), 70), { db });

    const vsPrevious = compareStored(db, third.auditId)!;
    expect(vsPrevious.previous.auditId).toBe(second.auditId);
    expect(vsPrevious.scoreDelta).toBe(20);
    expect(vsPrevious.rules.improved.map((c) => c.ruleId)).toEqual(['core-title']);

    const vsFirst = compareStored(db, third.auditId, first.auditId)!;
    expect(vsFirst.previous.auditId).toBe(first.auditId);
    expect(vsFirst.rules.regressed.map((c) => [c.ruleId, c.from, c.to])).toEqual([['core-title', 'pass', 'warn']]);

    expect(compareStored(db, first.auditId)).toBeNull();
    expect(db.getStats().comparisons).toBe(2); // only the saves recorded rows
  });
});
