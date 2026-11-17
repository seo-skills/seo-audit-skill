import type {
  AuditContext,
  AuditResult,
  CategoryResult,
  RuleResult,
  CategoryDefinition,
  SiteContext,
  SitemapFetchResult,
  AuditRunOptions,
} from './types.js';
import { categories, getCategoryById } from './categories/index.js';
import { getRuleById, getRulesByCategory } from './rules/registry.js';
import { isRuleEnabled } from './rules/pattern-matcher.js';
import { loadAllRules } from './rules/loader.js';
import {
  fetchPage,
  unauditableReason,
  createAuditContext,
  fetchPageWithPlaywright,
  closeBrowser,
  Crawler,
  type CrawledPage,
  type CrawlProgress,
  type PlaywrightFetchResult,
  type RenderOptions,
} from './crawler/index.js';
import { buildPageSnapshot } from './page-snapshot.js';
import { SCORING_VERSION } from './scoring.js';
import { applyScoreCaps, pageCaps, readPageFacts, siteCaps } from './score-caps.js';
import { AuditError, rethrowIfAborted, throwIfAborted } from './errors.js';
import { getUserAgent } from './crawler/user-agent.js';
import type { UrlFilterOptions } from './crawler/url-filter.js';
import { fetchSitemap } from './crawler/sitemap.js';
import {
  buildCategoryResult,
  buildAuditResult,
} from './scoring.js';
import { netFetch, readTextCapped, MAX_PAGE_BYTES } from './net/fetch.js';
import { policyForTarget, runWithNetPolicy, type NetMode } from './net/policy.js';
import { UrlService, type StatusCache } from './net/url-service.js';
import { LinkCache } from './storage/link-cache.js';
import {
  EXTERNAL_LINKS_DISABLED,
  SINGLE_PAGE_BUDGET_MS,
  checkExternalLinks,
  externalLinksExtras,
  type ExternalLinksExtras,
} from './site/external-links.js';
import { MAX_RATE_LIMIT_RETRIES, applyRender, parseRetryAfter, rateLimitedMessage, type CrawlDelayNotice, type CrawlWaiting } from './crawler/crawler.js';
import { notMeasured, resolveRuleOptions, defaultRuleOptions } from './rules/define-rule.js';
import type { AuditRule, RuleOptionValues } from './types.js';

/**
 * Callback for when a category audit starts
 */
export type OnCategoryStartCallback = (categoryId: string, categoryName: string) => void;

/**
 * Callback for when a category audit completes
 */
export type OnCategoryCompleteCallback = (
  categoryId: string,
  categoryName: string,
  result: CategoryResult
) => void;

/**
 * Callback for when a rule completes
 */
export type OnRuleCompleteCallback = (
  ruleId: string,
  ruleName: string,
  result: RuleResult
) => void;

/**
 * Callback for when a page audit completes (in crawl mode)
 */
export type OnPageCompleteCallback = (
  url: string,
  pageNumber: number,
  totalPages: number
) => void;

/**
 * Callback for crawl discovery progress, before any page is scored.
 *
 * A crawl spends most of its time here, and until now the CLI showed a bar
 * that only moved once the crawl had already finished.
 */
export type OnCrawlProgressCallback = (progress: CrawlProgress) => void;

/**
 * Mark every sitemap URL as sitemap-discovered on the shared site graph.
 *
 * Lives here rather than in the crawler because the Auditor owns the sitemap
 * fetch; the crawler never sees sitemap data. Marks the source only — sitemap
 * URLs are deliberately NOT queued for crawling, which would blow up crawl
 * scope. Keys go through `site.normalize` so they line up with the crawler's
 * own map keys.
 */
export function markSitemapDiscoverySources(
  site: SiteContext,
  sitemap: SitemapFetchResult
): void {
  if (!sitemap.urls.length) return;

  const map = site.discoverySourceByUrl ?? new Map();
  site.discoverySourceByUrl = map;

  for (const url of sitemap.urls) {
    const key = site.normalize(url);
    let sources = map.get(key);
    if (!sources) {
      sources = new Set();
      map.set(key, sources);
    }
    sources.add('sitemap');
  }
}

/**
 * Options for configuring the Auditor
 */
