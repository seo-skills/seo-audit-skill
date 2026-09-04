import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { Auditor } from '../auditor.js';
import { loadConfig } from '../config/index.js';
import {
  loadCrawl,
  getLatestCrawl,
  saveReport,
  createReport,
  saveAuditToDatabase,
  getAuditsDbPath,
  type StoredCrawl,
  type StoredPage,
} from '../storage/index.js';
import { resolvePersistence, SAVE_DEPRECATION_NOTICE } from './persistence.js';
import { ProgressReporter, renderTerminalReport, outputJsonReport } from '../reporters/index.js';
import { buildAuditResult } from '../scoring.js';
import { loadAllRules } from '../rules/loader.js';
import { createAuditContext } from '../crawler/index.js';
import { resetCrossPageState } from '../rules/registry.js';
import type { AuditContext } from '../types.js';

export interface AnalyzeOptions {
  categories?: string[];
  latest: boolean;
  /** Store the analysis in the history database. True unless `--no-save`. */
  save: boolean;
  /** True only when the user typed the deprecated `--save` flag */
  saveExplicit?: boolean;
  /** Also write the legacy JSON report under .seomator/reports/ */
  jsonReport?: boolean;
  json: boolean;
  verbose: boolean;
}

/**
 * Create an AuditContext from a stored page.
 *
 * Delegates to the crawler's own `createAuditContext` so replayed pages get
 * exactly the same extraction as a live fetch — including `invalidLinks`,
 * `specialLinks`, `figures`, `inlineSvgs` and `pictureElements`, which rules
 * dereference without guarding.
 */
function createContextFromStoredPage(page: StoredPage): AuditContext {
  const $ = cheerio.load(page.html);

  return createAuditContext(
    page.url,
    {
      html: page.html,
      $,
      headers: page.headers,
      statusCode: page.status,
      responseTime: page.loadTime,
    },
    page.cwv || {}
  );
}

/**
 * Run analysis on stored crawl data
 */
export async function runAnalyze(crawlId: string | undefined, options: AnalyzeOptions): Promise<void> {
  const { config } = loadConfig(process.cwd());
  const baseDir = process.cwd();

  const persistence = resolvePersistence({
    save: options.save,
    saveExplicit: options.saveExplicit ?? false,
    jsonReport: options.jsonReport ?? false,
    configSave: config.output.save,
  });
  if (persistence.deprecatedSaveFlag && !options.json) {
    console.error(chalk.yellow(`  ${SAVE_DEPRECATION_NOTICE}`));
  }

  // Load crawl data
  let crawl: StoredCrawl | null = null;

  if (options.latest || !crawlId) {
    crawl = getLatestCrawl(baseDir);
    if (!crawl) {
      console.error(chalk.red('No crawls found. Run `seomator crawl <url>` first.'));
      process.exit(1);
    }
  } else {
    crawl = loadCrawl(baseDir, crawlId);
    if (!crawl) {
      console.error(chalk.red(`Crawl not found: ${crawlId}`));
      process.exit(1);
    }
  }

  console.log(chalk.blue('Analyzing crawl...'));
  console.log(`  Crawl ID: ${crawl.id}`);
  console.log(`  URL: ${crawl.url}`);
  console.log(`  Pages: ${crawl.pages.length}`);
  console.log();

  const progress = new ProgressReporter({
    json: options.json,
    crawl: true,
    verbose: options.verbose,
  });

  // Load all rules before analysis
  await loadAllRules();

  const auditor = new Auditor({
    categories: options.categories,
    measureCwv: false, // CWV already measured during crawl
    onCategoryStart: (id, name) => progress.onCategoryStart(id, name),
    onCategoryComplete: (id, name, result) => progress.onCategoryComplete(id, name, result),
    onRuleComplete: (id, name, result) => progress.onRuleComplete(id, name, result),
    onPageComplete: (url, pageNumber, totalPages) =>
      progress.onPageComplete(url, pageNumber, totalPages),
  });

  try {
    progress.start(crawl.url);

    if (crawl.pages.length === 0) {
      console.error(chalk.red('No pages in crawl data.'));
      process.exit(1);
    }

    // analyze runs in crawl mode, so per-category lines are suppressed. Without
    // this the command sat silent through a multi-page analysis.
    progress.startCrawlProgress(crawl.pages.length);

    // Rules that compare pages against each other hold state across the run
    resetCrossPageState();

    const pages = crawl.pages.map((page) => {
      try {
        return { url: page.url, context: createContextFromStoredPage(page) };
      } catch (error) {
        return {
          url: page.url,
          context: null as unknown as AuditContext,
          error: error instanceof Error ? error.message : 'Failed to rebuild page context',
        };
      }
    });

    // Score every stored page, not just the first
    const categoryResults = await auditor.auditPages(pages);

    // Build final result
    const timestamp = new Date().toISOString();
    const result = buildAuditResult(
      crawl.url,
      categoryResults,
      auditor.getCategoriesToAudit(),
      timestamp,
      crawl.pages.length,
      undefined,
      undefined,
      { pages: pages.map((p) => p.url), detail: 'per-page' }
    );

    progress.stop();

    if (persistence.legacyJson) {
      const report = createReport(
        crawl.id,
        crawl.url,
        crawl.project,
        config,
        result.overallScore,
        result.categoryResults
      );
      saveReport(baseDir, report);
      if (!options.json) console.log(chalk.green(`Report saved: ${report.id}`));
    }

    if (persistence.database) {
      try {
        const saved = saveAuditToDatabase(result, {
          projectName: crawl.project || config.project.name || 'default',
          config,
          source: 'cli',
          run: {
            crawl: true,
            maxPages: crawl.pages.length,
            concurrency: config.crawler.concurrency,
            measureCwv: false,
            mobile: false,
            simulateInteraction: false,
            categories: options.categories ?? [],
            timeout: config.crawler.timeout_ms,
          },
        });
        if (!options.json) {
          console.log(chalk.dim(`  Saved as ${saved.auditId} — compare with: seomator compare ${saved.domain}`));
        }
      } catch (error) {
        console.error(
          chalk.yellow(`  Could not store this analysis in ${getAuditsDbPath()}:`),
          error instanceof Error ? error.message : 'unknown error'
        );
      }
    }

    // Output results
    if (options.json) {
      outputJsonReport(result);
    } else {
      renderTerminalReport(result);
    }

    // Set the code rather than exiting, so a large --json payload on stdout is
    // not truncated at the pipe buffer. See the note in commands/audit.ts.
    process.exitCode = result.overallScore >= 70 ? 0 : 1;
  } catch (error) {
    progress.stop();
    console.error(chalk.red('Analysis failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 2;
  }
}
