import { describe, it, expect } from 'vitest';
import {
  calculateCategoryScore,
  calculateOverallScore,
  buildCategoryResult,
} from './scoring.js';
import type { RuleResult, CategoryResult, CategoryDefinition } from './types.js';

/**
 * Build a result the way the pass()/warn()/fail() helpers actually do:
 * status score is always 100/50/0, and the rule's weight is a separate field.
 */
function res(status: RuleResult['status'], weight?: number): RuleResult {
  const score = status === 'pass' ? 100 : status === 'warn' ? 50 : 0;
  return { ruleId: `rule-${status}-${weight ?? 'x'}`, status, message: status, score, weight };
}

/**
 * Build a result the way notMeasured() does: a warn-shaped result carrying
 * weight 0, so it is excluded from the average rather than scored at 50.
 */
function notMeasuredRes(ruleId: string): RuleResult {
  return { ruleId, status: 'warn', message: 'not measured', score: 50, weight: 0 };
}

describe('calculateCategoryScore', () => {
  it('returns 0 for empty results array', () => {
    expect(calculateCategoryScore([])).toBe(0);
  });

  it('returns 100 for all passing rules', () => {
    expect(calculateCategoryScore([res('pass', 5), res('pass', 10), res('pass', 1)])).toBe(100);
  });

  it('returns 0 for all failing rules', () => {
    expect(calculateCategoryScore([res('fail', 5), res('fail', 10), res('fail', 1)])).toBe(0);
  });

  it('returns 50 for all warning rules', () => {
    expect(calculateCategoryScore([res('warn', 5), res('warn', 10)])).toBe(50);
  });

  it('averages equally-weighted mixed results', () => {
    // (100 + 50 + 0) / 3 = 50
    expect(calculateCategoryScore([res('pass', 5), res('warn', 5), res('fail', 5)])).toBe(50);
  });

  it('weights each result by its rule weight, not its status score', () => {
    // pass w30 = 3000, fail w10 = 0 -> 3000 / 40 = 75
    expect(calculateCategoryScore([res('pass', 30), res('fail', 10)])).toBe(75);
  });

  it('treats a missing weight as 1', () => {
    // Older stored results carry no weight; they must still count.
    expect(calculateCategoryScore([res('pass'), res('fail')])).toBe(50);
  });

  it('lets a heavy failing rule outweigh several light passes', () => {
    // fail w25 = 0; three passes w1 = 300 -> 300 / 28 = 11
    expect(
      calculateCategoryScore([res('fail', 25), res('pass', 1), res('pass', 1), res('pass', 1)])
    ).toBe(11);
  });

  it('does not let a single pass mask many failures', () => {
    // Regression: the old formula weighted passes 100 and failures 1, so
    // 1 pass + 9 fails scored 92 instead of 10.
    const results = [res('pass', 10), ...Array.from({ length: 9 }, () => res('fail', 10))];
    expect(calculateCategoryScore(results)).toBe(10);
  });

  it('calculates a complex weighted scenario correctly', () => {
    // pass w20 = 2000, warn w30 = 1500, fail w50 = 0 -> 3500 / 100 = 35
    expect(calculateCategoryScore([res('pass', 20), res('warn', 30), res('fail', 50)])).toBe(35);
  });
});

