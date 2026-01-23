import chalk from 'chalk';
import * as fs from 'fs';
import { loadConfig, findConfigFile, writeSettingsFile, validateConfig, formatValidationResult } from '../config/index.js';
import { getGlobalSettingsPath, getProjectSettingsPath, getGlobalDir } from '../storage/index.js';

export interface ConfigOptions {
  global: boolean;
  local: boolean;
  list: boolean;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

function parseValue(value: string): unknown {
  // Try to parse as JSON
  try {
    return JSON.parse(value);
  } catch {
    // Return as string
    return value;
  }
}

/**
 * Handle 'config validate' subcommand
 * Validates the merged configuration and reports errors/warnings
 */
async function runConfigValidate(): Promise<void> {
  const baseDir = process.cwd();
  const { config, configPath } = loadConfig(baseDir);

  console.log(chalk.blue('Validating configuration...'));
  console.log();

  if (configPath) {
    console.log(`Config file: ${configPath}`);
  } else {
    console.log('Config file: (using defaults)');
  }
  console.log();

  const result = validateConfig(config);
  const formatted = formatValidationResult(result);

  if (result.valid && result.warnings.length === 0) {
    console.log(chalk.green('\u2713 ') + formatted);
  } else if (result.valid) {
    console.log(chalk.green('\u2713 Configuration is valid (with warnings)'));
    console.log();
    // Print warnings in yellow
    for (const warning of result.warnings) {
      console.log(chalk.yellow('\u26A0 ') + chalk.yellow(warning.path) + ': ' + warning.message);
      if (warning.value !== undefined) {
        console.log('  Value: ' + JSON.stringify(warning.value));
      }
    }
  } else {
    console.log(chalk.red('\u2717 Configuration has errors'));
    console.log();
    // Print errors in red
    for (const error of result.errors) {
      console.log(chalk.red('\u2717 ') + chalk.red(error.path) + ': ' + error.message);
      if (error.value !== undefined) {
        console.log('  Value: ' + JSON.stringify(error.value));
      }
    }
    // Print warnings in yellow
    if (result.warnings.length > 0) {
      console.log();
      console.log(chalk.yellow('Warnings:'));
      for (const warning of result.warnings) {
        console.log(chalk.yellow('\u26A0 ') + chalk.yellow(warning.path) + ': ' + warning.message);
      }
    }
    process.exit(1);
  }
}

/**
 * Handle 'config show' subcommand
 * Shows the fully merged configuration with source information
 */
async function runConfigShow(): Promise<void> {
  const baseDir = process.cwd();
  const { config, configPath } = loadConfig(baseDir);

  console.log(chalk.blue('Merged Configuration'));
  console.log(chalk.blue('='.repeat(50)));
  console.log();

  // Show config sources
  console.log(chalk.bold('Sources (in priority order):'));
  console.log('  1. Built-in defaults');

  const globalSettingsPath = getGlobalSettingsPath();
  if (fs.existsSync(globalSettingsPath)) {
    console.log(chalk.green('  2. Global settings: ') + globalSettingsPath);
  } else {
    console.log(chalk.gray('  2. Global settings: (not found)'));
  }

  if (configPath) {
    console.log(chalk.green('  3. TOML config: ') + configPath);
  } else {
    console.log(chalk.gray('  3. TOML config: (not found)'));
  }

  const projectSettingsPath = getProjectSettingsPath(baseDir);
  if (fs.existsSync(projectSettingsPath)) {
    console.log(chalk.green('  4. Local settings: ') + projectSettingsPath);
  } else {
    console.log(chalk.gray('  4. Local settings: (not found)'));
  }

  console.log();
  console.log(chalk.bold('Configuration:'));
  console.log();
  console.log(JSON.stringify(config, null, 2));
}

/**
 * Handle 'config path' subcommand
 * Shows paths to all config files and whether they exist
 */
async function runConfigPath(): Promise<void> {
  const baseDir = process.cwd();

  console.log(chalk.blue('Configuration Paths'));
  console.log(chalk.blue('='.repeat(50)));
  console.log();

  // Global directory
  const globalDir = getGlobalDir();
  console.log(chalk.bold('Global directory:'));
  console.log('  ' + globalDir);
  if (fs.existsSync(globalDir)) {
    console.log(chalk.green('  (exists)'));
  } else {
    console.log(chalk.gray('  (does not exist)'));
  }
  console.log();

  // Global settings
  const globalSettingsPath = getGlobalSettingsPath();
  console.log(chalk.bold('Global settings:'));
  console.log('  ' + globalSettingsPath);
  if (fs.existsSync(globalSettingsPath)) {
    console.log(chalk.green('  (exists)'));
  } else {
    console.log(chalk.gray('  (does not exist)'));
  }
  console.log();

  // TOML config file (searched up tree)
  const configPath = findConfigFile(baseDir);
  console.log(chalk.bold('TOML config file:'));
  if (configPath) {
    console.log('  ' + configPath);
    console.log(chalk.green('  (exists)'));
  } else {
    console.log(chalk.gray('  (not found in directory tree)'));
  }
  console.log();

  // Local project settings
  const projectSettingsPath = getProjectSettingsPath(baseDir);
  console.log(chalk.bold('Local settings:'));
  console.log('  ' + projectSettingsPath);
  if (fs.existsSync(projectSettingsPath)) {
    console.log(chalk.green('  (exists)'));
  } else {
    console.log(chalk.gray('  (does not exist)'));
  }
}

export async function runConfig(key: string | undefined, value: string | undefined, options: ConfigOptions): Promise<void> {
  const baseDir = process.cwd();

  // Handle subcommands
  if (key === 'validate') {
    return runConfigValidate();
  }

  if (key === 'show') {
    return runConfigShow();
  }

  if (key === 'path') {
    return runConfigPath();
  }

  const { config, configPath } = loadConfig(baseDir);

  if (options.list || (!key && !value)) {
    // Show all config
    console.log(chalk.blue('Current configuration:'));
    console.log();

    if (configPath) {
      console.log(`Config file: ${configPath}`);
    } else {
      console.log('Config file: (using defaults)');
    }
    console.log();
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (key && !value) {
    // Get specific value
    const currentValue = getNestedValue(config as unknown as Record<string, unknown>, key);

    if (currentValue === undefined) {
      console.error(chalk.red(`Key not found: ${key}`));
      process.exit(1);
    }

    console.log(JSON.stringify(currentValue, null, 2));
    return;
  }

  if (key && value) {
    // Set value
    const settingsPath = options.global
      ? getGlobalSettingsPath()
      : getProjectSettingsPath(baseDir);

    // Load existing settings
    let settings: Record<string, unknown> = {};
    try {
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
    } catch {
      // Start fresh
    }

    // Set the value
    const parsedValue = parseValue(value);
    setNestedValue(settings, key, parsedValue);

    // Write settings
    writeSettingsFile(settingsPath, settings);

    const scope = options.global ? 'global' : 'local';
    console.log(chalk.green(`Set ${key} = ${JSON.stringify(parsedValue)} (${scope})`));
  }
}
