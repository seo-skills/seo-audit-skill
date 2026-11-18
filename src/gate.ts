/**
 * The CI verdict: does this run exit 0 or 1?
 *
 * Exit 1 means a gate failed:
 * - the overall score is below `fail-under` (default 70);
 * - a rule marked `fail_ci` failed on any page, scored or not;
 * - a rule marked `fail_ci` could not look on some page (it needed a render,
 *   a resource could not be verified, the check crashed), or took no reading
 *   anywhere. A gate that cannot run must not pass silently: that is how a
 *   CI check stays green over the very failure it was set up to catch. A page
 *   where there was nothing to find (`not-applicable`, `not-compared`) does
 *   not count against it.
 *
 * Exit 2 (usage, config, runtime) is decided before an audit result exists
 * and is not this module's business.
 */

import type { AuditGate, AuditResult, RuleResult } from './types.js';
import type { RuleOverride } from './config/schema.js';
import { couldNotLook, isNotMeasured } from './rules/define-rule.js';
import { isRuleEnabled } from './rules/pattern-matcher.js';
import { getRuleById } from './rules/registry.js';

export interface GateOptions {
  /** Exit 1 below this score */
  failUnder: number;
  overrides?: Record<string, RuleOverride>;
  /** Exit 1 when a crawl measured less than this percent of what it attempted; 0 is off */
  minCoverage?: number;
}

/** Measured and attempted pages, when the run was a crawl that recorded them */
export function coverageOf(result: AuditResult): { measured: number; attempted: number; percent: number } | null {
  const attempted = result.coverage?.attempted;
  const measured = result.coverage?.measured;
  if (!attempted || measured === undefined) return null;
  return { measured, attempted, percent: Math.floor((measured / attempted) * 100) };
}

/** Rule ids whose `fail_ci` is on */
export function gatedRuleIds(overrides: Record<string, RuleOverride> | undefined): string[] {
  if (!overrides) return [];
  return Object.entries(overrides)
    .filter(([, override]) => override.fail_ci === true)
    .map(([ruleId]) => ruleId)
    .sort();
}

function pageOf(result: RuleResult): string | null {
  const page = result.details?.pageUrl ?? result.details?.url;
  return typeof page === 'string' ? page : null;
}

/**
 * Decide the exit code for a finished audit.
 *
 * Reads per-page results, never an aggregate: a rule that fails on one page
 * of fifty has failed.
 */
export function evaluateGate(result: AuditResult, options: GateOptions): AuditGate {
  const score = result.overallScore;
  const failUnder = options.failUnder;
  const failedCiRules: AuditGate['failedCiRules'] = [];
  const unevaluated: AuditGate['unevaluated'] = [];

  for (const ruleId of gatedRuleIds(options.overrides)) {
    const results = result.categoryResults.flatMap((category) =>
      category.results.filter((r) => r.ruleId === ruleId)
    );

    const failing = results.filter((r) => r.status === 'fail' && !isNotMeasured(r));
    if (failing.length > 0) {
      const pages = [...new Set(failing.map(pageOf).filter((p): p is string => p !== null))];
      failedCiRules.push({ ruleId, pages });
      continue;
    }

    if (results.length === 0) {
      unevaluated.push({ ruleId, reason: 'the rule did not run' });
      continue;
    }

    // "Could not look" on any page leaves the gate unevaluated there. "Nothing
    // to find" (the pattern is absent, the page was not compared) satisfies
    // it: otherwise gating any rule that only applies to some pages would
    // fail every run.
    const blind = results.find((r) => isNotMeasured(r) && couldNotLook(r));
    if (blind) {
      unevaluated.push({ ruleId, reason: blind.message });
      continue;
    }

    // A result with no recorded reason is ambiguous; only when the rule took
    // no reading anywhere is the gate treated as unevaluated.
    if (results.every((r) => isNotMeasured(r) && r.reason === undefined)) {
      unevaluated.push({ ruleId, reason: results[0].message });
    }
  }

  let coverageGate: AuditGate['coverage'];
  const coverage = coverageOf(result);
  if (options.minCoverage && options.minCoverage > 0 && coverage) {
    coverageGate = { minCoverage: options.minCoverage, ...coverage, passed: coverage.percent >= options.minCoverage };
  }

  // A gated custom search fails on a failing page, and on a run it could
  // not vouch for: none of its pages checked, or one stopped by the time limit
  const failedCustomSearches = (result.extras?.custom?.searches ?? [])
    .filter((search) => search.failCi && (search.failing > 0 || search.checked === 0 || search.stopped > 0))
    .map(({ name, failing, checked, stopped }) => ({ name, failing, checked, stopped }));

  const scoreFailed = score < failUnder;
  const exitCode: 0 | 1 =
    scoreFailed ||
    failedCiRules.length > 0 ||
    unevaluated.length > 0 ||
    coverageGate?.passed === false ||
    failedCustomSearches.length > 0
      ? 1
      : 0;

  const gate: AuditGate = {
    failUnder,
    score,
    failedCiRules,
    unevaluated,
    ...(coverageGate && { coverage: coverageGate }),
    ...(failedCustomSearches.length > 0 && { failedCustomSearches }),
    exitCode,
  };
  if (exitCode === 1) gate.reason = describeGateFailure(gate);
  return gate;
}

