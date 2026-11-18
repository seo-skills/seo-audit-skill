// Regression: ISSUE-008 — a stored crawl forgot that it had gaps
// Found by /qa on 2026-11-18
// Report: .gstack/qa-reports/run-20261118T115906Z/qa-report-seomator-cli-2026-11-18.md
//
// A crawl that could not measure every page ends `completed-with-gaps`, with
// counts of the pages it lost ("Measured 2 of 3 pages · 1 rate-limited"). The
// live result had both, but saving dropped them, so every stored crawl read
// back as complete: the dashboard and the desktop app said "Completed", and
// `seomator report` and MCP get_audit printed no coverage line.
import { describe, it, expect, afterEach } from 'vitest';
import '../rules/loader.js';
import { tempDatabase } from './audits-db/test-fixtures.js';
import { saveAuditToDatabase } from './save-audit.js';
import { getAuditDetail } from '../dashboard/queries.js';
import { coverageLine } from '../reporters/coverage-line.js';
import { renderLlmReport } from '../reporters/llm-reporter.js';
import type { AuditCoverage, AuditResult, CompletionState } from '../types.js';

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

const PAGES = ['https://site.test/', 'https://site.test/a'];

function crawl(completionState: CompletionState, counts: Omit<AuditCoverage, 'pages' | 'detail'>): AuditResult {
  return {
    url: PAGES[0],
    overallScore: 80,
    timestamp: '2026-11-18T00:00:00.000Z',
    crawledPages: PAGES.length,
    coverage: { pages: PAGES, detail: 'per-page', ...counts },
    completionState,
    categoryResults: [
      {
        categoryId: 'core',
        score: 50,
        passCount: 1,
        warnCount: 0,
        failCount: 1,
        results: PAGES.map((pageUrl, i) => ({
          ruleId: 'core-canonical-present',
          status: i === 0 ? ('pass' as const) : ('fail' as const),
          message: i === 0 ? 'Canonical present' : 'No canonical',
          score: i === 0 ? 100 : 0,
          weight: 10,
          details: { pageUrl },
        })),
      },
    ],
  };
}

function storedCopy(result: AuditResult): AuditResult {
  const temp = tempDatabase();
  cleanups.push(temp.cleanup);
  const saved = saveAuditToDatabase(result, { db: temp.db });
  return getAuditDetail(temp.db, saved.auditId)!.result;
}

describe('a stored crawl', () => {
  it('keeps its gaps: completion state and the pages it could not measure', () => {
    const stored = storedCopy(crawl('completed-with-gaps', { attempted: 3, measured: 2, rateLimited: 1, failed: 0, notFetched: 0 }));
    expect(stored.completionState).toBe('completed-with-gaps');
    expect(coverageLine(stored)).toBe('Measured 2 of 3 pages · 1 rate-limited');
  });

  it('prints the coverage line in the report an agent reads back', () => {
    const stored = storedCopy(crawl('completed-with-gaps', { attempted: 3, measured: 2, rateLimited: 0, failed: 0, notFetched: 1 }));
    expect(renderLlmReport(stored)).toContain('Measured 2 of 3 pages · 1 not fetched');
  });

  it('that measured every page reads back as completed, with no coverage line', () => {
    const stored = storedCopy(crawl('completed', { attempted: 2, measured: 2, rateLimited: 0, failed: 0, notFetched: 0 }));
    expect(stored.completionState).toBe('completed');
    expect(coverageLine(stored)).toBeNull();
  });
});

describe('a stored single-page audit', () => {
  it('has no completion state, as the live one has none', () => {
    const { completionState: _state, ...single } = crawl('completed', {});
    const stored = storedCopy({ ...single, crawledPages: 1, coverage: undefined });
    expect(stored.completionState).toBeUndefined();
    expect(coverageLine(stored)).toBeNull();
  });
});
