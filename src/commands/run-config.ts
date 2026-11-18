/**
 * The checks every command that runs rules makes before the first request.
 *
 * `seomator config validate` was the only place the config was checked, so
 * a CI job that never ran it audited with a typo'd override, and a typo'd
 * `fail_ci` rule id meant a gate that never fired. `audit`, `analyze` and
 * `mcp` now refuse to start on a config that does not mean what it says.
 */

import type { SeomatorConfig } from '../config/schema.js';
import type { ExternalLinksOptions } from '../auditor.js';
import { validateConfig } from '../config/validator.js';
import { findFilteredGates } from '../gate.js';
import { getAllRules } from '../rules/registry.js';
import { AuditError } from '../errors.js';

export interface RunFilters {
  /** `--categories`; empty means every category */
  categories: string[];
}

/** What a run's config check found: errors stop the run, warnings are listed */
export interface RunConfigCheck {
  errors: string[];
  warnings: string[];
}

/** The validation context every run uses: the live rule registry */
export function registryValidationContext(unknownRuleOptionIds: 'error' | 'warning') {
  const rules = getAllRules();
  return {
    ruleIds: rules.map((rule) => rule.id),
    ruleOptionSpecs: Object.fromEntries(rules.map((rule) => [rule.id, rule.options])),
    unknownRuleOptionIds,
  };
}

export function checkRunConfig(config: SeomatorConfig, filters: RunFilters): RunConfigCheck {
  const validation = validateConfig(config, registryValidationContext('warning'));
  return {
    errors: [
      ...validation.errors.map((error) => `${error.path}: ${error.message}`),
      ...findFilteredGates(config.rules.override, {
        categories: filters.categories,
        enableRules: config.rules.enable,
        disableRules: config.rules.disable,
      }),
    ],
    // Only warnings that change what this run does; the general ones
    // (a rule filter is in force) are said elsewhere.
    warnings: validation.warnings
      .filter((warning) => warning.path.startsWith('rule_options'))
      .map((warning) => `${warning.path}: ${warning.message}`),
  };
}

/**
 * Every reason this config cannot run as written, in reading order.
 *
 * Requires the rule registry to be loaded, so unknown rule ids can be named.
 */
export function findRunConfigProblems(config: SeomatorConfig, filters: RunFilters): string[] {
  return checkRunConfig(config, filters).errors;
}

/**
 * Throw a `config` error (exit 2) when the config cannot run as written.
 *
 * The message names the first problem; the hint carries the rest, so a
 * machine reader gets every problem from one run.
 *
 * @returns Warnings the run should print and carry on with, such as a
 *          `rule_options` entry for an unknown rule id
 */
export function assertRunnableConfig(
  config: SeomatorConfig,
  configPath: string | null,
  filters: RunFilters
): string[] {
  const { errors: problems, warnings } = checkRunConfig(config, filters);
  if (problems.length === 0) return warnings;

  const where = configPath ? ` (${configPath})` : '';
  const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : '';
  const rest = problems.slice(1).map((p) => `- ${p}`);
  const hint = [...rest, 'Run `seomator config validate` to check the config without auditing.'].join('\n');
  throw new AuditError('config', `Invalid configuration${where}: ${problems[0]}${more}`, { hint });
}

/** `[external_links]` as the auditor takes it; `refresh` is `--refresh` */
export function externalLinksOptions(config: SeomatorConfig, refresh = false): ExternalLinksOptions {
  const ext = config.external_links;
  return {
    enabled: ext.enabled,
    timeoutMs: ext.timeout_ms,
    concurrency: ext.concurrency,
    cacheTtlDays: ext.cache_ttl_days,
    refresh,
  };
}
