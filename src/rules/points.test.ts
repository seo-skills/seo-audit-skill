import { describe, it, expect } from 'vitest';
import { attachPoints } from './points.js';
import { getRuleById, getRulesByCategory } from './registry.js';
import { getCategoryById } from '../categories/index.js';
import type { CategoryResult } from '../types.js';
import type { RuleSummary } from '../dashboard/contract.js';
import '../rules/loader.js';

type Status = 'pass' | 'warn' | 'fail';

/** A stored-shape summary for a real registry rule */
function row(ruleId: string, status: Status | 'not-measured', pages = 1, failed?: number, extra: Partial<RuleSummary> = {}): RuleSummary {
  const affected = status === 'pass' || status === 'not-measured' ? 0 : pages;
  return {
    ruleId,
    ruleName: ruleId,
    priority: 0,
    status,
    score: status === 'fail' ? 0 : status === 'warn' ? 50 : 100,
    message: '',
    totalPages: pages,
    measuredPages: status === 'not-measured' ? 0 : pages,
    affectedPages: affected,
    failedPages: failed ?? (status === 'fail' ? pages : 0),
    notMeasured: status === 'not-measured',
    samplePages: [],
    ...extra,
  };
}

/**
 * The exact score of a set of categories, the way `scoring.ts` computes it but
 * without rounding: Σ(weight × score) per page, then category weights.
 */
function exactScore(categories: CategoryResult[]): number {
  let total = 0;
  let totalWeight = 0;
  for (const category of categories) {
    let sum = 0;
    let weight = 0;
    for (const s of category.results as RuleSummary[]) {
      if (s.advisory || s.notMeasured) continue;
      const w = getRuleById(s.ruleId)!.weight;
      const failed = s.failedPages ?? 0;
      const warned = s.affectedPages - failed;
      const passed = s.measuredPages - s.affectedPages;
      sum += w * (100 * passed + 50 * warned);
      weight += w * s.measuredPages;
    }
    const categoryWeight = getCategoryById(category.categoryId)!.weight;
    total += (sum / weight) * categoryWeight;
    totalWeight += categoryWeight;
  }
  return total / totalWeight;
}

function category(categoryId: string, results: RuleSummary[]): CategoryResult {
  return { categoryId, score: 0, passCount: 0, warnCount: 0, failCount: 0, results };
}

const ids = (categoryId: string) => getRulesByCategory(categoryId).filter((r) => !r.advisory).map((r) => r.id);

describe('attachPoints', () => {
  it('gives every finding the points it would add, and they add up to what is missing', () => {
    const [core0, core1, core2, core3] = ids('core');
    const [perf0, perf1, perf2] = ids('perf');
    const categories = [
      category('core', [row(core0!, 'fail'), row(core1!, 'warn'), row(core2!, 'pass'), row(core3!, 'pass')]),
      category('perf', [row(perf0!, 'warn'), row(perf1!, 'pass'), row(perf2!, 'fail')]),
    ];
    attachPoints(categories);

    const points = categories.flatMap((c) => (c.results as RuleSummary[]).map((s) => s.points ?? 0));
    const total = points.reduce((a, b) => a + b, 0);
    expect(exactScore(categories) + total).toBeCloseTo(100, 9);
    // Passing rules are worth nothing; failing and warning ones are worth something
    for (const s of categories.flatMap((c) => c.results as RuleSummary[])) {
      if (s.status === 'pass') expect(s.points).toBe(0);
      else expect(s.points!).toBeGreaterThan(0);
    }
  });

  it('values a failure at twice the same rule warning', () => {
    const [a, b] = ids('core');
    const failing = [category('core', [row(a!, 'fail'), row(b!, 'pass')])];
    const warning = [category('core', [row(a!, 'warn'), row(b!, 'pass')])];
    attachPoints(failing);
    attachPoints(warning);
    expect((failing[0]!.results[0] as RuleSummary).points!).toBeCloseTo(2 * (warning[0]!.results[0] as RuleSummary).points!, 9);
  });

  it('splits a crawl rule that failed on some pages and warned on others', () => {
    const [a, b] = ids('content');
    // 10 pages: 3 failed, 4 warned, 3 passed
    const mixed = row(a!, 'fail', 10, 3, { affectedPages: 7 });
    const categories = [category('content', [mixed, row(b!, 'pass', 10)])];
    attachPoints(categories);
    expect(exactScore(categories) + mixed.points!).toBeCloseTo(100, 9);
  });

  it('gives advisory and unmeasured results nothing, and keeps them out of the denominator', () => {
    const [a, b, c] = ids('links');
    const advisory = row(b!, 'fail', 1, 1, { advisory: true });
    const unmeasured = row(c!, 'not-measured');
    const categories = [category('links', [row(a!, 'fail'), advisory, unmeasured])];
    attachPoints(categories);
    expect(advisory.points).toBe(0);
    expect(unmeasured.points).toBe(0);
    // The one scored rule fails, so it carries everything the category is missing
    const weight = getCategoryById('links')!.weight;
    expect((categories[0]!.results[0] as RuleSummary).points).toBeCloseTo(100 * (weight / weight), 9);
  });

  it('weighs categories against the categories that ran, not against 100', () => {
    // A run limited to one category: that category is the whole score
    const [a, b] = ids('legal');
    const categories = [category('legal', [row(a!, 'fail'), ...(b ? [row(b, 'pass')] : [])])];
    attachPoints(categories);
    expect(exactScore(categories) + ((categories[0]!.results[0] as RuleSummary).points ?? 0)).toBeCloseTo(100, 9);
  });

  it('counts a row from an older build without failedPages at its worst status', () => {
    const [a, b] = ids('core');
    const old = row(a!, 'fail', 4);
    delete old.failedPages;
    const categories = [category('core', [old, row(b!, 'pass', 4)])];
    attachPoints(categories);
    expect(exactScore([category('core', [{ ...old, failedPages: 4 }, row(b!, 'pass', 4)])]) + old.points!).toBeCloseTo(100, 9);
  });
});
