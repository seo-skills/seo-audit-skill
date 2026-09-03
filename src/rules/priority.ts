/**
 * What to fix first.
 *
 * An audit produces 332 findings and, until now, no surface could say which
 * mattered. The HTML report ordered by severity and then by registry order, so
 * a weight-1 warning sat above a weight-25 one. That is most of why the report
 * is 54,000 pixels tall: nothing could tell it what to put at the top.
 *
 * No new data was needed. The registry already carries a rule weight (13
 * distinct values, 1–25) and every category carries a weight (summing to 100),
 * and multiplying them puts Core Web Vitals, render-blocking resources and
 * missing alt text at the top — which is the right answer for an SEO tool.
 *
 * Requires the rule registry to be loaded: weights come from it, and an
 * unloaded registry makes every finding rank 0. The package entry and the
 * `Auditor` both import `rules/loader.js`, so any real caller has it; a test
 * that reaches this directly must import it too.
 *
 * This is deliberately **server-side only**. Rule weights exist only after
 * `rules/loader.ts` static-imports all 332 rule modules, and `@core` resolves
 * from `ui/`, so importing this from the renderer would pull the entire audit
 * engine into the browser bundle. The computed number travels on `RuleSummary`
 * instead.
 */

import { getRuleById } from './registry.js';
import { getCategoryById } from '../categories/index.js';
import type { RuleStatus } from '../types.js';

/**
 * How much a status counts toward priority.
 *
 * A warning is worth half a failure rather than some tuned fraction: the point
 * is a stable order, not a pretence of precision. Unmeasured is zero — it is a
 * prompt to re-run, not a finding, and ranking it would put "we did not check
 * this" at the top of a report whose whole job is to say what to fix.
 */
const SEVERITY: Record<RuleStatus, number> = {
  fail: 1,
  warn: 0.5,
  pass: 0,
  'not-measured': 0,
};

/** What the ranker needs to know about one aggregated rule */
export interface PriorityInput {
  ruleId: string;
  categoryId: string;
  status: RuleStatus;
  /** Measured pages where the rule did not pass */
  affectedPages: number;
  /** Pages where the rule took a reading */
  measuredPages: number;
}

/**
 * How much attention a finding deserves, relative to the others in its audit.
 *
 * `rule weight x category weight x severity x share of pages affected`.
 * Higher is more urgent; 0 means "not something to fix".
 *
 * Returns 0 for an unknown rule or category — a rule retired since the audit
 * was stored — rather than guessing a weight for something this build no
 * longer defines.
 */
export function rulePriority(input: PriorityInput): number {
  const rule = getRuleById(input.ruleId);
  const category = getCategoryById(input.categoryId);
  if (!rule || !category) return 0;

  const severity = SEVERITY[input.status];
  if (severity === 0) return 0;

  // Nothing was measured, so nothing can be ranked. Guards the divide below.
  if (input.measuredPages <= 0) return 0;

  const share = input.affectedPages / input.measuredPages;
  return rule.weight * category.weight * severity * share;
}

/**
 * Order findings worst-first, deterministically.
 *
 * The tie-break matters more than it looks: 13 rule weights across 20
 * categories collide often — three rules already tie at 150 — and without a
 * total order the long tail falls back to registry order and shuffles between
 * runs. Rule weight, then category weight, then rule id, which is total.
 */
export function byPriority<T extends PriorityInput>(items: readonly T[]): T[] {
  const scored = items.map((item) => ({
    item,
    priority: rulePriority(item),
    ruleWeight: getRuleById(item.ruleId)?.weight ?? 0,
    categoryWeight: getCategoryById(item.categoryId)?.weight ?? 0,
  }));

  scored.sort(
    (a, b) =>
      b.priority - a.priority ||
      b.ruleWeight - a.ruleWeight ||
      b.categoryWeight - a.categoryWeight ||
      a.item.ruleId.localeCompare(b.item.ruleId)
  );

  return scored.map((s) => s.item);
}
