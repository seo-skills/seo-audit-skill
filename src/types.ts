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
  /**
   * True when `inp` came from a synthetic interaction the crawler performed
   * rather than a real user. A synthetic INP reflects whichever element the
   * crawler happened to click, so it is indicative only — never field data.
   */
  inpSynthetic?: boolean;
  /** Total Blocking Time in milliseconds (long-task time beyond 50ms, after FCP) */
  tbt?: number;
  /** CSS selector of the element that produced the Largest Contentful Paint */
  lcpElement?: string;
  /** CSS selector of the element behind the single largest layout shift */
  clsLargestShiftTarget?: string;
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
  /**
   * Which sitemap documents listed each page URL.
   *
   * Maps a page URL (`<loc>`) to the sitemap document URLs that declared it.
   * A URL appearing under several documents is how "URL in multiple XML
   * sitemaps" is detected. Omitted when nothing was fetched.
   */
  urlSources?: Map<string, string[]>;
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
 * Per-subresource response data captured during a Playwright render.
 *
 * Rules otherwise see only the page's own response (`context.headers`); this
 * carries the same kind of facts for each CSS/JS/image/font the render loaded.
 * The page's main document is not included — it is not an asset.
 */
export interface AssetInfo {
  /** Final URL after redirects */
  url: string;
  /** Playwright `request.resourceType()`: 'stylesheet' | 'script' | 'image' | 'font' | … */
  resourceType: string;
  /** Final HTTP status */
  statusCode: number;
  /**
   * Response headers, lowercased keys. Only cache/encoding/length/type-relevant
   * ones are kept (cache-control, content-encoding, content-length,
   * content-type, expires, age, etag) to bound memory on asset-heavy pages.
   */
  headers: Record<string, string>;
  /** Redirect chain statuses if the request was redirected (empty array otherwise) */
  redirectChain: Array<{ url: string; statusCode: number }>;
  /** True when the request looped back to a URL already in its own chain */
  redirectLoop: boolean;
  /**
   * Transfer size in bytes when known (encoded body size).
   *
   * Currently never populated: Playwright exposes no transfer-size metric on a
   * completed response without fetching the body again (`response.body()`), and
   * double-fetching every subresource would distort the very page load being
   * measured. Rules should fall back to the `content-length` header when present.
   */
  transferBytes?: number;
}

/**
 * A site-wide view of the crawl, available to rules in crawl mode.
 *
 * Rules receive one page at a time, so questions that span pages — is anything
 * linking to this page, how many clicks from the entry point is it — cannot be
 * answered from AuditContext alone. This is the shared graph built once per
 * crawl and attached to every page's context.
 *
 * All keys are normalised through `normalize`, the same normalisation the
 * crawler used to dedupe URLs, so lookups line up with what was actually
 * crawled. Look a URL up with `normalize(url)` rather than the raw string.
 */
/**
 * How the crawl first learned about a URL.
 *
 * A URL can carry several sources — being linked does not stop it also being
 * in the sitemap. The isolated-URL hints look for URLs whose sources never
 * include `link`.
 */
export type DiscoverySource = 'link' | 'canonical' | 'redirect' | 'sitemap' | 'entry';

/**
 * One inbound link edge: who links to a URL, and how.
 *
 * Complements `SiteContext.inboundLinksByUrl` (which only says WHO links) with
 * the two facts anchor- and nofollow-related rules need per edge.
 */
export interface InboundEdge {
  /** Normalised URL of the page carrying the link */
  from: string;
  /** Whether the link carries a nofollow rel attribute */
  nofollow: boolean;
  /** The link's anchor text, trimmed; empty when the link has no text */
  anchor: string;
}

export interface SiteContext {
  /** The URL the crawl started from, normalised */
  entryUrl: string;
  /** Number of pages successfully crawled */
  pageCount: number;
  /** Click distance from the entry URL, by normalised URL */
  depthByUrl: Map<string, number>;
  /** Normalised URLs that link TO each normalised URL */
  inboundLinksByUrl: Map<string, Set<string>>;
  /** Internal normalised URLs each normalised URL links OUT to */
  outboundLinksByUrl: Map<string, Set<string>>;
  /** Normalise a URL into the key form used by the maps above */
  normalize: (url: string) => string;
  /**
   * Per-URL crawl state, one record per fetched page, keyed by normalised URL.
   *
   * Present only in crawl mode. Lets rules answer cross-page questions the
   * link graph cannot — did this sitemap URL return a 404, is this page's
   * canonical target noindex, is this hreflang target robots.txt-disallowed.
   */
  pages?: Map<string, SitePageInfo>;
  /**
   * How each URL was discovered, by normalised URL. A URL present in the
   * sitemap but never anchor-linked carries `sitemap` without `link` — that
   * combination is what isolated-URL rules look for. Sitemap entries are
   * marked by the Auditor after the crawl (the crawler never fetches
   * sitemaps); the rest are marked by the crawler itself.
   */
  discoverySourceByUrl?: Map<string, Set<DiscoverySource>>;
  /**
   * Inbound link edges with per-edge metadata, keyed by normalised target
   * URL. Same filtering as `inboundLinksByUrl` (internal, same-domain, no
   * self-links); a page linking twice to the same target yields two edges.
   */
  inboundEdgesByUrl?: Map<string, InboundEdge[]>;
}

