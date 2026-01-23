import * as cheerio from 'cheerio';
import { fetchPage, createAuditContext, type FetchResult } from './fetcher.js';
import type { AuditContext, CoreWebVitals } from '../types.js';

/**
 * Progress callback for reporting crawl status
 */
export type CrawlProgressCallback = (progress: CrawlProgress) => void;

/**
 * Progress information during crawl
 */
export interface CrawlProgress {
  /** Number of URLs crawled so far */
  crawled: number;
  /** Total URLs in queue (crawled + pending) */
  total: number;
  /** Currently processing URL */
  currentUrl: string;
  /** Number of URLs discovered */
  discovered: number;
}

/**
 * Options for the Crawler
 */
export interface CrawlerOptions {
  /** Maximum pages to crawl */
  maxPages: number;
  /** Number of concurrent requests */
  concurrency: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Progress callback */
  onProgress?: CrawlProgressCallback;
  /** Function to get Core Web Vitals for a URL (optional) */
  getCwv?: (url: string) => Promise<CoreWebVitals>;
}

/**
 * Result of crawling a single page
 */
export interface CrawledPage {
  /** The URL that was crawled */
  url: string;
  /** AuditContext for the page */
  context: AuditContext;
  /** Any error that occurred */
  error?: string;
}

/**
 * Queue-based crawler with concurrency control
 */
export class Crawler {
  private visited: Set<string> = new Set();
  private queue: string[] = [];
  private hostname: string = '';
  private options: CrawlerOptions;
  private results: CrawledPage[] = [];
  private activeCount = 0;

  constructor(options: Partial<CrawlerOptions> = {}) {
    this.options = {
      maxPages: options.maxPages ?? 10,
      concurrency: options.concurrency ?? 3,
      timeout: options.timeout ?? 30000,
      onProgress: options.onProgress,
      getCwv: options.getCwv,
    };
  }

  /**
   * Crawl starting from a URL
   * @param startUrl - URL to start crawling from
   * @param maxPages - Override max pages (optional)
   * @param concurrency - Override concurrency (optional)
   * @returns Array of CrawledPage results
   */
  async crawl(
    startUrl: string,
    maxPages?: number,
    concurrency?: number
  ): Promise<CrawledPage[]> {
    // Reset state
    this.visited.clear();
    this.queue = [];
    this.results = [];
    this.activeCount = 0;

    // Apply overrides
    if (maxPages !== undefined) {
      this.options.maxPages = maxPages;
    }
    if (concurrency !== undefined) {
      this.options.concurrency = concurrency;
    }

    // Extract hostname from start URL
    try {
      const url = new URL(startUrl);
      this.hostname = url.hostname;
    } catch {
      throw new Error(`Invalid start URL: ${startUrl}`);
    }

    // Normalize and add start URL to queue
    const normalizedStart = this.normalizeUrl(startUrl);
    this.visited.add(normalizedStart);
    this.queue.push(normalizedStart);

    // Process queue with concurrency control
    await this.processQueue();

    return this.results;
  }

  /**
   * Process the queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    const workers: Promise<void>[] = [];

    // Create worker promises
    for (let i = 0; i < this.options.concurrency; i++) {
      workers.push(this.worker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);
  }

  /**
   * Worker that processes URLs from the queue
   */
  private async worker(): Promise<void> {
    while (true) {
      // Check if we've hit the max pages limit
      if (this.results.length >= this.options.maxPages) {
        break;
      }

      // Get next URL from queue
      const url = this.getNextUrl();
      if (!url) {
        // No more URLs to process
        // Wait a bit in case other workers are adding URLs
        await this.sleep(100);

        // Check again
        const retryUrl = this.getNextUrl();
        if (!retryUrl) {
          break;
        }

        await this.processUrl(retryUrl);
      } else {
        await this.processUrl(url);
      }
    }
  }

  /**
   * Get next URL from queue (thread-safe)
   */
  private getNextUrl(): string | null {
    if (this.queue.length === 0) {
      return null;
    }

    // Check max pages
    if (this.results.length + this.activeCount >= this.options.maxPages) {
      return null;
    }

    const url = this.queue.shift()!;
    this.activeCount++;
    return url;
  }

  /**
   * Process a single URL
   */
  private async processUrl(url: string): Promise<void> {
    try {
      // Report progress
      this.reportProgress(url);

      // Fetch the page
      let fetchResult: FetchResult;
      try {
        fetchResult = await fetchPage(url, this.options.timeout);
      } catch (error) {
        this.results.push({
          url,
          context: this.createEmptyContext(url),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return;
      }

      // Get Core Web Vitals if callback provided
      let cwv: CoreWebVitals = {};
      if (this.options.getCwv) {
        try {
          cwv = await this.options.getCwv(url);
        } catch {
          // CWV measurement failed, continue without it
        }
      }

      // Create audit context
      const context = createAuditContext(url, fetchResult, cwv);

      // Add to results
      this.results.push({ url, context });

      // Discover new URLs from links
      this.discoverUrls(context);
    } finally {
      this.activeCount--;
    }
  }

  /**
   * Discover and queue new URLs from page links
   */
  private discoverUrls(context: AuditContext): void {
    for (const link of context.links) {
      // Only follow internal links
      if (!link.isInternal) {
        continue;
      }

      // Skip nofollow links
      if (link.isNoFollow) {
        continue;
      }

      const normalizedUrl = this.normalizeUrl(link.href);

      // Skip if already visited or in queue
      if (this.visited.has(normalizedUrl)) {
        continue;
      }

      // Verify same hostname (double-check)
      if (!this.isSameDomain(normalizedUrl)) {
        continue;
      }

      // Skip non-HTML resources
      if (this.isNonHtmlResource(normalizedUrl)) {
        continue;
      }

      // Add to queue
      this.visited.add(normalizedUrl);
      this.queue.push(normalizedUrl);
    }
  }

  /**
   * Check if URL is on the same domain
   */
  private isSameDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === this.hostname;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL points to a non-HTML resource
   */
  private isNonHtmlResource(url: string): boolean {
    const nonHtmlExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.tar', '.gz',
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
      '.mp3', '.mp4', '.avi', '.mov', '.wmv',
      '.css', '.js', '.json', '.xml',
    ];

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      return nonHtmlExtensions.some(ext => pathname.endsWith(ext));
    } catch {
      return false;
    }
  }

  /**
   * Normalize URL by removing fragments and trailing slashes
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Remove fragment
      urlObj.hash = '';

      // Get normalized href
      let normalized = urlObj.href;

      // Remove trailing slash (except for root)
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }

      return normalized;
    } catch {
      return url;
    }
  }

  /**
   * Report progress via callback
   */
  private reportProgress(currentUrl: string): void {
    if (this.options.onProgress) {
      this.options.onProgress({
        crawled: this.results.length,
        total: this.results.length + this.queue.length + this.activeCount,
        currentUrl,
        discovered: this.visited.size,
      });
    }
  }

  /**
   * Create an empty context for failed fetches
   */
  private createEmptyContext(url: string): AuditContext {
    return {
      url,
      html: '',
      $: cheerio.load(''),
      headers: {},
      statusCode: 0,
      responseTime: 0,
      cwv: {},
      links: [],
      images: [],
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a crawler instance with options
 */
export function createCrawler(options?: Partial<CrawlerOptions>): Crawler {
  return new Crawler(options);
}
