import chalk from 'chalk';
import { Crawler } from '../crawler/index.js';
import type { CrawledPage, CrawlerOptions, CrawlReport } from '../crawler/crawler.js';
import { assertRunnableConfig } from './run-config.js';
import { loadConfig } from '../config/index.js';
import type { SeomatorConfig } from '../config/schema.js';
import { policyForTarget, runWithNetPolicy } from '../net/policy.js';
import { pinEntryRedirects } from '../net/fetch.js';
import { setUserAgent } from '../crawler/user-agent.js';
import { saveCrawl, createCrawl, type StoredPage } from '../storage/index.js';
import { warnUnimplementedFlags } from './unimplemented-flags.js';
import { toUrlFilterOptions } from '../config/url-filter-options.js';

export interface CrawlOptions {
  maxPages?: number;
  refresh: boolean;
  resume: boolean;
  output?: string;
  verbose: boolean;
}

/**
 * Crawler options from the `[crawler]` config: every key a crawl honours.
 *
 * One mapping for the command, so a new politeness key cannot be read by
 * `audit` and silently dropped here.
 */
export function crawlerOptionsFor(config: SeomatorConfig, maxPages: number, now = Date.now()): CrawlerOptions {
  const { crawler } = config;
  return {
    maxPages,
    concurrency: crawler.concurrency,
    timeout: crawler.timeout_ms,
    respectRobots: crawler.respect_robots,
    urlFilter: toUrlFilterOptions(crawler),
    delayMs: crawler.delay_ms,
    perHostDelayMs: crawler.per_host_delay_ms,
    perHostConcurrency: crawler.per_host_concurrency,
    respectCrawlDelay: crawler.respect_crawl_delay,
    maxRetryAfterMs: crawler.max_retry_after_ms,
    ...(crawler.max_duration_s > 0 && { deadline: now + crawler.max_duration_s * 1000 }),
  };
}

/**
 * Crawl `url` under the same network policy as `seomator audit`: private
 * addresses are refused unless the target itself is local or intranet (then
 * it, and the hosts its start page redirects to, are pinned).
 */
export async function crawlSite(
  url: string,
  config: SeomatorConfig,
  maxPages: number,
  onProgress?: CrawlerOptions['onProgress']
): Promise<{ pages: CrawledPage[]; report: CrawlReport }> {
  const policy = await pinEntryRedirects(url, await policyForTarget(url, 'auto'), { timeoutMs: config.crawler.timeout_ms });
  const crawler = new Crawler({ ...crawlerOptionsFor(config, maxPages), ...(onProgress && { onProgress }) });
  const pages = await runWithNetPolicy(policy, () => crawler.crawl(url, maxPages, config.crawler.concurrency));
  return { pages, report: crawler.getReport() };
}

/** What a crawl could not do, one line each; empty for a crawl that finished */
export function crawlWarnings(report: CrawlReport, fetched: number): string[] {
  const warnings: string[] = [];
  const left = report.notFetched.length;
  const pages = (n: number) => `${n} page${n === 1 ? '' : 's'}`;
  if (report.stoppedByDeadline) {
    warnings.push(`The crawl reached its time limit (crawler.max_duration_s) after ${pages(fetched)}; ${pages(left)} still queued were not fetched.`);
  } else if (report.abandonedHosts.length > 0) {
    warnings.push(`Gave up on ${report.abandonedHosts.join(', ')} after repeated failures; ${pages(left)} still queued were not fetched.`);
  }
  if (report.rateLimitedPages.length > 0) {
    warnings.push(`${pages(report.rateLimitedPages.length)} stayed rate-limited after their retries.`);
  }
  return warnings;
}

export async function runCrawl(url: string, options: CrawlOptions): Promise<void> {
  warnUnimplementedFlags(options as unknown as Record<string, unknown>, 'crawl');

  // Load config, refusing one that does not mean what it says, as audit does
  const loaded = loadConfig(process.cwd());
  const { config } = loaded;
  try {
    for (const warning of assertRunnableConfig(config, loaded.configPath, { categories: [] })) {
      console.error(chalk.yellow(warning));
    }
  } catch (error) {
    console.error(chalk.red('Crawl failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(2);
  }

  setUserAgent(config.crawler.user_agent);

  const maxPages = options.maxPages ?? config.crawler.max_pages;
  const baseDir = options.output ?? process.cwd();

  // Create crawl record
  const crawl = createCrawl(url, config.project.name || 'default', config);

  console.log(chalk.blue('Starting crawl...'));
  console.log(`  URL: ${url}`);
  console.log(`  Max pages: ${maxPages}`);
  console.log();

  const startTime = Date.now();
  let errorCount = 0;

  const onProgress: CrawlerOptions['onProgress'] = (progress) => {
    if (options.verbose) {
      const truncatedUrl = progress.currentUrl.length > 50
        ? progress.currentUrl.slice(0, 50) + '...'
        : progress.currentUrl;
      process.stderr.write(`\r  Crawled: ${progress.crawled}/${progress.total} | Current: ${truncatedUrl}`);
    }
  };

  try {
    const { pages: crawledPages, report } = await crawlSite(url, config, maxPages, onProgress);

    if (options.verbose) {
      process.stderr.write('\n');
    }

    // Convert to stored pages
    for (const page of crawledPages) {
      if (page.error) {
        errorCount++;
        continue;
      }

      const storedPage: StoredPage = {
        url: page.url,
        status: page.context.statusCode,
        html: page.context.html,
        headers: page.context.headers,
        depth: 0, // TODO: Track depth in crawler
        loadTime: page.context.responseTime,
        cwv: page.context.cwv,
      };

      crawl.pages.push(storedPage);
    }

    // Update stats
    crawl.stats = {
      totalPages: crawl.pages.length,
      duration: Date.now() - startTime,
      errorCount,
    };

    // Save crawl
    const crawlId = saveCrawl(baseDir, crawl);

    console.log();
    console.log(chalk.green('Crawl complete!'));
    console.log(`  Pages crawled: ${crawl.pages.length}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Duration: ${(crawl.stats.duration / 1000).toFixed(1)}s`);
    console.log(`  Crawl ID: ${crawlId}`);
    for (const warning of crawlWarnings(report, crawl.pages.length)) console.error(chalk.yellow(`  ${warning}`));
    console.log();
    console.log('Run analysis with:');
    console.log(`  seomator analyze ${crawlId}`);
    console.log();
  } catch (error) {
    console.error(chalk.red('Crawl failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(2);
  }
}
