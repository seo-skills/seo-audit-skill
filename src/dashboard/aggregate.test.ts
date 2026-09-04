/**
 * The in-memory aggregation must match what the database read produces, or a
 * run that failed to save would render differently from the same run saved.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { aggregateResult } from './aggregate.js';
import { getAuditDetail } from './queries.js';
import { saveAuditToDatabase } from '../storage/save-audit.js';
import { makeAuditResult, tempDatabase } from '../storage/audits-db/test-fixtures.js';
import type { AuditMetaDto, RuleSummary } from './contract.js';
import type { AuditsDatabase } from '../storage/audits-db/index.js';

const URL_UNDER_TEST = 'https://agg.test/';

const SPEC = {
  core: {
    'core-title': [
      { pageUrl: URL_UNDER_TEST, status: 'pass' as const },
      { pageUrl: `${URL_UNDER_TEST}a`, status: 'fail' as const, message: 'missing title' },
      { pageUrl: `${URL_UNDER_TEST}b`, status: 'warn' as const },
    ],
    'core-h1': [
      { pageUrl: URL_UNDER_TEST, status: 'warn' as const, weight: 0 },
      { pageUrl: `${URL_UNDER_TEST}a`, status: 'warn' as const, weight: 0 },
    ],
    'core-lang': [
      { pageUrl: URL_UNDER_TEST, status: 'warn' as const, weight: 0 },
      { pageUrl: `${URL_UNDER_TEST}a`, status: 'pass' as const },
    ],
  },
  perf: { 'perf-ttfb': [{ pageUrl: URL_UNDER_TEST, status: 'warn' as const }] },
};

const META: AuditMetaDto = {
  id: 0,
  auditId: '2026-09-03-memory',
  domain: 'agg.test',
  projectName: null,
  startUrl: URL_UNDER_TEST,
  overallScore: 70,
  pagesAudited: 3,
  passedCount: 0,
  warningCount: 0,
  failedCount: 0,
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: 'completed',
  source: 'dashboard',
  engineVersion: '3.4.0',
  totalRules: 0,
  run: null,
};

describe('aggregateResult', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  function open(): AuditsDatabase {
    const temp = tempDatabase();
    cleanups.push(temp.cleanup);
    return temp.db;
  }

  it('produces the same rule summaries as reading the audit back from SQLite', () => {
    const live = makeAuditResult(URL_UNDER_TEST, SPEC, 70);
    const db = open();
    const saved = saveAuditToDatabase(live, { db });

    const fromDisk = getAuditDetail(db, saved.auditId)!;
    const fromMemory = aggregateResult(live, META);

    const byRule = (detail: typeof fromDisk) =>
      Object.fromEntries(
        detail.result.categoryResults.flatMap((category) =>
          (category.results as RuleSummary[]).map((rule) => [
            rule.ruleId,
            {
              status: rule.status,
              score: rule.score,
              message: rule.message,
              totalPages: rule.totalPages,
              measuredPages: rule.measuredPages,
              affectedPages: rule.affectedPages,
              notMeasured: rule.notMeasured,
              samplePages: rule.samplePages.map((p) => `${p.pageUrl}:${p.status}`),
            },
          ])
        )
      );

    expect(byRule(fromMemory)).toEqual(byRule(fromDisk));
    expect(fromMemory.result.categoryResults.map((c) => c.categoryId)).toEqual(
      fromDisk.result.categoryResults.map((c) => c.categoryId)
    );
  });

  it('keeps the category counts the live run reported', () => {
    const live = makeAuditResult(URL_UNDER_TEST, SPEC, 70);
    const aggregated = aggregateResult(live, META);

    for (const category of live.categoryResults) {
      const same = aggregated.result.categoryResults.find((c) => c.categoryId === category.categoryId)!;
      expect(same.score).toBe(category.score);
      expect(same.passCount).toBe(category.passCount);
      expect(same.warnCount).toBe(category.warnCount);
      expect(same.failCount).toBe(category.failCount);
      expect(same.notMeasuredCount).toBe(category.notMeasuredCount);
    }
  });

  it('marks a rule unmeasured only when every page was', () => {
    const rules = aggregateResult(makeAuditResult(URL_UNDER_TEST, SPEC, 70), META).result.categoryResults
      .flatMap((c) => c.results as RuleSummary[])
      .reduce<Record<string, RuleSummary>>((map, rule) => ({ ...map, [rule.ruleId]: rule }), {});

    expect(rules['core-h1']!.notMeasured).toBe(true);
    expect(rules['core-h1']!.status).toBe('warn');
    expect(rules['core-h1']!.score).toBe(50);
    expect(rules['core-h1']!.measuredPages).toBe(0);

    // One unmeasured page and one passing page: measured, and passing
    expect(rules['core-lang']!.notMeasured).toBe(false);
    expect(rules['core-lang']!.status).toBe('pass');
    expect(rules['core-lang']!.measuredPages).toBe(1);
    expect(rules['core-lang']!.totalPages).toBe(2);

    // The worst measured page wins, and carries its own message
    expect(rules['core-title']!.status).toBe('fail');
    expect(rules['core-title']!.message).toBe('missing title');
    expect(rules['core-title']!.affectedPages).toBe(2);
  });
});
