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
 * Invalid link information
 */
export interface InvalidLinkInfo {
  /** Raw href value */
  href: string;
  /** Reason it's invalid: 'empty' | 'javascript' | 'malformed' */
  reason: 'empty' | 'javascript' | 'malformed';
  /** Link text content */
  text: string;
}

/**
 * Special protocol link (tel:, mailto:)
 */
export interface SpecialLinkInfo {
  /** Protocol type */
  type: 'tel' | 'mailto';
  /** Raw href value */
  href: string;
  /** Extracted value (phone number or email) */
  value: string;
  /** Link text content */
  text: string;
  /** Whether format is valid */
  isValid: boolean;
  /** Validation issue if invalid */
  issue?: string;
}

/**
 * Figure element information
 */
export interface FigureInfo {
  /** Whether figure has a figcaption */
  hasFigcaption: boolean;
  /** Number of images inside the figure */
  imageCount: number;
  /** The figcaption text (if present) */
  captionText?: string;
}

/**
 * Inline SVG information
 */
export interface InlineSvgInfo {
  /** Size in bytes of the SVG markup */
  sizeBytes: number;
  /** Whether SVG has viewBox attribute */
  hasViewBox: boolean;
  /** Whether SVG has title element */
  hasTitle: boolean;
  /** Snippet of SVG for identification (first 100 chars) */
  snippet: string;
}

/**
 * Picture element information
 */
export interface PictureElementInfo {
  /** Whether picture has an img fallback */
  hasImgFallback: boolean;
  /** Number of source elements */
  sourceCount: number;
  /** The img src if present */
  imgSrc?: string;
  /** Source types defined (e.g., ['image/webp', 'image/avif']) */
  sourceTypes: string[];
}

/**
 * Redirect chain entry for tracking redirect hops
 */
export interface RedirectChainEntry {
  /** URL at this hop */
  url: string;
  /** HTTP status code at this hop */
  statusCode: number;
}

/**
 * One `<url>` entry from a sitemap
 */
export interface SitemapEntry {
  /** The URL itself */
  loc: string;
  /** Declared last modification date, as sent */
  lastmod?: string;
  /** Declared change frequency */
  changefreq?: string;
  /** Declared priority, 0.0-1.0 */
  priority?: number;
}

/**
 * Result of discovering and fetching a site's sitemap(s)
 */
export interface SitemapFetchResult {
  /** Raw XML of the first sitemap fetched */
  content?: string;
  /** Every page URL found, across nested sitemaps */
  urls: string[];
  /** Entries with their metadata */
  entries: SitemapEntry[];
  /** Sitemap documents actually fetched */
  sources: string[];
  /** Whether the entry point was a sitemap index */
  isIndex: boolean;
  /** Child sitemaps discovered but not fetched, because a limit was reached */
  skippedSitemaps: number;
}

/**
 * A cookie set by the server via a `Set-Cookie` response header.
 *
 * The value is never retained — only its length — because audit results are
 * written into shareable reports and passed to LLMs.
 */
export interface CookieInfo {
  /** Cookie name */
  name: string;
  /** Length of the value, kept instead of the value itself */
  valueLength: number;
  /** Secure attribute present */
  secure: boolean;
  /** HttpOnly attribute present */
  httpOnly: boolean;
  /** SameSite attribute, when set to a recognised value */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Domain attribute */
  domain?: string;
  /** Path attribute */
  path?: string;
  /** Expires attribute, as sent */
  expires?: string;
  /** Max-Age attribute in seconds */
  maxAge?: number;
}

/**
 * A console message emitted by the page while rendering
 */
export interface ConsoleMessageInfo {
  /** Console level, narrowed to the levels worth reporting */
  level: 'error' | 'warning';
  /** The message text */
  text: string;
  /** Script URL the message originated from, when known */
  sourceUrl?: string;
  /** Line number within the source, when known */
  line?: number;
}

/**
 * A subresource request that failed while rendering the page
 */
export interface FailedRequestInfo {
  /** URL that failed to load */
  url: string;
  /** What the page wanted it for: script, stylesheet, image, font, xhr, … */
  resourceType: string;
  /** HTTP method */
  method: string;
  /**
   * Why it failed. Either a browser-level error (`net::ERR_NAME_NOT_RESOLVED`)
   * or an HTTP error status rendered as `HTTP 404`.
   */
  failure: string;
  /** HTTP status, when the request completed with an error status */
  statusCode?: number;
}

/**
 * Errors and failed requests observed during a Playwright render.
 *
 * These are facts only a real browser can report — a static HTML parse cannot
 * tell you that a script 404'd or threw. Present only when rendering ran.
 */
export interface RenderDiagnostics {
  /** Uncaught exceptions thrown by page scripts */
  pageErrors: string[];
  /** console.error / console.warn output from the page */
  consoleMessages: ConsoleMessageInfo[];
  /** Subresources that failed to load */
  failedRequests: FailedRequestInfo[];
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
  /** Invalid links found on the page */
  invalidLinks: InvalidLinkInfo[];
  /** Special protocol links (tel:, mailto:) */
  specialLinks: SpecialLinkInfo[];
  /** Figure elements on the page */
  figures: FigureInfo[];
  /** Inline SVG elements */
  inlineSvgs: InlineSvgInfo[];
  /** Picture elements */
  pictureElements: PictureElementInfo[];
  /**
   * Cookies set by the server on this response.
   *
   * Optional because it is only recoverable from a live fetch: stored crawls
   * flatten headers into a string map, which comma-joins multiple Set-Cookie
   * headers into something that cannot be reliably split again.
   */
  cookies?: CookieInfo[];

  // --- Tier 2: Network-fetched data (optional) ---

  /** robots.txt content for the site (fetched once per audit) */
  robotsTxtContent?: string;
  /** Sitemap XML content (fetched once per audit) */
  sitemapContent?: string;
  /** URLs extracted from sitemap, including nested sitemaps under an index */
  sitemapUrls?: string[];
  /** Sitemap entries with lastmod / changefreq / priority metadata */
  sitemapEntries?: SitemapEntry[];
  /** Whether the site's entry-point sitemap is an index of other sitemaps */
  sitemapIsIndex?: boolean;
  /** Redirect chain followed to reach this page */
  redirectChain?: RedirectChainEntry[];

  // --- Tier 4: Rendered DOM (optional, requires Playwright) ---

  /** HTML after JavaScript rendering */
  renderedHtml?: string;
  /** Cheerio instance of rendered DOM */
  rendered$?: CheerioAPI;
  /** Errors and failed requests observed while rendering the page */
  renderDiagnostics?: RenderDiagnostics;

  // --- Mobile parity (optional, requires a second render at a mobile viewport) ---

  /** HTML after JavaScript rendering at a mobile viewport */
  mobileHtml?: string;
  /** Cheerio instance of the mobile-rendered DOM */
  mobile$?: CheerioAPI;
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
  /** Status score: 100 for pass, 50 for warn, 0 for fail */
  score: number;
  /**
   * The declared weight of the rule that produced this result, used to weight
   * the category average. Injected by the Auditor from `AuditRule.weight`;
   * results built by hand fall back to weight 1.
   */
  weight?: number;
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
