import type {
  AuditContext,
  AuditResult,
  CategoryResult,
  RuleResult,
  CategoryDefinition,
  CoreWebVitals,
} from './types.js';
import { categories, getCategoryById } from './categories/index.js';
import { getRulesByCategory } from './rules/registry.js';
import { loadAllRules } from './rules/loader.js';
import {
  fetchPage,
  createAuditContext,
  fetchPageWithPlaywright,
  closeBrowser,
  Crawler,
  type CrawledPage,
} from './crawler/index.js';
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
 * Options for configuring the Auditor
 */
export interface AuditorOptions {
  /** Categories to audit (empty array = all categories) */
  categories?: string[];
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to measure Core Web Vitals with Playwright */
  measureCwv?: boolean;
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
 * Main Auditor class for running SEO audits
 */
export class Auditor {
  private options: Required<AuditorOptions>;
  private rulesLoaded = false;
  private categoriesToAudit: CategoryDefinition[] = [];

  constructor(options: AuditorOptions = {}) {
    this.options = {
      categories: options.categories ?? [],
      timeout: options.timeout ?? 30000,
      measureCwv: options.measureCwv ?? false,
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
            'User-Agent': 'SEOmatorBot/2.0 (+https://github.com/seo-skills/seo-audit-skill)',
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
   * Fetch sitemap content and extract URLs
   */
  private async fetchSitemap(url: string, robotsTxtContent?: string): Promise<{ content?: string; urls?: string[] }> {
    try {
      const urlObj = new URL(url);
      // Try to find sitemap URL from robots.txt first
      let sitemapUrl = `${urlObj.protocol}//${urlObj.host}/sitemap.xml`;
      if (robotsTxtContent) {
        const match = robotsTxtContent.match(/^Sitemap:\s*(.+)$/im);
        if (match) {
          sitemapUrl = match[1].trim();
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(sitemapUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'SEOmatorBot/2.0 (+https://github.com/seo-skills/seo-audit-skill)',
          },
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const content = await response.text();
          // Extract URLs from sitemap XML
          const urls: string[] = [];
          const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
          let locMatch;
          while ((locMatch = locRegex.exec(content)) !== null) {
            urls.push(locMatch[1]);
          }
          return { content, urls };
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      // Sitemap fetch failed, continue without it
    }
    return {};
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
    context.sitemapContent = sitemapData.content;
    context.sitemapUrls = sitemapData.urls;
  }

  /**
   * Run a single-page audit
   * @param url - URL to audit
   * @returns AuditResult for the page
   */
  async audit(url: string): Promise<AuditResult> {
    await this.ensureRulesLoaded();

    // Fetch the page
    const fetchResult = await fetchPage(url, this.options.timeout);

    // Get Core Web Vitals and rendered DOM if enabled
    let cwv: CoreWebVitals = {};
    let renderedHtml: string | undefined;
    let rendered$: import('cheerio').CheerioAPI | undefined;
    if (this.options.measureCwv) {
      try {
        const pwResult = await fetchPageWithPlaywright(url, this.options.timeout);
        cwv = pwResult.cwv;
        // Capture rendered HTML for JS rendering rules
        if (pwResult.html) {
          renderedHtml = pwResult.html;
          const cheerio = await import('cheerio');
          rendered$ = cheerio.load(renderedHtml);
        }
      } catch {
        // CWV measurement failed, continue without it
      } finally {
        // Clean up browser
        await closeBrowser();
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

    // Run all categories
    const categoryResults = await this.runAllCategories(context);

    // Build and return final result
    const timestamp = new Date().toISOString();
    return buildAuditResult(url, categoryResults, this.categoriesToAudit, timestamp, 1);
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

    // Pre-fetch robots.txt and sitemap once for the entire crawl
    const robotsTxtContent = await this.fetchRobotsTxt(url);
    const sitemapData = await this.fetchSitemap(url, robotsTxtContent);

    // Create crawler with CWV callback if enabled
    const crawler = new Crawler({
      maxPages,
      concurrency,
      timeout: this.options.timeout,
      getCwv: this.options.measureCwv
        ? async (pageUrl: string) => {
            try {
              const result = await fetchPageWithPlaywright(pageUrl, this.options.timeout);
              return result.cwv;
            } catch {
              return {};
            }
          }
        : undefined,
    });

    // Crawl the site
    const crawledPages = await crawler.crawl(url, maxPages, concurrency);

    // Close browser if CWV was measured
    if (this.options.measureCwv) {
      await closeBrowser();
    }

    // Enrich each crawled page context with shared data
    for (const crawledPage of crawledPages) {
      if (crawledPage.context) {
        crawledPage.context.robotsTxtContent = robotsTxtContent;
        crawledPage.context.sitemapContent = sitemapData.content;
        crawledPage.context.sitemapUrls = sitemapData.urls;
      }
    }

    // Aggregate results from all pages
    const allCategoryResults = await this.aggregateCrawlResults(crawledPages);

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
   * Aggregate results from multiple crawled pages
   */
  private async aggregateCrawlResults(
    crawledPages: CrawledPage[]
  ): Promise<CategoryResult[]> {
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
          // Inject ruleId and page URL for consistent tracking
          const resultWithMeta: RuleResult = {
            ...result,
            ruleId: rule.id,
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
