/**
 * The wording the audit page uses for runs, reasons and coverage.
 */
import { describe, it, expect } from 'vitest';
import type { AuditResult, RuleResult } from '../../src/types.js';
import { NOT_MEASURED_REASONS, advisoryCount, completionLabel, coverageText, notMeasuredByReason, renderHint, rerunHref } from './audit-state.js';

const rule = (ruleId: string, status: RuleResult['status'], extra: Partial<RuleResult> = {}): RuleResult =>
  ({ ruleId, status, message: '', score: 0, ...extra }) as RuleResult;

function audit(results: RuleResult[], extra: Partial<AuditResult> = {}): AuditResult {
  return {
    url: 'https://example.com/',
    overallScore: 80,
    timestamp: '',
    crawledPages: 1,
    categoryResults: [{ categoryId: 'core', score: 80, passCount: 0, warnCount: 0, failCount: 0, results }],
    ...extra,
  } as AuditResult;
}

describe('not-measured reasons', () => {
  it("groups a static run's render-only checks under 'needs a browser render'", () => {
    const result = audit([
      rule('cwv-lcp', 'not-measured', { reason: 'needs-render' }),
      rule('js-rendered-title', 'not-measured', { reason: 'needs-render' }),
      rule('core-unavailable-after', 'not-measured', { reason: 'not-applicable' }),
    ]);
    expect(notMeasuredByReason(result)).toEqual([
      { reason: 'needs-render', label: 'needs a browser render', ruleIds: ['cwv-lcp', 'js-rendered-title'] },
      { reason: 'not-applicable', label: 'did not apply', ruleIds: ['core-unavailable-after'] },
    ]);
  });

  it('labels every reason, and gives the actionable ones an action', () => {
    expect(NOT_MEASURED_REASONS['needs-render'].action).toContain('Render in a browser');
    expect(NOT_MEASURED_REASONS['not-applicable'].action).toBeUndefined();
  });
});

describe('render hint', () => {
  const result = audit([rule('cwv-lcp', 'not-measured', { reason: 'needs-render' }), rule('cwv-cls', 'not-measured', { reason: 'needs-render' })]);
  it('counts the checks a render would add', () => {
    expect(renderHint(result, true)).toBe('2 checks need a browser render · Run again with rendering');
  });
  it('says when this build cannot render', () => {
    expect(renderHint(result, false)).toBe('2 checks need a browser render, which this build cannot do');
  });
  it('says nothing when no check needs a render', () => {
    expect(renderHint(audit([rule('a', 'pass')]), true)).toBeNull();
  });
});

describe('completion and coverage', () => {
  it('names a crawl that missed pages', () => {
    const result = audit([], { coverage: { pages: [], detail: 'per-page', attempted: 5, measured: 4, rateLimited: 1 }, completionState: 'completed-with-gaps' });
    expect(completionLabel(result)).toBe('Completed with gaps');
    expect(coverageText(result)).toContain('Measured 4 of 5 pages');
  });
  it('calls a full run completed', () => {
    expect(completionLabel(audit([]))).toBe('Completed');
    expect(coverageText(audit([]))).toBeNull();
  });
});

describe('advisory and rerun', () => {
  it('counts advisory findings that took a reading', () => {
    expect(advisoryCount(audit([rule('a', 'fail', { advisory: true }), rule('b', 'not-measured', { advisory: true }), rule('c', 'fail')]))).toBe(1);
  });
  it('carries the stored run options into "Run again"', () => {
    const result = audit([], { run: { crawl: true, maxPages: 25, measureCwv: true } as never });
    expect(rerunHref('https://example.com/', result)).toBe('/run?url=https%3A%2F%2Fexample.com%2F&render=1&crawl=1&maxPages=25');
    expect(rerunHref('https://example.com/', audit([]), true)).toBe('/run?url=https%3A%2F%2Fexample.com%2F&render=1');
  });
});
