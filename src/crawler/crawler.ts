import * as cheerio from 'cheerio';
import { fetchPage as defaultFetchPage, createAuditContext, type FetchPageOptions, type FetchResult } from './fetcher.js';
import { AuditError, rethrowIfAborted, throwIfAborted } from '../errors.js';
import type { AssetInfo, AuditContext, CoreWebVitals, DiscoverySource, InboundEdge, RenderDiagnostics, SiteContext, SitePageInfo } from '../types.js';
import { summarizeSchemaNodes } from '../rules/schema/utils.js';
import { pageKindFrom } from '../rules/content/page-kind.js';
import { countWords, extractMainContent } from '../rules/content/utils/text-extractor.js';
import { UrlFilter, type UrlFilterOptions } from './url-filter.js';
import { RobotsMatcher } from './robots.js';
import { getUserAgent } from './user-agent.js';
import { DOCUMENT_TITLE } from '../rules/document-title.js';
import { netFetch, readTextCapped, MAX_PAGE_BYTES } from '../net/fetch.js';
import { createHash } from 'node:crypto';
import { isNoindex, isNofollow, isPaginatedPage, readCanonical } from '../indexability.js';
import { shingleText } from '../site/near-duplicates.js';
import { bodyText as visibleBodyText } from '../rules/content/utils/visible-text.js';
import type { CodeCoverage } from '../render/coverage.js';

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
  /** Render probe results by id */
  probes?: Record<string, unknown>;
  /** How much of each script and stylesheet the load used */
  coverage?: CodeCoverage;
}

/**
 * Put a render's results on a page's context: the rendered DOM, diagnostics,
 * assets and probes. The one place both the single-page and crawl paths do
 * it, so a field the renderer returns cannot be dropped by one of them.
 */
export function applyRender(context: AuditContext, render: PageRenderResult): void {
  if (render.html) {
    context.renderedHtml = render.html;
    context.rendered$ = cheerio.load(render.html);
  }
  if (render.diagnostics) context.renderDiagnostics = render.diagnostics;
  if (render.assets) context.assets = render.assets;
  if (render.probes) context.probes = render.probes;
  if (render.coverage) context.coverage = render.coverage;
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
  /**
   * Minimum gap between the start of any two requests, in milliseconds.
   * `crawler.delay_ms`, which was schema'd, defaulted, range-validated and
   * never read: a config asking for a 2s gap crawled at full speed.
   *
   * Defaults to 0 here rather than to the config's 100, so a Crawler built
   * directly (tests, embedders) is not silently slowed down. The CLI passes
   * the configured value.
   */
  delayMs?: number;
  /** Same, but per host. `crawler.per_host_delay_ms`, equally unread. */
  perHostDelayMs?: number;
  /**
   * Most requests in flight to one host at once (`crawler.per_host_concurrency`).
   * Unlimited when unset, so a directly-built Crawler keeps its behaviour.
   */
  perHostConcurrency?: number;
  /**
   * Honour the robots.txt `Crawl-delay` of the group that governs this
   * crawler, capped at {@link MAX_CRAWL_DELAY_MS}. Defaults to true; has no
   * effect when robots.txt is not respected.
   */
  respectCrawlDelay?: boolean;
  /** Longest `Retry-After` honoured, in milliseconds (`crawler.max_retry_after_ms`) */
  maxRetryAfterMs?: number;
  /** First backoff when a 429 or 503 carries no `Retry-After` (doubles after) */
  backoffBaseMs?: number;
  /**
   * Stop starting new requests at this time (epoch ms) and return what was
   * fetched. The crawl ends "with gaps"; it is not cancelled.
   */
  deadline?: number;
  /** Told when the crawl waits on a host: a rate limit or a Crawl-delay */
  onWaiting?: (waiting: CrawlWaiting) => void;
  /** Told once, before the first page, when a Crawl-delay applies */
  onCrawlDelay?: (delay: CrawlDelayNotice) => void;
}

/** The crawl is waiting on a host */
export interface CrawlWaiting {
  host: string;
  /** How long the wait is, in milliseconds */
  waitMs: number;
  reason: 'rate-limited';
  /** The status that caused it */
  status: number;
}

