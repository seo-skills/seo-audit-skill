import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { getPresetConfig, writeConfigFile, type ConfigPreset } from '../config/index.js';

export interface InitOptions {
  name?: string;
  preset?: ConfigPreset;
  yes: boolean;
}

async function prompt(question: string, defaultValue: string = ''): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const displayDefault = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`${question}${displayDefault}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function selectPreset(): Promise<ConfigPreset> {
  console.log('\nSelect a preset:');
  console.log('  1. default - Standard configuration');
  console.log('  2. blog - Optimized for blog/content sites');
  console.log('  3. ecommerce - Optimized for e-commerce sites');
  console.log('  4. ci - Minimal config for CI/CD pipelines');

  const choice = await prompt('Enter choice', '1');

  switch (choice) {
    case '2': return 'blog';
    case '3': return 'ecommerce';
    case '4': return 'ci';
    default: return 'default';
  }
}

export async function runInit(options: InitOptions): Promise<void> {
  const configPath = path.join(process.cwd(), 'seomator.toml');

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow('seomator.toml already exists in this directory.'));
    const overwrite = await prompt('Overwrite?', 'n');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }
  }

  let projectName = options.name || '';
  let preset: ConfigPreset = options.preset || 'default';

  if (!options.yes) {
    // Interactive mode
    projectName = await prompt('Project name', path.basename(process.cwd()));
    preset = await selectPreset();
  } else {
    // Use directory name as default project name
    projectName = projectName || path.basename(process.cwd());
  }

  // Build config
  const config = {
    ...getPresetConfig(preset),
    project: {
      name: projectName,
      domains: [],
    },
  };

  // Write config file
  writeConfigFile(configPath, config);

  console.log();
  console.log(chalk.green('Created seomator.toml'));
  console.log();
  console.log('Next steps:');
  console.log('  1. Edit seomator.toml to customize settings');
  console.log('  2. Run: seomator audit <url>');
  console.log();
}
