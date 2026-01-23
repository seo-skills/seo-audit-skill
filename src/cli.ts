import { Command, InvalidArgumentError } from 'commander';
import chalk from 'chalk';
import { Auditor } from './auditor.js';
import { categories, getCategoryIds } from './categories/index.js';
import { ProgressReporter, renderTerminalReport, outputJsonReport } from './reporters/index.js';

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
    throw new InvalidArgumentError('Invalid URL format. Please provide a valid URL (e.g., https://example.com)');
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
        `Invalid category: "${cat}". Valid categories are: ${validCategories.join(', ')}`
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
  if (isNaN(parsed)) {
    throw new InvalidArgumentError(`${name} must be a number`);
  }
  if (parsed < min || parsed > max) {
    throw new InvalidArgumentError(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

/**
 * Main CLI program
 */
const program = new Command();

program
  .name('seomator')
  .description('SEOmator - Comprehensive SEO audit CLI tool with 55 rules across 9 categories')
  .version('1.0.0')
  .argument('<url>', 'URL to audit', validateUrl)
  .option(
    '-c, --categories <list>',
    'Comma-separated list of categories to audit',
    parseCategories
  )
  .option('-j, --json', 'Output results as JSON', false)
  .option('--crawl', 'Enable crawl mode to audit multiple pages', false)
  .option(
    '--max-pages <n>',
    'Maximum pages to crawl (default: 10)',
    (value) => parseIntValue(value, 'max-pages', 1, 1000),
    10
  )
  .option(
    '--concurrency <n>',
    'Number of concurrent requests (default: 3)',
    (value) => parseIntValue(value, 'concurrency', 1, 20),
    3
  )
  .option(
    '--timeout <ms>',
    'Request timeout in milliseconds (default: 30000)',
    (value) => parseIntValue(value, 'timeout', 1000, 120000),
    30000
  )
  .option(
    '-v, --verbose',
    'Show progress to stderr (useful with --json)',
    false
  )
  .option(
    '--no-cwv',
    'Skip Core Web Vitals measurement (faster, no browser needed)'
  )
  .addHelpText(
    'after',
    `
Examples:
  $ seomator https://example.com
  $ seomator https://example.com --categories meta-tags,headings
  $ seomator https://example.com --json
  $ seomator https://example.com --crawl --max-pages 20
  $ seomator https://example.com --crawl --concurrency 5 --timeout 60000

Available categories:
${categories.map((c) => `  - ${c.id}: ${c.name}`).join('\n')}

Exit codes:
  0 - Audit passed (score >= 70)
  1 - Audit failed (score < 70)
  2 - Error occurred
`
  )
  .action(async (url: string, options) => {
    const isJsonMode = options.json;
    const isCrawlMode = options.crawl;
    const isVerbose = options.verbose;
    const measureCwv = options.cwv !== false; // true by default, false with --no-cwv
    const selectedCategories: string[] = options.categories ?? [];
    const maxPages: number = options.maxPages;
    const concurrency: number = options.concurrency;
    const timeout: number = options.timeout;

    // Create progress reporter
    const progress = new ProgressReporter({
      json: isJsonMode,
      crawl: isCrawlMode,
      verbose: isVerbose,
    });

    try {
      // Start progress display
      progress.start(url);

      // Create auditor with options and callbacks
      const auditor = new Auditor({
        categories: selectedCategories,
        timeout,
        measureCwv, // CWV measurement enabled by default, disable with --no-cwv
        onCategoryStart: (categoryId, categoryName) => {
          progress.onCategoryStart(categoryId, categoryName);
        },
        onCategoryComplete: (categoryId, categoryName, result) => {
          progress.onCategoryComplete(categoryId, categoryName, result);
        },
        onRuleComplete: (ruleId, ruleName, result) => {
          progress.onRuleComplete(ruleId, ruleName, result);
        },
        onPageComplete: (pageUrl, pageNumber, totalPages) => {
          progress.onPageComplete(pageUrl, pageNumber, totalPages);
        },
      });

      let result;

      if (isCrawlMode) {
        // Start crawl progress bar
        progress.startCrawlProgress(maxPages);

        // Run crawl audit
        result = await auditor.auditWithCrawl(url, maxPages, concurrency);
      } else {
        // Run single-page audit
        result = await auditor.audit(url);
      }

      // Stop any progress indicators
      progress.stop();

      // Output results
      if (isJsonMode) {
        outputJsonReport(result);
      } else {
        renderTerminalReport(result);
      }

      // Exit with appropriate code
      const exitCode = result.overallScore >= 70 ? 0 : 1;
      process.exit(exitCode);
    } catch (error) {
      // Stop any progress indicators
      progress.stop();

      if (!isJsonMode) {
        console.error();
        console.error(chalk.red('Error: ') + (error instanceof Error ? error.message : 'Unknown error'));
        console.error();

        if (error instanceof Error && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      } else {
        // Output error as JSON
        const errorOutput = {
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        console.log(JSON.stringify(errorOutput, null, 2));
      }

      process.exit(2);
    }
  });

// Parse arguments and run
program.parse();