export interface AuditorOptions {
  /** Categories to audit (empty array = all categories) */
  categories?: string[];
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to measure Core Web Vitals with Playwright */
  measureCwv?: boolean;
  /**
   * Also render the page at a mobile viewport and run mobile-first parity rules.
   * Requires measureCwv (a browser render). Roughly doubles render time, so it
   * is off by default.
   */
  mobileParity?: boolean;
  /**
   * Perform a synthetic interaction during the render so INP can be measured.
   * Requires measureCwv. The resulting INP is flagged as synthetic.
   */
  simulateInteraction?: boolean;
  /**
   * Whether a crawl obeys the site's robots.txt. Defaults to true; `staging`
   * turns it off.
   */
  respectRobots?: boolean;
  /**
   * Audit a staging site, which is kept out of search on purpose. The noindex
   * and robots.txt caps are waived and reported as `waivedCaps`, and a crawl
   * ignores robots.txt so a `Disallow: /` staging site can be crawled at all.
   * The content caps still apply. Defaults to false.
   */
  staging?: boolean;
  /**
   * Which URLs a crawl may visit and how they are normalised, from the
   * `[crawler]` include/exclude and query-parameter keys.
   */
  urlFilter?: Partial<UrlFilterOptions>;
  /**
   * Rule id patterns to run, from `rules.enable`. Empty (or `['*']`) means
   * every rule, matching the config default.
   */
  enableRules?: string[];
  /** Rule id patterns to skip, from `rules.disable`. Takes precedence. */
  disableRules?: string[];
  /** Minimum gap between requests, from `crawler.delay_ms` */
  delayMs?: number;
  /** Minimum gap between requests to one host, from `crawler.per_host_delay_ms` */
  perHostDelayMs?: number;
  /** Optional browser-based page fetcher (replaces Playwright when provided) */
  browserFetcher?: (
    url: string,
    timeout: number,
    options?: RenderOptions
  ) => Promise<PlaywrightFetchResult>;
  /** Callback when category audit starts */
  onCategoryStart?: OnCategoryStartCallback;
  /** Callback when category audit completes */
  onCategoryComplete?: OnCategoryCompleteCallback;
  /** Callback when a rule completes */
  onRuleComplete?: OnRuleCompleteCallback;
  /** Callback when a page completes (crawl mode) */
  onPageComplete?: OnPageCompleteCallback;
  /** Callback as the crawl discovers and fetches pages (crawl mode) */
  onCrawlProgress?: OnCrawlProgressCallback;
  /** Callback as each page's fetch begins (crawl mode) */
  onPageStart?: (url: string) => void;
  /**
   * Cancels the run. Every fetch, render and page loop checks it, so an
   * aborted audit stops within a request rather than running to completion in
   * the background. The call rejects with an `AuditAbortedError`.
   */
  signal?: AbortSignal;
  /**
   * Which destinations the run may reach. `auto` (the default) blocks
   * private, loopback and link-local destinations when the target itself is
   * public, so a page cannot point the audit at an internal service. `strict`
   * blocks them for every request, the target included. `allowHosts` lists
   * `host:port` pairs that stay reachable.
   */
  network?: { mode?: NetMode; allowHosts?: string[] };
  /**
   * Per-rule option values, keyed by rule id: the `rule_options` table of
   * `seomator.toml`. Each rule receives its declared defaults with these laid
   * over them. Validate with `validateConfig` first; undeclared keys are
   * ignored here.
   */
  ruleOptions?: Record<string, Record<string, unknown>>;
  /** Most requests in flight to one host at once (`crawler.per_host_concurrency`) */
  perHostConcurrency?: number;
  /** Honour robots.txt Crawl-delay, capped at 10 s. Default true. */
  respectCrawlDelay?: boolean;
  /** Longest Retry-After honoured, in ms (`crawler.max_retry_after_ms`) */
  maxRetryAfterMs?: number;
  /**
   * Stop a crawl's requests after this long and score what was fetched; the
   * run ends "completed with gaps" (`crawler.max_duration_s`).
   */
  maxDurationMs?: number;
  /** Told once, before the first page, when the site's Crawl-delay applies */
  onCrawlDelay?: (notice: CrawlDelayNotice) => void;
  /** Told when the crawl waits on a rate-limited host */
  onWaiting?: (waiting: CrawlWaiting) => void;
  /**
   * `[external_links]`. Without `cacheTtlDays` nothing persists between runs;
   * the CLI passes the configured 7 days.
   */
  externalLinks?: ExternalLinksOptions;
  /** Told how many unique external URLs the run is about to check */
  onExternalLinks?: (count: number) => void;
}

export interface ExternalLinksOptions {
  /** `false` makes `links-external-valid` not measured and requests nothing */
  enabled?: boolean;
  /** Per request, in ms (default 10000) */
  timeoutMs?: number;
  /** Requests in flight at once (default 5) */
  concurrency?: number;
  /** Days a settled answer persists in the link cache; 0 or absent: never */
  cacheTtlDays?: number;
  /** Ask again even when the link cache has an answer (`--refresh`) */
  refresh?: boolean;
  /** A cache to use instead of opening the one under SEOMATOR_HOME (tests) */
  cache?: StatusCache;
}

/**
 * Resolved options with defaults applied.
 * browserFetcher stays optional because it has no default.
 */
type OptionalAuditorKeys =
  | 'browserFetcher'
  | 'signal'
  | 'perHostConcurrency'
  | 'maxDurationMs'
  | 'onCrawlDelay'
  | 'onWaiting'
  | 'onExternalLinks';
type ResolvedAuditorOptions = Required<Omit<AuditorOptions, OptionalAuditorKeys>> &
  Pick<AuditorOptions, OptionalAuditorKeys>;

/** Pages of a crawl scored at the same time */
const PAGE_SCORING_CONCURRENCY = 4;