/**
 * One line naming every reason a run exits 1, for the last line of output.
 *
 * "core-canonical-present failed (fail_ci); score 85 passed fail-under 70"
 * says both what stopped the build and that the score was not it.
 */
export function describeGateFailure(gate: Omit<AuditGate, 'reason'>): string {
  const parts: string[] = [];
  for (const { ruleId, pages } of gate.failedCiRules) {
    const where = pages.length > 1 ? ` on ${pages.length} pages` : '';
    parts.push(`${ruleId} failed${where} (fail_ci)`);
  }
  for (const { ruleId, reason } of gate.unevaluated) {
    parts.push(`fail_ci rule ${ruleId} was not measured (${reason}); fix what stopped it or drop fail_ci`);
  }
  for (const search of gate.failedCustomSearches ?? []) {
    if (search.failing > 0) parts.push(`custom search "${search.name}" failed on ${search.failing} page${search.failing === 1 ? '' : 's'} (fail_ci)`);
    else if (search.stopped > 0) parts.push(`custom search "${search.name}" was stopped by the regex time limit on ${search.stopped} page${search.stopped === 1 ? '' : 's'} (fail_ci)`);
    else parts.push(`custom search "${search.name}" checked 0 pages (fail_ci); check its scope`);
  }
  if (gate.coverage && !gate.coverage.passed) {
    parts.push(
      `measured ${gate.coverage.measured} of ${gate.coverage.attempted} pages; min-coverage ${gate.coverage.minCoverage}`
    );
  }
  parts.push(
    gate.score < gate.failUnder
      ? `score ${gate.score} is below fail-under ${gate.failUnder}`
      : `score ${gate.score} passed fail-under ${gate.failUnder}`
  );
  return parts.join('; ');
}

/**
 * Gated rules this run will not execute, as config errors.
 *
 * A `fail_ci` rule removed by `rules.enable`, `rules.disable` or a category
 * filter can never fail, so its gate would pass forever. That is a
 * contradiction in the config, reported before any request is made.
 */
export function findFilteredGates(
  overrides: Record<string, RuleOverride> | undefined,
  filters: { categories: string[]; enableRules: string[]; disableRules: string[] }
): string[] {
  const problems: string[] = [];
  for (const ruleId of gatedRuleIds(overrides)) {
    const rule = getRuleById(ruleId);
    if (!rule) continue; // an unknown id is the validator's error, reported separately
    const enable = filters.enableRules.length === 1 && filters.enableRules[0] === '*' ? [] : filters.enableRules;
    if (!isRuleEnabled(ruleId, enable, filters.disableRules)) {
      problems.push(
        `fail_ci rule ${ruleId} is turned off by [rules] enable/disable, so its gate can never run`
      );
      continue;
    }
    if (filters.categories.length > 0 && !filters.categories.includes(rule.category)) {
      problems.push(
        `fail_ci rule ${ruleId} is in category "${rule.category}", which --categories leaves out, so its gate can never run`
      );
    }
  }
  return problems;
}
