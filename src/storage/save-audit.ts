import type { AuditResult } from '../types.js';
import type { SeomatorConfig } from '../config/schema.js';
import type { InsertCategoryInput, InsertResultInput, RuleResultStatus } from './types.js';
import { getAuditsDatabase } from './audits-db/index.js';
import { getCategoryById } from '../categories/index.js';
import { getRuleById } from '../rules/registry.js';
import { generateId } from './paths.js';

/**
 * Writes a completed audit into the audits database.
 *
 * Until now nothing did. The schema, the comparison engine and the trend
 * queries all existed, but commands persisted to the flat JSON report store
 * instead, so the tables they read were always empty and `seomator compare`
 * had nothing to compare.
 */

/** The domain an audit is filed under, used to group runs for comparison */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export interface SavedAudit {
  /** Human-facing audit id, e.g. 2026-08-31-a1b2c3 */
  auditId: string;
  /** Database row id */
  id: number;
  /** Domain the audit was filed under */
  domain: string;
}

/**
 * Persist an audit result and its per-rule detail.
 *
 * @param result - The completed audit
 * @param options - Project name and config to record alongside it
 * @returns Identifiers for the stored audit
 */
export function saveAuditToDatabase(
  result: AuditResult,
  options: { projectName?: string; config?: SeomatorConfig } = {}
): SavedAudit {
  const db = getAuditsDatabase();
  const auditId = generateId();
  const domain = domainOf(result.url);

  const audit = db.createAudit({
    auditId,
    domain,
    startUrl: result.url,
    ...(options.projectName && { projectName: options.projectName }),
    ...(options.config && { config: options.config }),
  });

  const categoryInputs: InsertCategoryInput[] = [];
  const resultInputs: InsertResultInput[] = [];
  let passedCount = 0;
  let warningCount = 0;
  let failedCount = 0;

  for (const category of result.categoryResults) {
    const definition = getCategoryById(category.categoryId);

    categoryInputs.push({
      categoryId: category.categoryId,
      categoryName: definition?.name ?? category.categoryId,
      score: category.score,
      weight: definition?.weight ?? 0,
      passCount: category.passCount,
      warnCount: category.warnCount,
      failCount: category.failCount,
    });

    passedCount += category.passCount;
    warningCount += category.warnCount;
    failedCount += category.failCount;

    for (const ruleResult of category.results) {
      const rule = getRuleById(ruleResult.ruleId);
      const pageUrl =
        typeof ruleResult.details?.pageUrl === 'string'
          ? ruleResult.details.pageUrl
          : result.url;

      resultInputs.push({
        categoryId: category.categoryId,
        ruleId: ruleResult.ruleId,
        ruleName: rule?.name ?? ruleResult.ruleId,
        pageUrl,
        status: ruleResult.status as RuleResultStatus,
        score: ruleResult.score,
        message: ruleResult.message,
        ...(ruleResult.details && { details: ruleResult.details }),
      });
    }
  }

  db.insertCategories(audit.id, categoryInputs);
  db.insertResults(audit.id, resultInputs);

  db.completeAudit(auditId, {
    overallScore: result.overallScore,
    totalRules: resultInputs.length,
    passedCount,
    warningCount,
    failedCount,
    pagesAudited: result.crawledPages,
  });

  return { auditId, id: audit.id, domain };
}
