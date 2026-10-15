// Regression: ISSUE-035 — compare --json stopped being parseable JSON on the runs ISSUE-027 makes common
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T102121Z/qa-report-seomator-cli-skill-2026-10-15.md
//
// With --json and --fail-on-regression, a pair of audits measured differently
// printed the JSON document and then a plain-text "Not failing on regression"
// line, so `seomator compare --json --fail-on-regression | jq` broke. Once the
// scoring version is stored (ISSUE-027), that is every first comparison after
// an upgrade. `--trend --json` with no stored audits printed plain text and
// exited 1, the "below threshold" code. And every no-audits hint told users to
// run `seomator audit <domain> --save`: a bare domain the audit command rejects,
// and a flag that no longer does what the hint implies.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCompare, type CompareOptions } from './compare.js';
import { saveAuditToDatabase } from '../storage/save-audit.js';
import { closeAuditsDatabase } from '../storage/index.js';
import { makeAuditResult, simpleSpec } from '../storage/audits-db/test-fixtures.js';
import type { AuditRunOptions } from '../types.js';

const URL = 'https://site.test/';
const RUN: AuditRunOptions = {
  crawl: false,
  maxPages: 10,
  concurrency: 3,
  measureCwv: true,
  mobile: false,
  simulateInteraction: false,
  categories: [],
  timeout: 30000,
};
const OPTIONS: CompareOptions = { json: true, trend: false, failOnRegression: true };

let home: string;
let previousHome: string | undefined;
let stdout: string[];

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'seomator-compare-'));
  previousHome = process.env['SEOMATOR_HOME'];
  process.env['SEOMATOR_HOME'] = home;
  stdout = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  closeAuditsDatabase();
  if (previousHome === undefined) delete process.env['SEOMATOR_HOME'];
  else process.env['SEOMATOR_HOME'] = previousHome;
  rmSync(home, { recursive: true, force: true });
  process.exitCode = undefined;
});

describe('compare --json output (ISSUE-035)', () => {
  it('stays pure JSON when --fail-on-regression skips a pair measured differently', async () => {
    saveAuditToDatabase(makeAuditResult(URL, simpleSpec(URL), 90), { run: RUN });
    saveAuditToDatabase(makeAuditResult(URL, simpleSpec(URL, 'fail'), 40), {
      run: { ...RUN, measureCwv: false },
    });

    await runCompare('site.test', OPTIONS);

    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed.comparable).toBe(false);
    expect(process.exitCode).toBe(0);
  });

  it('reports a missing history as a structured error with --trend --json', async () => {
    await runCompare('nothing.test', { ...OPTIONS, trend: true });

    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed).toMatchObject({ error: true, code: 'no-audits' });
    expect(process.exitCode).toBe(2);
  });

  it('suggests an audit command that works', async () => {
    await runCompare('nothing.test', OPTIONS);

    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed.hint).toContain('seomator audit https://nothing.test');
    expect(parsed.hint).not.toContain('--save');
  });
});
