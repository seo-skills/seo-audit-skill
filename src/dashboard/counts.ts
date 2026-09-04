/**
 * How many findings does an audit have? Two honest answers.
 *
 * The HTML report said 332 and the dashboard said 2,656 for the same audit,
 * and neither said which it was counting. Both were right: one counted rules,
 * the other counted rule-per-page evaluations of them (332 × 8 pages). The
 * defect was never the arithmetic, it was that the number was unlabelled — so
 * two surfaces looked like they disagreed about the same site.
 *
 * There is no single correct total, so this returns both, named. A surface
 * picks the one that matches the thing it is showing: a per-rule list quotes
 * `rules`, a per-page list quotes `evaluations`.
 */

import type { AuditResult } from '../types.js';
import { isNotMeasured } from '../rules/define-rule.js';
import type { RuleSummary } from './contract.js';

/** Four buckets that sum to the total, by construction */
export interface CountLedger {
  pass: number;
  warn: number;
  fail: number;
  notMeasured: number;
  total: number;
}

export interface AuditCounts {
  /** One entry per rule — around 332, whatever the page count */
  rules: CountLedger;
  /** One entry per rule per page — 332 × pages */
  evaluations: CountLedger;
  /** Distinct pages carrying at least one measured, non-passing result */
  affectedPages: number;
  /** Pages the audit covered */
  pagesAudited: number;
}

const empty = (): CountLedger => ({ pass: 0, warn: 0, fail: 0, notMeasured: 0, total: 0 });

/** Add one result to a ledger, in the one place that decides which bucket it lands in */
function tally(ledger: CountLedger, status: string, unmeasured: boolean): void {
  ledger.total++;
  if (unmeasured) ledger.notMeasured++;
  else if (status === 'fail') ledger.fail++;
  else if (status === 'warn') ledger.warn++;
  else ledger.pass++;
}

/**
 * Count a live audit result, whose entries are one per rule per page.
 */
export function countLiveResult(result: AuditResult): AuditCounts {
  const evaluations = empty();
  const rules = empty();
  const affected = new Set<string>();
  const pages = new Set<string>();

  // Worst measured status per rule, so the rule ledger answers "how many
  // rules are failing", not "how many page-checks failed".
  const worstByRule = new Map<string, { status: string; unmeasured: boolean }>();
  const RANK: Record<string, number> = { pass: 0, warn: 1, fail: 2 };

  for (const category of result.categoryResults) {
    for (const entry of category.results) {
      const unmeasured = isNotMeasured(entry);
      tally(evaluations, entry.status, unmeasured);

      const pageUrl = typeof entry.details?.pageUrl === 'string' ? entry.details.pageUrl : result.url;
      pages.add(pageUrl);
      if (!unmeasured && entry.status !== 'pass') affected.add(pageUrl);

      const current = worstByRule.get(entry.ruleId);
      if (!current) {
        worstByRule.set(entry.ruleId, { status: entry.status, unmeasured });
      } else if (!unmeasured) {
        // Any measured reading beats an unmeasured one; among measured
        // readings the worst wins.
        if (current.unmeasured || RANK[entry.status]! > RANK[current.status]!) {
          worstByRule.set(entry.ruleId, { status: entry.status, unmeasured: false });
        }
      }
    }
  }

  for (const rule of worstByRule.values()) tally(rules, rule.status, rule.unmeasured);

  return { rules, evaluations, affectedPages: affected.size, pagesAudited: pages.size };
}

/**
 * Count from already-aggregated summaries plus the stored evaluation totals.
 *
 * @param summaries - One per rule
 * @param evaluationCounts - Per rule-page totals, as the database counts them
 * @param affectedPages - Distinct affected pages, counted in SQL
 * @param pagesAudited - Pages the audit covered
 */
export function countFromSummaries(
  summaries: readonly RuleSummary[],
  evaluationCounts: CountLedger,
  affectedPages: number,
  pagesAudited: number
): AuditCounts {
  const rules = empty();
  for (const summary of summaries) tally(rules, summary.status, summary.notMeasured);
  return { rules, evaluations: evaluationCounts, affectedPages, pagesAudited };
}

/** Whether a ledger's buckets account for its total */
export function ledgerSums(ledger: CountLedger): boolean {
  return ledger.pass + ledger.warn + ledger.fail + ledger.notMeasured === ledger.total;
}
