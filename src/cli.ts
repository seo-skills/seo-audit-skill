import { Command, InvalidArgumentError } from 'commander';
import { readFileSync } from 'node:fs';
import { getCategoryIds } from './categories/index.js';
import './rules/loader.js'; // side-effect: registers every rule so the count below is accurate
import { getRuleCount } from './rules/registry.js';
import {
  runAudit,
  runInit,
  runCrawl,
  runAnalyze,
  runReport,
  runCompare,
  runConfig,
  runDbMigrate,
  runDbStats,
  runDbRestore,
  runSelfDoctor,
} from './commands/index.js';

/**
 * Read the package version from package.json rather than hardcoding it.
 * The published layout is dist/cli.js with package.json one level up, so this
 * resolves to the root manifest and can never drift from the released version.
 * Falls back gracefully if the manifest cannot be read.
 */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

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
  .description(
    `SEOmator - Comprehensive SEO audit CLI with ${getRuleCount()} rules across 20 categories`
  )
  .version(readVersion());

// Audit command
program
  .command('audit <url>')
  .description('Run SEO audit on a URL')
  .option('-c, --categories <list>', 'Categories to audit', parseCategories)
  .option('-j, --json', 'Output as JSON (deprecated, use --format json)', false)
  .option('-f, --format <type>', 'Output format: console, json, html, markdown, llm')
  .option('-o, --output <path>', 'Output file path (for html/markdown/json)')
  .option('--crawl', 'Enable multi-page crawl', false)
  .option('-m, --max-pages <n>', 'Max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000), 10)
  .option('--concurrency <n>', 'Concurrent requests', (v) => parseIntValue(v, 'concurrency', 1, 20), 3)
  .option('--timeout <ms>', 'Request timeout', (v) => parseIntValue(v, 'timeout', 1000, 120000), 30000)
  .option('-v, --verbose', 'Show progress', false)
  .option('--no-cwv', 'Skip Core Web Vitals')
  .option('--mobile', 'Also render at a mobile viewport and run mobile-first parity checks (single-page)', false)
  .option('-r, --refresh', 'Ignore cache, fetch all pages fresh', false)
  .option('--resume', 'Resume interrupted crawl', false)
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
  .option('-m, --max-pages <n>', 'Max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000))
  .option('-r, --refresh', 'Ignore cache, fetch all pages fresh', false)
  .option('--resume', 'Resume interrupted crawl', false)
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

// Compare command
program
  .command('compare [domain]')
  .description('Compare the latest audit of a site against a previous one')
  .option('--against <auditId>', 'Compare against a specific audit id instead of the previous run')
  .option('--trend', 'Show the score history for the domain instead of a two-run diff', false)
  .option('-j, --json', 'Output as JSON', false)
  .option('--fail-on-regression', 'Exit 1 when the score dropped or new failures appeared', false)
  .action(runCompare);

// Config command
program
  .command('config [key] [value]')
  .description('View or modify configuration')
  .option('--global', 'Modify global settings', false)
  .option('--local', 'Modify local settings', false)
  .option('--list', 'Show all config values', false)
  .action(runConfig);

// Database management command
const dbCommand = program
  .command('db')
  .description('Database management commands');

dbCommand
  .command('migrate')
  .description('Migrate JSON files to SQLite databases')
  .option('--dry-run', 'Preview migration without making changes', false)
  .option('--no-backup', 'Skip creating backup of original files')
  .action(runDbMigrate);

dbCommand
  .command('stats')
  .description('Show database statistics')
  .option('-v, --verbose', 'Show detailed statistics', false)
  .action(runDbStats);

dbCommand
  .command('restore')
  .description('Restore from backup (rollback migration)')
  .action(runDbRestore);

// Self command (diagnostics)
const selfCommand = program
  .command('self')
  .description('Self-diagnostics and maintenance');

selfCommand
  .command('doctor')
  .description('Check system setup and dependencies')
  .option('-v, --verbose', 'Show detailed output', false)
  .action(runSelfDoctor);

program.parse();