/**
 * What the crawler learned about one fetched page, distilled to primitives so
 * a large crawl does not retain per-page HTML.
 *
 * Recorded for every page the crawler produced a result for, including pages
 * whose fetch failed: those carry `statusCode: 0` and defaults elsewhere,
 * which is exactly what sitemap cross-reference rules need to spot timeouts.
 */
export interface SitePageInfo {
  /** Final HTTP status of the page fetch; 0 when it failed or timed out */
  statusCode: number;
  /**
   * Resolved absolute target of `link[rel=canonical]`. Null when the tag was
   * declared but its href could not be resolved against the page URL;
   * undefined when the page declares no canonical.
   */
  canonical?: string | null;
  /** `noindex` (or `none`) in the meta robots tag or X-Robots-Tag header */
  noindex: boolean;
  /** `nofollow` (or `none`) in the meta robots tag or X-Robots-Tag header */
  nofollow: boolean;
  /**
   * Whether robots.txt disallows this URL. Best-effort: the crawler only
   * keeps a robots matcher when `respectRobots` is on and robots.txt was
   * reachable, so this is false whenever the answer is unknown.
   */
  disallowed: boolean;
  /** hreflang code → resolved absolute target URL, from `link[rel=alternate][hreflang]` */
  hreflangOut: Record<string, string>;
  /** Text of the first `<h1>`, trimmed; undefined when absent or empty */
  h1?: string;
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
  /**
   * Which sitemap documents listed each sitemap URL (page URL → sitemap
   * document URLs), for detecting URLs declared in multiple sitemaps.
   */
  sitemapUrlSources?: Map<string, string[]>;
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
  /**
   * Per-subresource response data observed while rendering the page
   * (status, cache headers, redirect chains). Present only when a render ran.
   */
  assets?: AssetInfo[];

  // --- Mobile parity (optional, requires a second render at a mobile viewport) ---

  /** HTML after JavaScript rendering at a mobile viewport */
  mobileHtml?: string;
  /** Cheerio instance of the mobile-rendered DOM */
  mobile$?: CheerioAPI;

  // --- Site graph (present in crawl mode only) ---

  /**
   * Site-wide link graph and click depths, shared across every page of a
   * crawl. Absent for single-page audits, where cross-page questions cannot
   * be answered.
   */
  site?: SiteContext;

  // --- Run control ---

  /**
   * Fires when the run is cancelled. Rules that make their own requests pass
   * it to `fetchUrl()` so an in-flight check stops with the run instead of
   * finishing in the background.
   */
  signal?: AbortSignal;
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
  /** Number of rules that warned. Excludes checks that could not be measured. */
  warnCount: number;
  /** Number of rules that failed */
  failCount: number;
  /**
   * Number of checks that could not take a reading (weight 0), and so
   * contribute to neither the score nor the warning count. Optional because
   * audits stored before this field existed do not carry it.
   */
  notMeasuredCount?: number;
  /** Individual rule results */
  results: RuleResult[];
}

/**
 * Complete audit result for a URL
 */
/** One entry in the rendered heading outline */
export interface SnapshotHeading {
  /** Heading level, 1-6 */
  level: number;
  /** Visible heading text */
  text: string;
}

/**
 * Page-level signals captured for reporting, independent of any rule result.
 *
 * Reporters need the title, social tags and heading outline to draw previews.
 * Reading them from rule `details` would couple the reporters to each rule's
 * internal shape, so they are captured once from the parsed document instead.
 */
export interface PageSnapshot {
  title?: string;
  description?: string;
  canonical?: string;
  og: {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    type?: string;
  };
  twitterCard?: string;
  /** Heading outline in document order */
  headings: SnapshotHeading[];
  metrics: {
    wordCount: number;
    internalLinks: number;
    externalLinks: number;
    images: number;
    /** Body text length as a percentage of total HTML length */
    textRatio: number;
  };
}

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
  /**
   * Page-level signals for the report's previews and outline.
   *
   * Optional: crawl runs cover many pages and have no single page to snapshot,
   * and a stored audit predating this field has none.
   */
  page?: PageSnapshot;
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
