import chalk from 'chalk';
import { Auditor } from '../auditor.js';
import { ProgressReporter, renderTerminalReport, outputJsonReport } from '../reporters/index.js';
import { loadConfig } from '../config/index.js';
import { saveReport, createReport } from '../storage/index.js';

export interface AuditOptions {
  categories?: string[];
  json: boolean;
  crawl: boolean;
  maxPages: number;
  concurrency: number;
  timeout: number;
  verbose: boolean;
  cwv: boolean;
  config?: string;
  save: boolean;
}

export async function runAudit(url: string, options: AuditOptions): Promise<void> {
  const isJsonMode = options.json;
  const isCrawlMode = options.crawl;
  const isVerbose = options.verbose;
  const measureCwv = options.cwv !== false;
  const selectedCategories: string[] = options.categories ?? [];
  const maxPages: number = options.maxPages;
  const concurrency: number = options.concurrency;
  const shouldSave = options.save;

  // Load config
  const { config } = loadConfig(process.cwd(), {
    crawler: {
      max_pages: maxPages,
      concurrency,
      timeout_ms: options.timeout,
    },
  });

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
      timeout: config.crawler.timeout_ms,
      measureCwv,
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
      progress.startCrawlProgress(config.crawler.max_pages);
      result = await auditor.auditWithCrawl(url, config.crawler.max_pages, config.crawler.concurrency);
    } else {
      result = await auditor.audit(url);
    }

    // Stop any progress indicators
    progress.stop();

    // Save report if requested
    if (shouldSave) {
      const report = createReport(
        '', // No crawl ID for inline audits
        url,
        config.project.name || 'default',
        config,
        result.overallScore,
        result.categoryResults
      );
      saveReport(process.cwd(), report);
    }

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
    progress.stop();

    if (!isJsonMode) {
      console.error();
      console.error(chalk.red('Error: ') + (error instanceof Error ? error.message : 'Unknown error'));
      console.error();
    } else {
      const errorOutput = {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(errorOutput, null, 2));
    }

    process.exit(2);
  }
}
