import { Command, InvalidArgumentError } from 'commander';
import { getCategoryIds } from './categories/index.js';
import {
  runAudit,
  runInit,
  runCrawl,
  runAnalyze,
  runReport,
  runConfig,
} from './commands/index.js';

/**
 * Validate that a string is a valid URL
 */
function validateUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new InvalidArgumentError('URL must use http or https protocol');
    }
    return value;
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      throw error;
    }
    throw new InvalidArgumentError('Invalid URL format');
  }
}

/**
 * Parse and validate category list
 */
function parseCategories(value: string): string[] {
  const validCategories = getCategoryIds();
  const requested = value.split(',').map((c) => c.trim().toLowerCase());

  for (const cat of requested) {
    if (!validCategories.includes(cat)) {
      throw new InvalidArgumentError(
        `Invalid category: "${cat}". Valid: ${validCategories.join(', ')}`
      );
    }
  }

  return requested;
}

/**
 * Parse integer value with validation
 */
function parseIntValue(value: string, name: string, min: number, max: number): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new InvalidArgumentError(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

const program = new Command();

program
  .name('seomator')
  .description('SEOmator - Comprehensive SEO audit CLI with 55 rules across 9 categories')
  .version('2.0.0');

// Audit command (default)
program
  .command('audit <url>', { isDefault: true })
  .description('Run SEO audit on a URL')
  .argument('<url>', 'URL to audit', validateUrl)
  .option('-c, --categories <list>', 'Categories to audit', parseCategories)
  .option('-j, --json', 'Output as JSON', false)
  .option('--crawl', 'Enable multi-page crawl', false)
  .option('--max-pages <n>', 'Max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000), 10)
  .option('--concurrency <n>', 'Concurrent requests', (v) => parseIntValue(v, 'concurrency', 1, 20), 3)
  .option('--timeout <ms>', 'Request timeout', (v) => parseIntValue(v, 'timeout', 1000, 120000), 30000)
  .option('-v, --verbose', 'Show progress', false)
  .option('--no-cwv', 'Skip Core Web Vitals')
  .option('--config <path>', 'Config file path')
  .option('--save', 'Save report to .seomator/reports/', false)
  .action(runAudit);

// Init command
program
  .command('init')
  .description('Create seomator.toml config file')
  .option('--name <name>', 'Project name')
  .option('--preset <type>', 'Use preset (default, blog, ecommerce, ci)')
  .option('-y, --yes', 'Use defaults without prompts', false)
  .action(runInit);

// Crawl command
program
  .command('crawl <url>')
  .description('Crawl website without analysis')
  .argument('<url>', 'URL to crawl', validateUrl)
  .option('--max-pages <n>', 'Max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000))
  .option('--output <path>', 'Output directory')
  .option('-v, --verbose', 'Show progress', false)
  .action(runCrawl);

// Analyze command
program
  .command('analyze [crawl-id]')
  .description('Run rules on stored crawl data')
  .option('-c, --categories <list>', 'Categories to analyze', parseCategories)
  .option('--latest', 'Use most recent crawl', false)
  .option('--save', 'Save report', false)
  .option('-j, --json', 'Output as JSON', false)
  .option('-v, --verbose', 'Show progress', false)
  .action(runAnalyze);

// Report command
program
  .command('report [query]')
  .description('View and query past reports')
  .option('--list', 'List all reports', false)
  .option('--project <name>', 'Filter by project')
  .option('--since <date>', 'Filter by date (ISO format)')
  .option('--format <type>', 'Output format (table, json)', 'table')
  .action(runReport);

// Config command
program
  .command('config [key] [value]')
  .description('View or modify configuration')
  .option('--global', 'Modify global settings', false)
  .option('--local', 'Modify local settings', false)
  .option('--list', 'Show all config values', false)
  .action(runConfig);

program.parse();
