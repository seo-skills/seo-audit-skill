import type { AuditRule, RuleResult } from '../types.js';

/**
 * Validates that an audit rule has all required fields
 * @throws Error if any required field is missing or invalid
 */
function validateRule(rule: Partial<AuditRule>): asserts rule is AuditRule {
  const errors: string[] = [];

  if (!rule.id || typeof rule.id !== 'string') {
    errors.push('Rule must have a string "id"');
  }

  if (!rule.name || typeof rule.name !== 'string') {
    errors.push('Rule must have a string "name"');
  }

  if (!rule.description || typeof rule.description !== 'string') {
    errors.push('Rule must have a string "description"');
  }

  if (!rule.category || typeof rule.category !== 'string') {
    errors.push('Rule must have a string "category"');
  }

  if (typeof rule.weight !== 'number' || rule.weight < 0 || rule.weight > 100) {
    errors.push('Rule must have a "weight" number between 0 and 100');
  }

  if (typeof rule.run !== 'function') {
    errors.push('Rule must have a "run" function');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid rule definition:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * Defines and validates an audit rule
 * @param rule - The rule definition
 * @returns The validated rule
 * @throws Error if the rule is invalid
 */
export function defineRule(rule: AuditRule): AuditRule {
  validateRule(rule);
  return rule;
}

/**
 * Creates a passing RuleResult
 * @param ruleId - The rule identifier
 * @param message - Human-readable result message
 * @param details - Optional additional details
 * @returns RuleResult with status 'pass' and score 100
 */
export function pass(
  ruleId: string,
  message: string,
  details?: Record<string, unknown>
): RuleResult {
  return {
    ruleId,
    status: 'pass',
    message,
    score: 100,
    ...(details && { details }),
  };
}

/**
 * Creates a warning RuleResult
 * @param ruleId - The rule identifier
 * @param message - Human-readable result message
 * @param details - Optional additional details
 * @returns RuleResult with status 'warn' and score 50
 */
export function warn(
  ruleId: string,
  message: string,
  details?: Record<string, unknown>
): RuleResult {
  return {
    ruleId,
    status: 'warn',
    message,
    score: 50,
    ...(details && { details }),
  };
}

/**
 * Creates a RuleResult for a check whose input could not be measured.
 *
 * Distinct from `warn`: the site may be perfectly fine, we simply have no
 * reading. The result is reported so the gap is visible, but carries weight 0
 * so it contributes to neither side of the category average — you cannot score
 * what you did not measure.
 *
 * @param ruleId - The rule identifier
 * @param message - Human-readable explanation of why there is no reading
 * @param details - Optional additional details
 * @returns RuleResult with status 'warn' and weight 0 (excluded from scoring)
 */
export function notMeasured(
  ruleId: string,
  message: string,
  details?: Record<string, unknown>
): RuleResult {
  return {
    ruleId,
    status: 'warn',
    message,
    score: 50,
    weight: 0,
    ...(details && { details }),
  };
}

/**
 * Whether a result came from a check that could not take a reading.
 *
 * Weight 0 is the marker: it is precisely the fact that the result is excluded
 * from the category average, so "unmeasured" and "unweighted" are one fact
 * rather than two that could drift apart. `notMeasured()` above is the only
 * producer of weight 0 — every registered rule declares a positive weight.
 *
 * Reporters use this to count and label such results separately, so a category
 * does not present "score 100, 13 warnings" for checks that never ran.
 *
 * @param result - The rule result to classify
 * @returns True when the result carries no reading
 */
export function isNotMeasured(result: Pick<RuleResult, 'weight'>): boolean {
  return result.weight === 0;
}

/**
 * Creates a failing RuleResult
 * @param ruleId - The rule identifier
 * @param message - Human-readable result message
 * @param details - Optional additional details
 * @returns RuleResult with status 'fail' and score 0
 */
export function fail(
  ruleId: string,
  message: string,
  details?: Record<string, unknown>
): RuleResult {
  return {
    ruleId,
    status: 'fail',
    message,
    score: 0,
    ...(details && { details }),
  };
}
