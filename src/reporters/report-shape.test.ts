/**
 * What the report leads with, and what it folds away.
 *
 * The report rendered all 332 checks expanded, ordered by severity and then by
 * registry order. That is 54,000 pixels of page in which a weight-1 warning
 * could sit above a weight-25 one, and in which the 278 checks that passed took
 * up most of the height. Neither is a styling problem: the report had no way to
 * say which finding mattered, and no way to get the settled ones out of the way.
 */
import { describe, it, expect } from 'vitest';
import '../rules/loader.js'; // rule weights come from the registry
import { renderHtmlReport } from './html-reporter.js';
import type { AuditResult, CategoryResult, RuleResult } from '../types.js';

function rule(ruleId: string, status: RuleResult['status'], weight = 1): RuleResult {
  return {
    ruleId,
    status,
    score: status === 'pass' ? 100 : status === 'warn' ? 50 : 0,
    weight,
    message: `${ruleId} says something`,
    details: { pageUrl: 'https://example.com/' },
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

function render(categoryResults: CategoryResult[]): string {
  const result: AuditResult = {
    url: 'https://example.com',
    overallScore: 50,
    categoryResults,
    timestamp: new Date().toISOString(),
    crawledPages: 1,
    coverage: { pages: ['https://example.com/'], detail: 'per-page' },
  };
  return renderHtmlReport(result);
}

/** The order rule names appear in the summary table. */
function tableOrder(html: string): string[] {
  const table = html.split('<tr class="issue-row"').slice(1);
  return table
    .map((row) => row.match(/issue-row-text">([^<]*)</)?.[1] ?? '')
    .filter(Boolean);
}

describe('report ordering', () => {
  it('puts a heavier finding above a lighter one of the same severity', () => {
    // perf-render-blocking is weight 20 in a 10% category (200);
    // legal-cookie-consent is weight 15 in a 1% category (15). Registry order
    // used to put legal first purely because it registered first.
    const html = render([
      category('legal', [rule('legal-cookie-consent', 'warn')]),
      category('perf', [rule('perf-render-blocking', 'warn')]),
    ]);
    const order = tableOrder(html);
    const blocking = order.findIndex((n) => /Render-Blocking/i.test(n));
    const cookie = order.findIndex((n) => /Cookie/i.test(n));
    expect(blocking).toBeGreaterThanOrEqual(0);
    expect(cookie).toBeGreaterThanOrEqual(0);
    expect(blocking).toBeLessThan(cookie);
  });

  it('still puts every failure above every warning', () => {
    const html = render([
      category('perf', [rule('perf-lcp', 'warn')]),
      category('legal', [rule('legal-cookie-consent', 'fail')]),
    ]);
    const statuses = html
      .split('<tr class="issue-row"')
      .slice(1)
      .map((r) => r.match(/data-status="(\w+)"/)?.[1]);
    expect(statuses).toEqual([...statuses].sort((a, b) => (a === 'fail' ? -1 : b === 'fail' ? 1 : 0)));
  });
});

describe('report folding', () => {
  const html = render([
    category('core', [
      rule('core-title-length', 'pass'),
      rule('core-canonical-external', 'pass'),
      rule('core-canonical-multiple', 'fail'),
    ]),
  ]);

  it('folds the checks that need no action', () => {
    expect(html).toContain('<details class="quiet-rules">');
    expect(html).toContain('2 checks that need no action');
  });

  it('keeps the folded checks in the document rather than dropping them', () => {
    // Folding is not filtering: every check must still be findable.
    expect(html).toContain('core-title-length');
    expect(html).toContain('core-canonical-external');
  });

  it('leaves the failure outside the fold', () => {
    const beforeFold = html.split('<details class="quiet-rules">')[0];
    expect(beforeFold).toContain('core-canonical-multiple');
  });

  it('uses the singular when only one check is folded', () => {
    const one = render([
      category('core', [rule('core-title-length', 'pass'), rule('core-canonical-multiple', 'fail')]),
    ]);
    expect(one).toContain('1 check that needs no action');
  });
});
