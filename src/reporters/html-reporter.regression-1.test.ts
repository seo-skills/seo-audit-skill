// Regression: ISSUE-001 — the HTML fix queue listed a rule twice, each row claiming all of its points
// Found by /qa on 2026-11-19
// Report: .gstack/qa-reports/run-20261118T153622Z/qa-report-seomator-crawl-2026-11-19.md
//
// A crawl can find one rule failing on some pages and warning on others. The
// HTML report grouped its fix queue by rule and status, so that rule took two
// rows and each printed the whole rule's points: on a 40-page crawl of
// crawler-test.com "Add async/defer to scripts" sat at 03 and 04, +0.5 each,
// and the queue said 115 fixes where the dashboard, reading the same audit,
// said 105. Advisory findings, which score nothing yet, were counted as fixes
// too. The queue is now one entry per scored rule, as the dashboard counts it.
import { describe, it, expect } from 'vitest';
import '../rules/loader.js'; // rule weights come from the registry
import { renderHtmlReport } from './html-reporter.js';
import type { AuditResult, CategoryResult, RuleResult } from '../types.js';

const PAGES = ['https://site.test/', 'https://site.test/a', 'https://site.test/b'];

function row(ruleId: string, status: RuleResult['status'], page: string, advisory = false): RuleResult {
  return {
    ruleId,
    status,
    score: status === 'pass' ? 100 : status === 'warn' ? 50 : 0,
    weight: 1,
    message: `${ruleId} on ${page}`,
    details: { pageUrl: `https://site.test${page}` },
    ...(advisory && { advisory: true }),
  };
}

function category(categoryId: string, results: RuleResult[]): CategoryResult {
  return {
    categoryId,
    score: 50,
    passCount: results.filter((r) => r.status === 'pass').length,
    warnCount: results.filter((r) => r.status === 'warn').length,
    failCount: results.filter((r) => r.status === 'fail').length,
    notMeasuredCount: 0,
    results,
  };
}

const crawl: AuditResult = {
  url: 'https://site.test/',
  overallScore: 51,
  timestamp: '2026-11-19T00:00:00.000Z',
  crawledPages: 3,
  coverage: { pages: PAGES, detail: 'per-page', attempted: 3, measured: 3, rateLimited: 0, failed: 0, notFetched: 0 },
  categoryResults: [
    // Fails on the home page, warns on the other two
    category('perf', [row('perf-render-blocking', 'fail', '/'), row('perf-render-blocking', 'warn', '/a'), row('perf-render-blocking', 'warn', '/b')]),
    category('core', [
      row('core-canonical-present', 'fail', '/'),
      row('core-canonical-present', 'pass', '/a'),
      row('core-canonical-present', 'pass', '/b'),
      // An advisory rule: reported, worth nothing to the score
      row('core-obsolete-robots-directives', 'warn', '/', true),
    ]),
  ],
};

/** The fix queue's rows, in order */
function queueRows(html: string): string[] {
  return html.split('<tr class="issue-row"').slice(1).map((r) => r.slice(0, r.indexOf('</tr>')));
}

describe('the HTML fix queue counts a rule once', () => {
  const html = renderHtmlReport(crawl);
  const rows = queueRows(html);
  const ids = rows.map((r) => r.match(/data-rule-id="([^"]*)"/)?.[1]);

  it('lists a rule that fails on one page and warns on others in one row', () => {
    expect(ids.filter((id) => id === 'perf-render-blocking')).toHaveLength(1);
  });

  it('shows that row at its worst status, covering every page it was found on', () => {
    const blocking = rows[ids.indexOf('perf-render-blocking')]!;
    expect(blocking).toContain('data-status="fail"');
    expect(blocking).toContain('3 pages');
  });

  it('leaves advisory findings out of the queue', () => {
    expect(ids).not.toContain('core-obsolete-robots-directives');
  });

  it('counts the same fixes the dashboard does', () => {
    expect(html).toContain('Fix queue (2), by score points returned');
    expect(ids).toEqual(['perf-render-blocking', 'core-canonical-present']);
  });

  it('adds up to what the score is missing, each rule once', () => {
    // perf: weight-20 rule lost 20 × (100 + 50 + 50) of 20 × 3, times 10/21;
    // core: weight-10 rule lost 10 × 100 of 10 × 3, times 11/21
    const shown = rows.map((r) => Number(r.match(/class="fb-num">\+([\d.]+)/)?.[1]));
    expect(shown).toEqual([31.7, 17.5]);
  });
});
