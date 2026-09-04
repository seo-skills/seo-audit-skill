import type { HydratedAuditResult, RuleResultStatus } from '../types.js';

/**
 * Rule-level differences between two stored audits.
 *
 * Shared by `seomator compare`, the dashboard and the Electron app so they
 * all answer "what changed?" the same way.
 */

/** A rule whose worst status moved, or that appeared or disappeared */
export interface RuleChange {
  ruleId: string;
  ruleName: string;
  categoryId: string;
  /** Worst measured status before; null when the rule was not in the previous audit */
  from: RuleResultStatus | null;
  /** Worst measured status now; null when the rule is gone from the current audit */
  to: RuleResultStatus | null;
  /** Message of the worst page in the audit the status came from */
  message: string;
  /** Measured pages that did not pass in the current audit */
  affectedPages: number;
  /** Pages the rule ran on in the current audit */
  totalPages: number;
}

export interface RuleDiff {
  /** Worse now than before (pass → warn, pass → fail, warn → fail) */
  regressed: RuleChange[];
  /** Better now than before */
  improved: RuleChange[];
  /** In the current audit but not the previous one (a new rule or a new page type) */
  added: RuleChange[];
  /** In the previous audit but not the current one */
  removed: RuleChange[];
}

const RANK: Record<RuleResultStatus, number> = { pass: 0, warn: 1, fail: 2 };

interface RuleRollup {
  ruleId: string;
  ruleName: string;
  categoryId: string;
  /** Worst status among measured rows; null when nothing was measured */
  status: RuleResultStatus | null;
  message: string;
  affectedPages: number;
  totalPages: number;
}

/** Rows written before 3.4.0 have no weight and were always measured */
function isMeasured(row: HydratedAuditResult): boolean {
  return row.weight === null || row.weight !== 0;
}

/**
 * Collapse per-page rows into one entry per rule, keeping the worst measured
 * page. Unmeasured rows count toward `totalPages` only.
 */
export function rollupByRule(rows: HydratedAuditResult[]): Map<string, RuleRollup> {
  const map = new Map<string, RuleRollup>();
  for (const row of rows) {
    let entry = map.get(row.ruleId);
    if (!entry) {
      entry = {
        ruleId: row.ruleId,
        ruleName: row.ruleName,
        categoryId: row.categoryId,
        status: null,
        message: '',
        affectedPages: 0,
        totalPages: 0,
      };
      map.set(row.ruleId, entry);
    }
    entry.totalPages++;
    if (!isMeasured(row)) continue;
    if (row.status !== 'pass') entry.affectedPages++;
    if (entry.status === null || RANK[row.status] > RANK[entry.status]) {
      entry.status = row.status;
      entry.message = row.message;
    }
  }
  return map;
}

/**
 * Diff two audits rule by rule.
 *
 * A rule that was not measured on any page (every row has weight 0) is treated
 * as absent from that audit: it cannot regress or improve, because there was
 * no reading to compare.
 *
 * @param previous - Every result row of the earlier audit
 * @param current - Every result row of the later audit
 */
export function diffRules(previous: HydratedAuditResult[], current: HydratedAuditResult[]): RuleDiff {
  const before = rollupByRule(previous);
  const after = rollupByRule(current);

  const diff: RuleDiff = { regressed: [], improved: [], added: [], removed: [] };

  for (const now of after.values()) {
    if (now.status === null) continue;
    const then = before.get(now.ruleId);
    const change: RuleChange = {
      ruleId: now.ruleId,
      ruleName: now.ruleName,
      categoryId: now.categoryId,
      from: then?.status ?? null,
      to: now.status,
      message: now.message,
      affectedPages: now.affectedPages,
      totalPages: now.totalPages,
    };
    if (!then || then.status === null) {
      diff.added.push(change);
    } else if (RANK[now.status] > RANK[then.status]) {
      diff.regressed.push(change);
    } else if (RANK[now.status] < RANK[then.status]) {
      diff.improved.push({ ...change, message: then.message });
    }
  }

  for (const then of before.values()) {
    if (then.status === null) continue;
    const now = after.get(then.ruleId);
    if (now && now.status !== null) continue;
    diff.removed.push({
      ruleId: then.ruleId,
      ruleName: then.ruleName,
      categoryId: then.categoryId,
      from: then.status,
      to: null,
      message: then.message,
      affectedPages: 0,
      totalPages: now?.totalPages ?? 0,
    });
  }

  const bySeverity = (a: RuleChange, b: RuleChange) =>
    RANK[b.to ?? 'pass'] - RANK[a.to ?? 'pass'] || a.ruleId.localeCompare(b.ruleId);
  diff.regressed.sort(bySeverity);
  diff.added.sort(bySeverity);
  diff.improved.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  diff.removed.sort((a, b) => a.ruleId.localeCompare(b.ruleId));

  return diff;
}
