/**
 * Project configuration section
 */
export interface ProjectConfig {
  name: string;
  domains: string[];
}

/**
 * Crawler configuration section
 */
export interface CrawlerConfig {
  max_pages: number;
  delay_ms: number;
  timeout_ms: number;
  concurrency: number;
  per_host_concurrency: number;
  per_host_delay_ms: number;
  include: string[];
  exclude: string[];
  allow_query_params: string[];
  drop_query_prefixes: string[];
  respect_robots: boolean;
  breadth_first: boolean;
  follow_redirects: boolean;
  user_agent: string;
  max_prefix_budget: number;
}

import type { OverridePriority } from '../types.js';

export type { OverridePriority };

/** Where an overridden finding ranks; `ignore` hides it from reports */
export const OVERRIDE_PRIORITIES = ['high', 'normal', 'low', 'ignore'] as const satisfies readonly OverridePriority[];

/**
 * One `[rules.override]` entry.
 *
 * Changes how a finding is ranked and whether it gates CI. Never the score:
 * the score describes the site, not a team's preferences about it.
 */
export interface RuleOverride {
  priority?: OverridePriority;
  /** A `fail` from this rule exits 1 whatever the score */
  fail_ci?: boolean;
}

/** The keys a `[rules.override]` entry may set */
export const RULE_OVERRIDE_KEYS = ['priority', 'fail_ci'] as const;

/**
 * Rules configuration section
 */
export interface RulesConfig {
  enable: string[];
  disable: string[];
  /** Per-rule ranking and CI gating, keyed by rule id */
  override?: Record<string, RuleOverride>;
}

/**
 * CI gate configuration section
 */
export interface CiConfig {
  /** Exit 1 when the overall score is below this. `--fail-under` wins. */
  fail_under: number;
}

/**
 * External links configuration section
 */
export interface ExternalLinksConfig {
  enabled: boolean;
  cache_ttl_days: number;
  timeout_ms: number;
  concurrency: number;
}

/**
 * Output configuration section
 */
export interface OutputConfig {
  format: 'console' | 'text' | 'json' | 'html' | 'markdown' | 'llm';
  path: string;
  /** Store every audit in the audits database. Default true; `--no-save` overrides per run. */
  save: boolean;
}

/**
 * Complete SEOmator configuration
 */
export interface SeomatorConfig {
  project: ProjectConfig;
  crawler: CrawlerConfig;
  rules: RulesConfig;
  external_links: ExternalLinksConfig;
  output: OutputConfig;
  ci: CiConfig;
  rule_options: Record<string, Record<string, unknown>>;
}

/**
 * Partial config for merging
 */
export type PartialSeomatorConfig = {
  project?: Partial<ProjectConfig>;
  crawler?: Partial<CrawlerConfig>;
  rules?: Partial<RulesConfig>;
  external_links?: Partial<ExternalLinksConfig>;
  output?: Partial<OutputConfig>;
  ci?: Partial<CiConfig>;
  rule_options?: Record<string, Record<string, unknown>>;
};
