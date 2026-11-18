import type { AuditRule, NotMeasuredReason, RuleOptionSpec, RuleOptionValues, RuleResult } from '../types.js';

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

  for (const [key, spec] of Object.entries(rule.options ?? {})) {
    const problem = checkRuleOptionValue(spec, spec.default);
    if (problem) errors.push(`Option "${key}" has an invalid default: ${problem}`);
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
 * @returns RuleResult with status 'not-measured' and weight 0 (excluded from
 *          scoring). The weight is kept alongside the status so that an older
 *          build reading a newer database still recognises the row.
 */
export function notMeasured(
  ruleId: string,
  message: string,
  details?: Record<string, unknown>,
  reason?: NotMeasuredReason
): RuleResult {
  return {
    ruleId,
    status: 'not-measured',
    message,
    ...(reason && { reason }),
    // Kept at 50 deliberately. `audit_results.score` is INTEGER NOT NULL, and
    // the GUI defaults Core Web Vitals off, so every desktop audit carries
    // unmeasured rows — a null here would fail the insert on every save. The
    // status carries the meaning; the number does not have to.
    score: 50,
    weight: 0,
    ...(details && { details }),
  };
}

/**
 * Whether a result came from a check that could not take a reading.
 *
 * Three encodings exist and all three must read correctly, because stored
 * audits outlive the code that wrote them:
 *
 * | Encoding | Written by    | status         | weight | Means        |
 * |----------|---------------|----------------|--------|--------------|
 * | A        | before 3.4.0  | 'warn'         | NULL   | **measured** |
 * | B        | 3.4.0 – 3.5.0 | 'warn'         | 0      | not measured |
 * | C        | 3.6.0 onward  | 'not-measured' | 0      | not measured |
 *
 * Encoding A predates the weight column; every check in those audits was a
 * real result, and re-reading them as unmeasured would rewrite history. A
 * predicate keying on status alone would do exactly that to encodings A and B.
 *
 * `weight === 0` is kept in the test on purpose, and `notMeasured()` keeps
 * writing it: an older build reading a database written by a newer one still
 * recognises the row.
 *
 * @param result - The rule result to classify
 * @returns True when the result carries no reading
 */
export function isNotMeasured(result: Pick<RuleResult, 'status' | 'weight'>): boolean {
  return result.status === 'not-measured' || result.weight === 0;
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

/**
 * Whether a result moves the score.
 *
 * The one place that decides it: a result counts when it took a reading and
 * its rule is not advisory. Every surface that totals or averages results
 * asks this rather than re-deriving it, so "advisory" cannot be counted in one
 * place and skipped in another.
 */
export function countsTowardScore(result: Pick<RuleResult, 'status' | 'weight' | 'advisory'>): boolean {
  return !isNotMeasured(result) && result.advisory !== true;
}

/** Not-measured reasons that mean "nothing to find here", as opposed to "could not look" */
const NOTHING_TO_FIND: ReadonlySet<NotMeasuredReason> = new Set(['not-applicable', 'not-compared']);

/** True when a not-measured result means the check could not look, not that there was nothing to look at */
export function couldNotLook(result: Pick<RuleResult, 'reason'>): boolean {
  return result.reason !== undefined && !NOTHING_TO_FIND.has(result.reason);
}

/**
 * Why `value` is not a valid setting for `spec`, or null when it is.
 */
export function checkRuleOptionValue(spec: RuleOptionSpec, value: unknown): string | null {
  switch (spec.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'must be a number';
      if (spec.min !== undefined && value < spec.min) return `must be at least ${spec.min}`;
      if (spec.max !== undefined && value > spec.max) return `must be at most ${spec.max}`;
      return null;
    case 'string':
      return typeof value === 'string' ? null : 'must be a string';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be true or false';
    case 'string[]':
      return Array.isArray(value) && value.every((v) => typeof v === 'string') ? null : 'must be a list of strings';
  }
}

/** A rule's declared defaults */
export function defaultRuleOptions(rule: Pick<AuditRule, 'options'>): RuleOptionValues {
  const values: Record<string, RuleOptionValues[string]> = {};
  for (const [key, spec] of Object.entries(rule.options ?? {})) values[key] = spec.default;
  return values;
}

/**
 * A rule's effective options: its declared defaults, with any configured
 * value for a declared key laid over them. Undeclared keys are dropped; the
 * config validator has already rejected them.
 */
export function resolveRuleOptions(
  rule: Pick<AuditRule, 'options'>,
  configured: Record<string, unknown> | undefined
): RuleOptionValues {
  const values: Record<string, RuleOptionValues[string]> = { ...defaultRuleOptions(rule) };
  if (configured) {
    for (const key of Object.keys(rule.options ?? {})) {
      if (key in configured) values[key] = configured[key] as RuleOptionValues[string];
    }
  }
  return values;
}

/**
 * The options a rule's `run` received, or its defaults when called directly.
 *
 * The Auditor always passes options; a test calling `rule.run(context)`
 * does not, and gets the defaults.
 */
export function readRuleOptions(rule: Pick<AuditRule, 'options'>, options: RuleOptionValues | undefined): RuleOptionValues {
  return options ?? defaultRuleOptions(rule);
}
