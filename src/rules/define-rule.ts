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
