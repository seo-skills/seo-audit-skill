import { describe, it, expect } from 'vitest';
import { rulePriority, byPriority, type PriorityInput } from './priority.js';
import '../rules/loader.js';

/** cwv-lcp: rule weight 25, category perf weight 10 */
const lcp = (over: Partial<PriorityInput> = {}): PriorityInput => ({
  ruleId: 'cwv-lcp',
  categoryId: 'perf',
  status: 'fail',
  affectedPages: 1,
  measuredPages: 1,
  ...over,
});

describe('rulePriority', () => {
  it('multiplies rule weight, category weight, severity and share of pages', () => {
    expect(rulePriority(lcp())).toBe(25 * 10 * 1 * 1);
    // A warning is worth half a failure
    expect(rulePriority(lcp({ status: 'warn' }))).toBe(25 * 10 * 0.5 * 1);
    // Failing on a quarter of the pages is worth a quarter
    expect(rulePriority(lcp({ affectedPages: 1, measuredPages: 4 }))).toBe(25 * 10 * 1 * 0.25);
  });

  it('gives a passing rule no priority', () => {
    expect(rulePriority(lcp({ status: 'pass', affectedPages: 0 }))).toBe(0);
  });

  it('gives an unmeasured rule no priority', () => {
    // Otherwise the top of every default GUI audit would read "we did not
    // check this" five times: the dashboard defaults Core Web Vitals off.
    expect(rulePriority(lcp({ status: 'not-measured', measuredPages: 0, affectedPages: 0 }))).toBe(0);
    expect(rulePriority(lcp({ status: 'not-measured' }))).toBe(0);
  });

  it('never divides by zero', () => {
    expect(rulePriority(lcp({ measuredPages: 0, affectedPages: 0 }))).toBe(0);
    expect(Number.isFinite(rulePriority(lcp({ measuredPages: 0 })))).toBe(true);
  });

  it('returns 0 for a rule or category this build no longer defines', () => {
    // A stored audit can name a rule that has since been retired. Guessing a
    // weight for it would rank a thing we cannot describe.
    expect(rulePriority(lcp({ ruleId: 'rule-that-was-removed' }))).toBe(0);
    expect(rulePriority(lcp({ categoryId: 'category-that-was-removed' }))).toBe(0);
  });
});

describe('byPriority', () => {
  it('puts what an SEO tool should surface first, first', () => {
    const findings: PriorityInput[] = [
      { ruleId: 'legal-cookie-consent', categoryId: 'legal', status: 'fail', affectedPages: 1, measuredPages: 1 },
      { ruleId: 'cwv-lcp', categoryId: 'perf', status: 'fail', affectedPages: 1, measuredPages: 1 },
      { ruleId: 'core-title-present', categoryId: 'core', status: 'warn', affectedPages: 1, measuredPages: 1 },
      { ruleId: 'cwv-cls', categoryId: 'perf', status: 'fail', affectedPages: 1, measuredPages: 1 },
    ];

    const ordered = byPriority(findings).map((f) => f.ruleId);

    // Core Web Vitals failures first: weight 25 in a 10%-weighted category.
    expect(ordered.slice(0, 2).sort()).toEqual(['cwv-cls', 'cwv-lcp']);
    // Then a failing weight-15 rule in a 1%-weighted category (15), and last a
    // warning on a weight-1 rule even though its category is weighted 11%
    // (1 x 11 x 0.5 = 5.5). Severity and rule weight both count; neither wins
    // alone.
    expect(ordered.slice(2)).toEqual(['legal-cookie-consent', 'core-title-present']);
  });

  it('is a total order, so the long tail does not shuffle between runs', () => {
    // 13 rule weights across 20 categories collide often; without a total
    // tie-break the tail falls back to whatever order it arrived in.
    const tied: PriorityInput[] = [
      { ruleId: 'cwv-fcp', categoryId: 'perf', status: 'pass', affectedPages: 0, measuredPages: 1 },
      { ruleId: 'cwv-ttfb', categoryId: 'perf', status: 'pass', affectedPages: 0, measuredPages: 1 },
      { ruleId: 'perf-dom-size', categoryId: 'perf', status: 'pass', affectedPages: 0, measuredPages: 1 },
    ];

    const once = byPriority(tied).map((f) => f.ruleId);
    const again = byPriority([...tied].reverse()).map((f) => f.ruleId);
    expect(once).toEqual(again);
  });

  it('ranks a site-wide failure above the same rule failing on one page', () => {
    const ordered = byPriority([
      { ruleId: 'cwv-lcp', categoryId: 'perf', status: 'fail', affectedPages: 1, measuredPages: 10 },
      { ruleId: 'cwv-cls', categoryId: 'perf', status: 'fail', affectedPages: 10, measuredPages: 10 },
    ]).map((f) => f.ruleId);

    expect(ordered).toEqual(['cwv-cls', 'cwv-lcp']);
  });
});
