import * as cheerio from 'cheerio';
import { fetchPage as defaultFetchPage, createAuditContext, type FetchPageOptions, type FetchResult } from './fetcher.js';
import { rethrowIfAborted, throwIfAborted } from '../errors.js';
import type { AssetInfo, AuditContext, CoreWebVitals, DiscoverySource, InboundEdge, RenderDiagnostics, SiteContext, SitePageInfo } from '../types.js';
import { UrlFilter, type UrlFilterOptions } from './url-filter.js';
import { RobotsMatcher } from './robots.js';
import { getUserAgent } from './user-agent.js';

/**
 * Progress callback for reporting crawl status
 */
export type CrawlProgressCallback = (progress: CrawlProgress) => void;

/**
 * Progress information during crawl.
 *
 * `crawled` and `discovered` never decrease, so a progress bar built on them
 * cannot run backwards as workers finish out of order.
 */
export interface CrawlProgress {
  /** Number of URLs crawled so far */
  crawled: number;
  /** Crawled plus queued plus in-flight, capped at maxPages */
  total: number;
  /** Currently processing URL */
  currentUrl: string;
  /** Number of distinct URLs discovered so far */
  discovered: number;
  /** The crawl's page ceiling */
  maxPages: number;
  /** True on the final callback, after the queue has drained */
  done: boolean;
}

/**
 * What a browser render contributes beyond the HTTP response.
 */
