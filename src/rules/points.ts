/**
 * What fixing one finding is worth, in score points.
 *
 * Every audit tool ranks by severity tier, because its score is a share of
 * clean URLs and cannot say what one fix buys back. Ours is a linear weighted
 * average: a category is Σ(rule weight × result score) ÷ Σ(rule weight) over
 * every scored result on every page, and the overall score is the category
 * scores averaged by category weight. So the gain from making one rule pass is
 * a closed-form number, and the gains of every finding add up to exactly what
 * the score is missing. That number is what the report ranks by and prints.
 *
 * - Advisory and not-measured results score nothing, so they are worth 0 and
 *   are left out of the denominators, the way `calculateCategoryScore()`
 *   leaves them out.
 * - Points are computed on the uncapped average. While a page-level cap holds
 *   (`score-caps.ts`), no fix but lifting the cap moves the shown score; the
 *   report says so beside the points instead of pretending they are live.
 * - Points are score points, never traffic. Nothing here predicts rankings.
 *
 * Server-side only, for the same reason as `priority.ts`: rule weights exist
 * once the registry has loaded, and the renderer must not import the engine.
 */

import { getRuleById } from './registry.js';
import { getCategoryById } from '../categories/index.js';
import type { CategoryResult } from '../types.js';
import type { RuleSummary } from '../dashboard/contract.js';

/** pass 100, warn 50, fail 0, as `scoring.ts` counts them */
const LOST_PER_PAGE = { fail: 100, warn: 50 } as const;

function scored(summary: RuleSummary): boolean {
  return !summary.advisory && !summary.notMeasured && summary.status !== 'not-measured';
}

/**
 * Fill in `points` on every rule summary of an audit.
 *
 * Mutates the summaries in place, the way the priority pass does. A summary
 * without `failedPages` (a row read by an older build) counts all its affected
 * pages at its worst status, which can only overstate a mixed fail/warn rule.
 *
 * @param categories - The audit's categories, each holding `RuleSummary` rows
 */
export function attachPoints(categories: CategoryResult[]): void {
  let totalCategoryWeight = 0;
  for (const category of categories) {
    totalCategoryWeight += getCategoryById(category.categoryId)?.weight ?? 0;
  }

  for (const category of categories) {
    const summaries = category.results as RuleSummary[];
    const categoryWeight = getCategoryById(category.categoryId)?.weight ?? 0;

    // Σ(rule weight × pages it was scored on): the category score's denominator.
    let denominator = 0;
    for (const summary of summaries) {
      if (!scored(summary)) continue;
      denominator += (getRuleById(summary.ruleId)?.weight ?? 0) * summary.measuredPages;
    }

    for (const summary of summaries) {
      summary.points = 0;
      if (!scored(summary) || denominator === 0 || totalCategoryWeight === 0) continue;
      if (summary.status !== 'fail' && summary.status !== 'warn') continue;

      const weight = getRuleById(summary.ruleId)?.weight ?? 0;
      const failed = summary.failedPages ?? (summary.status === 'fail' ? summary.affectedPages : 0);
      const warned = Math.max(summary.affectedPages - failed, 0);
      const lost = weight * (LOST_PER_PAGE.fail * failed + LOST_PER_PAGE.warn * warned);

      summary.points = (lost / denominator) * (categoryWeight / totalCategoryWeight);
    }
  }
}

/** Worst measured status first */
const RANK = { pass: 0, warn: 1, fail: 2 } as const;

/**
 * Points per rule for any audit result, live or stored.
 *
 * A stored audit arrives with one summary per rule and its points already
 * attached; a live one has a result per rule per page. Both reduce to the same
 * counts — pages measured, affected and failed — so the HTML report, which
 * renders either shape, ranks exactly the way the dashboard does.
 *
 * @returns Score points by rule id; rules worth nothing are absent or 0
 */
export function pointsByRule(categories: CategoryResult[]): Map<string, number> {
  const points = new Map<string, number>();
  const summaries: CategoryResult[] = categories.map((category) => {
    const byRule = new Map<string, RuleSummary>();
    for (const result of category.results) {
      const stored = result as Partial<RuleSummary>;
      if (stored.measuredPages !== undefined && stored.affectedPages !== undefined) {
        // Already one summary per rule
        byRule.set(result.ruleId, stored as RuleSummary);
        continue;
      }
      let summary = byRule.get(result.ruleId);
      if (!summary) {
        summary = {
          ruleId: result.ruleId,
          ruleName: result.ruleId,
          priority: 0,
          status: 'pass',
          score: 100,
          message: '',
          totalPages: 0,
          measuredPages: 0,
          affectedPages: 0,
          failedPages: 0,
          notMeasured: true,
          samplePages: [],
        };
        byRule.set(result.ruleId, summary);
      }
      summary.totalPages++;
      if (result.advisory) summary.advisory = true;
      if (result.status === 'not-measured' || result.weight === 0) continue;
      summary.notMeasured = false;
      summary.measuredPages++;
      if (result.status !== 'pass') summary.affectedPages++;
      if (result.status === 'fail') summary.failedPages = (summary.failedPages ?? 0) + 1;
      if (RANK[result.status] > RANK[summary.status as keyof typeof RANK]) summary.status = result.status;
    }
    for (const summary of byRule.values()) {
      if (summary.notMeasured) summary.status = 'not-measured';
    }
    return { ...category, results: [...byRule.values()] };
  });

  // Stored summaries carry their points already; recompute only when one is missing
  const missing = summaries.some((c) => (c.results as RuleSummary[]).some((s) => s.points === undefined));
  if (missing) attachPoints(summaries);
  for (const category of summaries) {
    for (const summary of category.results as RuleSummary[]) points.set(summary.ruleId, summary.points ?? 0);
  }
  return points;
}
