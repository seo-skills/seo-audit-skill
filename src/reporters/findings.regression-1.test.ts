// Regression: ISSUE-003 — a live crawl report said a finding hit every page it was measured on
// Found by /qa on 2026-11-18
// Report: .gstack/qa-reports/run-20261118T115906Z/qa-report-seomator-cli-2026-11-18.md
//
// The LLM report prints `pages="N" of="M"`: the finding appeared on N of the M
// pages its rule took a reading on. For a live result M was counted from the
// failing rows only, so it always equalled N ("3 of 3" in a 4-page crawl where
// the rule passed on the fourth). Stored audits counted it right; the live path
// now counts the same way, every page with a reading.
import { describe, it, expect } from 'vitest';
import '../rules/loader.js';
import { collectFindings } from './findings.js';
import { renderLlmReport } from './llm-reporter.js';
import type { AuditResult, RuleResult } from '../types.js';

const row = (status: RuleResult['status'], page: string): RuleResult => ({
  ruleId: 'core-canonical-present',
  status,
  score: status === 'pass' ? 100 : 0,
  weight: 1,
  message: status === 'pass' ? 'Canonical present' : 'No canonical link',
  details: { pageUrl: `https://site.test${page}` },
});

const crawl: AuditResult = {
  url: 'https://site.test/',
  overallScore: 80,
  timestamp: '2026-11-18T00:00:00.000Z',
  crawledPages: 4,
  categoryResults: [
    {
      categoryId: 'core',
      score: 50,
      passCount: 1,
      warnCount: 0,
      failCount: 3,
      results: [row('pass', '/'), row('fail', '/a'), row('fail', '/b'), row('fail', '/c')],
    },
  ],
};

describe('a finding in a live crawl', () => {
  it('counts every page its rule was measured on, passing ones included', () => {
    const finding = collectFindings(crawl).find((f) => f.ruleId === 'core-canonical-present')!;
    expect(finding.pageCount).toBe(3);
    expect(finding.measuredPages).toBe(4);
  });

  it('prints 3 of 4 pages in the LLM report', () => {
    expect(renderLlmReport(crawl)).toContain('pages="3" of="4"');
  });
});
