/**
 * One finding per problem, not one per page it appears on.
 *
 * A live crawl produces one rule result per rule per page, so a 40-page site
 * with one render-blocking script gave the markdown report forty identical
 * `### perf-render-blocking` sections and the LLM report forty `<issue>`
 * elements. That is forty times the tokens for one problem, and a model reading
 * it has every reason to conclude there are forty problems.
 *
 * A stored audit arrives already aggregated — one row per rule with page counts
 * — so grouping it is a no-op, and the same code serves both shapes.
 *
 * The terminal reporter has its own copy of this grouping and the HTML reporter
 * a third; both predate this module and neither has been migrated. New callers
 * should use this one.
 */

import type { AuditResult, RuleResult, RuleStatus } from '../types.js';
import type { RuleSummary } from '../dashboard/contract.js';
import { getCategoryById } from '../categories/index.js';
import { getRuleById } from '../rules/registry.js';
import { isNotMeasured } from '../rules/define-rule.js';
import { rulePriority } from '../rules/priority.js';

/** One problem, wherever it was found */
export interface Finding {
  ruleId: string;
  ruleName: string;
  categoryId: string;
  categoryName: string;
  status: RuleStatus;
  message: string;
  details: Record<string, unknown> | undefined;
  /** Pages this was seen on, in first-seen order; empty for a single-page audit */
  pages: string[];
  /** How many pages it affected — from the stored count when there is one */
  pageCount: number;
  /** How many pages the rule could be measured on */
  measuredPages: number;
  priority: number;
}

/** A stored audit arrives already ranked server-side; a live one does not. */
interface Grouping {
  finding: Finding;
  pages: Set<string>;
  storedPriority: number | undefined;
}

/**
 * Strip the parts of a message that vary between pages.
 *
 * "Title is 51 chars" and "Title is 62 chars" are the same finding; without
 * this they group separately and the report is long again for a subtler reason.
 * Same substitutions as the terminal reporter, which this will eventually share.
 */
function normalizeMessage(message: string): string {
  return message
    .replace(/\d+ chars?/g, 'X chars')
    .replace(/\d+ words?/g, 'X words')
    .replace(/\d+ images?/g, 'X images')
    .replace(/\d+ links?/g, 'X links')
    .replace(/\d+px/g, 'Xpx')
    .replace(/\d+ms/g, 'Xms')
    .replace(/\d+KB/g, 'XKB')
    .replace(/\d+\.\d+s/g, 'X.Xs');
}

function pageOf(result: RuleResult): string | null {
  const details = result.details;
  if (!details) return null;
  for (const field of ['pageUrl', 'url'] as const) {
    const value = details[field];
    if (typeof value === 'string' && value.startsWith('http')) return value;
  }
  return null;
}

function statusOf(result: RuleResult): RuleStatus {
  return isNotMeasured(result) ? 'not-measured' : result.status;
}

/**
 * Every unmeasured, warning and failing check, grouped and ranked.
 *
 * Passes are excluded: every caller wants the things to act on, and a passing
 * check has no page attribution worth keeping.
 */
export function collectFindings(result: AuditResult): Finding[] {
  const byKey = new Map<string, Grouping>();

  for (const category of result.categoryResults) {
    const definition = getCategoryById(category.categoryId);
    const categoryName = definition?.name ?? category.categoryId;

    for (const ruleResult of category.results) {
      const status = statusOf(ruleResult);
      if (status === 'pass') continue;

      const key = `${category.categoryId}:${ruleResult.ruleId}:${status}:${normalizeMessage(ruleResult.message)}`;
      const summary = ruleResult as Partial<RuleSummary>;
      const page = pageOf(ruleResult);

      let group = byKey.get(key);
      if (!group) {
        const finding: Finding = {
          ruleId: ruleResult.ruleId,
          ruleName: summary.ruleName ?? getRuleById(ruleResult.ruleId)?.name ?? ruleResult.ruleId,
          categoryId: category.categoryId,
          categoryName,
          status,
          message: ruleResult.message,
          details: ruleResult.details,
          pages: [],
          // A stored row already knows how many pages it affected across the
          // whole crawl; a live row speaks only for its own page.
          pageCount: summary.affectedPages ?? 0,
          measuredPages: summary.measuredPages ?? 0,
          priority: 0,
        };
        group = { finding, pages: new Set(), storedPriority: summary.priority };
        byKey.set(key, group);
      }

      const { finding, pages } = group;
      if (page && !pages.has(page)) {
        pages.add(page);
        finding.pages.push(page);
      }
      if (summary.affectedPages === undefined) finding.pageCount++;
      if (summary.measuredPages === undefined) finding.measuredPages++;
    }
  }

  const findings = [...byKey.values()].map(({ finding, storedPriority }) => {
    // `storedPriority ?? compute` and not `finding.priority ?? compute`: the
    // field is initialised to 0, and `0 ?? x` is 0, so reading it back left
    // every finding ranked zero and the order fell through to page count.
    finding.priority =
      storedPriority ??
      rulePriority({
        ruleId: finding.ruleId,
        categoryId: finding.categoryId,
        status: finding.status,
        affectedPages: finding.pageCount,
        measuredPages: finding.measuredPages,
      });
    return finding;
  });

  // Severity leads — a failure outranks a warning whatever its weight — then the
  // ranker, then a total tie-break so the order is stable between runs.
  const rank: Record<RuleStatus, number> = { fail: 0, warn: 1, 'not-measured': 2, pass: 3 };
  return findings.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      b.priority - a.priority ||
      b.pageCount - a.pageCount ||
      a.ruleId.localeCompare(b.ruleId)
  );
}
