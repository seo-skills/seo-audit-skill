// Regression: ISSUE-027 — stored run profiles had no scoring version, so compare read a model change as a regression
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T102121Z/qa-report-seomator-cli-skill-2026-10-15.md
//
// 6.0.0 raised SCORING_VERSION to 3 so that `compare` would treat a 5.x
// baseline as a different model, not a regression. But the CLI's audit
// command and both dashboard save calls (the desktop app's too) built the
// run they store by hand, without scoringVersion or the rule filters. A noindex
// page audited with 5.1.0 (90) and then 6.0.0 (capped at 20) made
// `compare --fail-on-regression` exit 1, failing CI over the upgrade.
import { describe, it, expect, afterEach } from 'vitest';
import { saveAuditToDatabase } from './save-audit.js';
import { makeAuditResult, simpleSpec, tempDatabase } from './audits-db/test-fixtures.js';
import { compareRunProfiles, hasMaterialDifference } from './audits-db/run-profile.js';
import { SCORING_VERSION } from '../scoring.js';
import type { AuditRunOptions } from '../types.js';

const URL = 'https://site.test/';

/** The run a caller builds by hand, as `seomator audit` and AuditSession do */
const CALLER_RUN: AuditRunOptions = {
  crawl: false,
  maxPages: 10,
  concurrency: 3,
  measureCwv: false,
  mobile: false,
  simulateInteraction: false,
  categories: [],
  timeout: 30000,
};

/** What the Auditor records on every result */
const ENGINE_RUN: AuditRunOptions = {
  ...CALLER_RUN,
  maxPages: 1,
  concurrency: 1,
  scoringVersion: SCORING_VERSION,
  enableRules: ['*'],
  disableRules: ['perf-*'],
};

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

describe('saveAuditToDatabase run profile (ISSUE-027)', () => {
  it('stores the scoring version and rule filters the engine recorded', () => {
    const t = tempDatabase();
    cleanups.push(t.cleanup);
    const result = { ...makeAuditResult(URL, simpleSpec(URL)), run: ENGINE_RUN };

    const saved = saveAuditToDatabase(result, { db: t.db, run: CALLER_RUN });

    const stored = t.db.getAudit(saved.auditId)?.run;
    expect(stored?.scoringVersion).toBe(SCORING_VERSION);
    expect(stored?.enableRules).toEqual(['*']);
    expect(stored?.disableRules).toEqual(['perf-*']);
    // The caller's own view of the run still wins where it has one
    expect(stored?.maxPages).toBe(10);
  });

  it('makes a baseline stored without a scoring version read as a different model', () => {
    const t = tempDatabase();
    cleanups.push(t.cleanup);
    const baseline = saveAuditToDatabase(makeAuditResult(URL, simpleSpec(URL), 90), { db: t.db, run: CALLER_RUN });
    const upgraded = saveAuditToDatabase(
      { ...makeAuditResult(URL, simpleSpec(URL, 'fail'), 20), run: ENGINE_RUN },
      { db: t.db, run: CALLER_RUN }
    );

    const differences = compareRunProfiles(t.db.getAudit(baseline.auditId)?.run, t.db.getAudit(upgraded.auditId)?.run);
    expect(hasMaterialDifference(differences)).toBe(true);
    expect(differences.map((d) => d.option)).toContain('scoring model');
  });
});

describe('run profile differences read correctly (ISSUE-027)', () => {
  it('names a field older audits never recorded, and an empty disable list as none', () => {
    const differences = compareRunProfiles(CALLER_RUN, ENGINE_RUN);
    const byOption = Object.fromEntries(differences.map((d) => [d.option, d]));
    expect(byOption['scoring model']?.previous).toBe('not recorded');
    expect(byOption['scoring model']?.current).toBe(String(SCORING_VERSION));
    expect(compareRunProfiles(CALLER_RUN, { ...CALLER_RUN, disableRules: [] })[0]?.current).toBe('none');
    expect(compareRunProfiles(CALLER_RUN, { ...CALLER_RUN, categories: ['core'] })[0]?.previous).toBe('all');
  });
});
