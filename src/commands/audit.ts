import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { Auditor } from '../auditor.js';
import { resolveBrowserRender } from '../browser-render.js';
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
import { toUrlFilterOptions } from '../config/url-filter-options.js';
import { selectsRuleSubset, RULE_FILTER_NOTICE } from '../config/validator.js';
import { warnUnimplementedFlags } from './unimplemented-flags.js';
import type { OutputConfig } from '../config/schema.js';
import type { AuditResult } from '../types.js';
import { AuditAbortedError, classifyError } from '../errors.js';
import { setUserAgent } from '../crawler/user-agent.js';
import { saveReport, createReport, saveAuditToDatabase, getAuditsDbPath } from '../storage/index.js';
import { resolvePersistence, SAVE_DEPRECATION_NOTICE } from './persistence.js';
import { assertRunnableConfig, externalLinksOptions } from './run-config.js';
import { applyRuleOverrides } from '../rules/overrides.js';
import { evaluateGate } from '../gate.js';

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
  /** `--cwv` is true, `--no-cwv` is false, neither is undefined */
  cwv?: boolean;
  mobile?: boolean;
  simulateInteraction?: boolean;
  /** Audit a staging site: waive the noindex and robots.txt caps */
  staging?: boolean;
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
  /** Exit 1 below this score; overrides `[ci] fail_under` */
  failUnder?: number;
  /**
   * Which of `maxPages`, `concurrency` and `timeout` the user typed. Only those
   * override `[crawler]` in seomator.toml. Absent (a programmatic caller)
   * means all three are explicit, as they always were.
   */
  explicitFlags?: { maxPages?: boolean; concurrency?: boolean; timeout?: boolean };
  /** Exit 1 when a crawl measured less than this percent; overrides `[ci] min_coverage` */
  minCoverage?: number;
  /** Stop a crawl after this many seconds; overrides `crawler.max_duration_s` */
  maxDuration?: number;
  /** Do not honour robots.txt Crawl-delay */
  ignoreCrawlDelay?: boolean;
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
 * Render a failure in whatever shape the caller is reading.
 *
 * Shared by the audit's own catch and by config loading, which happens before
 * the run starts. A bad `--config` path used to escape as an unhandled throw:
 * a typo printed a Node stack trace and exited 1, while every other error in
 * this command produced a message, a hint and exit 2.
 */
