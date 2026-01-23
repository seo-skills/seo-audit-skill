import chalk from 'chalk';
import { loadConfig, findConfigFile, writeSettingsFile } from '../config/index.js';
import { getGlobalSettingsPath, getProjectSettingsPath } from '../storage/index.js';

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

export async function runConfig(key: string | undefined, value: string | undefined, options: ConfigOptions): Promise<void> {
  const baseDir = process.cwd();
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
      const fs = await import('fs');
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
