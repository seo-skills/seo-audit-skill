import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { Auditor } from '../auditor.js';
import { loadConfig } from '../config/index.js';
import * as fs from 'fs';
import {
  loadCrawl,
  getLatestCrawl,
  getCrawlsDir,
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
import type { AuditContext } from '../types.js';
import { emitCommandError } from './machine-error.js';
import { SCORING_VERSION } from '../scoring.js';
import { applyScoreCaps, readPageFacts, siteCaps } from '../score-caps.js';
import { assertRunnableConfig, externalLinksOptions } from './run-config.js';
import { applyRuleOverrides } from '../rules/overrides.js';
import { evaluateGate } from '../gate.js';
import { classifyError } from '../errors.js';
import type { SeomatorConfig } from '../config/schema.js';

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
  /** Analyze a staging crawl: waive the noindex cap */
  staging?: boolean;
  /** Config file path; otherwise seomator.toml is searched for */
  config?: string;
  /** Exit 1 below this score; overrides `[ci] fail_under` */
  failUnder?: number;
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
/**
 * Explain the one cause of "crawl not found" that the user cannot guess.
 *
 * `db migrate` used to rename `.seomator/crawls` to `.seomator/crawls.bak`,
 * and `analyze` only ever reads JSON: nothing reads a crawl back out of
 * `project.db`. So the migration `db stats` recommended made every stored
 * crawl unreachable, and said nothing about it. `db restore` puts them back,
 * which is not a connection anyone would make from "Crawl not found".
 */
function reportArchivedCrawls(baseDir: string): void {
  const archived = `${getCrawlsDir(baseDir)}.bak`;
  if (!fs.existsSync(archived)) return;

  const count = fs.readdirSync(archived).filter((f) => f.endsWith('.json')).length;
  if (count === 0) return;

  console.error();
  console.error(
    chalk.yellow(
      `${count} crawl${count === 1 ? '' : 's'} sitting in ${archived}, moved there by a past ` +
        '`db migrate`.'
    )
  );
  console.error(chalk.yellow('Run `seomator db restore` to put them back where analyze reads.'));
}

/**
 * Say which crawl is being analysed, on stderr.
 *
 * stdout carries the document — the JSON payload under `--json`, the terminal
 * report otherwise — and stderr carries status, the same split `audit` uses.
 * These four lines were plain `console.log` with no `--json` guard, so
 * `analyze <id> --json` printed "Analyzing crawl..." in front of the payload
 * and an agent's `JSON.parse` failed on the first character.
 *
 * Writing status to stderr removes the guard instead of adding a fourth one
 * next to the three that were already there and still missed these.
 */
export function announceAnalysis(crawl: Pick<StoredCrawl, 'id' | 'url' | 'pages'>): void {
  console.error(chalk.blue('Analyzing crawl...'));
  console.error(`  Crawl ID: ${crawl.id}`);
  console.error(`  URL: ${crawl.url}`);
  console.error(`  Pages: ${crawl.pages.length}`);
  console.error();
}

export async function runAnalyze(crawlId: string | undefined, options: AnalyzeOptions): Promise<void> {
  const baseDir = process.cwd();

  // Loaded inside the error handling, so a bad config reaches the same
  // code, message and exit 2 as every other failure instead of a stack trace.
  let config: SeomatorConfig;
  let configWarnings: string[];
  try {
    await loadAllRules();
    const loaded = loadConfig(baseDir, {}, options.config);
    configWarnings = assertRunnableConfig(loaded.config, loaded.configPath, { categories: options.categories ?? [] });
    config = loaded.config;
  } catch (error) {
    const audited = classifyError(error);
    emitCommandError({
      json: options.json === true,
      code: audited.code,
      message: audited.message,
      ...(audited.hint && { hint: audited.hint }),
      exitCode: 2,
    });
    return;
  }
  const failUnder = options.failUnder ?? config.ci.fail_under;
  for (const warning of configWarnings) {
    console.error(chalk.yellow(`Config warning: ${warning}`));
  }

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
      emitCommandError({
        json: options.json === true,
        code: 'no-crawls',
        message: 'No crawls found.',
        hint: 'Run `seomator crawl <url>` first.',
        exitCode: 2,
      });
      reportArchivedCrawls(baseDir);
      return;
    }
  } else {
    crawl = loadCrawl(baseDir, crawlId);
    if (!crawl) {
      emitCommandError({
        json: options.json === true,
        code: 'crawl-not-found',
        message: `Crawl not found: ${crawlId}`,
        hint: 'List stored crawls with: seomator analyze (no id) or check .seomator/crawls/',
        exitCode: 2,
      });
      reportArchivedCrawls(baseDir);
      return;
    }
  }

  announceAnalysis(crawl);

  const progress = new ProgressReporter({
    json: options.json,
    crawl: true,
    verbose: options.verbose,
  });

  const auditor = new Auditor({
    categories: options.categories,
    // `analyze` reads the same seomator.toml as `audit`, so a rule filter
    // applies to both. Analysing a stored crawl under different rules than the
    // audit that would have produced it is not a difference anyone asked for.
    enableRules: config.rules.enable,
    disableRules: config.rules.disable,
    ruleOptions: config.rule_options,
    externalLinks: externalLinksOptions(config),
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
      emitCommandError({
        json: options.json === true,
        code: 'empty-crawl',
        message: 'No pages in crawl data.',
        hint: 'Re-run the crawl: seomator crawl <url>',
        exitCode: 2,
      });
      return;
    }

    // analyze runs in crawl mode, so per-category lines are suppressed. Without
    // this the command sat silent through a multi-page analysis.
    progress.startCrawlProgress(crawl.pages.length);

    const pages = crawl.pages.map((page) => {
      try {
        // Dates are judged against the time of the crawl, not of the replay
        const context = createContextFromStoredPage(page);
        const crawledAt = Date.parse(crawl.timestamp);
        if (Number.isFinite(crawledAt)) context.now = crawledAt;
        return { url: page.url, context };
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
    const built = buildAuditResult(
      crawl.url,
      categoryResults,
      auditor.getCategoriesToAudit(),
      timestamp,
      crawl.pages.length,
      undefined,
      undefined,
      { pages: pages.map((p) => p.url), detail: 'per-page' }
    );
    const externalLinks = auditor.getExternalLinksReport();
    if (externalLinks) built.extras = { ...built.extras, externalLinks };

    // Capped like `audit --crawl` when search engines cannot index the start
    // page. That is the first stored page: the crawler records the entry
    // before it queues a single link, and `crawl` stores depth 0 for every
    // page, so depth cannot say. robots.txt is not stored with a crawl, so a
    // replay caps on noindex only.
    const start = pages[0];
    const result =
      start && !start.error
        ? applyScoreCaps(built, siteCaps(readPageFacts(start.context), start.url, { staging: options.staging }))
        : built;

    progress.stop();

    applyRuleOverrides(result, config.rules.override);
    result.gate = evaluateGate(result, { failUnder, overrides: config.rules.override });

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
      console.error(chalk.green(`Report saved: ${report.id}`));
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
            scoringVersion: SCORING_VERSION,
            ...(auditor.getRunRuleOptions() && { ruleOptions: auditor.getRunRuleOptions() }),
            // analyze applies rules.enable/disable too, so the run has to carry
            // them or `compare` reads a filtered analysis as like-for-like.
            enableRules: config.rules.enable,
            disableRules: config.rules.disable,
            ...(options.staging && { staging: true }),
            timeout: config.crawler.timeout_ms,
          },
        });
        console.error(
          chalk.dim(`  Saved as ${saved.auditId} — compare with: seomator compare ${saved.domain}`)
        );
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
    process.exitCode = result.gate.exitCode;
    if (result.gate.reason) {
      console.error(chalk.red(`Exit 1: ${result.gate.reason}`));
    }
  } catch (error) {
    progress.stop();
    console.error(chalk.red('Analysis failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 2;
  }
}