/** A robots.txt Crawl-delay the crawl will honour, and what it costs */
export interface CrawlDelayNotice {
  host: string;
  /** The delay applied, after the cap, in milliseconds */
  delayMs: number;
  /** The delay the site asked for, in milliseconds */
  requestedMs: number;
  capped: boolean;
  /** How long the crawl may take at this delay, in milliseconds */
  projectedMs: number;
}

/** Retries per URL on 429 and 503 before it is recorded as rate-limited */
export const MAX_RATE_LIMIT_RETRIES = 3;
/** Most a robots.txt Crawl-delay is honoured for */
export const MAX_CRAWL_DELAY_MS = 10_000;
/** Most a host's delay grows to while it keeps rate-limiting */
const MAX_ADAPTIVE_DELAY_MS = 60_000;
/** Consecutive failed pages (rate-limited or 5xx) before a host is given up */
export const HOST_FAILURE_LIMIT = 10;

/** What a crawl could not do, for the run summary and the coverage line */
export interface CrawlReport {
  /** Pages still rate-limited after their retries */
  rateLimitedPages: string[];
  /** Per host: pages it rate-limited, and the last Retry-After it sent (seconds) */
  rateLimitedHosts: Array<{ host: string; pages: number; lastRetryAfterS: number | null }>;
  /** Queued pages never requested: their host was given up, or the time limit hit */
  notFetched: string[];
  /** Hosts given up after repeated failures */
  abandonedHosts: string[];
  /** The Crawl-delay honoured, when one applied */
  crawlDelay: CrawlDelayNotice | null;
  /** The crawl stopped at its time limit */
  stoppedByDeadline: boolean;
}

/** Per-host scheduling state */
interface HostState {
  /** No request to this host starts before this time */
  pausedUntil: number;
  /** Backoffs in a row with no success between them */
  consecutiveBackoffs: number;
  /** Extra delay added after repeated backoffs */
  extraDelayMs: number;
  /** Pages in a row that ended rate-limited or 5xx */
  consecutiveFailures: number;
  /** Given up: no further requests */
  abandoned: boolean;
  inFlight: number;
  rateLimitedPages: number;
  lastRetryAfterS: number | null;
}

/**
 * Milliseconds a `Retry-After` header asks for: seconds, or an HTTP date.
 *
 * @returns null when the header is absent or unreadable
 */
/**
 * Why a run stopped on a page that stayed rate-limited. A 429 is the site
 * asking for fewer requests; a 503 is the site saying it cannot answer now,
 * so it gets its own wording.
 */
export function rateLimitedMessage(host: string, status: number, lastRetryAfterS: number | null): string {
  const requests = MAX_RATE_LIMIT_RETRIES + 1;
  const wait = lastRetryAfterS !== null ? `; it last asked to wait ${lastRetryAfterS} s` : '';
  const what =
    status === 503
      ? `${host} answered 503 Service Unavailable to all ${requests} requests${wait}. The site may be down or shedding load.`
      : `${host} is limiting how fast SEOmator can request pages (HTTP ${status} to all ${requests} requests${wait}).`;
  return `${what} Nothing was saved.`;
}

