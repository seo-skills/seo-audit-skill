import type { SeomatorConfig } from './schema.js';

/**
 * Get default configuration values
 */
export function getDefaultConfig(): SeomatorConfig {
  return {
    project: {
      name: '',
      domains: [],
    },
    crawler: {
      max_pages: 100,
      delay_ms: 100,
      timeout_ms: 30000,
      concurrency: 3,
      per_host_concurrency: 2,
      per_host_delay_ms: 200,
      include: [],
      exclude: [],
      allow_query_params: [],
      drop_query_prefixes: ['utm_', 'gclid', 'fbclid', 'mc_', '_ga'],
      respect_robots: true,
      breadth_first: true,
      follow_redirects: true,
      user_agent: '',
      max_prefix_budget: 0.25,
    },
    rules: {
      enable: ['*'],
      disable: [],
    },
    external_links: {
      enabled: true,
      cache_ttl_days: 7,
      timeout_ms: 10000,
      concurrency: 5,
    },
    output: {
      format: 'console',
      path: '',
    },
    rule_options: {},
  };
}