/**
 * Main Auditor class for running SEO audits
 */
export class Auditor {
  private options: ResolvedAuditorOptions;
  private rulesLoaded = false;
  private categoriesToAudit: CategoryDefinition[] = [];
  /** The current run's URL requests; see `withUrlService` */
  private urls: UrlService | undefined;
  /** The current run's external link report, for `extras.externalLinks` */
  private externalLinksReport: ExternalLinksExtras | undefined;
  /** When the current run started: every page's `context.now` */
  private runStartedAt = Date.now();

  constructor(options: AuditorOptions = {}) {
    this.options = {
      categories: options.categories ?? [],
      timeout: options.timeout ?? 30000,
      measureCwv: options.measureCwv ?? false,
      mobileParity: options.mobileParity ?? false,
      simulateInteraction: options.simulateInteraction ?? false,
      // Defaults to true so a programmatic crawl is polite unless asked not to
      // be. A staging site's robots.txt blocks everything on purpose, and it
      // is the user's own site, so staging crawls past it.
      respectRobots: options.staging ? false : (options.respectRobots ?? true),
      staging: options.staging ?? false,
      // 0 rather than the config's 100/200: a programmatic Auditor is not
      // silently slowed down. The CLI passes the configured values.
      urlFilter: options.urlFilter ?? {},
      enableRules: options.enableRules ?? [],
      disableRules: options.disableRules ?? [],
      delayMs: options.delayMs ?? 0,
      perHostDelayMs: options.perHostDelayMs ?? 0,
      browserFetcher: options.browserFetcher,
      signal: options.signal,
      onCategoryStart: options.onCategoryStart ?? (() => {}),
      onCategoryComplete: options.onCategoryComplete ?? (() => {}),
      onRuleComplete: options.onRuleComplete ?? (() => {}),
      onPageComplete: options.onPageComplete ?? (() => {}),
      onCrawlProgress: options.onCrawlProgress ?? (() => {}),
      onPageStart: options.onPageStart ?? (() => {}),
      network: { mode: options.network?.mode ?? 'auto', allowHosts: options.network?.allowHosts ?? [] },
      ruleOptions: options.ruleOptions ?? {},
      perHostConcurrency: options.perHostConcurrency,
      respectCrawlDelay: options.respectCrawlDelay ?? true,
      maxRetryAfterMs: options.maxRetryAfterMs ?? 120_000,
      maxDurationMs: options.maxDurationMs,
      onCrawlDelay: options.onCrawlDelay,
      onWaiting: options.onWaiting,
      externalLinks: options.externalLinks ?? {},
      onExternalLinks: options.onExternalLinks,
    };

    // Determine which categories to audit
    this.categoriesToAudit = this.filterCategories();
  }

  /**
   * Filter categories based on options
   */
  private filterCategories(): CategoryDefinition[] {
    if (this.options.categories.length === 0) {
      // Audit all categories
      return categories;
    }

    // Filter to only specified categories
    return categories.filter((cat) =>
      this.options.categories.includes(cat.id)
    );
  }

  /**
   * Ensure rules are loaded before running audit
   */
  private async ensureRulesLoaded(): Promise<void> {
    if (!this.rulesLoaded) {
      await loadAllRules();
      this.rulesLoaded = true;
    }
  }

