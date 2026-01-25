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
   * Run a single-page audit
   * @param url - URL to audit
   * @returns AuditResult for the page
   */
  async audit(url: string): Promise<AuditResult> {
    await this.ensureRulesLoaded();

    // Fetch the page
    const fetchResult = await fetchPage(url, this.options.timeout);

    // Get Core Web Vitals if enabled
    let cwv: CoreWebVitals = {};
    if (this.options.measureCwv) {
      try {
        const pwResult = await fetchPageWithPlaywright(url, this.options.timeout);
        cwv = pwResult.cwv;
      } catch {
        // CWV measurement failed, continue without it
      } finally {
        // Clean up browser
        await closeBrowser();
      }
    }

    // Create audit context
    const context = createAuditContext(url, fetchResult, cwv);

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
          // Inject page URL into details for multi-page tracking
          const resultWithUrl: RuleResult = {
            ...result,
            details: {
              ...result.details,
              pageUrl: context.url,
            },
          };
          ruleResults.push(resultWithUrl);
          this.options.onRuleComplete(rule.id, rule.name, resultWithUrl);
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
