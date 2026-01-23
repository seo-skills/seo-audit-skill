import type { CheerioAPI } from 'cheerio';

/**
 * Rule execution status
 */
export type RuleStatus = 'pass' | 'warn' | 'fail';

/**
 * Category definition for organizing audit rules
 */
export interface CategoryDefinition {
  /** Unique category identifier */
  id: string;
  /** Human-readable category name */
  name: string;
  /** Description of what this category audits */
  description: string;
  /** Weight as percentage (0-100) for scoring */
  weight: number;
}

/**
 * Core Web Vitals metrics
 */
export interface CoreWebVitals {
  /** Largest Contentful Paint in milliseconds */
  lcp?: number;
  /** First Input Delay in milliseconds */
  fid?: number;
  /** Cumulative Layout Shift score */
  cls?: number;
  /** Time to First Byte in milliseconds */
  ttfb?: number;
  /** First Contentful Paint in milliseconds */
  fcp?: number;
  /** Interaction to Next Paint in milliseconds */
  inp?: number;
}

/**
 * Link information extracted from the page
 */
export interface LinkInfo {
  /** Link href attribute */
  href: string;
  /** Link text content */
  text: string;
  /** Whether the link is internal or external */
  isInternal: boolean;
  /** Whether the link has nofollow rel attribute */
  isNoFollow: boolean;
  /** HTTP status code if checked */
  statusCode?: number;
}

/**
 * Image information extracted from the page
 */
export interface ImageInfo {
  /** Image src attribute */
  src: string;
  /** Image alt attribute */
  alt: string;
  /** Whether alt attribute is present */
  hasAlt: boolean;
  /** Image width attribute */
  width?: string;
  /** Image height attribute */
  height?: string;
  /** Whether image is lazy loaded */
  isLazyLoaded: boolean;
}

/**
 * Context passed to each audit rule's run function
 */
export interface AuditContext {
  /** The URL being audited */
  url: string;
  /** Raw HTML content of the page */
  html: string;
  /** Cheerio instance for DOM querying */
  $: CheerioAPI;
  /** HTTP response headers */
  headers: Record<string, string>;
  /** HTTP status code */
  statusCode: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Core Web Vitals metrics (if available) */
  cwv: CoreWebVitals;
  /** Links found on the page */
  links: LinkInfo[];
  /** Images found on the page */
  images: ImageInfo[];
}

/**
 * Result returned by an individual audit rule
 */
export interface RuleResult {
  /** Rule identifier */
  ruleId: string;
  /** Pass/warn/fail status */
  status: RuleStatus;
  /** Human-readable result message */
  message: string;
  /** Additional details about the result */
  details?: Record<string, unknown>;
  /** Score from 0-100 */
  score: number;
}

/**
 * Definition of an audit rule
 */
export interface AuditRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Description of what this rule checks */
  description: string;
  /** Category this rule belongs to */
  category: string;
  /** Weight within the category (0-100) */
  weight: number;
  /** Function that executes the rule and returns a result */
  run: (context: AuditContext) => RuleResult | Promise<RuleResult>;
}

/**
 * Aggregated results for a category
 */
export interface CategoryResult {
  /** Category identifier */
  categoryId: string;
  /** Calculated score for this category (0-100) */
  score: number;
  /** Number of rules that passed */
  passCount: number;
  /** Number of rules that warned */
  warnCount: number;
  /** Number of rules that failed */
  failCount: number;
  /** Individual rule results */
  results: RuleResult[];
}

/**
 * Complete audit result for a URL
 */
export interface AuditResult {
  /** URL that was audited */
  url: string;
  /** Overall score (0-100) */
  overallScore: number;
  /** Results grouped by category */
  categoryResults: CategoryResult[];
  /** Timestamp of when the audit was performed */
  timestamp: string;
  /** Number of pages crawled (if crawl mode enabled) */
  crawledPages: number;
}

/**
 * CLI options from command line arguments
 */
export interface CLIOptions {
  /** URL to audit */
  url: string;
  /** Categories to include (empty = all) */
  categories: string[];
  /** Output as JSON */
  json: boolean;
  /** Enable crawling mode */
  crawl: boolean;
  /** Maximum pages to crawl */
  maxPages: number;
  /** Concurrent requests */
  concurrency: number;
  /** Request timeout in milliseconds */
  timeout: number;
}

/**
 * Result of a crawl operation
 */
export interface CrawlResult {
  /** URLs that were crawled */
  urls: string[];
  /** Audit results for each page */
  pageResults: AuditResult[];
}
