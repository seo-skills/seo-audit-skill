import { describe, it, expect, afterEach } from 'vitest';
import { saveAuditToDatabase } from '../save-audit.js';
import { makeAuditResult, tempDatabase, type PageOutcome } from './test-fixtures.js';

describe('audit results queries', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  function open() {
    const t = tempDatabase();
    cleanups.push(t.cleanup);
    return t.db;
  }

  it('getAllResults returns every row where getResults stops at 1,000', () => {
    const db = open();
    const pages: PageOutcome[] = Array.from({ length: 1200 }, (_, i) => ({
      pageUrl: `https://big.test/p${i}`,
      status: i % 7 === 0 ? 'fail' : 'pass',
    }));
    const saved = saveAuditToDatabase(makeAuditResult('https://big.test/', { core: { 'core-title': pages } }), { db });

    expect(db.getResults(saved.id)).toHaveLength(1000);
    expect(db.getAllResults(saved.id)).toHaveLength(1200);
  });

  it('getRuleSummaries aggregates each rule across pages, worst page first', () => {
    const db = open();
    const saved = saveAuditToDatabase(
      makeAuditResult('https://agg.test/', {
        core: {
          'core-title': [
            { pageUrl: 'https://agg.test/', status: 'pass' },
            { pageUrl: 'https://agg.test/a', status: 'warn', message: 'short title' },
            { pageUrl: 'https://agg.test/b', status: 'fail', message: 'missing title' },
            { pageUrl: 'https://agg.test/c', status: 'pass' },
          ],
          'core-h1': [
            { pageUrl: 'https://agg.test/', status: 'warn', weight: 0 },
            { pageUrl: 'https://agg.test/a', status: 'warn', weight: 0 },
          ],
          'core-lang': [
            { pageUrl: 'https://agg.test/', status: 'warn', weight: 0 },
            { pageUrl: 'https://agg.test/a', status: 'pass' },
          ],
        },
      }),
      { db }
    );

    const byRule = Object.fromEntries(db.getRuleSummaries(saved.id).map((s) => [s.ruleId, s]));

    const title = byRule['core-title']!;
    expect(title.status).toBe('fail');
    expect(title.score).toBe(0);
    expect(title.message).toBe('missing title');
    expect(title.totalPages).toBe(4);
    expect(title.measuredPages).toBe(4);
    expect(title.affectedPages).toBe(2);
    expect(title.notMeasured).toBe(false);
    expect(title.samplePages.map((p) => p.status)).toEqual(['fail', 'warn', 'pass', 'pass']);
    expect(title.samplePages[0]!.pageUrl).toBe('https://agg.test/b');

    // Every page unmeasured: the rule is not measured, exactly like notMeasured() live
    const h1 = byRule['core-h1']!;
    expect(h1.notMeasured).toBe(true);
    expect(h1.status).toBe('warn');
    expect(h1.score).toBe(50);
    expect(h1.measuredPages).toBe(0);
    expect(h1.affectedPages).toBe(0);
    expect(h1.totalPages).toBe(2);

    // One page unmeasured, one passing: measured, passing, and the unmeasured
    // row never becomes the "worst" sample
    const lang = byRule['core-lang']!;
    expect(lang.notMeasured).toBe(false);
    expect(lang.status).toBe('pass');
    expect(lang.measuredPages).toBe(1);
    expect(lang.samplePages[0]!.pageUrl).toBe('https://agg.test/a');
  });

  it('caps sample pages at five per rule', () => {
    const db = open();
    const pages: PageOutcome[] = Array.from({ length: 12 }, (_, i) => ({
      pageUrl: `https://cap.test/p${i}`,
      status: 'fail',
    }));
    const saved = saveAuditToDatabase(makeAuditResult('https://cap.test/', { core: { 'core-title': pages } }), { db });
    const [summary] = db.getRuleSummaries(saved.id);
    expect(summary!.samplePages).toHaveLength(5);
    expect(summary!.affectedPages).toBe(12);
  });
});
