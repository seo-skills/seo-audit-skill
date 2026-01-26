import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { Auditor } from '../auditor.js';
import {
  ProgressReporter,
  renderTerminalReport,
  outputJsonReport,
  renderHtmlReport,
  renderMarkdownReport,
  renderLlmReport,
  outputLlmReport,
  renderBanner,
} from '../reporters/index.js';
import { loadConfig } from '../config/index.js';
import { saveReport, createReport, generateId } from '../storage/index.js';

export interface AuditOptions {
  categories?: string[];
  json: boolean;
  crawl: boolean;
  maxPages: number;
  concurrency: number;
  timeout: number;
  verbose: boolean;
  cwv: boolean;
  refresh: boolean;
  resume: boolean;
  config?: string;
  save: boolean;
  format?: 'console' | 'json' | 'html' | 'markdown' | 'llm';
  output?: string;
}

export async function runAudit(url: string, options: AuditOptions): Promise<void> {
  // Determine output format (--format takes precedence over --json)
  const outputFormat = options.format ?? (options.json ? 'json' : 'console');
  const isJsonMode = outputFormat === 'json';
  const isCrawlMode = options.crawl;
  const isVerbose = options.verbose;
  const measureCwv = options.cwv !== false;
  const selectedCategories: string[] = options.categories ?? [];
  const maxPages: number = options.maxPages;
  const concurrency: number = options.concurrency;
  const shouldSave = options.save;
  const outputPath = options.output;

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
    // Show banner (only for console output)
    if (outputFormat === 'console') {
      renderBanner({
        url,
        configPath: options.config,
        maxPages: config.crawler.max_pages,
        crawlMode: isCrawlMode,
      });
    }

    // Start timing
    const startTime = Date.now();

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

    // Calculate elapsed time
    const elapsedMs = Date.now() - startTime;
    const elapsedSec = (elapsedMs / 1000).toFixed(1);

    // Show completion message (for non-JSON output)
    if (outputFormat === 'console' || (isVerbose && !isJsonMode)) {
      const pageText = result.crawledPages === 1 ? 'page' : 'pages';
      console.log();
      console.log(chalk.green(`\u2713 Audited ${result.crawledPages} ${pageText} in ${elapsedSec}s`));
    }

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

    // Output results based on format
    switch (outputFormat) {
      case 'json':
        if (outputPath) {
          fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
          console.log(chalk.green(`Report saved to: ${outputPath}`));
        } else {
          outputJsonReport(result);
        }
        break;

      case 'html': {
        const htmlContent = renderHtmlReport(result);
        const htmlPath = outputPath ?? `seo-report-${generateId()}.html`;
        fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
        console.log(chalk.green(`HTML report saved to: ${htmlPath}`));
        break;
      }

      case 'markdown': {
        const mdContent = renderMarkdownReport(result);
        const mdPath = outputPath ?? `seo-report-${generateId()}.md`;
        fs.writeFileSync(mdPath, mdContent, 'utf-8');
        console.log(chalk.green(`Markdown report saved to: ${mdPath}`));
        break;
      }

      case 'llm':
        if (outputPath) {
          fs.writeFileSync(outputPath, renderLlmReport(result), 'utf-8');
          // Use stderr for status message so stdout stays clean for piping
          console.error(chalk.green(`LLM report saved to: ${outputPath}`));
        } else {
          outputLlmReport(result);
        }
        break;

      case 'console':
      default:
        renderTerminalReport(result);
        break;
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
