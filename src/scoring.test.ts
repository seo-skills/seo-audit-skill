import { describe, it, expect } from 'vitest';
import {
  calculateCategoryScore,
  calculateOverallScore,
  buildCategoryResult,
} from './scoring.js';
import type { RuleResult, CategoryResult, CategoryDefinition } from './types.js';

describe('calculateCategoryScore', () => {
  it('returns 0 for empty results array', () => {
    expect(calculateCategoryScore([])).toBe(0);
  });

  it('returns 100 for all passing rules', () => {
    const results: RuleResult[] = [
      { ruleId: 'rule-1', status: 'pass', message: 'Passed', score: 10 },
      { ruleId: 'rule-2', status: 'pass', message: 'Passed', score: 10 },
      { ruleId: 'rule-3', status: 'pass', message: 'Passed', score: 10 },
    ];
    expect(calculateCategoryScore(results)).toBe(100);
  });

  it('returns 0 for all failing rules', () => {
    const results: RuleResult[] = [
      { ruleId: 'rule-1', status: 'fail', message: 'Failed', score: 10 },
      { ruleId: 'rule-2', status: 'fail', message: 'Failed', score: 10 },
      { ruleId: 'rule-3', status: 'fail', message: 'Failed', score: 10 },
    ];
    expect(calculateCategoryScore(results)).toBe(0);
  });

  it('returns 50 for all warning rules', () => {
    const results: RuleResult[] = [
      { ruleId: 'rule-1', status: 'warn', message: 'Warning', score: 10 },
      { ruleId: 'rule-2', status: 'warn', message: 'Warning', score: 10 },
    ];
    expect(calculateCategoryScore(results)).toBe(50);
  });

  it('calculates weighted average for mixed pass/warn/fail', () => {
    // 1 pass (100), 1 warn (50), 1 fail (0) with equal weights
    // Average = (100 + 50 + 0) / 3 = 50
    const results: RuleResult[] = [
      { ruleId: 'rule-1', status: 'pass', message: 'Passed', score: 10 },
      { ruleId: 'rule-2', status: 'warn', message: 'Warning', score: 10 },
      { ruleId: 'rule-3', status: 'fail', message: 'Failed', score: 10 },
    ];
    expect(calculateCategoryScore(results)).toBe(50);
  });

  it('uses score as weight for weighted calculation', () => {
    // pass (weight 30) = 100 * 30 = 3000
    // fail (weight 10) = 0 * 10 = 0
    // Total weight = 40, Total score = 3000
    // Weighted average = 3000 / 40 = 75
    const results: RuleResult[] = [
      { ruleId: 'rule-1', status: 'pass', message: 'Passed', score: 30 },
      { ruleId: 'rule-2', status: 'fail', message: 'Failed', score: 10 },
    ];
    expect(calculateCategoryScore(results)).toBe(75);
  });

  it('handles rules with zero score by treating as weight 1', () => {
    // When score is 0, it uses 1 as weight
    const results: RuleResult[] = [
      { ruleId: 'rule-1', status: 'pass', message: 'Passed', score: 0 },
      { ruleId: 'rule-2', status: 'fail', message: 'Failed', score: 0 },
    ];
    // (100 * 1 + 0 * 1) / 2 = 50
    expect(calculateCategoryScore(results)).toBe(50);
  });

  it('calculates complex weighted scenario correctly', () => {
    // pass (weight 20) = 100 * 20 = 2000
    // warn (weight 30) = 50 * 30 = 1500
    // fail (weight 50) = 0 * 50 = 0
    // Total weight = 100, Total score = 3500
    // Weighted average = 3500 / 100 = 35
    const results: RuleResult[] = [
      { ruleId: 'rule-1', status: 'pass', message: 'Passed', score: 20 },
      { ruleId: 'rule-2', status: 'warn', message: 'Warning', score: 30 },
      { ruleId: 'rule-3', status: 'fail', message: 'Failed', score: 50 },
    ];
    expect(calculateCategoryScore(results)).toBe(35);
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
});
