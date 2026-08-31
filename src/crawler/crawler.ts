import * as cheerio from 'cheerio';
import { fetchPage, createAuditContext, type FetchResult } from './fetcher.js';
import type { AuditContext, CoreWebVitals, RenderDiagnostics, SiteContext } from '../types.js';
import { UrlFilter, type UrlFilterOptions } from './url-filter.js';

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
 * What a browser render contributes beyond the HTTP response.
 */
export interface PageRenderResult {
  /** Core Web Vitals measured during the render */
  cwv: CoreWebVitals;
  /** Errors and failed requests observed during the render */
  diagnostics?: RenderDiagnostics;
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
  /**
   * Renders a URL in a browser, returning what only a real render can observe.
   * Optional: when absent, pages are audited from their HTTP response alone.
   */
  renderPage?: (url: string) => Promise<PageRenderResult>;
  /** URL filter options for include/exclude patterns and query param handling */
  urlFilter?: Partial<UrlFilterOptions>;
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
  /** Click distance from the entry URL, set when a URL is first discovered */
  private depthByUrl: Map<string, number> = new Map();
  /** Normalised entry URL, the root of the depth measurement */
  private entryUrl = '';
  private hostname: string = '';
  private options: CrawlerOptions;
  private results: CrawledPage[] = [];
  private activeCount = 0;
  private urlFilter: UrlFilter;

  constructor(options: Partial<CrawlerOptions> = {}) {
    this.options = {
      maxPages: options.maxPages ?? 10,
      concurrency: options.concurrency ?? 3,
      timeout: options.timeout ?? 30000,
      onProgress: options.onProgress,
      renderPage: options.renderPage,
      urlFilter: options.urlFilter,
    };

    // Initialize URL filter with provided options
    this.urlFilter = new UrlFilter(options.urlFilter);
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
    this.depthByUrl.clear();
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
    this.entryUrl = normalizedStart;
    this.depthByUrl.set(normalizedStart, 0);
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

      // Render in a browser if a renderer was provided
      let cwv: CoreWebVitals = {};
      let diagnostics: RenderDiagnostics | undefined;
      if (this.options.renderPage) {
        try {
          const rendered = await this.options.renderPage(url);
          cwv = rendered.cwv;
          diagnostics = rendered.diagnostics;
        } catch {
          // Rendering failed, continue with the HTTP response alone
        }
      }

      // Create audit context
      const context = createAuditContext(url, fetchResult, cwv);
      if (diagnostics) {
        context.renderDiagnostics = diagnostics;
      }

      // Add to results
      this.results.push({ url, context });

      // Discover new URLs from links
      this.discoverUrls(context);
    } finally {
      this.activeCount--;
    }
  }

  /**
   * Build the site-wide link graph from the pages just crawled.
   *
   * Call after `crawl()`. Unlike discovery, this includes nofollow links and
   * links the URL filter excluded from crawling: a page that is linked is not
   * orphaned regardless of whether we chose to follow the link. Self-links are
   * ignored so a page cannot be its own inbound reference.
   *
   * @returns The graph, shared by reference across every page's context
   */
  buildSiteContext(): SiteContext {
    const inboundLinksByUrl = new Map<string, Set<string>>();
    const outboundLinksByUrl = new Map<string, Set<string>>();
    let pageCount = 0;

    for (const page of this.results) {
      if (page.error) continue;
      pageCount++;

      const from = this.normalizeUrl(page.url);
      const targets = new Set<string>();

      for (const link of page.context.links) {
        if (!link.isInternal) continue;

        const to = this.normalizeUrl(link.href);
        if (to === from) continue;
        if (!this.isSameDomain(to)) continue;

        targets.add(to);
        let inbound = inboundLinksByUrl.get(to);
        if (!inbound) {
          inbound = new Set<string>();
          inboundLinksByUrl.set(to, inbound);
        }
        inbound.add(from);
      }

      outboundLinksByUrl.set(from, targets);
    }

    return {
      entryUrl: this.entryUrl,
      pageCount,
      depthByUrl: this.depthByUrl,
      inboundLinksByUrl,
      outboundLinksByUrl,
      normalize: (url: string) => this.normalizeUrl(url),
    };
  }

  /**
   * Discover and queue new URLs from page links
   */
  private discoverUrls(context: AuditContext): void {
    const parentDepth = this.depthByUrl.get(this.normalizeUrl(context.url)) ?? 0;

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

      // Apply include/exclude patterns from URL filter
      if (!this.urlFilter.shouldCrawl(normalizedUrl)) {
        continue;
      }

      // Add to queue. Depth is recorded on first discovery only: the queue is
      // FIFO and a URL is queued at most once, so this is its shortest path
      // from the entry point.
      this.visited.add(normalizedUrl);
      this.depthByUrl.set(normalizedUrl, parentDepth + 1);
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
   * Normalize URL using the URL filter (removes tracking params, fragments, etc.)
   */
  private normalizeUrl(url: string): string {
    return this.urlFilter.normalizeUrl(url);
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
      invalidLinks: [],
      specialLinks: [],
      figures: [],
      inlineSvgs: [],
      pictureElements: [],
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
