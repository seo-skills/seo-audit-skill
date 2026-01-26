import chalk from 'chalk';
import { Crawler } from '../crawler/index.js';
import { loadConfig } from '../config/index.js';
import { saveCrawl, createCrawl, type StoredPage } from '../storage/index.js';

export interface CrawlOptions {
  maxPages?: number;
  refresh: boolean;
  resume: boolean;
  output?: string;
  verbose: boolean;
}

export async function runCrawl(url: string, options: CrawlOptions): Promise<void> {
  // Load config
  const { config } = loadConfig(process.cwd());

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

  // Create crawler
  const crawler = new Crawler({
    maxPages,
    concurrency: config.crawler.concurrency,
    timeout: config.crawler.timeout_ms,
    onProgress: (progress) => {
      if (options.verbose) {
        const truncatedUrl = progress.currentUrl.length > 50
          ? progress.currentUrl.slice(0, 50) + '...'
          : progress.currentUrl;
        process.stderr.write(`\r  Crawled: ${progress.crawled}/${progress.total} | Current: ${truncatedUrl}`);
      }
    },
  });

  try {
    const crawledPages = await crawler.crawl(url, maxPages, config.crawler.concurrency);

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
    console.log();
    console.log('Run analysis with:');
    console.log(`  seomator analyze ${crawlId}`);
    console.log();
  } catch (error) {
    console.error(chalk.red('Crawl failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(2);
  }
}