export function parseRetryAfter(value: string | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
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
  /** The site was still rate-limiting this page after its retries */
  rateLimited?: boolean;
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
  /** Earliest time any next request may start (politeness scheduling) */
  private nextGlobalSlot = 0;
  /** Earliest time the next request to each host may start */
  private nextHostSlot = new Map<string, number>();
  private activeCount = 0;
  /** Idle workers waiting for a running page to finish */
  private progressWaiters: Array<() => void> = [];
  private urlFilter: UrlFilter;
  /** Built once per crawl from the site's robots.txt; null when not applied. */
  private robots: RobotsMatcher | null = null;
  private hosts = new Map<string, HostState>();
  /** Requests made per URL, for the rate-limit retry budget */
  private attempts = new Map<string, number>();
  /** The Crawl-delay applied to the entry host, in milliseconds */
  private crawlDelayMs = 0;
  private report: CrawlReport = Crawler.emptyReport();

  private static emptyReport(): CrawlReport {
    return {
      rateLimitedPages: [],
      rateLimitedHosts: [],
      notFetched: [],
      abandonedHosts: [],
      crawlDelay: null,
      stoppedByDeadline: false,
    };
  }

  /** What the last crawl could not do */
  getReport(): CrawlReport {
    return this.report;
  }

  private hostOf(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return '';
    }
  }

  private hostState(host: string): HostState {
    let state = this.hosts.get(host);
    if (!state) {
      state = {
        pausedUntil: 0,
        consecutiveBackoffs: 0,
        extraDelayMs: 0,
        consecutiveFailures: 0,
        abandoned: false,
        inFlight: 0,
        rateLimitedPages: 0,
        lastRetryAfterS: null,
      };
      this.hosts.set(host, state);
    }
    return state;
  }

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
      // 0, not the config's 100/200: only the CLI passes the configured value,
      // so a directly-built Crawler keeps its old speed.
      delayMs: options.delayMs ?? 0,
      perHostDelayMs: options.perHostDelayMs ?? 0,
      perHostConcurrency: options.perHostConcurrency,
      respectCrawlDelay: options.respectCrawlDelay ?? true,
      maxRetryAfterMs: options.maxRetryAfterMs ?? 120_000,
      backoffBaseMs: options.backoffBaseMs ?? 5_000,
      deadline: options.deadline,
      onWaiting: options.onWaiting,
      onCrawlDelay: options.onCrawlDelay,
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
      const response = await netFetch(robotsUrl, {
        headers: { 'User-Agent': getUserAgent() },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) return;
      this.robots = new RobotsMatcher(await readTextCapped(response, MAX_PAGE_BYTES), getUserAgent());
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
    this.progressWaiters = [];
    this.hosts.clear();
    this.attempts.clear();
    this.crawlDelayMs = 0;
    this.report = Crawler.emptyReport();

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
    this.applyCrawlDelay(startUrl);

    // Normalize and add start URL to queue
    const normalizedStart = this.normalizeUrl(startUrl);
    this.entryUrl = normalizedStart;
    this.depthByUrl.set(normalizedStart, 0);
    this.visited.add(normalizedStart);
    this.queue.push(normalizedStart);
    this.recordDiscoverySource(normalizedStart, 'entry');

    // Process queue with concurrency control
    await this.processQueue();

    this.finishReport();
    this.reportProgress('', true);
    return this.results;
  }

  /**
   * Honour the site's Crawl-delay, capped, and say what it will cost.
   *
   * Applied to the entry host only: the crawl stays on that host, and the
   * delay is the site's request about its own server.
   */
  private applyCrawlDelay(startUrl: string): void {
    const seconds = this.robots?.crawlDelaySeconds;
    if (!this.options.respectCrawlDelay || seconds === undefined || seconds <= 0) return;
    const requestedMs = Math.round(seconds * 1000);
    const delayMs = Math.min(requestedMs, MAX_CRAWL_DELAY_MS);
    this.crawlDelayMs = delayMs;
    const spacing = Math.max(delayMs, this.options.perHostDelayMs ?? 0);
    const notice: CrawlDelayNotice = {
      host: this.hostOf(startUrl),
      delayMs,
      requestedMs,
      capped: requestedMs > delayMs,
      projectedMs: spacing * Math.max(0, this.options.maxPages - 1),
    };
    this.report.crawlDelay = notice;
    this.options.onCrawlDelay?.(notice);
  }

  /** Close the report: what was queued and never requested, per-host counts */
  private finishReport(): void {
    for (const url of this.queue) this.report.notFetched.push(url);
    this.queue = [];
    for (const [host, state] of this.hosts) {
      if (state.rateLimitedPages > 0) {
        this.report.rateLimitedHosts.push({ host, pages: state.rateLimitedPages, lastRetryAfterS: state.lastRetryAfterS });
      }
      if (state.abandoned) this.report.abandonedHosts.push(host);
    }
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
   *
   * An empty queue only means the crawl is over when no request is still in
   * flight: a page being fetched can add links. So an idle worker waits for
   * a running page to finish and looks again, rather than leaving. Leaving
   * after a fixed pause made every crawl whose start page took longer than
   * that pause run one request at a time, whatever `concurrency` said.
   */
  private async worker(): Promise<void> {
    while (true) {
      throwIfAborted(this.options.signal);

      // Check if we've hit the max pages limit
      if (this.results.length >= this.options.maxPages) {
        break;
      }

      // Out of time: stop starting requests; what was fetched is kept
      if (this.options.deadline !== undefined && Date.now() >= this.options.deadline) {
        this.report.stoppedByDeadline = true;
        break;
      }

      const url = this.getNextUrl();
      if (url) {
        await this.waitForTurn(url);
        await this.processUrl(url);
        continue;
      }

      if (this.activeCount === 0) break;
      await this.waitForProgress();
    }
  }

  /** Resolve when a page finishes (and may have queued links) or the run is cancelled */
  private waitForProgress(): Promise<void> {
    return new Promise((resolve) => {
      const signal = this.options.signal;
      const onAbort = () => resolve();
      this.progressWaiters.push(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      });
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** Wake every idle worker */
  private notifyProgress(): void {
    const waiters = this.progressWaiters;
    this.progressWaiters = [];
    for (const wake of waiters) wake();
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

    // The first queued URL whose host is not given up and has room under the
    // per-host limit. URLs of a given-up host are set aside as not fetched.
    const limit = this.options.perHostConcurrency ?? Infinity;
    for (let index = 0; index < this.queue.length; index++) {
      const candidate = this.queue[index];
      const state = this.hostState(this.hostOf(candidate));
      if (state.abandoned) {
        this.queue.splice(index, 1);
        this.report.notFetched.push(candidate);
        index--;
        continue;
      }
      if (state.inFlight >= limit) continue;
      this.queue.splice(index, 1);
      state.inFlight++;
      this.activeCount++;
      return candidate;
    }
    return null;
  }

  /**
   * Back off a host that answered 429 or 503.
   *
   * Waits for its `Retry-After` (capped), or 5 s doubling to 60 s with 20%
   * jitter when it sent none. Every second backoff in a row also doubles
   * the host's delay for the rest of the run, so a crawl that keeps tripping
   * a rate limit slows down instead of hammering it.
   */
  private backOff(host: string, status: number, retryAfter: string | undefined, attempt: number): number {
    const state = this.hostState(host);
    const requested = parseRetryAfter(retryAfter);
    if (requested !== null) state.lastRetryAfterS = Math.round(requested / 1000);
    const base = this.options.backoffBaseMs ?? 5_000;
    const fallback = Math.min(base * 2 ** (attempt - 1), MAX_ADAPTIVE_DELAY_MS) * (0.8 + Math.random() * 0.4);
    const waitMs = Math.round(requested !== null ? Math.min(requested, this.options.maxRetryAfterMs ?? 120_000) : fallback);

    state.pausedUntil = Math.max(state.pausedUntil, Date.now() + waitMs);
    state.consecutiveBackoffs++;
    if (state.consecutiveBackoffs % 2 === 0) {
      state.extraDelayMs = Math.min(MAX_ADAPTIVE_DELAY_MS, Math.max(base, state.extraDelayMs * 2));
    }
    this.options.onWaiting?.({ host, waitMs, reason: 'rate-limited', status });
    return waitMs;
  }

  /** Count a page that ended badly against its host, and give the host up past the limit */
  private noteFailure(host: string): void {
    const state = this.hostState(host);
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= HOST_FAILURE_LIMIT) state.abandoned = true;
  }

  private noteSuccess(host: string): void {
    const state = this.hostState(host);
    state.consecutiveFailures = 0;
    state.consecutiveBackoffs = 0;
  }

  /**
   * Process a single URL
   */
  private async processUrl(url: string): Promise<void> {
    const host = this.hostOf(url);
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
        this.noteFailure(host);
        return;
      }

      // A rate limit is the site asking us to slow down, not a client
      // error: wait and try again, and if it persists record the page as
      // rate-limited rather than score a 4xx we caused.
      if (fetchResult.statusCode === 429 || fetchResult.statusCode === 503) {
        const attempt = (this.attempts.get(url) ?? 0) + 1;
        this.attempts.set(url, attempt);
        if (attempt <= MAX_RATE_LIMIT_RETRIES) {
          this.backOff(host, fetchResult.statusCode, fetchResult.headers['retry-after'], attempt);
          this.queue.unshift(url);
          return;
        }
        const state = this.hostState(host);
        state.rateLimitedPages++;
        this.report.rateLimitedPages.push(url);
        this.results.push({
          url,
          context: createAuditContext(url, fetchResult, {}),
          error: `rate-limited (HTTP ${fetchResult.statusCode}) after ${MAX_RATE_LIMIT_RETRIES} retries`,
          rateLimited: true,
        });
        this.noteFailure(host);
        if (url === this.entryUrl) {
          throw new AuditError('rate-limited', rateLimitedMessage(host, fetchResult.statusCode, state.lastRetryAfterS));
        }
        return;
      }

      if (fetchResult.statusCode >= 500) this.noteFailure(host);
      else this.noteSuccess(host);

      // Render in a browser if a renderer was provided
      let render: PageRenderResult | undefined;
      if (this.options.renderPage) {
        try {
          render = await this.options.renderPage(url);
        } catch (error) {
          rethrowIfAborted(error, this.options.signal);
          // Rendering failed, continue with the HTTP response alone
        }
      }

      // Create audit context
      const context = createAuditContext(url, fetchResult, render?.cwv ?? {});
      if (this.options.signal) {
        context.signal = this.options.signal;
      }
      if (render) applyRender(context, render);

      // Add to results
      this.results.push({ url, context });

      // Discover new URLs from links
      this.discoverUrls(context);

      // Record canonical/redirect discovery (canonical targets also get queued)
      this.discoverFromPageSignals(context);
    } finally {
      this.activeCount--;
      this.hostState(host).inFlight--;
      this.notifyProgress();
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
    const redirectTargetByUrl = new Map<string, string>();
    let pageCount = 0;

    for (const page of this.results) {
      const from = this.normalizeUrl(page.url);
      // Where this URL's redirects ended, so an alias can be folded into it
      const chain = page.context?.redirectChain;
      if (chain && chain.length > 1) {
        const final = this.normalizeUrl(chain[chain.length - 1].url);
        if (final !== from) redirectTargetByUrl.set(from, final);
      }
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
        edges.push({
          from,
          nofollow: link.isNoFollow,
          anchor: link.text.trim(),
          chrome: link.inChrome === true,
        });
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
      redirectTargetByUrl,
      normalize: (url: string) => this.normalizeUrl(url),
    };
  }

  /** One crawled page's record, with this crawl's robots.txt answer */
  private buildPageInfo(page: CrawledPage): SitePageInfo {
    // Best-effort: the matcher exists only when respectRobots is on and
    // robots.txt was reachable, so "unknown" is reported as false.
    return buildSitePageInfo(page, this.robots ? !this.robots.isAllowed(page.url) : false);
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

  /**
   * Hold a worker until this request is allowed to start.
   *
   * The slot is reserved synchronously before the await, so concurrent workers
   * queue behind each other instead of all reading the same "last request"
   * timestamp and starting together — which is how a delay silently becomes
   * no delay at concurrency > 1.
   */
  private async waitForTurn(url: string): Promise<void> {
    const host = this.hostOf(url);
    const state = this.hostState(host);
    const delay = this.options.delayMs ?? 0;
    const crawlDelay = host === this.hostOf(this.entryUrl) ? this.crawlDelayMs : 0;
    const hostDelay = Math.max(this.options.perHostDelayMs ?? 0, crawlDelay) + state.extraDelayMs;

    if (delay > 0 || hostDelay > 0) await this.reserveSlot(host, delay, hostDelay);

    // A pause set while this request waited for its slot (another page got a
    // 429) still applies: a reserved slot is not permission to ignore it.
    while (state.pausedUntil > Date.now()) {
      throwIfAborted(this.options.signal);
      await this.sleep(state.pausedUntil - Date.now());
    }
  }

  /** Reserve this request's start time, synchronously, then wait for it */
  private async reserveSlot(host: string, delay: number, hostDelay: number): Promise<void> {
    const now = Date.now();
    const nextAllowed = Math.max(
      now,
      this.nextGlobalSlot,
      this.nextHostSlot.get(host) ?? 0
    );

    this.nextGlobalSlot = nextAllowed + delay;
    this.nextHostSlot.set(host, nextAllowed + hostDelay);

    const wait = nextAllowed - now;
    if (wait > 0) await this.sleep(wait);
  }
}

/**
 * Distil one crawled page into its SitePageInfo record.
 *
 * Exported so a stored crawl or a test can build the same records the
 * crawler does.
 *
 * Parses only what is already in memory (`context.$`, headers) — no new
 * fetches. Errored pages carry an empty context, so parsing them yields the
 * defaults with `statusCode: 0`.
 */
export function buildSitePageInfo(page: Pick<CrawledPage, 'url' | 'context' | 'rateLimited'>, disallowed: boolean): SitePageInfo {
  const { $, headers, statusCode } = page.context;

  const info: SitePageInfo = {
    statusCode,
    noindex: false,
    nofollow: false,
    disallowed,
    hreflangOut: {},
    ...(page.rateLimited && { rateLimited: true }),
  };

  // One classifier for every reader of indexability: the score caps, these
  // records and the cross-page checks built on them.
  const page$ = { $, headers, url: page.url };
  const canonical = readCanonical(page$);
  if (canonical !== undefined) info.canonical = canonical;
  info.noindex = isNoindex(page$);
  info.nofollow = isNofollow(page$);
  if (isPaginatedPage(page$)) info.isPaginated = true;

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

  const title = $(DOCUMENT_TITLE).first().text().replace(/\s+/g, ' ').trim();
  if (title) info.title = title;
  const mainContent = extractMainContent($);
  info.wordCount = countWords(mainContent);

  // What the cross-page duplicate checks compare, computed once per page
  // while the parsed document is still in memory.
  const description = $('meta[name="description"]').first().attr('content')?.trim();
  if (description) info.description = description;
  const ogTitle = $('meta[property="og:title"]').first().attr('content')?.trim();
  if (ogTitle) info.ogTitle = ogTitle;
  const ogDescription = $('meta[property="og:description"]').first().attr('content')?.trim();
  if (ogDescription) info.ogDescription = ogDescription;
  const bodyText = visibleBodyText($);
  if (bodyText.length >= 50) info.contentHash = createHash('md5').update(bodyText).digest('hex');
  const main = mainContent.replace(/\s+/g, ' ').trim();
  if (main.length >= 100) info.shingles = shingleText(main);

  const schemaNodes = summarizeSchemaNodes($);
  info.pageKind = pageKindFrom(
    schemaNodes.flatMap((node) => node.types),
    page.url
  );
  if (schemaNodes.length > 0) info.schemaNodes = schemaNodes;

  return info;
}

/**
 * Create a crawler instance with options
 */
export function createCrawler(options?: Partial<CrawlerOptions>): Crawler {
  return new Crawler(options);
}

/**
 * What a crawl's Crawl-delay will cost, before the crawl starts.
 *
 * Reads the site's robots.txt the way the crawl will and projects the
 * duration at `maxPages`. For callers that must decide up front whether the
 * crawl fits their time budget (an agent cannot wait 28 hours for an answer).
 *
 * @returns The notice the crawl would send, or null when no delay applies
 */
export async function projectCrawlDelay(
  startUrl: string,
  maxPages: number,
  perHostDelayMs = 0,
  timeout = 10_000
): Promise<CrawlDelayNotice | null> {
  try {
    const response = await netFetch(new URL('/robots.txt', startUrl).href, {
      headers: { 'User-Agent': getUserAgent() },
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) return null;
    const robots = new RobotsMatcher(await readTextCapped(response, MAX_PAGE_BYTES), getUserAgent());
    const seconds = robots.crawlDelaySeconds;
    if (seconds === undefined || seconds <= 0) return null;
    const requestedMs = Math.round(seconds * 1000);
    const delayMs = Math.min(requestedMs, MAX_CRAWL_DELAY_MS);
    return {
      host: new URL(startUrl).host,
      delayMs,
      requestedMs,
      capped: requestedMs > delayMs,
      projectedMs: Math.max(delayMs, perHostDelayMs) * Math.max(0, maxPages - 1),
    };
  } catch {
    return null;
  }
}
