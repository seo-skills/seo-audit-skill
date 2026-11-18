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
      // 10, the same as `-m`'s default, so a crawl with no config covers the
      // same pages whichever way it is started.
      max_pages: 10,
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
      respect_crawl_delay: true,
      max_retry_after_ms: 120000,
      max_duration_s: 0,
    },
    rules: {
      enable: ['*'],
      disable: [],
      override: {},
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
      save: true,
    },
    ci: {
      fail_under: 70,
      min_coverage: 0,
    },
    rule_options: {},
    custom: {
      search: [],
      extract: [],
    },
  };
}
