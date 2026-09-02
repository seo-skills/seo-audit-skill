import type {
  AuditContext,
  AuditResult,
  CategoryResult,
  RuleResult,
  CategoryDefinition,
  CoreWebVitals,
  RenderDiagnostics,
  AssetInfo,
  SiteContext,
  SitemapFetchResult,
} from './types.js';
import { categories, getCategoryById } from './categories/index.js';
import { getRulesByCategory, resetCrossPageState } from './rules/registry.js';
import { loadAllRules } from './rules/loader.js';
import {
  fetchPage,
  unauditableReason,
  createAuditContext,
  fetchPageWithPlaywright,
  closeBrowser,
  Crawler,
  type CrawledPage,
  type PlaywrightFetchResult,
  type RenderOptions,
} from './crawler/index.js';
import { buildPageSnapshot } from './page-snapshot.js';
import { getUserAgent } from './crawler/user-agent.js';
import { fetchSitemap } from './crawler/sitemap.js';
import {
  buildCategoryResult,
  buildAuditResult,
} from './scoring.js';

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
  /** Whether a crawl obeys the site's robots.txt. Defaults to true. */
  respectRobots?: boolean;
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
}

/**
 * Resolved options with defaults applied.
 * browserFetcher stays optional because it has no default.
 */
type ResolvedAuditorOptions = Required<Omit<AuditorOptions, 'browserFetcher'>> &
  Pick<AuditorOptions, 'browserFetcher'>;

/**
 * Main Auditor class for running SEO audits
 */
export class Auditor {
  private options: ResolvedAuditorOptions;
  private rulesLoaded = false;
  private categoriesToAudit: CategoryDefinition[] = [];

  constructor(options: AuditorOptions = {}) {
    this.options = {
      categories: options.categories ?? [],
      timeout: options.timeout ?? 30000,
      measureCwv: options.measureCwv ?? false,
      mobileParity: options.mobileParity ?? false,
      simulateInteraction: options.simulateInteraction ?? false,
      // Defaults to true so a programmatic crawl is polite unless asked not to be.
      respectRobots: options.respectRobots ?? true,
      browserFetcher: options.browserFetcher,
      onCategoryStart: options.onCategoryStart ?? (() => {}),
      onCategoryComplete: options.onCategoryComplete ?? (() => {}),
      onRuleComplete: options.onRuleComplete ?? (() => {}),
      onPageComplete: options.onPageComplete ?? (() => {}),
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
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(robotsUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': getUserAgent(),
          },
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          return await response.text();
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      // Robots.txt fetch failed, continue without it
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
    return fetchSitemap(url, robotsTxtContent);
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
  }

  /**
   * Run a single-page audit
   * @param url - URL to audit
   * @returns AuditResult for the page
   */
  async audit(url: string): Promise<AuditResult> {
    await this.ensureRulesLoaded();
    resetCrossPageState();

    // Fetch the page, recording the redirect hops so redirect-loop and
    // redirect-broken have a chain to read.
    const fetchResult = await fetchPage(url, this.options.timeout, {
      trackRedirects: true,
    });

    // Refuse to score something that is not an auditable page. Most rules pass
    // when the thing they check is absent, so an empty body used to score
    // 84/100 and a JSON response 83 — confidently wrong is worse than an error.
    const unauditable = unauditableReason(
      url,
      fetchResult.headers['content-type'] ?? null,
      fetchResult.html
    );
    if (unauditable) {
      throw new Error(unauditable);
    }

    // Get Core Web Vitals and rendered DOM if enabled
    let cwv: CoreWebVitals = {};
    let renderedHtml: string | undefined;
    let rendered$: import('cheerio').CheerioAPI | undefined;
    let renderDiagnostics: RenderDiagnostics | undefined;
    let assets: AssetInfo[] | undefined;
    let mobileHtml: string | undefined;
    let mobile$: import('cheerio').CheerioAPI | undefined;
    if (this.options.measureCwv) {
      const fetcher = this.options.browserFetcher ?? fetchPageWithPlaywright;
      try {
        const pwResult = await fetcher(url, this.options.timeout, {
          simulateInteraction: this.options.simulateInteraction,
        });
        cwv = pwResult.cwv;
        renderDiagnostics = pwResult.diagnostics;
        assets = pwResult.assets;
        // Capture rendered HTML for JS rendering rules
        if (pwResult.html) {
          renderedHtml = pwResult.html;
          const cheerio = await import('cheerio');
          rendered$ = cheerio.load(renderedHtml);
        }

        // Mobile-first parity: a second render at a mobile viewport, while the
        // shared browser is still open. Uses the real Playwright renderer
        // directly because a custom browserFetcher has no mobile mode.
        if (this.options.mobileParity) {
          try {
            const mobileResult = await fetchPageWithPlaywright(url, this.options.timeout, {
              mobile: true,
            });
            if (mobileResult.html) {
              mobileHtml = mobileResult.html;
              const cheerio = await import('cheerio');
              mobile$ = cheerio.load(mobileHtml);
            }
          } catch {
            // Mobile render failed; parity rules report unmeasured
          }
        }
      } catch {
        // CWV measurement failed, continue without it
      } finally {
        // Clean up Playwright browser (only when not using an injected fetcher)
        if (!this.options.browserFetcher) {
          await closeBrowser();
        }
      }
    }

    // Create audit context
    const context = createAuditContext(url, fetchResult, cwv);

    // Enrich with robots.txt, sitemap, and rendered DOM
    await this.enrichContext(context, url);
    if (renderedHtml) {
      context.renderedHtml = renderedHtml;
      context.rendered$ = rendered$;
    }
    if (renderDiagnostics) {
      context.renderDiagnostics = renderDiagnostics;
    }
    if (assets) {
      context.assets = assets;
    }
    if (mobileHtml) {
      context.mobileHtml = mobileHtml;
      context.mobile$ = mobile$;
    }

    // Run all categories
    const categoryResults = await this.runAllCategories(context);

    // Build and return final result
    const timestamp = new Date().toISOString();
    return buildAuditResult(
      url,
      categoryResults,
      this.categoriesToAudit,
      timestamp,
      1,
      buildPageSnapshot(context)
    );
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
    await this.ensureRulesLoaded();
    resetCrossPageState();

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
      renderPage: this.options.measureCwv
        ? async (pageUrl: string) => {
            try {
              const result = await fetcher(pageUrl, this.options.timeout);
              // `html` is what the JS-rendering rules read. Leaving it out here
              // is what made all eleven of them report "rendered DOM not
              // available" on every page of every crawl.
              return {
                cwv: result.cwv,
                html: result.html,
                diagnostics: result.diagnostics,
                assets: result.assets,
              };
            } catch {
              return { cwv: {} };
            }
          }
        : undefined,
    });

