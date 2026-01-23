import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { Auditor } from '../auditor.js';
import { loadConfig } from '../config/index.js';
import { loadCrawl, getLatestCrawl, saveReport, createReport, type StoredCrawl, type StoredPage } from '../storage/index.js';
import { ProgressReporter, renderTerminalReport, outputJsonReport } from '../reporters/index.js';
import { buildAuditResult } from '../scoring.js';
import { loadAllRules } from '../rules/loader.js';
import type { AuditContext, LinkInfo, ImageInfo } from '../types.js';

export interface AnalyzeOptions {
  categories?: string[];
  latest: boolean;
  save: boolean;
  json: boolean;
  verbose: boolean;
}

/**
 * Create an AuditContext from a stored page
 * Reconstructs the context needed for running audit rules
 */
function createContextFromStoredPage(page: StoredPage): AuditContext {
  const $ = cheerio.load(page.html);

  // Extract links
  const links: LinkInfo[] = [];
  const baseUrl = new URL(page.url);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    try {
      const linkUrl = new URL(href, page.url);
      const isInternal = linkUrl.hostname === baseUrl.hostname;
      const rel = $(el).attr('rel') || '';
      const isNoFollow = rel.includes('nofollow');

      links.push({ href: linkUrl.href, text, isInternal, isNoFollow });
    } catch {
      // Invalid URL, skip
    }
  });

  // Extract images
  const images: ImageInfo[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';

    images.push({
      src,
      alt,
      hasAlt: $(el).attr('alt') !== undefined,
      width: $(el).attr('width'),
      height: $(el).attr('height'),
      isLazyLoaded: $(el).attr('loading') === 'lazy',
    });
  });

  return {
    url: page.url,
    html: page.html,
    $,
    headers: page.headers,
    statusCode: page.status,
    responseTime: page.loadTime,
    cwv: page.cwv || {},
    links,
    images,
  };
}

/**
 * Run analysis on stored crawl data
 */
export async function runAnalyze(crawlId: string | undefined, options: AnalyzeOptions): Promise<void> {
  const { config } = loadConfig(process.cwd());
  const baseDir = process.cwd();

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
  });

  try {
    progress.start(crawl.url);

    // Analyze first page for now (multi-page analysis would need aggregation)
    const firstPage = crawl.pages[0];
    if (!firstPage) {
      console.error(chalk.red('No pages in crawl data.'));
      process.exit(1);
    }

    const context = createContextFromStoredPage(firstPage);

    // Run all categories on the context
    const categoryResults = await auditor.runAllCategories(context);

    // Build final result
    const timestamp = new Date().toISOString();
    const result = buildAuditResult(
      crawl.url,
      categoryResults,
      auditor.getCategoriesToAudit(),
      timestamp,
      crawl.pages.length
    );

    progress.stop();

    // Save report if requested
    if (options.save) {
      const report = createReport(
        crawl.id,
        crawl.url,
        crawl.project,
        config,
        result.overallScore,
        result.categoryResults
      );
      saveReport(baseDir, report);
      console.log(chalk.green(`Report saved: ${report.id}`));
    }

    // Output results
    if (options.json) {
      outputJsonReport(result);
    } else {
      renderTerminalReport(result);
    }

    const exitCode = result.overallScore >= 70 ? 0 : 1;
    process.exit(exitCode);
  } catch (error) {
    progress.stop();
    console.error(chalk.red('Analysis failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(2);
  }
}
