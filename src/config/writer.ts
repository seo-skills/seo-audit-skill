import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import type { SeomatorConfig, PartialSeomatorConfig } from './schema.js';

/**
 * Config presets for different use cases
 */
export type ConfigPreset = 'default' | 'blog' | 'ecommerce' | 'ci';

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
          'meta-tags/description-length': { min_length: 120, max_length: 160 },
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
        rules: {
          enable: ['meta-tags/*', 'security/*', 'links/*'],
          disable: [],
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

  const content = generateTomlConfig(config);
  fs.writeFileSync(filePath, content, 'utf-8');
}

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
