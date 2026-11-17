/**
 * The checks every command that runs rules makes before the first request.
 *
 * `seomator config validate` was the only place the config was checked, so
 * a CI job that never ran it audited with a typo'd override, and a typo'd
 * `fail_ci` rule id meant a gate that never fired. `audit`, `analyze` and
 * `mcp` now refuse to start on a config that does not mean what it says.
 */

import type { SeomatorConfig } from '../config/schema.js';
import { validateConfig } from '../config/validator.js';
import { findFilteredGates } from '../gate.js';
import { getAllRules } from '../rules/registry.js';
import { AuditError } from '../errors.js';

export interface RunFilters {
  /** `--categories`; empty means every category */
  categories: string[];
}

/**
 * Every reason this config cannot run as written, in reading order.
 *
 * Requires the rule registry to be loaded, so unknown rule ids can be named.
 */
export function findRunConfigProblems(config: SeomatorConfig, filters: RunFilters): string[] {
  const ruleIds = getAllRules().map((rule) => rule.id);
  const validation = validateConfig(config, { ruleIds });
  return [
    ...validation.errors.map((error) => `${error.path}: ${error.message}`),
    ...findFilteredGates(config.rules.override, {
      categories: filters.categories,
      enableRules: config.rules.enable,
      disableRules: config.rules.disable,
    }),
  ];
}

/**
 * Throw a `config` error (exit 2) when the config cannot run as written.
 *
 * The message names the first problem; the hint carries the rest, so a
 * machine reader gets every problem from one run.
 */
export function assertRunnableConfig(
  config: SeomatorConfig,
  configPath: string | null,
  filters: RunFilters
): void {
  const problems = findRunConfigProblems(config, filters);
  if (problems.length === 0) return;

  const where = configPath ? ` (${configPath})` : '';
  const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : '';
  const rest = problems.slice(1).map((p) => `- ${p}`);
  const hint = [...rest, 'Run `seomator config validate` to check the config without auditing.'].join('\n');
  throw new AuditError('config', `Invalid configuration${where}: ${problems[0]}${more}`, { hint });
}