function reportAuditError(
  error: unknown,
  url: string,
  isMachineMode: boolean,
  isJsonMode: boolean
): void {
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
    console.log(
      JSON.stringify(
        {
          error: true,
          code: audited.code,
          message: audited.message,
          ...(audited.hint && { hint: audited.hint }),
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }

  // Same reason as the success path: let stdout drain before the process ends.
  process.exitCode = 2;
}

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

/** "17 min", "45 s", "2 h 5 min" */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * What a crawl could not measure, said once after the run, on stderr.
 *
 * Each host that rate-limited the crawl is named with a setting that would
 * have spaced the requests out; a crawl that measured under 90% of its pages
 * says so even when no coverage gate is set.
 */
export function crawlWarnings(result: AuditResult, minCoverage: number): string[] {
  const warnings: string[] = [];
  const crawl = result.extras?.['crawl'] as
    | { rateLimitedHosts?: Array<{ host: string; pages: number; lastRetryAfterS: number | null }>; abandonedHosts?: string[]; stoppedByDeadline?: boolean }
    | undefined;
  for (const host of crawl?.rateLimitedHosts ?? []) {
    const suggested = Math.max(1000, (host.lastRetryAfterS ?? 2) * 1000);
    warnings.push(
      `${host.host} rate-limited ${host.pages} ${host.pages === 1 ? 'page' : 'pages'}. ` +
        `Space requests out with crawler.per_host_delay_ms = ${suggested}, or lower --concurrency.`
    );
  }
  for (const host of crawl?.abandonedHosts ?? []) {
    warnings.push(`${host} kept failing, so the crawl stopped requesting it; its remaining pages were not fetched.`);
  }
  if (crawl?.stoppedByDeadline) {
    warnings.push('The crawl reached its time limit; pages still queued were not fetched.');
  }
  const coverage = result.coverage;
  if (!minCoverage && coverage?.attempted && coverage.measured !== undefined) {
    const percent = Math.floor((coverage.measured / coverage.attempted) * 100);
    if (percent < 90) {
      warnings.push(
        `Measured ${coverage.measured} of ${coverage.attempted} pages (${percent}%). Set --min-coverage to make CI fail on this.`
      );
    }
  }
  return warnings;
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
  // The browser render is opt-in. One resolver for the CLI and the dashboard,
  // so a flag means the same thing on both.
  const {
    measureCwv,
    mobile: mobileParity,
    simulateInteraction,
  } = resolveBrowserRender({
    cwv: options.cwv,
    mobile: options.mobile,
    simulateInteraction: options.simulateInteraction,
  });
  const selectedCategories: string[] = options.categories ?? [];
  const maxPages: number = options.maxPages;
  const concurrency: number = options.concurrency;

  // Load config before resolving output, not after. Format used to be decided
  // on the line above this call, so `[output] format` and `[output] path` in
  // seomator.toml were read, displayed by `seomator config`, and then never
  // consulted — `init --preset ci` writes both, and produced a coloured console
  // banner on stdout and no file.
  // How to report a failure that happens before the config is known. The
  // config can change the output format, but a config that failed to load
  // cannot, so the flags alone are the right view here.
  const cliFormat: OutputFormat = options.format ?? (options.json ? 'json' : 'console');

  let loaded;
  let configWarnings: string[] = [];
  try {
    const explicit = options.explicitFlags ?? { maxPages: true, concurrency: true, timeout: true };
    loaded = loadConfig(
      process.cwd(),
      {
        crawler: {
          ...(explicit.maxPages && { max_pages: maxPages }),
          ...(explicit.concurrency && { concurrency }),
          ...(explicit.timeout && { timeout_ms: options.timeout }),
        },
      },
      options.config
    );
    // A config that does not mean what it says stops here, before any
    // request: a typo'd `fail_ci` rule id would otherwise be a gate that
    // never fires.
    configWarnings = assertRunnableConfig(loaded.config, loaded.configPath, { categories: selectedCategories });
  } catch (error) {
    reportAuditError(error, url, isDocumentFormat(cliFormat), cliFormat === 'json');
    return;
  }
  const { config, configPath } = loaded;
  const failUnder = options.failUnder ?? config.ci.fail_under;
  const minCoverage = options.minCoverage ?? config.ci.min_coverage;
  const maxDurationS = options.maxDuration ?? config.crawler.max_duration_s;
  for (const warning of configWarnings) {
    console.error(chalk.yellow(`Config warning: ${warning}`));
  }

  warnUnimplementedFlags(options as unknown as Record<string, unknown>, 'audit');

  // A filtered run scores differently from a full one. Say so on the run it
  // affects, on stderr so a redirected document is still only the document.
  if (selectsRuleSubset(config.rules)) {
    const where = configPath ? ` (${configPath})` : '';
    console.error(chalk.yellow(`Note${where}: ${RULE_FILTER_NOTICE}`));
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
        configPath: configPath ?? undefined,
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
      staging: options.staging ?? false,
      urlFilter: toUrlFilterOptions(config.crawler),
      enableRules: config.rules.enable,
      disableRules: config.rules.disable,
      ruleOptions: config.rule_options,
      delayMs: config.crawler.delay_ms,
      perHostDelayMs: config.crawler.per_host_delay_ms,
      perHostConcurrency: config.crawler.per_host_concurrency,
      respectCrawlDelay: !options.ignoreCrawlDelay && config.crawler.respect_crawl_delay,
      maxRetryAfterMs: config.crawler.max_retry_after_ms,
      ...(maxDurationS > 0 && { maxDurationMs: maxDurationS * 1000 }),
      externalLinks: externalLinksOptions(config, options.refresh === true),
      onExternalLinks: (count) => {
        if (outputFormat === 'console' || isVerbose) {
          console.error(chalk.dim(`  checking ${count} external link${count === 1 ? '' : 's'}`));
        }
      },
      // Said before the first page, on stderr, and the run carries on: a
      // projection is information, not a question an unattended run can answer.
      onCrawlDelay: (notice) => {
        const capped = notice.capped ? ` (capped from ${Math.round(notice.requestedMs / 1000)} s)` : '';
        console.error(
          chalk.yellow(
            `${notice.host} asks for ${notice.delayMs / 1000} s between requests${capped}. ` +
              `This crawl may take up to ${formatDuration(notice.projectedMs)}. Pass --ignore-crawl-delay to skip the delay.`
          )
        );
      },
      onWaiting: (waiting) => {
        // A sub-second pause is not worth a line; a long one should not look like a hang
        if ((outputFormat === 'console' || isVerbose) && waiting.waitMs >= 1000) {
          console.error(chalk.dim(`  waiting on ${waiting.host} (rate limited, ${Math.ceil(waiting.waitMs / 1000)} s)`));
        }
      },
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

    // Overrides re-rank findings and mark gated rules; they never touch the
    // score. The gate is decided here so every format carries it.
    applyRuleOverrides(result, config.rules.override);
    result.gate = evaluateGate(result, { failUnder, overrides: config.rules.override, minCoverage });
    const runWarnings = [...configWarnings, ...crawlWarnings(result, minCoverage)];
    for (const warning of runWarnings.slice(configWarnings.length)) console.error(chalk.yellow(warning));
    if (runWarnings.length > 0) result.warnings = [...(result.warnings ?? []), ...runWarnings];

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
            // The auditor's own record first: it carries the scoring model,
            // the rule filters and staging. Without it `compare` read audits
            // from two scoring models as like-for-like, and could fail
            // --fail-on-regression over a model change.
            ...result.run,
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
    process.exitCode = result.gate.exitCode;
    // The last line says why a run failed, on stderr so stdout stays the
    // document. Without it a CI log shows exit 1 next to a passing score.
    if (result.gate.reason) {
      console.error(chalk.red(`Exit 1: ${result.gate.reason}`));
    }
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

    reportAuditError(error, url, isMachineMode, isJsonMode);
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onInterrupt);
  }
}