describe('calculateOverallScore', () => {
  const categories: CategoryDefinition[] = [
    { id: 'cat-a', name: 'Category A', description: 'Test A', weight: 30 },
    { id: 'cat-b', name: 'Category B', description: 'Test B', weight: 50 },
    { id: 'cat-c', name: 'Category C', description: 'Test C', weight: 20 },
  ];

  it('returns 0 for empty category results', () => {
    expect(calculateOverallScore([], categories)).toBe(0);
  });

  it('returns 100 when all categories score 100', () => {
    const categoryResults: CategoryResult[] = [
      { categoryId: 'cat-a', score: 100, passCount: 3, warnCount: 0, failCount: 0, results: [] },
      { categoryId: 'cat-b', score: 100, passCount: 3, warnCount: 0, failCount: 0, results: [] },
      { categoryId: 'cat-c', score: 100, passCount: 3, warnCount: 0, failCount: 0, results: [] },
    ];
    expect(calculateOverallScore(categoryResults, categories)).toBe(100);
  });

  it('returns 0 when all categories score 0', () => {
    const categoryResults: CategoryResult[] = [
      { categoryId: 'cat-a', score: 0, passCount: 0, warnCount: 0, failCount: 3, results: [] },
      { categoryId: 'cat-b', score: 0, passCount: 0, warnCount: 0, failCount: 3, results: [] },
      { categoryId: 'cat-c', score: 0, passCount: 0, warnCount: 0, failCount: 3, results: [] },
    ];
    expect(calculateOverallScore(categoryResults, categories)).toBe(0);
  });

  it('calculates weighted average correctly', () => {
    // cat-a: score 100, weight 30 = 3000
    // cat-b: score 50, weight 50 = 2500
    // cat-c: score 0, weight 20 = 0
    // Total weight = 100, Total score = 5500
    // Weighted average = 5500 / 100 = 55
    const categoryResults: CategoryResult[] = [
      { categoryId: 'cat-a', score: 100, passCount: 3, warnCount: 0, failCount: 0, results: [] },
      { categoryId: 'cat-b', score: 50, passCount: 1, warnCount: 2, failCount: 0, results: [] },
      { categoryId: 'cat-c', score: 0, passCount: 0, warnCount: 0, failCount: 3, results: [] },
    ];
    expect(calculateOverallScore(categoryResults, categories)).toBe(55);
  });

  it('ignores categories not in definitions', () => {
    // Only cat-a is in definitions, others are ignored
    const singleCategory: CategoryDefinition[] = [
      { id: 'cat-a', name: 'Category A', description: 'Test A', weight: 100 },
    ];
    const categoryResults: CategoryResult[] = [
      { categoryId: 'cat-a', score: 80, passCount: 2, warnCount: 1, failCount: 0, results: [] },
      { categoryId: 'cat-unknown', score: 0, passCount: 0, warnCount: 0, failCount: 3, results: [] },
    ];
    expect(calculateOverallScore(categoryResults, singleCategory)).toBe(80);
  });

  it('handles categories with zero weight', () => {
    const zeroWeightCategories: CategoryDefinition[] = [
      { id: 'cat-a', name: 'Category A', description: 'Test A', weight: 0 },
      { id: 'cat-b', name: 'Category B', description: 'Test B', weight: 100 },
    ];
    const categoryResults: CategoryResult[] = [
      { categoryId: 'cat-a', score: 0, passCount: 0, warnCount: 0, failCount: 3, results: [] },
      { categoryId: 'cat-b', score: 75, passCount: 2, warnCount: 1, failCount: 0, results: [] },
    ];
    // cat-a has weight 0, so it's ignored
    // Only cat-b contributes: 75 * 100 / 100 = 75
    expect(calculateOverallScore(categoryResults, zeroWeightCategories)).toBe(75);
  });
});

