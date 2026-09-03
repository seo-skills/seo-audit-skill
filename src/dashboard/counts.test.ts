/**
 * The HTML report said 332 and the dashboard said 2,656 for the same audit.
 * Both were right; neither said what it was counting.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { countLiveResult, countFromSummaries, ledgerSums } from './counts.js';
import { getAuditDetail } from './queries.js';
import { saveAuditToDatabase } from '../storage/save-audit.js';
import { makeAuditResult, tempDatabase } from '../storage/audits-db/test-fixtures.js';
import type { RuleSummary } from './contract.js';
import '../rules/loader.js';

const URL_UNDER_TEST = 'https://counts.test/';

/** One rule failing on 1 of 4 pages, one rule unmeasured everywhere, one passing */
const SPEC = {
  core: {
    'core-title': [
      { pageUrl: `${URL_UNDER_TEST}a`, status: 'fail' as const },
      { pageUrl: `${URL_UNDER_TEST}b`, status: 'pass' as const },
      { pageUrl: `${URL_UNDER_TEST}c`, status: 'pass' as const },
      { pageUrl: `${URL_UNDER_TEST}d`, status: 'pass' as const },
    ],
    'core-h1': [
      { pageUrl: `${URL_UNDER_TEST}a`, status: 'warn' as const, weight: 0 },
      { pageUrl: `${URL_UNDER_TEST}b`, status: 'warn' as const, weight: 0 },
      { pageUrl: `${URL_UNDER_TEST}c`, status: 'warn' as const, weight: 0 },
      { pageUrl: `${URL_UNDER_TEST}d`, status: 'warn' as const, weight: 0 },
    ],
    'core-lang': [
      { pageUrl: `${URL_UNDER_TEST}a`, status: 'warn' as const },
      { pageUrl: `${URL_UNDER_TEST}b`, status: 'pass' as const },
      { pageUrl: `${URL_UNDER_TEST}c`, status: 'pass' as const },
      { pageUrl: `${URL_UNDER_TEST}d`, status: 'pass' as const },
    ],
  },
};

describe('countLiveResult', () => {
  const counts = countLiveResult(makeAuditResult(URL_UNDER_TEST, SPEC));

  it('counts rules and rule-page evaluations as two different numbers', () => {
    expect(counts.rules.total).toBe(3);
    expect(counts.evaluations.total).toBe(12); // 3 rules x 4 pages
  });

  it('makes both ledgers sum, which is the whole point', () => {
    expect(ledgerSums(counts.rules)).toBe(true);
    expect(ledgerSums(counts.evaluations)).toBe(true);
  });

  it('reports a rule by its worst measured page, not by its page count', () => {
    // core-title fails on one of four pages: one failing RULE, one failing
    // EVALUATION, not four.
    expect(counts.rules.fail).toBe(1);
    expect(counts.evaluations.fail).toBe(1);
    expect(counts.rules.warn).toBe(1); // core-lang
    expect(counts.rules.notMeasured).toBe(1); // core-h1, unmeasured on every page
    expect(counts.evaluations.notMeasured).toBe(4);
  });

  it('counts affected pages as distinct URLs, never as a sum', () => {
    // core-title fails on /a and core-lang warns on /a — one affected page,
    // not two. Summing per-rule counts would say two.
    expect(counts.affectedPages).toBe(1);
    expect(counts.pagesAudited).toBe(4);
  });
});

describe('live and stored counts agree', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  it('the same audit counts the same before and after it is saved', () => {
    const live = makeAuditResult(URL_UNDER_TEST, SPEC);
    const temp = tempDatabase();
    cleanups.push(temp.cleanup);
    const saved = saveAuditToDatabase(live, { db: temp.db });

    const fromLive = countLiveResult(live);
    const detail = getAuditDetail(temp.db, saved.auditId)!;
    const summaries = detail.result.categoryResults.flatMap((c) => c.results as RuleSummary[]);
    const stored = temp.db.getResultCounts(saved.id);

    const fromDisk = countFromSummaries(
      summaries,
      { ...stored },
      fromLive.affectedPages,
      detail.result.crawledPages
    );

    expect(fromDisk.rules).toEqual(fromLive.rules);
    expect(fromDisk.evaluations).toEqual(fromLive.evaluations);
    expect(ledgerSums(fromDisk.rules)).toBe(true);
    expect(ledgerSums(fromDisk.evaluations)).toBe(true);
  });
});