    // Crawl the site
    const crawledPages = await crawler.crawl(url, maxPages, concurrency);

    // Close Playwright browser if CWV was measured (only when not using an injected fetcher)
    if (this.options.measureCwv && !this.options.browserFetcher) {
      await closeBrowser();
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
        this.applySitemapData(crawledPage.context, sitemapData);
      }
    }

    // Aggregate results from all pages
    const allCategoryResults = await this.auditPages(crawledPages);

    // Build final result
    const timestamp = new Date().toISOString();
    return buildAuditResult(
      url,
      allCategoryResults,
      this.categoriesToAudit,
      timestamp,
      crawledPages.length
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
    const crawledPages = pages;
    // Collect all rule results per category across all pages
    const categoryRuleResults = new Map<string, RuleResult[]>();

    // Initialize map for each category
    for (const category of this.categoriesToAudit) {
      categoryRuleResults.set(category.id, []);
    }

    let pageNumber = 0;
    for (const crawledPage of crawledPages) {
      pageNumber++;

      // Skip pages with errors
      if (crawledPage.error) {
        this.options.onPageComplete(crawledPage.url, pageNumber, crawledPages.length);
        continue;
      }

      // Run categories for this page
      const pageResults = await this.runAllCategories(crawledPage.context);

      // Merge results into aggregated map
      for (const categoryResult of pageResults) {
        const existing = categoryRuleResults.get(categoryResult.categoryId);
        if (existing) {
          existing.push(...categoryResult.results);
        }
      }

      this.options.onPageComplete(crawledPage.url, pageNumber, crawledPages.length);
    }

    // Build final category results from aggregated data
    const finalResults: CategoryResult[] = [];
    for (const category of this.categoriesToAudit) {
      const results = categoryRuleResults.get(category.id) ?? [];
      finalResults.push(buildCategoryResult(category.id, results));
    }

    return finalResults;
  }

  /**
   * Run all categories against an audit context
   * @param context - The audit context to run rules against
   * @returns Array of CategoryResult
   */
  async runAllCategories(context: AuditContext): Promise<CategoryResult[]> {
    const results: CategoryResult[] = [];

    for (const category of this.categoriesToAudit) {
      // Notify start
      this.options.onCategoryStart(category.id, category.name);

      // Get rules for this category
      const rules = getRulesByCategory(category.id);
      const ruleResults: RuleResult[] = [];

      // Run each rule
      for (const rule of rules) {
        try {
          const result = await rule.run(context);
          // Inject ruleId, weight and page URL for consistent tracking.
          // A result that set its own weight keeps it — that is how
          // notMeasured() opts a result out of scoring with weight 0.
          const resultWithMeta: RuleResult = {
            ...result,
            ruleId: rule.id,
            weight: result.weight ?? rule.weight,
            details: {
              ...result.details,
              pageUrl: context.url,
            },
          };
          ruleResults.push(resultWithMeta);
          this.options.onRuleComplete(rule.id, rule.name, resultWithMeta);
        } catch (error) {
          // Rule threw an error, treat as fail
          const errorResult: RuleResult = {
            ruleId: rule.id,
            status: 'fail',
            message: `Rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            score: 0,
            weight: rule.weight,
            details: {
              pageUrl: context.url,
            },
          };
          ruleResults.push(errorResult);
          this.options.onRuleComplete(rule.id, rule.name, errorResult);
        }
      }

      // Build category result
      const categoryResult = buildCategoryResult(category.id, ruleResults);
      results.push(categoryResult);

      // Notify complete
      this.options.onCategoryComplete(category.id, category.name, categoryResult);
    }

    return results;
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