export interface PageRenderResult {
  /** Core Web Vitals measured during the render */
  cwv: CoreWebVitals;
  /**
   * The DOM after scripts have run.
   *
   * The JS-rendering rules compare this against the HTTP response, so without
   * it every one of them reports "rendered DOM not available" — on a crawl that
   * did render the page. Optional because a custom renderer need not return it.
   */
  html?: string;
  /** Errors and failed requests observed during the render */
  diagnostics?: RenderDiagnostics;
  /** Per-subresource response data observed during the render */
  assets?: AssetInfo[];
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
  /** Progress callback, fired as pages start and once when the crawl ends */
  onProgress?: CrawlProgressCallback;
  /** Called with each URL as its fetch begins */
  onPageStart?: (url: string) => void;
  /** Cancels the crawl: in-flight fetches abort and no new ones start */
  signal?: AbortSignal;
  /**
   * Fetches one page. Defaults to the HTTP fetcher; injectable so tests can
   * observe in-flight requests without a network.
   */
  fetchPage?: (url: string, timeout: number, options?: FetchPageOptions) => Promise<FetchResult>;
  /**
   * Renders a URL in a browser, returning what only a real render can observe.
   * Optional: when absent, pages are audited from their HTTP response alone.
   */
  renderPage?: (url: string) => Promise<PageRenderResult>;
  /** URL filter options for include/exclude patterns and query param handling */
  urlFilter?: Partial<UrlFilterOptions>;
  /**
   * Whether to obey the site's robots.txt. Defaults to true, matching the
   * config default that previously had no effect.
   */
  respectRobots?: boolean;
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
 * Split a robots directive string (meta content or X-Robots-Tag value) into
 * lowercase tokens.
 *
 * A copy of the parser in `src/rules/core/robots-meta.ts`, kept local because
 * the layering runs rules → crawler, never the reverse.
 */
function parseRobotsDirectiveTokens(content: string): string[] {
  return content
    .toLowerCase()
    .split(/[,\s]+/)
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

/**
 * Queue-based crawler with concurrency control
 */
export class Crawler {
  private visited: Set<string> = new Set();
  private queue: string[] = [];
  /** Click distance from the entry URL, set when a URL is first discovered */
  private depthByUrl: Map<string, number> = new Map();
  /** How each normalised URL was discovered (link, canonical, redirect, entry) */
  private discoverySourceByUrl: Map<string, Set<DiscoverySource>> = new Map();
  /** Normalised entry URL, the root of the depth measurement */
  private entryUrl = '';
  private hostname: string = '';
  private options: CrawlerOptions;
  private results: CrawledPage[] = [];
  private activeCount = 0;
  private urlFilter: UrlFilter;
  /** Built once per crawl from the site's robots.txt; null when not applied. */
  private robots: RobotsMatcher | null = null;

  constructor(options: Partial<CrawlerOptions> = {}) {
    this.options = {
      maxPages: options.maxPages ?? 10,
      concurrency: options.concurrency ?? 3,
      timeout: options.timeout ?? 30000,
      onProgress: options.onProgress,
      onPageStart: options.onPageStart,
      signal: options.signal,
      fetchPage: options.fetchPage ?? defaultFetchPage,
      renderPage: options.renderPage,
      urlFilter: options.urlFilter,
      respectRobots: options.respectRobots ?? true,
    };

    // Initialize URL filter with provided options
    this.urlFilter = new UrlFilter(options.urlFilter);
  }

  /**
   * Fetch and parse the site's robots.txt once per crawl.
   *
   * A site with no robots.txt, or one that cannot be reached, permits
   * everything — the same posture every other crawler takes.
   */
  private async loadRobots(startUrl: string): Promise<void> {
    this.robots = null;
    if (!this.options.respectRobots) return;

    const signal = this.options.signal;
    try {
      const robotsUrl = new URL('/robots.txt', startUrl).href;
      const timeout = AbortSignal.timeout(this.options.timeout);
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': getUserAgent() },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) return;
      this.robots = new RobotsMatcher(await response.text(), getUserAgent());
    } catch (error) {
      // Unreachable robots.txt is not a reason to refuse to crawl — but a
      // cancelled one is a cancelled crawl.
      rethrowIfAborted(error, signal);
    }
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
    this.discoverySourceByUrl.clear();
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

    throwIfAborted(this.options.signal);
    await this.loadRobots(startUrl);

    // Normalize and add start URL to queue
    const normalizedStart = this.normalizeUrl(startUrl);
    this.entryUrl = normalizedStart;
    this.depthByUrl.set(normalizedStart, 0);
    this.visited.add(normalizedStart);
    this.queue.push(normalizedStart);
    this.recordDiscoverySource(normalizedStart, 'entry');

    // Process queue with concurrency control
    await this.processQueue();

    this.reportProgress('', true);
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
      throwIfAborted(this.options.signal);

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
      this.options.onPageStart?.(url);

      // Fetch the page
      let fetchResult: FetchResult;
      try {
        fetchResult = await this.options.fetchPage!(url, this.options.timeout, {
          trackRedirects: true,
          ...(this.options.signal && { signal: this.options.signal }),
        });
      } catch (error) {
        // A page that failed to load is a finding; a cancelled run is not.
        rethrowIfAborted(error, this.options.signal);
        this.results.push({
          url,
          context: this.createEmptyContext(url),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return;
      }

      // Render in a browser if a renderer was provided
      let cwv: CoreWebVitals = {};
      let renderedHtml: string | undefined;
      let diagnostics: RenderDiagnostics | undefined;
      let assets: AssetInfo[] | undefined;
      if (this.options.renderPage) {
        try {
          const rendered = await this.options.renderPage(url);
          cwv = rendered.cwv;
          renderedHtml = rendered.html;
          diagnostics = rendered.diagnostics;
          assets = rendered.assets;
        } catch (error) {
          rethrowIfAborted(error, this.options.signal);
          // Rendering failed, continue with the HTTP response alone
        }
      }

      // Create audit context
      const context = createAuditContext(url, fetchResult, cwv);
      if (this.options.signal) {
        context.signal = this.options.signal;
      }
      if (renderedHtml) {
        context.renderedHtml = renderedHtml;
        context.rendered$ = cheerio.load(renderedHtml);
      }
      if (diagnostics) {
        context.renderDiagnostics = diagnostics;
      }
      if (assets) {
        context.assets = assets;
      }

      // Add to results
      this.results.push({ url, context });

      // Discover new URLs from links
      this.discoverUrls(context);

      // Record canonical/redirect discovery (canonical targets also get queued)
      this.discoverFromPageSignals(context);
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
    const inboundEdgesByUrl = new Map<string, InboundEdge[]>();
    const pages = new Map<string, SitePageInfo>();
    let pageCount = 0;

    for (const page of this.results) {
      const from = this.normalizeUrl(page.url);
      // Recorded for every result, including failed fetches (statusCode 0):
      // sitemap cross-reference rules need to see those too. Cheap primitives
      // only — no HTML is retained.
      pages.set(from, this.buildPageInfo(page));

      if (page.error) continue;
      pageCount++;

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

        let edges = inboundEdgesByUrl.get(to);
        if (!edges) {
          edges = [];
          inboundEdgesByUrl.set(to, edges);
        }
        edges.push({ from, nofollow: link.isNoFollow, anchor: link.text.trim() });
      }

      outboundLinksByUrl.set(from, targets);
    }

    return {
      entryUrl: this.entryUrl,
      pageCount,
      depthByUrl: this.depthByUrl,
      inboundLinksByUrl,
      outboundLinksByUrl,
      pages,
      discoverySourceByUrl: this.discoverySourceByUrl,
      inboundEdgesByUrl,
      normalize: (url: string) => this.normalizeUrl(url),
    };
  }

  /**
   * Distil one crawled page into its SitePageInfo record.
   *
   * Parses only what is already in memory (`context.$`, headers) — no new
   * fetches. Errored pages carry an empty context, so parsing them yields the
   * defaults with `statusCode: 0`.
   */
  private buildPageInfo(page: CrawledPage): SitePageInfo {
    const { $, headers, statusCode } = page.context;

    const info: SitePageInfo = {
      statusCode,
      noindex: false,
      nofollow: false,
      // Best-effort: the matcher exists only when respectRobots is on and
      // robots.txt was reachable, so "unknown" is reported as false.
      disallowed: this.robots ? !this.robots.isAllowed(page.url) : false,
      hreflangOut: {},
    };

    const canonicalHref = $('link[rel="canonical"]').first().attr('href');
    if (canonicalHref !== undefined) {
      try {
        info.canonical = new URL(canonicalHref, page.url).href;
      } catch {
        info.canonical = null;
      }
    }

    const directives: string[] = [];
    $('meta[name="robots"]').each((_, el) => {
      directives.push(...parseRobotsDirectiveTokens($(el).attr('content') ?? ''));
    });
    const xRobotsTag = headers['x-robots-tag'];
    if (xRobotsTag) {
      directives.push(...parseRobotsDirectiveTokens(xRobotsTag));
    }
    info.noindex = directives.includes('noindex') || directives.includes('none');
    info.nofollow = directives.includes('nofollow') || directives.includes('none');

    $('link[rel="alternate"][hreflang]').each((_, el) => {
      const code = $(el).attr('hreflang')?.trim();
      const href = $(el).attr('href');
      if (!code || !href) return;
      try {
        info.hreflangOut[code] = new URL(href, page.url).href;
      } catch {
        // An unresolvable hreflang target is a per-page finding, not recorded here.
      }
    });

    const h1 = $('h1').first().text().trim();
    if (h1) info.h1 = h1;

    return info;
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

      const normalizedUrl = this.normalizeUrl(link.href);

      // Verify same hostname (double-check)
      if (!this.isSameDomain(normalizedUrl)) {
        continue;
      }

      // Skip non-HTML resources
      if (this.isNonHtmlResource(normalizedUrl)) {
        continue;
      }

      // Found via an anchor — this counts even for nofollow links and URLs the
      // filters below exclude from crawling: discovered is not the same as
      // followed. Isolated-URL rules key on the absence of this source.
      this.recordDiscoverySource(normalizedUrl, 'link');

      // Skip nofollow links
      if (link.isNoFollow) {
        continue;
      }

      // Skip if already visited or in queue
      if (this.visited.has(normalizedUrl)) {
        continue;
      }

      // Apply include/exclude patterns from URL filter
      if (!this.urlFilter.shouldCrawl(normalizedUrl)) {
        continue;
      }

      // Respect the site's robots.txt, which until now was ignored entirely.
      if (this.robots && !this.robots.isAllowed(normalizedUrl)) {
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
   * Record discovery sources declared by the page itself: its canonical tag
   * and, when the fetch tracked them, its redirect hops.
   *
   * Internal canonical targets are also queued for crawling — a deliberate,
   * conservative crawl-scope expansion: a canonical is a strong
   * page-equivalence signal, and without it the "URL reachable only via
   * canonical" hints could never fire. Guardrails: http(s) only, same domain,
   * URL filter and robots.txt applied, and the queue is still capped by
   * maxPages (workers stop dequeuing once the cap is hit). Redirect targets
   * are recorded but NOT queued: the fetch already followed the redirect, so
   * re-fetching the target would duplicate work.
   */
  private discoverFromPageSignals(context: AuditContext): void {
    const canonicalHref = context.$('link[rel="canonical"]').first().attr('href');
    if (canonicalHref !== undefined) {
      try {
        const canonicalUrl = new URL(canonicalHref, context.url).href;
        if (this.isHttpSameDomain(canonicalUrl) && !this.isNonHtmlResource(canonicalUrl)) {
          const normalizedCanonical = this.normalizeUrl(canonicalUrl);
          this.recordDiscoverySource(normalizedCanonical, 'canonical');

          if (
            !this.visited.has(normalizedCanonical) &&
            this.urlFilter.shouldCrawl(normalizedCanonical) &&
            (!this.robots || this.robots.isAllowed(normalizedCanonical))
          ) {
            this.visited.add(normalizedCanonical);
            // A canonical declares page equivalence, so the target sits at the
            // same click distance as the page that points at it.
            this.depthByUrl.set(
              normalizedCanonical,
              this.depthByUrl.get(this.normalizeUrl(context.url)) ?? 0
            );
            this.queue.push(normalizedCanonical);
          }
        }
      } catch {
        // An unresolvable canonical is a per-page finding, not recorded here.
      }
    }

    // Now that the fetch records the chain, every URL a redirect pointed AT was
    // discovered by that redirect. The first entry is the URL originally
    // requested — it was reached some other way (entry, link, sitemap), so
    // skipping it keeps a page fetched without any redirect from claiming to
    // have discovered itself.
    if (context.redirectChain) {
      for (const hop of context.redirectChain.slice(1)) {
        if (!this.isHttpSameDomain(hop.url)) continue;
        this.recordDiscoverySource(this.normalizeUrl(hop.url), 'redirect');
      }
    }
  }

  /**
   * Check if a URL is http(s) and on the crawled domain
   */
  private isHttpSameDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
        urlObj.hostname === this.hostname
      );
    } catch {
      return false;
    }
  }

  /**
   * Record one discovery source for a normalised URL; sources accumulate.
   */
  private recordDiscoverySource(normalizedUrl: string, source: DiscoverySource): void {
    let sources = this.discoverySourceByUrl.get(normalizedUrl);
    if (!sources) {
      sources = new Set<DiscoverySource>();
      this.discoverySourceByUrl.set(normalizedUrl, sources);
    }
    sources.add(source);
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
  private reportProgress(currentUrl: string, done = false): void {
    if (!this.options.onProgress) return;

    const crawled = this.results.length;
    // Never advertise more pages than the crawl will actually audit, and never
    // let the target shrink below what has already been done.
    const total = Math.max(
      crawled,
      Math.min(crawled + this.queue.length + this.activeCount, this.options.maxPages)
    );

    this.options.onProgress({
      crawled,
      total,
      currentUrl,
      discovered: this.visited.size,
      maxPages: this.options.maxPages,
      done,
    });
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
