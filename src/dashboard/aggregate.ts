/**
 * Aggregating a live audit result the way the database does.
 *
 * A finished run holds one `RuleResult` per rule per page. Stored audits are
 * read back as one `RuleSummary` per rule, computed in SQL. A run that could
 * not be saved still has to render in the same UI, so this produces the same
 * shape from memory — one implementation of "worst measured page wins", not
 * two that can drift apart.
 */

import type { AuditResult, CategoryResult, RuleResult } from '../types.js';
import { categories as categoryDefinitions } from '../categories/index.js';
import { isNotMeasured } from '../rules/define-rule.js';
import { buildRuleMetadata } from './queries.js';
import type { AuditDetail, AuditMetaDto, RuleSummary } from './contract.js';
import { RULE_SUMMARY_SAMPLE_PAGES } from '../storage/audits-db/results.js';

const RANK: Record<RuleResult['status'], number> = { pass: 0, warn: 1, fail: 2 };

/** The page a rule result ran on, when the auditor recorded one */
function pageOf(result: RuleResult, fallback: string): string {
  return typeof result.details?.pageUrl === 'string' ? result.details.pageUrl : fallback;
}

/**
 * Collapse one category's per-page results into one entry per rule.
 */
export function aggregateCategory(category: CategoryResult, auditUrl: string): RuleSummary[] {
  const byRule = new Map<string, RuleSummary>();
  // The worst measured result seen so far, so the summary's message and score
  // come from the same page its status does.
  const worst = new Map<string, RuleResult>();

  for (const result of category.results) {
    const measured = !isNotMeasured(result);
    let summary = byRule.get(result.ruleId);

    if (!summary) {
      summary = {
        ruleId: result.ruleId,
        ruleName: result.ruleId,
        status: 'pass',
        score: 100,
        message: '',
        totalPages: 0,
        measuredPages: 0,
        affectedPages: 0,
        notMeasured: true,
        samplePages: [],
      };
      byRule.set(result.ruleId, summary);
    }

    summary.totalPages++;
    if (!measured) continue;

    summary.measuredPages++;
    summary.notMeasured = false;
    if (result.status !== 'pass') summary.affectedPages++;

    const currentWorst = worst.get(result.ruleId);
    if (!currentWorst || RANK[result.status] > RANK[currentWorst.status]) {
      worst.set(result.ruleId, result);
    }
  }

  for (const [ruleId, summary] of byRule) {
    const top = worst.get(ruleId);
    if (summary.notMeasured) {
      // Exactly what notMeasured() produces live, and what the SQL read gives
      // back: a warning-shaped placeholder that scores nothing.
      summary.status = 'warn';
      summary.score = 50;
      summary.weight = 0;
      const any = category.results.find((r) => r.ruleId === ruleId);
      summary.message = any?.message ?? '';
      if (any?.details) summary.details = any.details;
    } else if (top) {
      summary.status = top.status;
      summary.score = top.score;
      summary.message = top.message;
      summary.weight = 1;
      if (top.details) summary.details = top.details;
    }

    // Sample pages, worst first, capped the same way the SQL read caps them.
    summary.samplePages = category.results
      .filter((r) => r.ruleId === ruleId)
      .sort((a, b) => {
        const aMeasured = isNotMeasured(a) ? -1 : RANK[a.status];
        const bMeasured = isNotMeasured(b) ? -1 : RANK[b.status];
        return bMeasured - aMeasured;
      })
      .slice(0, RULE_SUMMARY_SAMPLE_PAGES)
      .map((r) => ({ pageUrl: pageOf(r, auditUrl), status: r.status, message: r.message }));
  }

  return [...byRule.values()];
}

/**
 * Rebuild a finished run as the detail shape every surface renders.
 *
 * @param result - The live audit result
 * @param meta - The audit row this would have been stored as
 */
export function aggregateResult(result: AuditResult, meta: AuditMetaDto): AuditDetail {
  const order = new Map(categoryDefinitions.map((c, index) => [c.id, index]));
  const categoryResults: CategoryResult[] = [...result.categoryResults]
    .sort((a, b) => (order.get(a.categoryId) ?? Infinity) - (order.get(b.categoryId) ?? Infinity))
    .map((category) => ({
      categoryId: category.categoryId,
      score: category.score,
      passCount: category.passCount,
      warnCount: category.warnCount,
      failCount: category.failCount,
      notMeasuredCount: category.notMeasuredCount ?? 0,
      results: aggregateCategory(category, result.url),
    }));

  const summaries = categoryResults.flatMap((category) =>
    (category.results as RuleSummary[]).map((rule) => ({ ruleId: rule.ruleId, ruleName: rule.ruleName }))
  );

  return {
    audit: meta,
    result: { ...result, categoryResults },
    ruleMetadata: buildRuleMetadata(summaries),
  };
}
