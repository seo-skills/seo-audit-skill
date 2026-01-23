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
}

/**
 * Rules configuration section
 */
export interface RulesConfig {
  enable: string[];
  disable: string[];
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
  format: 'console' | 'json' | 'html' | 'markdown';
  path: string;
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
  rule_options?: Record<string, Record<string, unknown>>;
};