  /**
   * Fetch robots.txt content for a site
   */
  private async fetchRobotsTxt(url: string): Promise<string | undefined> {
    const signal = this.options.signal;
    throwIfAborted(signal);
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await netFetch(robotsUrl, {
          signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
          headers: {
            'User-Agent': getUserAgent(),
          },
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          return await readTextCapped(response, MAX_PAGE_BYTES);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Robots.txt fetch failed, continue without it
      rethrowIfAborted(error, signal);
    }
    return undefined;
  }

  /**
   * Discover and fetch the site's sitemap(s).
   *
   * Delegates to the sitemap module, which follows sitemap indexes,
   * decompresses gzipped sitemaps and reads every `Sitemap:` line in
   * robots.txt rather than only the first.
   */
  private async fetchSitemap(
    url: string,
    robotsTxtContent?: string
  ): Promise<SitemapFetchResult> {
    return fetchSitemap(url, robotsTxtContent, this.options.signal);
  }

  /**
   * Enrich audit context with robots.txt, sitemap data
   */
  private async enrichContext(context: AuditContext, url: string): Promise<void> {
    // Fetch robots.txt first (needed for sitemap URL discovery)
    const robotsTxtContent = await this.fetchRobotsTxt(url);
    context.robotsTxtContent = robotsTxtContent;

    // Fetch sitemap using robots.txt info
    const sitemapData = await this.fetchSitemap(url, robotsTxtContent);
    this.applySitemapData(context, sitemapData);
  }

  /**
   * Copy shared sitemap data onto a page context
   */
  private applySitemapData(context: AuditContext, sitemap: SitemapFetchResult): void {
    context.sitemapContent = sitemap.content;
    context.sitemapUrls = sitemap.urls;
    context.sitemapUrlSources = sitemap.urlSources;
    context.sitemapEntries = sitemap.entries;
    context.sitemapIsIndex = sitemap.isIndex;
    context.sitemapDocuments = sitemap.documents;
    context.sitemapSkippedCount = sitemap.skippedSitemaps;
    context.sitemapComplete = sitemap.complete;
    context.sitemapGaps = sitemap.gaps;
  }

  /**
   * Run a single-page audit
   * @param url - URL to audit
   * @returns AuditResult for the page
   */
  async audit(url: string): Promise<AuditResult> {
    return this.underNetPolicy(url, () => this.withUrlService(url, () => this.auditSinglePage(url)));
  }

  /**
   * Give `fn` one URL service for the whole run, with the link cache open
   * when `externalLinks.cacheTtlDays` asks for one, and close it after.
   */
  private async withUrlService<T>(siteUrl: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.urls;
    const ext = this.options.externalLinks;
    // A cache the caller passed is theirs to close; one opened here is ours
    let opened: LinkCache | undefined;
    if (!ext.cache && ext.enabled !== false && (ext.cacheTtlDays ?? 0) > 0) {
      try {
        opened = new LinkCache({ ttlDays: ext.cacheTtlDays });
      } catch (error) {
        // A link cache that cannot open costs speed, not correctness
        console.error(`Link cache unavailable, checking every link fresh: ${error instanceof Error ? error.message : error}`);
      }
    }
    const service = this.createUrlService(siteUrl, ext.cache ?? opened ?? null);
    this.urls = service;
    this.externalLinksReport = undefined;
    this.runStartedAt = Date.now();
    try {
      return await fn();
    } finally {
      service.close();
      opened?.close();
      this.urls = previous;
    }
  }

  private createUrlService(siteUrl: string, cache: StatusCache | null): UrlService {
    const ext = this.options.externalLinks;
    return new UrlService({
      siteUrl,
      ...(ext.timeoutMs !== undefined && { timeoutMs: ext.timeoutMs }),
      ...(ext.concurrency !== undefined && { concurrency: ext.concurrency }),
      ...(this.options.perHostConcurrency !== undefined && { perHostConcurrency: this.options.perHostConcurrency }),
      cache,
      refresh: ext.refresh ?? false,
      maxRetryAfterMs: this.options.maxRetryAfterMs,
      ...(this.options.signal && { signal: this.options.signal }),
    });
  }

  /**
   * Check every external link on `contexts` once, and hand each context the
   * answers before its rules run. Skipped when `links-external-valid` will not
   * run. A crawl uses the rule's `max_urls` and `max_seconds`; a single page
   * gets 30 seconds.
   */
  private async prepareExternalLinks(contexts: AuditContext[], crawl: boolean): Promise<void> {
    const rule = getRuleById('links-external-valid');
    const runs =
      rule !== undefined &&
      this.categoriesToAudit.some((category) => category.id === rule.category) &&
      isRuleEnabled(rule.id, this.options.enableRules, this.options.disableRules);
    if (!runs || contexts.length === 0) return;

    if (this.options.externalLinks.enabled === false) {
      for (const context of contexts) context.externalLinks = EXTERNAL_LINKS_DISABLED;
      return;
    }
    const options = this.optionsFor(rule);
    const maxUrls = Number(options['max_urls']);
    const budgetMs = crawl ? Number(options['max_seconds']) * 1000 : SINGLE_PAGE_BUDGET_MS;
    const check = await checkExternalLinks(this.urls!, contexts, { maxUrls, budgetMs }, this.options.onExternalLinks);
    for (const context of contexts) context.externalLinks = check;
    this.externalLinksReport = externalLinksExtras(check);
  }

  /**
   * Run `fn` with every request it makes under this run's network policy.
   * See `net/policy.ts`.
   */
  private async underNetPolicy<T>(url: string, fn: () => Promise<T>): Promise<T> {
    const { mode, allowHosts } = this.options.network;
    const policy = await policyForTarget(url, mode ?? 'auto', allowHosts ?? []);
    return runWithNetPolicy(policy, fn);
  }

  private async auditSinglePage(url: string): Promise<AuditResult> {
    throwIfAborted(this.options.signal);
    await this.ensureRulesLoaded();

    // Fetch the page, recording the redirect hops so redirect-loop and
    // redirect-broken have a chain to read. A rate limit is retried the way a
    // crawl retries it: it says nothing about the page.
    let fetchResult = await fetchPage(url, this.options.timeout, {
      trackRedirects: true,
      ...(this.options.signal && { signal: this.options.signal }),
    });
    for (let attempt = 1; fetchResult.statusCode === 429 || fetchResult.statusCode === 503; attempt++) {
      const requested = parseRetryAfter(fetchResult.headers['retry-after']);
      if (attempt > MAX_RATE_LIMIT_RETRIES) {
        throw new AuditError(
          'rate-limited',
          rateLimitedMessage(new URL(url).host, fetchResult.statusCode, requested !== null ? Math.round(requested / 1000) : null)
        );
      }
      const waitMs = Math.min(requested ?? 5000 * 2 ** (attempt - 1), this.options.maxRetryAfterMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      throwIfAborted(this.options.signal);
      fetchResult = await fetchPage(url, this.options.timeout, {
        trackRedirects: true,
        ...(this.options.signal && { signal: this.options.signal }),
      });
    }

    // Refuse to score something that is not an auditable page. Most rules pass
    // when the thing they check is absent, so an empty body used to score
    // 84/100 and a JSON response 83 — confidently wrong is worse than an error.
    const unauditable = unauditableReason(
      url,
      fetchResult.headers['content-type'] ?? null,
      fetchResult.html
    );
    if (unauditable) {
      throw new AuditError('non-html', unauditable);
    }

    // Same reasoning one step earlier: a 404 is not a page to score. It was
    // fetched, parsed and audited like any other document, so a typo'd URL came
    // back with a confident 87/100 for a page that does not exist — and most
    // rules pass when the thing they check is absent, so the score reads
    // healthy rather than obviously wrong.
    //
    // Reported with the final URL after redirects, because a 301 to a 404 is
    // the case where the address the user typed is not the address that failed.
    if (fetchResult.statusCode >= 400) {
      const chain = fetchResult.redirectChain;
      const finalUrl = chain && chain.length > 0 ? chain[chain.length - 1].url : url;
      const via = finalUrl !== url ? ` (redirected to ${finalUrl})` : '';
      throw new AuditError(
        'http-error',
        `The page returned HTTP ${fetchResult.statusCode}${via}.`
      );
    }

    // Get Core Web Vitals and rendered DOM if enabled
    let render: PlaywrightFetchResult | undefined;
    let mobileHtml: string | undefined;
    let mobile$: import('cheerio').CheerioAPI | undefined;
    if (this.options.measureCwv) {
      const fetcher = this.options.browserFetcher ?? fetchPageWithPlaywright;
      try {
        render = await fetcher(url, this.options.timeout, {
          simulateInteraction: this.options.simulateInteraction,
          ...(this.options.signal && { signal: this.options.signal }),
        });

        // Mobile-first parity: a second render at a mobile viewport, while the
        // shared browser is still open. Uses the real Playwright renderer
        // directly because a custom browserFetcher has no mobile mode.
        if (this.options.mobileParity) {
          try {
            const mobileResult = await fetchPageWithPlaywright(url, this.options.timeout, {
              mobile: true,
              ...(this.options.signal && { signal: this.options.signal }),
            });
            if (mobileResult.html) {
              mobileHtml = mobileResult.html;
              const cheerio = await import('cheerio');
              mobile$ = cheerio.load(mobileHtml);
            }
          } catch (error) {
            rethrowIfAborted(error, this.options.signal);
            // Mobile render failed; parity rules report unmeasured
          }
        }
      } catch (error) {
        rethrowIfAborted(error, this.options.signal);
        // CWV measurement failed, continue without it
      } finally {
        // Clean up Playwright browser (only when not using an injected fetcher)
        if (!this.options.browserFetcher) {
          await closeBrowser();
        }
      }
    }

    // Create audit context
    const context = createAuditContext(url, fetchResult, render?.cwv ?? {});
    if (this.options.signal) {
      context.signal = this.options.signal;
    }
    context.urls = this.urls;
    context.now = this.runStartedAt;

    // Enrich with robots.txt, sitemap, and rendered DOM
    await this.enrichContext(context, url);
    if (render) applyRender(context, render);
    if (mobileHtml) {
      context.mobileHtml = mobileHtml;
      context.mobile$ = mobile$;
    }

    // Run all categories
    await this.prepareExternalLinks([context], false);
    const categoryResults = await this.runAllCategories(context);

    // Build the final result, then hold the score down for any condition the
    // category average cannot express (see score-caps.ts)
    const timestamp = new Date().toISOString();
    const result = buildAuditResult(
      url,
      categoryResults,
      this.categoriesToAudit,
      timestamp,
      1,
      buildPageSnapshot(context),
      this.runOptions(false, 1, 1),
      { pages: [url], detail: 'per-page' }
    );
    if (this.externalLinksReport) result.extras = { ...result.extras, externalLinks: this.externalLinksReport };
    return applyScoreCaps(result, pageCaps(readPageFacts(context), { staging: this.options.staging }));
  }

  /**
   * Run audit with crawling (multiple pages)
   * @param url - Starting URL to crawl from
   * @param maxPages - Maximum number of pages to crawl
   * @param concurrency - Number of concurrent requests
   * @returns AuditResult with aggregated scores
   */
  async auditWithCrawl(
    url: string,
    maxPages = 10,
    concurrency = 3
  ): Promise<AuditResult> {
    return this.underNetPolicy(url, () => this.withUrlService(url, () => this.auditCrawl(url, maxPages, concurrency)));
  }

  private async auditCrawl(url: string, maxPages: number, concurrency: number): Promise<AuditResult> {
    throwIfAborted(this.options.signal);
    await this.ensureRulesLoaded();

    // Pre-fetch robots.txt and sitemap once for the entire crawl
    const robotsTxtContent = await this.fetchRobotsTxt(url);
    const sitemapData = await this.fetchSitemap(url, robotsTxtContent);

    // Create crawler with browser rendering if enabled
    const fetcher = this.options.browserFetcher ?? fetchPageWithPlaywright;
    const crawler = new Crawler({
      maxPages,
      concurrency,
      timeout: this.options.timeout,
      respectRobots: this.options.respectRobots,
      urlFilter: this.options.urlFilter,
      delayMs: this.options.delayMs,
      perHostDelayMs: this.options.perHostDelayMs,
      ...(this.options.perHostConcurrency !== undefined && { perHostConcurrency: this.options.perHostConcurrency }),
      // A staging crawl ignores robots.txt, its Crawl-delay included.
      respectCrawlDelay: this.options.respectCrawlDelay && !this.options.staging,
      maxRetryAfterMs: this.options.maxRetryAfterMs,
      ...(this.options.maxDurationMs !== undefined && { deadline: Date.now() + this.options.maxDurationMs }),
      ...(this.options.onCrawlDelay && { onCrawlDelay: this.options.onCrawlDelay }),
      ...(this.options.onWaiting && { onWaiting: this.options.onWaiting }),
      ...(this.options.signal && { signal: this.options.signal }),
      onProgress: (progress) => this.options.onCrawlProgress(progress),
      onPageStart: (pageUrl) => this.options.onPageStart(pageUrl),
      renderPage: this.options.measureCwv
        ? async (pageUrl: string) => {
            try {
              // Passed through whole: picking fields here is how `html` was once
              // dropped, and every JS-rendering rule reported "rendered DOM not
              // available" on every page of every crawl
              return await fetcher(pageUrl, this.options.timeout, {
                ...(this.options.signal && { signal: this.options.signal }),
              });
            } catch (error) {
              rethrowIfAborted(error, this.options.signal);
              return { cwv: {} };
            }
          }
        : undefined,
    });

    // Crawl the site. The browser is closed whatever happens, including a
    // cancellation: a leaked Chromium outlives the process that started it.
    let crawledPages: CrawledPage[];
    try {
      crawledPages = await crawler.crawl(url, maxPages, concurrency);
    } finally {
      if (this.options.measureCwv && !this.options.browserFetcher) {
        await closeBrowser();
      }
    }

    if (crawledPages.length === 0) {
      throw new AuditError('no-pages', `The crawl of ${url} found no pages to audit`);
    }

    // Build the site graph once, then share it by reference with every page so
    // rules can answer cross-page questions (inbound links, click depth).
    const site = crawler.buildSiteContext();
    markSitemapDiscoverySources(site, sitemapData);

    // Enrich each crawled page context with shared data
    for (const crawledPage of crawledPages) {
      if (crawledPage.context) {
        crawledPage.context.robotsTxtContent = robotsTxtContent;
        crawledPage.context.site = site;
        crawledPage.context.urls = this.urls;
        crawledPage.context.now = this.runStartedAt;
        if (this.options.signal) {
          crawledPage.context.signal = this.options.signal;
        }
        this.applySitemapData(crawledPage.context, sitemapData);
      }
    }

    // Aggregate results from all pages
    const allCategoryResults = await this.auditPages(crawledPages);

    // Build the final result, then cap it if search engines cannot index the
    // start page. A site-wide block always reaches it; averaged with the
    // pages behind it, it moved the score by a point (see score-caps.ts).
    const timestamp = new Date().toISOString();
    const report = crawler.getReport();
    const failed = crawledPages.filter((page) => page.error && !page.rateLimited).length;
    const coverage = {
      pages: crawledPages.map((p) => p.url),
      detail: 'per-page' as const,
      attempted: crawledPages.length + report.notFetched.length,
      measured: crawledPages.filter((page) => !page.error).length,
      rateLimited: report.rateLimitedPages.length,
      failed,
      notFetched: report.notFetched.length,
    };
    const built = buildAuditResult(
      url,
      allCategoryResults,
      this.categoriesToAudit,
      timestamp,
      crawledPages.length,
      undefined,
      this.runOptions(true, maxPages, concurrency),
      coverage
    );
    const gaps = coverage.rateLimited + coverage.failed + coverage.notFetched > 0 || report.stoppedByDeadline;
    built.completionState = gaps ? 'completed-with-gaps' : 'completed';
    built.extras = {
      ...built.extras,
      ...(this.externalLinksReport && { externalLinks: this.externalLinksReport }),
      crawl: {
        rateLimitedPages: coverage.rateLimited,
        rateLimitedHosts: report.rateLimitedHosts,
        notFetched: coverage.notFetched,
        abandonedHosts: report.abandonedHosts,
        stoppedByDeadline: report.stoppedByDeadline,
        crawlDelayApplied: report.crawlDelay,
      },
    };

    const start = crawledPages.find((page) => page.url === site.entryUrl && !page.error);
    if (!start) return built;
    return applyScoreCaps(
      built,
      siteCaps(readPageFacts(start.context), start.url, { staging: this.options.staging })
    );
  }

  /**
   * Run every category across multiple pages and aggregate the rule results.
   *
   * Each category's score is the weighted average over every rule result from
   * every page, so a rule that fails on 3 of 50 pages drags the category down
   * proportionally rather than deciding it outright.
   *
   * Used by both the live crawl path and `seomator analyze`, which replays
   * pages from a stored crawl.
   *
   * @param pages - Pages to audit; entries with an `error` are skipped
   * @returns One CategoryResult per audited category
   */
  async auditPages(pages: CrawledPage[]): Promise<CategoryResult[]> {
    const audited = pages.filter((page) => !page.error && page.context).map((page) => page.context);
    // `seomator analyze` calls this outside a run: it gets a service of its
    // own, and the same network policy an audit of that site would have, so a
    // stored page linking to a private address cannot make this machine ask it
    if (!this.urls && audited.length > 0) {
      const siteUrl = audited[0].url;
      return this.underNetPolicy(siteUrl, () => this.withUrlService(siteUrl, () => this.auditPages(pages)));
    }
    for (const context of audited) {
      context.urls ??= this.urls;
      context.now ??= this.runStartedAt;
    }
    if (audited.some((context) => !context.externalLinks)) {
      await this.prepareExternalLinks(audited, true);
    }
    const crawledPages = pages;
    // Collect all rule results per category across all pages
    const categoryRuleResults = new Map<string, RuleResult[]>();

    // Initialize map for each category
    for (const category of this.categoriesToAudit) {
      categoryRuleResults.set(category.id, []);
    }

    // Pages are scored a few at a time, so one page's slow requests do not
    // hold up the rest; the run's URL service still bounds the requests.
    // Results are merged in page order, so the outcome does not depend on
    // which page finished first. `pageNumber` counts completions, so progress
    // only moves forward.
    const perPage: Array<CategoryResult[] | null> = new Array(crawledPages.length).fill(null);
    let next = 0;
    let completed = 0;
    const worker = async () => {
      while (next < crawledPages.length) {
        const index = next++;
        const crawledPage = crawledPages[index];
        throwIfAborted(this.options.signal);
        // Skip pages with errors
        if (!crawledPage.error) perPage[index] = await this.runAllCategories(crawledPage.context);
        completed++;
        this.options.onPageComplete(crawledPage.url, completed, crawledPages.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PAGE_SCORING_CONCURRENCY, crawledPages.length) }, worker));

    // Merge results into the aggregated map, in page order
    for (const pageResults of perPage) {
      for (const categoryResult of pageResults ?? []) {
        categoryRuleResults.get(categoryResult.categoryId)?.push(...categoryResult.results);
      }
    }

    // Build final category results from aggregated data
    const finalResults: CategoryResult[] = [];
    for (const category of this.categoriesToAudit) {
      const results = categoryRuleResults.get(category.id) ?? [];
      finalResults.push(buildCategoryResult(category.id, results));
    }

    return finalResults;
  }

  /** The last run's external link report, for a caller building its own result */
  getExternalLinksReport(): ExternalLinksExtras | undefined {
    return this.externalLinksReport;
  }

  /**
   * Run all categories against an audit context
   * @param context - The audit context to run rules against
   * @returns Array of CategoryResult
   */
  async runAllCategories(context: AuditContext): Promise<CategoryResult[]> {
    const results: CategoryResult[] = [];

    for (const category of this.categoriesToAudit) {
      throwIfAborted(this.options.signal);

      // Notify start
      this.options.onCategoryStart(category.id, category.name);

      // Get rules for this category, minus anything `rules.enable` /
      // `rules.disable` excludes.
      const rules = getRulesByCategory(category.id).filter((rule) =>
        isRuleEnabled(rule.id, this.options.enableRules, this.options.disableRules)
      );

      // A category with every rule filtered out is not a category that scored
      // zero. calculateCategoryScore([]) returns 0, so keeping it would drag
      // the overall score down and report a narrower audit as a catastrophic
      // one. Dropping it lets calculateOverallScore renormalise over the
      // categories that actually ran.
      // Advisory rules do not count toward the score, so a category with
      // nothing else in it would score 0 at its full weight: dropped the same
      // way, so adding an advisory rule never moves the overall score.
      if (rules.length === 0 || rules.every((rule) => rule.advisory)) {
        continue;
      }

      // A category's rules run together: they read the context and never
      // write it, and their requests share the run's limits. Results keep
      // the rules' order whatever order they finish in.
      const ruleResults = await Promise.all(rules.map((rule) => this.runRule(rule, context)));

      // Build category result
      const categoryResult = buildCategoryResult(category.id, ruleResults);
      results.push(categoryResult);

      // Notify complete
      this.options.onCategoryComplete(category.id, category.name, categoryResult);
    }

    return results;
  }

  /** Run one rule on one page; a crash is a not-measured result, a cancel is thrown */
  private async runRule(rule: AuditRule, context: AuditContext): Promise<RuleResult> {
    // A render-only rule on a page with no render: not measured, without
    // running it, and the same answer from every such rule
    if (rule.requiresRender && context.renderedHtml === undefined) {
      const result: RuleResult = {
        ...notMeasured(
          rule.id,
          this.options.measureCwv
            ? 'The browser render failed for this page'
            : 'Needs a browser render: rerun with --cwv',
          { pageUrl: context.url },
          this.options.measureCwv ? 'could-not-verify' : 'needs-render'
        ),
        ...(rule.advisory && { advisory: true }),
      };
      this.options.onRuleComplete(rule.id, rule.name, result);
      return result;
    }
    try {
      const result = await rule.run(context, this.optionsFor(rule));
      // Inject ruleId, weight and page URL for consistent tracking.
      // A result that set its own weight keeps it — that is how
      // notMeasured() opts a result out of scoring with weight 0.
      const resultWithMeta: RuleResult = {
        ...result,
        ruleId: rule.id,
        weight: result.weight ?? rule.weight,
        ...(rule.advisory && { advisory: true }),
        details: {
          ...result.details,
          pageUrl: context.url,
        },
      };
      this.options.onRuleComplete(rule.id, rule.name, resultWithMeta);
      return resultWithMeta;
    } catch (error) {
      // A cancelled run is not a rule failure: stop rather than scoring
      // 332 rules as "execution failed".
      rethrowIfAborted(error, this.options.signal);

      // A check that crashed took no reading. Scoring it as a weighted
      // fail blamed the site for the engine's bug, and let any thrown
      // network or parse error drag the score down.
      const errorResult: RuleResult = {
        ...notMeasured(
          rule.id,
          `The check failed to run: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { pageUrl: context.url },
          'rule-error'
        ),
        ...(rule.advisory && { advisory: true }),
      };
      this.options.onRuleComplete(rule.id, rule.name, errorResult);
      return errorResult;
    }
  }

  /** Effective options per rule, resolved once per run */
  private resolvedOptions = new Map<string, RuleOptionValues>();

  /** A rule's declared defaults with the configured `rule_options` over them */
  private optionsFor(rule: AuditRule): RuleOptionValues {
    let values = this.resolvedOptions.get(rule.id);
    if (!values) {
      values = resolveRuleOptions(rule, this.options.ruleOptions[rule.id]);
      this.resolvedOptions.set(rule.id, values);
    }
    return values;
  }

  /** The `rule_options` values this run used that differ from the defaults */
  getRunRuleOptions(): Record<string, Record<string, unknown>> | undefined {
    return this.changedRuleOptions();
  }

  /**
   * Configured option values that differ from the rules' defaults.
   *
   * Recorded on the run because a threshold change moves verdicts without
   * the site changing. Undefined when every rule ran on its defaults.
   */
  private changedRuleOptions(): Record<string, Record<string, unknown>> | undefined {
    const changed: Record<string, Record<string, unknown>> = {};
    for (const [ruleId, configured] of Object.entries(this.options.ruleOptions)) {
      const rule = getRuleById(ruleId);
      if (!rule?.options) continue;
      const defaults = defaultRuleOptions(rule);
      for (const [key, value] of Object.entries(configured)) {
        if (!(key in rule.options)) continue;
        if (JSON.stringify(value) === JSON.stringify(defaults[key])) continue;
        (changed[ruleId] ??= {})[key] = value;
      }
    }
    return Object.keys(changed).length > 0 ? changed : undefined;
  }

  /**
   * The options this audit ran with, recorded on the result.
   *
   * Two scores are only comparable if they were measured the same way. Every
   * surface now starts with the browser render off, but `--cwv` and the GUI's
   * Core Web Vitals toggle turn it on per run, and audits from before the
   * default changed were rendered. All of them write to the same history.
   */
  private runOptions(crawl: boolean, maxPages: number, concurrency: number): AuditRunOptions {
    return {
      crawl,
      maxPages,
      concurrency,
      measureCwv: this.options.measureCwv,
      mobile: this.options.mobileParity,
      simulateInteraction: this.options.simulateInteraction,
      categories: this.options.categories,
      scoringVersion: SCORING_VERSION,
      enableRules: this.options.enableRules,
      disableRules: this.options.disableRules,
      // Recorded only when set: absent reads as a production audit, which is
      // what every audit stored before the option existed was.
      ...(this.options.staging && { staging: true }),
      ...(this.changedRuleOptions() && { ruleOptions: this.changedRuleOptions() }),
      timeout: this.options.timeout,
    };
  }

  /**
   * Get the categories that will be audited
   */
  getCategoriesToAudit(): CategoryDefinition[] {
    return this.categoriesToAudit;
  }
}

/**
 * Create an Auditor instance with options
 * @param options - Auditor configuration options
 * @returns Configured Auditor instance
 */
export function createAuditor(options?: AuditorOptions): Auditor {
  return new Auditor(options);
}
