import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import type { SeomatorConfig, PartialSeomatorConfig } from './schema.js';

/**
 * Config presets for different use cases.
 *
 * The array is the source of truth so the CLI can validate `--preset` against
 * the same list the type is derived from, instead of a second copy that drifts.
 */
export const CONFIG_PRESETS = ['default', 'blog', 'ecommerce', 'ci'] as const;

export type ConfigPreset = (typeof CONFIG_PRESETS)[number];

/**
 * Get preset configuration
 */
export function getPresetConfig(preset: ConfigPreset): PartialSeomatorConfig {
  switch (preset) {
    case 'blog':
      return {
        crawler: {
          max_pages: 500,
          exclude: ['/wp-admin/**', '/wp-content/uploads/**', '*.pdf'],
        },
        rule_options: {
          'core-description-length': { min_length: 120, max_length: 160 },
        },
      };

    case 'ecommerce':
      return {
        crawler: {
          max_pages: 1000,
          include: ['/products/**', '/categories/**', '/collections/**'],
          exclude: ['/cart/**', '/checkout/**', '/account/**', '*.pdf'],
          allow_query_params: ['category', 'sort', 'filter', 'page'],
        },
      };

    case 'ci':
      return {
        crawler: {
          max_pages: 100,
          delay_ms: 0,
          respect_robots: false,
        },
        external_links: {
          enabled: false,
          cache_ttl_days: 7,
          timeout_ms: 10000,
          concurrency: 5,
        },
        output: {
          format: 'json',
          path: 'reports/audit.json',
        },
      };

    default:
      return {};
  }
}

/**
 * Generate TOML config string
 */
export function generateTomlConfig(config: PartialSeomatorConfig): string {
  // TOML.stringify expects JsonMap, cast appropriately
  return TOML.stringify(config as TOML.JsonMap);
}

/**
 * Write config to file
 */
export function writeConfigFile(filePath: string, config: PartialSeomatorConfig): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = `${generateTomlConfig(config).trimEnd()}\n\n${INIT_EXAMPLES}`;
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Commented examples `seomator init` appends: the sections most teams reach
 * for next, ready to uncomment. Each one validates as written.
 */
export const INIT_EXAMPLES = `# --- Examples: uncomment what you need. docs/configuration.md has every key.

# Fail CI below a score, or when a crawl measured too few pages
# [ci]
# fail_under = 80
# min_coverage = 90

# Rank a rule higher in reports, or fail CI whenever it fails
# [rules.override."core-canonical-present"]
# priority = "high"
# fail_ci = true

# Tune a rule; seomator explain <rule-id> lists its options
# [rule_options."content-duplicate-near"]
# warn_threshold = 0.7

# Your own checks, reported apart from the score
# [[custom.search]]
# name = "Old brand name"
# text = "Acme Old"
# expect = "absent"
# fail_ci = true
#
# [[custom.extract]]
# name = "SKU"
# selector = "[itemprop=sku]"
`;

/**
 * Write JSON settings file
 */
export function writeSettingsFile(filePath: string, settings: PartialSeomatorConfig): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}
