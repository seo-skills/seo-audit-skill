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
  renderLlmError,
  outputLlmReport,
  renderBanner,
} from '../reporters/index.js';
import { loadConfig } from '../config/index.js';
import { selectsRuleSubset, UNAPPLIED_RULE_FILTER_NOTICE } from '../config/validator.js';
import type { OutputConfig } from '../config/schema.js';
import { AuditAbortedError, classifyError } from '../errors.js';
import { setUserAgent } from '../crawler/user-agent.js';
import { saveReport, createReport, saveAuditToDatabase, getAuditsDbPath } from '../storage/index.js';
import { resolvePersistence, SAVE_DEPRECATION_NOTICE } from './persistence.js';

/**
 * Output formats the audit command can render.
 *
 * The array is the source of truth so the CLI validates `--format` against the
 * same list this type is derived from.
 */
export const OUTPUT_FORMATS = ['console', 'json', 'html', 'markdown', 'llm'] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export interface AuditOptions {
  categories?: string[];
  json: boolean;
  crawl: boolean;
  maxPages: number;
  concurrency: number;
  timeout: number;
  verbose: boolean;
  cwv: boolean;
  mobile?: boolean;
  simulateInteraction?: boolean;
  refresh: boolean;
  resume: boolean;
  config?: string;
  /** Store the audit in the history database. True unless `--no-save`. */
  save: boolean;
  /** True only when the user typed the deprecated `--save` flag */
  saveExplicit?: boolean;
  /** Also write the legacy JSON report under .seomator/reports/ */
  jsonReport?: boolean;
  format?: OutputFormat;
  output?: string;
}

/**
 * Formats whose job is to put a document on stdout.
 *
 * Progress display, completion lines and anything else chatty must stay off
 * stdout for these, or the document is not parseable. This started life as
 * `json || llm` inline, so `--format markdown` printed the terminal progress
 * summary to stdout while the real report went to a file nobody asked for.
 *
 * Exported so the rule can be tested directly. A test that restates the list is
 * a test of its own copy.
 */
/**
 * Decide which format to render and where to put it.
 *
 * Precedence is flag > config file > default. This used to be computed before
 * `loadConfig` ran, so `[output] format` and `[output] path` were parsed,
 * validated, printed by `seomator config`, and then never consulted.
 *
 * `text` is a config-only spelling of the human-readable format with no CLI
 * equivalent, so it resolves to `console` rather than failing a run over a
 * synonym the config schema itself accepts.
 *
 * `format` and `path` are one instruction, not two fields: "my runs produce
 * JSON at reports/audit.json". Inheriting the path while the caller overrides
 * the format writes markdown into a file named `audit.json` and leaves stdout
 * empty, so `--format` without `-o` streams. A caller who overrides the format
 * and still wants a file names it.
 */
export function resolveOutputTarget(
  cli: { format?: OutputFormat; json?: boolean; output?: string },
  config: OutputConfig
): { format: OutputFormat; path: string | undefined } {
  const fromConfig: OutputFormat = config.format === 'text' ? 'console' : config.format;
  const overridesFormat = cli.format !== undefined || cli.json === true;
  const configPath = overridesFormat ? undefined : config.path || undefined;
  return {
    format: cli.format ?? (cli.json ? 'json' : fromConfig),
    path: cli.output ?? configPath,
  };
}

/**
 * Write a report to `outputPath`, creating its parent directories first.
 *
 * `-o reports/audit.json` failed with a bare ENOENT: nothing created the
 * directory, so the natural CI shape (a report under a subdirectory) could not
 * be written at all. The `ci` preset ships exactly that path as its default.
 *
 * The confirmation goes to stderr so a redirect still captures only the report.
 */
export function writeReport(outputPath: string, contents: string, label: string): void {
  const dir = path.dirname(outputPath);
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, contents, 'utf-8');
  console.error(chalk.green(`${label} saved to: ${outputPath}`));
}

export function isDocumentFormat(outputFormat: string): boolean {
  return (
    outputFormat === 'json' ||
    outputFormat === 'llm' ||
    outputFormat === 'html' ||
    outputFormat === 'markdown'
  );
}

