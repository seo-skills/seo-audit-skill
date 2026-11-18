/**
 * `[rules.override]`: re-rank findings and gate CI on them.
 *
 * Overrides never change a status, a score or a weight. A team that does not
 * want meta descriptions can push that finding down or hide it, and a team
 * that cannot ship without a canonical can make one failing page stop the
 * build, but the score keeps describing the site.
 */

import type { AuditResult, OverridePriority, RuleOverrideMark, RuleResult } from '../types.js';
import type { RuleOverride } from '../config/schema.js';

/**
 * How much an override moves a finding's priority.
 *
 * Multiplies the computed priority, so an override re-ranks within the
 * existing order rather than inventing a parallel one. `ignore` is 0: the
 * finding drops out of every list that ranks things to fix.
 */
const PRIORITY_FACTOR: Record<OverridePriority, number> = {
  high: 4,
  normal: 1,
  low: 0.25,
  ignore: 0,
};

/** The factor an override applies to a finding's priority (1 when there is none) */
export function overridePriorityFactor(priority: OverridePriority | undefined): number {
  return priority ? PRIORITY_FACTOR[priority] : 1;
}

/** True when `[rules.override]` hides this result from reports */
export function isIgnoredByConfig(result: Pick<RuleResult, 'overridden'>): boolean {
  return result.overridden?.priority === 'ignore';
}

/** Convert one config entry into the mark carried on results */
function toMark(override: RuleOverride): RuleOverrideMark | null {
  const mark: RuleOverrideMark = {};
  if (override.priority) mark.priority = override.priority;
  if (override.fail_ci) mark.failCi = true;
  return mark.priority || mark.failCi ? mark : null;
}

/**
 * Mark every result of an overridden rule.
 *
 * Mutates and returns `result`. Results of rules with no override are left
 * untouched, so an audit with an empty `[rules.override]` is byte-identical
 * to one without the section.
 */
export function applyRuleOverrides(
  result: AuditResult,
  overrides: Record<string, RuleOverride> | undefined
): AuditResult {
  if (!overrides) return result;
  const marks = new Map<string, RuleOverrideMark>();
  for (const [ruleId, override] of Object.entries(overrides)) {
    const mark = toMark(override);
    if (mark) marks.set(ruleId, mark);
  }
  if (marks.size === 0) return result;

  for (const category of result.categoryResults) {
    for (const ruleResult of category.results) {
      const mark = marks.get(ruleResult.ruleId);
      if (mark) ruleResult.overridden = { ...mark };
    }
  }
  return result;
}

/** One rule that `ignore` hid, for the collapsed "Ignored by config" list */
export interface IgnoredFinding {
  ruleId: string;
  /** Non-passing results hidden, across every page */
  count: number;
  status: RuleResult['status'];
}

/**
 * Every rule `ignore` hid that had something to say.
 *
 * Reports list these in a collapsed section so hiding a finding is visible:
 * a reader can see what the config chose not to show them. Passing results
 * are left out, as they are from every findings list.
 */
export function collectIgnoredFindings(result: AuditResult): IgnoredFinding[] {
  const byRule = new Map<string, IgnoredFinding>();
  for (const category of result.categoryResults) {
    for (const ruleResult of category.results) {
      if (!isIgnoredByConfig(ruleResult) || ruleResult.status === 'pass') continue;
      const existing = byRule.get(ruleResult.ruleId);
      if (existing) {
        existing.count++;
        if (ruleResult.status === 'fail') existing.status = 'fail';
      } else {
        byRule.set(ruleResult.ruleId, { ruleId: ruleResult.ruleId, count: 1, status: ruleResult.status });
      }
    }
  }
  return [...byRule.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}
