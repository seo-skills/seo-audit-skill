import chalk from 'chalk';
import { Command, InvalidArgumentError, Option } from 'commander';
import { getCategoryIds } from './categories/index.js';
import { getVersion } from './version.js';
import { OUTPUT_FORMATS, type AuditOptions } from './commands/audit.js';
import type { AnalyzeOptions } from './commands/analyze.js';
import type { ServeOptions } from './commands/serve.js';
import { CONFIG_PRESETS } from './config/writer.js';

/** Formats the `report` command can render. */
const REPORT_FORMATS = ['table', 'json'] as const;
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
 * Validate that a string is a URL the crawler can actually fetch.
 *
 * Runs at parse time so a bad URL is rejected before the banner prints and
 * before any network call. A missing scheme is the most common way to get
 * here, so say so rather than surfacing the underlying parser error.
 */
function validateUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    // Suggest a scheme only when the value does not already carry one and
    // prefixing it actually parses. Without the first condition, "http://"
    // would be offered back as "https://http://".
    if (!value.includes('://')) {
      const withScheme = `https://${value}`;
      if (URL.canParse(withScheme)) {
        throw new InvalidArgumentError(`Invalid URL "${value}". Did you mean ${withScheme}?`);
      }
    }
    throw new InvalidArgumentError(`Invalid URL "${value}"`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new InvalidArgumentError(
      `URL must use http or https, got "${url.protocol.replace(':', '')}"`
    );
  }

  return value;
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
 * Validate that an option value is one of a fixed set.
 *
 * Without this, a typo'd `--format josn` silently fell back to console output
 * and exited 0, which in CI looks exactly like success.
 *
 * @param value - The supplied option value
 * @param name - Option name, for the error message
 * @param allowed - The permitted values
 * @returns The value, once known to be permitted
 */
function parseEnum<T extends string>(
  value: string,
  name: string,
  allowed: readonly T[]
): T {
  if (!allowed.includes(value as T)) {
    throw new InvalidArgumentError(
      `Invalid ${name}: "${value}". Valid: ${allowed.join(', ')}`
    );
  }
  return value as T;
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
  .version(getVersion());

// Audit command
program
  .command('audit')
  .argument('<url>', 'URL to audit', validateUrl)
  .description('Run SEO audit on a URL')
  .option('-c, --categories <list>', 'Categories to audit', parseCategories)
  .option('-j, --json', 'Output as JSON (deprecated, use --format json)', false)
  .option(
    '-f, --format <type>',
    `Output format: ${OUTPUT_FORMATS.join(', ')}`,
    (v) => parseEnum(v, 'format', OUTPUT_FORMATS)
  )
  .option('-o, --output <path>', 'Output file path (for html/markdown/json)')
  .option('--crawl', 'Enable multi-page crawl', false)
  .option('-m, --max-pages <n>', 'Max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000), 10)
  .option('--concurrency <n>', 'Concurrent requests', (v) => parseIntValue(v, 'concurrency', 1, 20), 3)
  .option('--timeout <ms>', 'Request timeout', (v) => parseIntValue(v, 'timeout', 1000, 120000), 30000)
  .option('-v, --verbose', 'Show progress', false)
  .option('--no-cwv', 'Skip Core Web Vitals')
  .option('--mobile', 'Also render at a mobile viewport and run mobile-first parity checks (single-page)', false)
  .option('--simulate-interaction', 'Click and scroll the page so INP can be measured (reported as synthetic)', false)
  .addOption(new Option('-r, --refresh').hideHelp().default(false))
  .addOption(new Option('--resume').hideHelp().default(false))
  .option('--config <path>', 'Config file path')
  // --no-save must be declared before --save so the default stays true.
  .option('--no-save', 'Do not store this audit in the history database')
  .option('--save', 'Deprecated: also write the legacy JSON report (use --json-report)')
  .option('--json-report', 'Also write the legacy JSON report to .seomator/reports/', false)
  .action((url: string, options: AuditOptions, command: Command) =>
    runAudit(url, {
      ...options,
      saveExplicit: command.getOptionValueSource('save') === 'cli' && options.save === true,
    })
  );

// Serve command
program
  .command('serve')
  .description('Run the local dashboard: browse past audits in your browser')
  .option('-p, --port <n>', 'Port on 127.0.0.1 (0 picks a free one)', (v) => parseIntValue(v, 'port', 0, 65535), 7360)
  .option('--no-open', 'Do not open a browser')
  .option('-v, --verbose', 'Log one line per request', false)
  .option('--audit <url>', 'Audit this URL as soon as the server starts', validateUrl)
  .option('--crawl', 'With --audit: crawl the site', false)
  .option('-m, --max-pages <n>', 'With --audit: max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000))
  .option('--no-cwv', 'With --audit: skip Core Web Vitals')
  .option('-c, --categories <list>', 'With --audit: categories to run', parseCategories)
  .option('--mobile', 'With --audit: also render at a mobile viewport', false)
  .option('--simulate-interaction', 'With --audit: click and scroll so INP can be measured', false)
  .action(async (options: ServeOptions) => {
    // Imported lazily so `seomator audit` does not pay for the server module.
    const { runServe } = await import('./commands/serve.js');
    await runServe(options);
  });

// Init command
program
  .command('init')
  .description('Create seomator.toml config file')
  .option('--name <name>', 'Project name')
  .option(
    '--preset <type>',
    `Use preset (${CONFIG_PRESETS.join(', ')})`,
    (v) => parseEnum(v, 'preset', CONFIG_PRESETS)
  )
  .option('-y, --yes', 'Use defaults without prompts', false)
  .action(runInit);

// Crawl command
program
  .command('crawl')
  .argument('<url>', 'URL to crawl', validateUrl)
  .description('Crawl website without analysis')
  .option('-m, --max-pages <n>', 'Max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000))
  .addOption(new Option('-r, --refresh').hideHelp().default(false))
  .addOption(new Option('--resume').hideHelp().default(false))
  .option('--output <path>', 'Output directory')
  .option('-v, --verbose', 'Show progress', false)
  .action(runCrawl);

// Analyze command
program
  .command('analyze [crawl-id]')
  .description('Run rules on stored crawl data')
  .option('-c, --categories <list>', 'Categories to analyze', parseCategories)
  .option('--latest', 'Use most recent crawl', false)
  .option('--no-save', 'Do not store this analysis in the history database')
  .option('--save', 'Deprecated: also write the legacy JSON report (use --json-report)')
  .option('--json-report', 'Also write the legacy JSON report to .seomator/reports/', false)
  .option('-j, --json', 'Output as JSON', false)
  .option('-v, --verbose', 'Show progress', false)
  .action((crawlId: string | undefined, options: AnalyzeOptions, command: Command) =>
    runAnalyze(crawlId, {
      ...options,
      saveExplicit: command.getOptionValueSource('save') === 'cli' && options.save === true,
    })
  );

// Report command
program
  .command('report [query]')
  .description('View and query past reports')
  .option('--list', 'List all reports', false)
  .option('--project <name>', 'Filter by project')
  .option('--since <date>', 'Filter by date (ISO format)')
  .option(
    '--format <type>',
    'Output format (table, json)',
    (v) => parseEnum(v, 'format', REPORT_FORMATS),
    'table'
  )
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
  .option('--archive', 'Move the original JSON files aside after migrating', false)
  // Kept so existing scripts keep parsing. Not archiving is the default now,
  // because `analyze` and `report` still read those JSON files.
  .option('--no-backup', 'Deprecated: originals are kept unless --archive')
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
