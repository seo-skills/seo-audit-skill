import type {
  RuleResult,
  CategoryResult,
  CategoryDefinition,
  AuditResult,
  PageSnapshot,
} from './types.js';
import { AUDIT_SCHEMA_VERSION } from './types.js';
import { isNotMeasured } from './rules/define-rule.js';

/**
 * Score values for each rule status
 */
const STATUS_SCORES = {
  pass: 100,
  warn: 50,
  fail: 0,
} as const;

/**
 * Calculate the weighted average score for a category based on rule results.
 *
 * Each result contributes its status score (pass=100, warn=50, fail=0) weighted
 * by the declared weight of the rule that produced it, so a weight-25 rule like
 * `security-https` moves the category 25x more than a weight-1 rule.
 *
 * Results without a weight (hand-built, or from an older stored audit) count as
 * weight 1 rather than being dropped.
 *
 * @param results - Array of rule results
 * @returns Score from 0-100
 */
export function calculateCategoryScore(results: RuleResult[]): number {
  if (results.length === 0) {
    return 0;
  }

  let totalScore = 0;
  let totalWeight = 0;

  for (const result of results) {
    const statusScore = STATUS_SCORES[result.status];
    const weight = result.weight ?? 1;
    totalScore += statusScore * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  // Return weighted average, rounded to nearest integer
  return Math.round(totalScore / totalWeight);
}

/**
 * Calculate the overall audit score from category results
 * Uses weighted category average based on category definition weights
 * @param categoryResults - Array of category results
 * @param categories - Array of category definitions with weights
 * @returns Overall score from 0-100
 */
export function calculateOverallScore(
  categoryResults: CategoryResult[],
  categories: CategoryDefinition[]
): number {
  if (categoryResults.length === 0) {
    return 0;
  }

  // Create a map of category weights for quick lookup
  const categoryWeights = new Map<string, number>();
  for (const category of categories) {
    categoryWeights.set(category.id, category.weight);
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const result of categoryResults) {
    const weight = categoryWeights.get(result.categoryId) ?? 0;
    if (weight > 0) {
      totalWeightedScore += result.score * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return 0;
  }

  // Return weighted average, rounded to nearest integer
  return Math.round(totalWeightedScore / totalWeight);
}

/**
 * Build a CategoryResult from rule results
 * Aggregates results into pass/warn/fail counts and calculates score
 * @param categoryId - The category identifier
 * @param ruleResults - Array of rule results for this category
 * @returns CategoryResult with aggregated data
 */
export function buildCategoryResult(
  categoryId: string,
  ruleResults: RuleResult[]
): CategoryResult {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  let notMeasuredCount = 0;

  for (const result of ruleResults) {
    // A check that took no reading is neither a pass nor a warning. Counting it
    // as a warning is what produced category rows reading "score 100, 13
    // warnings" — a score that excluded the rules the count was advertising.
    if (isNotMeasured(result)) {
      notMeasuredCount++;
      continue;
    }

    switch (result.status) {
      case 'pass':
        passCount++;
        break;
      case 'warn':
        warnCount++;
        break;
      case 'fail':
        failCount++;
        break;
    }
  }

  return {
    categoryId,
    score: calculateCategoryScore(ruleResults),
    passCount,
    warnCount,
    failCount,
    notMeasuredCount,
    results: ruleResults,
  };
}

/**
 * Build the final AuditResult from category results
 * @param url - The URL that was audited
 * @param categoryResults - Array of category results
 * @param categories - Category definitions for weight calculation
 * @param timestamp - ISO timestamp of when audit was performed
 * @param crawledPages - Optional number of pages crawled (default: 1)
 * @returns Complete AuditResult
 */
export function buildAuditResult(
  url: string,
  categoryResults: CategoryResult[],
  categories: CategoryDefinition[],
  timestamp: string,
  crawledPages = 1,
  page?: PageSnapshot
): AuditResult {
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    url,
    overallScore: calculateOverallScore(categoryResults, categories),
    categoryResults,
    timestamp,
    crawledPages,
    ...(page && { page }),
  };
}