describe('buildCategoryResult', () => {
  it('builds result with correct counts for all passes', () => {
    const ruleResults: RuleResult[] = [
      { ruleId: 'rule-1', status: 'pass', message: 'Passed', score: 10 },
      { ruleId: 'rule-2', status: 'pass', message: 'Passed', score: 10 },
    ];

    const result = buildCategoryResult('test-category', ruleResults);

    expect(result.categoryId).toBe('test-category');
    expect(result.passCount).toBe(2);
    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(0);
    expect(result.score).toBe(100);
    expect(result.results).toBe(ruleResults);
  });

  it('builds result with correct counts for mixed statuses', () => {
    const ruleResults: RuleResult[] = [
      { ruleId: 'rule-1', status: 'pass', message: 'Passed', score: 10 },
      { ruleId: 'rule-2', status: 'warn', message: 'Warning', score: 10 },
      { ruleId: 'rule-3', status: 'fail', message: 'Failed', score: 10 },
      { ruleId: 'rule-4', status: 'warn', message: 'Warning 2', score: 10 },
    ];

    const result = buildCategoryResult('mixed-category', ruleResults);

    expect(result.categoryId).toBe('mixed-category');
    expect(result.passCount).toBe(1);
    expect(result.warnCount).toBe(2);
    expect(result.failCount).toBe(1);
    expect(result.score).toBe(50); // (100 + 50 + 0 + 50) / 4 = 50
    expect(result.results).toHaveLength(4);
  });

  it('builds result for empty results array', () => {
    const result = buildCategoryResult('empty-category', []);

    expect(result.categoryId).toBe('empty-category');
    expect(result.passCount).toBe(0);
    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('preserves the original results array reference', () => {
    const ruleResults: RuleResult[] = [
      { ruleId: 'rule-1', status: 'pass', message: 'Passed', score: 10 },
    ];

    const result = buildCategoryResult('ref-test', ruleResults);

    expect(result.results).toBe(ruleResults);
  });

  it('handles all fail results', () => {
    const ruleResults: RuleResult[] = [
      { ruleId: 'rule-1', status: 'fail', message: 'Failed 1', score: 10 },
      { ruleId: 'rule-2', status: 'fail', message: 'Failed 2', score: 20 },
      { ruleId: 'rule-3', status: 'fail', message: 'Failed 3', score: 30 },
    ];

    const result = buildCategoryResult('all-fail', ruleResults);

    expect(result.passCount).toBe(0);
    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(3);
    expect(result.score).toBe(0);
  });

  // Regression: ISSUE-003 — checks that took no reading were counted as warnings
  // Found by /qa on 2026-09-01
  // Report: .gstack/qa-reports/qa-report-seomator-cli-2026-09-01.md
  describe('checks that took no reading', () => {
    it('counts them separately instead of as warnings', () => {
      // What --no-cwv produced: rules that could not measure, reported as
      // "score 100, N warnings" because weight-0 results fell into warnCount.
      const result = buildCategoryResult('js', [
        res('pass', 5),
        res('pass', 5),
        notMeasuredRes('cwv-lcp'),
        notMeasuredRes('cwv-inp'),
        notMeasuredRes('cwv-cls'),
      ]);

      expect(result.warnCount).toBe(0);
      expect(result.notMeasuredCount).toBe(3);
      expect(result.passCount).toBe(2);
      // The score already excluded them; the counts now agree with it.
      expect(result.score).toBe(100);
    });

    it('keeps real warnings distinct from unmeasured ones', () => {
      const result = buildCategoryResult('mixed', [
        res('warn', 10),
        notMeasuredRes('skipped-1'),
        res('fail', 10),
      ]);

      expect(result.warnCount).toBe(1);
      expect(result.notMeasuredCount).toBe(1);
      expect(result.failCount).toBe(1);
      // (50*10 + 0*10) / 20 = 25 — the unmeasured result moves nothing.
      expect(result.score).toBe(25);
    });

    it('reports zero when everything was measured', () => {
      const result = buildCategoryResult('clean', [res('pass', 5), res('fail', 5)]);

      expect(result.notMeasuredCount).toBe(0);
    });

    it('does not treat a missing weight as unmeasured', () => {
      // Stored audits from before weights were injected carry no weight at all.
      // Those are real results and must stay in the warning count.
      const result = buildCategoryResult('legacy', [
        { ruleId: 'old-rule', status: 'warn', message: 'legacy', score: 50 },
      ]);

      expect(result.warnCount).toBe(1);
      expect(result.notMeasuredCount).toBe(0);
    });
  });
});
