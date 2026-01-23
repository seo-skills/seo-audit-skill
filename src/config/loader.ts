import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as TOML from '@iarna/toml';
import type { SeomatorConfig, PartialSeomatorConfig } from './schema.js';
import { getDefaultConfig } from './defaults.js';
import { getGlobalSettingsPath, getProjectSettingsPath } from '../storage/paths.js';

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Merge partial config with base config
 */
export function mergeConfigs(
  base: SeomatorConfig,
  partial: PartialSeomatorConfig
): SeomatorConfig {
  return deepMerge(base, partial as Partial<SeomatorConfig>);
}

/**
 * Find seomator.toml by searching up directory tree
 */
export function findConfigFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const homeDir = os.homedir();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const configPath = path.join(currentDir, 'seomator.toml');

    if (fs.existsSync(configPath)) {
      return configPath;
    }

    // Stop at home directory
    if (currentDir === homeDir) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Parse TOML config file
 */
export function parseConfigFile(filePath: string): PartialSeomatorConfig {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return TOML.parse(content) as PartialSeomatorConfig;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load JSON settings file
 */
function loadJsonSettings(filePath: string): PartialSeomatorConfig {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Load complete config with priority:
 * 1. Built-in defaults
 * 2. Global settings (~/.seomator/settings.json)
 * 3. TOML config file (searched up directory tree)
 * 4. Local settings (.seomator/settings.json)
 * 5. CLI overrides (passed as parameter)
 */
export function loadConfig(
  startDir: string = process.cwd(),
  cliOverrides: PartialSeomatorConfig = {}
): { config: SeomatorConfig; configPath: string | null } {
  // Start with defaults
  let config = getDefaultConfig();

  // Merge global settings
  const globalSettings = loadJsonSettings(getGlobalSettingsPath());
  config = mergeConfigs(config, globalSettings);

  // Find and merge TOML config
  const configPath = findConfigFile(startDir);
  if (configPath) {
    const tomlConfig = parseConfigFile(configPath);
    config = mergeConfigs(config, tomlConfig);
  }

  // Merge local project settings
  const projectSettings = loadJsonSettings(getProjectSettingsPath(startDir));
  config = mergeConfigs(config, projectSettings);

  // Merge CLI overrides
  config = mergeConfigs(config, cliOverrides);

  return { config, configPath };
}