export async function runAudit(url: string, options: AuditOptions): Promise<void> {
  const isCrawlMode = options.crawl;
  const isVerbose = options.verbose;
  const measureCwv = options.cwv !== false;
  // Mobile parity needs a browser render, so --mobile implies CWV rendering.
  const mobileParity = options.mobile === true && measureCwv;
  // A synthetic interaction only means anything during a browser render.
  const simulateInteraction = options.simulateInteraction === true && measureCwv;
  const selectedCategories: string[] = options.categories ?? [];
  const maxPages: number = options.maxPages;
  const concurrency: number = options.concurrency;

  // Load config before resolving output, not after. Format used to be decided
  // on the line above this call, so `[output] format` and `[output] path` in
  // seomator.toml were read, displayed by `seomator config`, and then never
  // consulted — `init --preset ci` writes both, and produced a coloured console
  // banner on stdout and no file.
  const { config, configPath } = loadConfig(process.cwd(), {
    crawler: {
      max_pages: maxPages,
      concurrency,
      timeout_ms: options.timeout,
    },
  });

  // A config asking for a subset of rules gets all 332 anyway. Say so on the
  // run it affects, not only when someone happens to type `seomator config`:
  // stderr, so a redirected document is still only the document.
  if (selectsRuleSubset(config.rules)) {
    const where = configPath ? ` (${configPath})` : '';
    console.error(chalk.yellow(`Warning${where}: ${UNAPPLIED_RULE_FILTER_NOTICE}`));
  }

  const { format: outputFormat, path: outputPath } = resolveOutputTarget(options, config.output);

  const isJsonMode = outputFormat === 'json';
  // `--format llm` exists so an agent can read stdout. A failure that prints
  // only to stderr leaves that agent with an empty string, which reads exactly
  // like a clean audit.
  const isMachineMode = isDocumentFormat(outputFormat);

  // Apply the configured identity to every request this run makes
  setUserAgent(config.crawler.user_agent);

  const persistence = resolvePersistence({
    save: options.save,
    saveExplicit: options.saveExplicit ?? false,
    jsonReport: options.jsonReport ?? false,
    configSave: config.output.save,
  });
  if (persistence.deprecatedSaveFlag && !isJsonMode) {
    console.error(chalk.yellow(`  ${SAVE_DEPRECATION_NOTICE}`));
  }

  // Create progress reporter
  const progress = new ProgressReporter({
    // Machine mode, not JSON mode. `--format llm` also writes a document to
    // stdout for a program to parse, and passing `isJsonMode` here let the
    // progress display print into the middle of it: every `--format llm` run
    // emitted "✗ Core …" lines before `<seo-audit>`, so the output was not
    // parseable XML at all.
    json: isMachineMode,
    crawl: isCrawlMode,
    verbose: isVerbose,
  });

  // Ctrl-C now stops the run rather than leaving the process to die with
  // requests in flight and a half-drawn progress bar.
  const controller = new AbortController();
  const onInterrupt = (): void => {
    if (!controller.signal.aborted) {
      controller.abort();
      progress.stop();
      console.error();
      console.error(chalk.yellow('Cancelling…'));
    }
  };
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onInterrupt);

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
      mobileParity,
      simulateInteraction,
      respectRobots: config.crawler.respect_robots,
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
      onCrawlProgress: (crawlProgress) => {
        progress.onCrawlProgress(crawlProgress);
      },
      signal: controller.signal,
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

    // Show completion message. Verbose must not reopen the hole: with
    // `--format llm --verbose` this line would print into the middle of the
    // document stdout is carrying.
    if (outputFormat === 'console' || (isVerbose && !isMachineMode)) {
      const pageText = result.crawledPages === 1 ? 'page' : 'pages';
      console.log();
      console.log(chalk.green(`\u2713 Audited ${result.crawledPages} ${pageText} in ${elapsedSec}s`));
    }

    // The legacy per-project JSON report, on request only
    if (persistence.legacyJson) {
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

    // The history database, which `seomator compare`, `seomator report` and
    // the desktop app read. On by default; never let a storage failure lose
    // the report the user is waiting on, and never hide the failure either.
    if (persistence.database) {
      try {
        const saved = saveAuditToDatabase(result, {
          projectName: config.project.name || 'default',
          config,
          source: 'cli',
          run: {
            crawl: isCrawlMode,
            maxPages: config.crawler.max_pages,
            concurrency: config.crawler.concurrency,
            measureCwv,
            mobile: mobileParity,
            simulateInteraction,
            categories: selectedCategories,
            timeout: config.crawler.timeout_ms,
          },
        });
        if (outputFormat === 'console') {
          console.log(chalk.dim(`  Saved as ${saved.auditId} — compare with: seomator compare ${saved.domain}`));
        }
      } catch (error) {
        console.error(
          chalk.yellow(`  Could not store this audit in ${getAuditsDbPath()}:`),
          error instanceof Error ? error.message : 'unknown error'
        );
        console.error(chalk.dim('  The report below is complete. Run `seomator self doctor` to check the data directory.'));
      }
    }

    // Output results based on format
    switch (outputFormat) {
      case 'json':
        if (outputPath) {
          writeReport(outputPath, JSON.stringify(result, null, 2), 'Report');
        } else {
          outputJsonReport(result);
        }
        break;

      // html and markdown used to write `seo-report-<id>.html` into the working
      // directory whatever the caller asked for, so `--format html > page.html`
      // produced a file of terminal output beside a stray report with an
      // invented name. They stream now, like json and llm: `-o` is the one way
      // to get a file, and it is the only thing that writes one.
      case 'html':
        if (outputPath) {
          writeReport(outputPath, renderHtmlReport(result), 'HTML report');
        } else {
          console.log(renderHtmlReport(result));
        }
        break;

      case 'markdown':
        if (outputPath) {
          writeReport(outputPath, renderMarkdownReport(result), 'Markdown report');
        } else {
          console.log(renderMarkdownReport(result));
        }
        break;

      case 'llm':
        if (outputPath) {
          writeReport(outputPath, renderLlmReport(result), 'LLM report');
        } else {
          outputLlmReport(result);
        }
        break;

      case 'console':
      default:
        renderTerminalReport(result);
        break;
    }

    // Set the code rather than calling process.exit(), which would discard
    // anything still buffered on stdout. Writes to a file are synchronous on
    // POSIX but writes to a pipe are not, so `--format json | jq` lost
    // everything past the 64KB pipe buffer while the same command redirected
    // to a file was complete. The process exits on its own once the event loop
    // drains, by which point stdout has been flushed.
    process.exitCode = result.overallScore >= 70 ? 0 : 1;
  } catch (error) {
    progress.stop();

    if (error instanceof AuditAbortedError) {
      if (!isMachineMode) {
        console.error(chalk.yellow('Audit cancelled.'));
      } else if (isJsonMode) {
        console.log(JSON.stringify({ error: true, code: 'aborted', message: 'Audit cancelled' }, null, 2));
      } else {
        console.log(renderLlmError({ url, code: 'aborted', message: 'Audit cancelled' }));
      }
      process.exitCode = 130;
      return;
    }

    const audited = classifyError(error);

    if (!isMachineMode) {
      console.error();
      console.error(chalk.red('Error: ') + audited.message);
      if (audited.hint) {
        console.error(chalk.dim(`  ${audited.hint}`));
      }
      console.error();
    } else if (!isJsonMode) {
      console.log(
        renderLlmError({
          url,
          code: audited.code,
          message: audited.message,
          ...(audited.hint && { hint: audited.hint }),
        })
      );
    } else {
      const errorOutput = {
        error: true,
        code: audited.code,
        message: audited.message,
        ...(audited.hint && { hint: audited.hint }),
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(errorOutput, null, 2));
    }

    // Same reason as the success path: let stdout drain before the process ends.
    process.exitCode = 2;
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onInterrupt);
  }
}
