import type { CheerioAPI } from 'cheerio';
import type { UrlService } from './net/url-service.js';
import type { ExternalLinkCheck, ExternalLinksExtras } from './site/external-links.js';
import type { CodeCoverage } from './render/coverage.js';
import type { LinkScoreSummary } from './site/link-score.js';
import type { CustomResults } from './custom/custom-checks.js';

/**
 * Rule execution status.
 *
 * `not-measured` is a real status rather than a sentinel. It used to be encoded
 * as `status: 'warn'` with `weight: 0`, recovered by testing the weight — so
 * every consumer that branched on status alone (the markdown and LLM reporters
 * among them) reported checks that never ran as genuine warnings.
 *
 * Note for anyone reading stored history: three encodings exist in the
 * database. See `isNotMeasured()`.
 */
export type RuleStatus = 'pass' | 'warn' | 'fail' | 'not-measured';

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
  /**
   * Whether the anchor sits in site chrome (nav, header, footer) rather than
   * body copy. Absent on links built before this field existed.
   */
  inChrome?: boolean;
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
 * One sitemap document that was fetched. The protocol's limits (50,000 URLs,
 * 50 MB uncompressed) apply to each file, so an index is never the file to
 * judge: the sitemaps it lists are.
 */
export interface SitemapDocument {
  /** Document URL */
  url: string;
  /** `<url>` entries it lists; 0 for an index */
  urlCount: number;
  /** Decompressed size in bytes */
  bytes: number;
  /** Whether it is a sitemap index */
  isIndex: boolean;
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
  /** Every sitemap document fetched, in fetch order */
  documents: SitemapDocument[];
  /**
   * Which sitemap documents listed each page URL.
   *
   * Maps a page URL (`<loc>`) to the sitemap document URLs that declared it.
   * A URL appearing under several documents is how "URL in multiple XML
   * sitemaps" is detected. Omitted when nothing was fetched.
   */
  urlSources?: Map<string, string[]>;
  /**
   * Whether every sitemap the site declares was read in full. A rule that
   * needs the whole inventory ("no sitemap URL is an orphan") must not pass
   * on a partial one.
   */
  complete: boolean;
  /** Why the inventory is partial; empty when complete */
  gaps: SitemapGap[];
}

/** One reason a sitemap inventory is partial */
export type SitemapGap =
  /** A sitemap could not be fetched; `status` when the server answered */
  | { kind: 'fetch-failed'; url: string; status?: number }
  /** Fetched, but neither a urlset nor a sitemap index */
  | { kind: 'invalid'; url: string }
  /** More than 50,000 URLs: the rest were dropped */
  | { kind: 'truncated'; limit: number }
  /** Declared but never read, because a limit was reached first */
  | { kind: 'unread'; url: string };

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
  /**
   * True when the link was inside nav, header, or footer.
   * Absent when the crawl did not record placement.
   */
  chrome?: boolean;
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
  /** Crawled URL to the URL its redirects ended at, both normalised; only for URLs that redirect */
  redirectTargetByUrl?: Map<string, string>;
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
   * Resolved absolute canonical: `link[rel=canonical]`, else the HTTP `Link`
   * header. Null when declared but unresolvable; undefined when the page
   * declares no canonical.
   */
  canonical?: string | null;
  /** Google is told not to index: `noindex` or `none` in robots/googlebot meta or a Google-scoped X-Robots-Tag */
  noindex: boolean;
  /** Google is told not to follow links, read the same way as `noindex` */
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
  /** Document title, trimmed; undefined when absent or empty */
  title?: string;
  /** Visible word count, excluding nav, footer, and scripts */
  wordCount?: number;
  /** Coarse page kind used to compare a page with others of the same kind */
  pageKind?: 'article' | 'product' | 'other';
  /**
   * Compact JSON-LD nodes from this page, for crawl-wide identity checks.
   * Omitted when the page has no parseable typed nodes.
   */
  schemaNodes?: SchemaNodeSummary[];
  /** `<meta name="description">` content, trimmed; undefined when absent or empty */
  description?: string;
  /** `og:title` content, trimmed */
  ogTitle?: string;
  /** `og:description` content, trimmed */
  ogDescription?: string;
  /** Hash of the visible body text, for exact-duplicate detection; undefined below 50 characters */
  contentHash?: string;
  /**
   * Sorted hashed word trigrams of the first 500 words of main content, for
   * near-duplicate detection. Undefined when the page has under 100
   * characters of main content.
   */
  shingles?: Uint32Array;
  /** A later page of a series: `rel="prev"`, `/page/N`, `?page=N` and similar */
  isPaginated?: boolean;
  /**
   * The site was still rate-limiting this page after its retries. Its
   * `statusCode` is the last one seen (429 or 503); cross-page checks read
   * it as unknown, never as broken or missing.
   */
  rateLimited?: boolean;
}

/**
 * One typed JSON-LD node, reduced to the fields crawl-wide identity rules
 * compare. The page HTML is not retained.
 */
export interface SchemaNodeSummary {
  /** Raw @id when the node declared one */
  id?: string;
  /** @type values, one entry per type on the node */
  types: string[];
  /** name, when it is a string */
  name?: string;
  /** logo URL, when it is a string or an ImageObject url / @id */
  logo?: string;
  /** telephone, when it is a string */
  telephone?: string;
  /** Postal address flattened to one line, when the node declares one */
  address?: string;
  /** Absolute or raw @ids this node points at (publisher, author, isPartOf, ...) */
  refs: string[];
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
  /** Every sitemap document fetched, with its URL count and size */
  sitemapDocuments?: SitemapDocument[];
  /** Child sitemaps an index listed that were not fetched, because a limit was reached */
  sitemapSkippedCount?: number;
  /** `false` when the sitemap inventory is partial; see `SitemapFetchResult.gaps` */
  sitemapComplete?: boolean;
  sitemapGaps?: SitemapGap[];
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

  /**
   * The run's requests for URLs other than its pages, made once each.
   * Absent when a rule is called on its own; see `urlServiceFor()`.
   */
  urls?: UrlService;

  /** Every external link of the run, checked once each before rules run */
  externalLinks?: ExternalLinkCheck;

  /**
   * Results of the render probes, by probe id (see `render/probes.ts`).
   * Absent without a render; a probe that failed is absent from the record.
   */
  probes?: Record<string, unknown>;

  /** Script and stylesheet usage during the render; absent without one or on the desktop app */
  coverage?: CodeCoverage;

  /**
   * The run's clock, in ms since the epoch: when the audit or crawl started.
   * Every date comparison reads it, so a stored crawl replays against the
   * time it was taken. Absent when a rule is called on its own.
   */
  now?: number;
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
  /**
   * Set when `[rules.override]` named this rule. Changes ranking, report
   * placement and CI gating; never `status`, `score` or `weight`.
   */
  overridden?: RuleOverrideMark;
  /** Why a `not-measured` result took no reading; see {@link NotMeasuredReason} */
  reason?: NotMeasuredReason;
  /** From an advisory rule: reported, not counted in the score */
  advisory?: boolean;
}

/** Where an overridden finding ranks; `ignore` hides it from reports but not from JSON */
export type OverridePriority = 'high' | 'normal' | 'low' | 'ignore';

/** What `[rules.override]` changed about one rule's results */
export interface RuleOverrideMark {
  priority?: OverridePriority;
  /** A `fail` from this rule exits 1 whatever the score */
  failCi?: boolean;
}

/**
 * Why a run exits the way it does.
 *
 * Exit 1 means a gate failed: the score, a `fail_ci` rule, or a gated rule
 * that could not be evaluated. Exit 2 (usage, config or runtime) never gets
 * this far, so it has no gate.
 */
export interface AuditGate {
  /** The threshold the score was held to */
  failUnder: number;
  score: number;
  /** `fail_ci` rules that failed, with the pages they failed on */
  failedCiRules: Array<{ ruleId: string; pages: string[] }>;
  /** `fail_ci` rules that never produced a reading, so their gate could not pass */
  unevaluated: Array<{ ruleId: string; reason: string }>;
  /** The coverage gate, when one is set: percent of attempted pages measured */
  coverage?: { minCoverage: number; measured: number; attempted: number; percent: number; passed: boolean };
  /** `fail_ci` custom searches that failed, checked nothing, or were stopped by the regex time limit */
  failedCustomSearches?: Array<{ name: string; failing: number; checked: number; stopped: number }>;
  exitCode: 0 | 1;
  /** One line explaining a non-zero exit; absent when the run passes */
  reason?: string;
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
  /**
   * Options this rule reads, set per project under `rule_options."<id>"`.
   * Declared here so the config can be checked against them and `explain`
   * can list them; a key the rule does not declare is a config error.
   */
  options?: Record<string, RuleOptionSpec>;
  /**
   * Shown in every report, with an "Advisory" chip, but not counted in the
   * score yet. New rules start advisory and are promoted once their
   * verdicts have been checked on real sites.
   */
  advisory?: boolean;
  /**
   * Needs a browser render (`--cwv`). Without one the auditor reports the
   * rule not measured, reason `needs-render`, without running it, and the
   * console says how many checks a render would add.
   */
  requiresRender?: boolean;
  /**
   * Function that executes the rule and returns a result. The Auditor
   * always passes `options`: the rule's declared options, defaults merged
   * with the project's `rule_options`. A direct call (a test) may leave it
   * out, so a rule reads it through `readRuleOptions`.
   */
  run: (context: AuditContext, options?: RuleOptionValues) => RuleResult | Promise<RuleResult>;
}

/** One option a rule declares */
export interface RuleOptionSpec {
  type: 'number' | 'string' | 'boolean' | 'string[]';
  default: number | string | boolean | string[];
  /** Inclusive bounds, for numbers */
  min?: number;
  max?: number;
  description: string;
}

/** A rule's effective options: declared defaults merged with `rule_options` */
export type RuleOptionValues = Readonly<Record<string, number | string | boolean | readonly string[]>>;

/**
 * Why a check took no reading.
 *
 * - `not-applicable`: nothing to check on this page (the pattern is absent).
 * - `not-compared`: a cross-page check skipped this page on purpose
 *   (noindex, canonicalised elsewhere, paginated).
 * - `needs-render`: needs a browser render that this run did not do.
 * - `could-not-verify`: an outside resource could not be fetched reliably.
 * - `probe-failed`: the in-page script that measures it failed.
 * - `disabled`: turned off in the config.
 * - `unsupported`: the engine running this audit cannot do it.
 * - `rule-error`: the check itself crashed.
 *
 * Only `not-applicable` and `not-compared` mean "nothing was wrong to find";
 * the rest mean "could not look", which a CI gate must not read as a pass.
 */
export type NotMeasuredReason =
  | 'not-applicable'
  | 'not-compared'
  | 'needs-render'
  | 'could-not-verify'
  | 'probe-failed'
  | 'disabled'
  | 'unsupported'
  | 'rule-error';

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
  /**
   * Results from advisory rules that took a reading. Counted here and not in
   * pass/warn/fail, because they do not count toward the score yet.
   */
  advisoryCount?: number;
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

/**
 * Version of the shape `--format json` and the programmatic API emit.
 *
 * `renderJsonReport` is a bare `JSON.stringify` of `AuditResult`, so this type
 * *is* the public contract. Without a version a consumer cannot tell a 3.5.0
 * payload from a 3.6.0 one, and every semantic change below — a new status
 * value, a moved grade boundary, reordered findings — is a silent break.
 *
 * Bump on any change a consumer could notice. 1 is the shape shipped through
 * 3.5.0, so a payload with no `schemaVersion` should be read as 1.
 *
 * 3 added `gate` (why the run exits as it does), `warnings` and
 * `RuleResult.overridden`.
 * 4 added `RuleResult.reason` and `RuleResult.advisory`, and
 * `CategoryResult.advisoryCount`. A rule that crashes is now `not-measured`
 * with reason `rule-error`, not a `fail`.
 */
export const AUDIT_SCHEMA_VERSION = 4;

/**
 * The options an audit actually ran with.
 *
 * Lives here rather than in the storage layer because it belongs to the
 * result, not to how the result is persisted: two audits of the same site are
 * only comparable if they were measured the same way, and every surface needs
 * to be able to say so.
 */
export interface AuditRunOptions {
  crawl: boolean;
  maxPages: number;
  concurrency: number;
  measureCwv: boolean;
  mobile: boolean;
  simulateInteraction: boolean;
  categories: string[];
  /** Which scoring model produced the score. See SCORING_VERSION. */
  scoringVersion?: number;
  /** `rules.enable` patterns in force. Empty means every rule. */
  enableRules?: string[];
  /** `rules.disable` patterns in force. */
  disableRules?: string[];
  /**
   * Audited as a staging site: the noindex and robots.txt caps were waived
   * and a crawl ignored robots.txt. Recorded only when set, so an audit from
   * before the option existed reads as a production audit.
   */
  staging?: boolean;
  /**
   * `rule_options` values that differ from the rules' defaults, by rule id.
   * Recorded because a threshold change moves verdicts without the site
   * changing. Absent when every rule ran on its defaults.
   */
  ruleOptions?: Record<string, Record<string, unknown>>;
  timeout: number;
}

/**
 * What an audit covered, and how `categoryResults` is shaped.
 *
 * The two shapes are not interchangeable and the reporter cannot tell them
 * apart by inspection. A live crawl keeps one result per rule per page, so a
 * per-page filter is exact. A stored audit is aggregated to one result per
 * rule carrying page counts and a capped sample, so a per-page filter can only
 * see the sampled pages: it silently omitted whole pages from its list and
 * returned almost nothing for the pages it did offer.
 */
export interface AuditCoverage {
  /** Every page URL the audit covered, in crawl order. */
  pages: string[];
  /**
   * `per-page` when `categoryResults` holds one result per rule per page.
   * `aggregated` when it holds one result per rule with page counts.
   */
  detail: 'per-page' | 'aggregated';
  /**
   * What a crawl could not measure. Set on crawls only; absent fields are 0.
   * `measured` of `attempted` is the "measured 4 of 5 pages" line.
   */
  attempted?: number;
  measured?: number;
  /** Pages the site was still rate-limiting after their retries */
  rateLimited?: number;
  /** Pages that could not be fetched for another reason */
  failed?: number;
  /** Queued pages never requested: a host was given up, or the time limit hit */
  notFetched?: number;
}

/**
 * How a run ended. `completed-with-gaps` means it finished, but some pages
 * were rate-limited, failed or never fetched; the score covers the rest.
 */
export type CompletionState = 'completed' | 'completed-with-gaps';

/**
 * A page-level condition that holds the overall score at or below a ceiling,
 * whatever the categories average. See `src/score-caps.ts`.
 */
export interface ScoreCap {
  /** Stable identifier, e.g. `noindex`, for machines and tests */
  id: string;
  /** Highest overall score the page can show while the condition holds */
  ceiling: number;
  /** One sentence naming the condition, printed beside the score */
  reason: string;
}

export interface AuditResult {
  /** See {@link AUDIT_SCHEMA_VERSION}. Absent on payloads from 3.5.0 and earlier. */
  schemaVersion?: number;
  /**
   * How this audit was measured.
   *
   * Without it, a score is not comparable to another score. The CLI measures
   * Core Web Vitals by default and the desktop app does not, both write to the
   * same history, and `compare --fail-on-regression` could therefore fail a
   * build whose only change was which surface produced the baseline.
   *
   * Optional because audits stored before 3.6.0 do not carry it.
   */
  run?: AuditRunOptions;
  /** URL that was audited */
  url: string;
  /** Overall score (0-100), after any {@link AuditResult.scoreCap} */
  overallScore: number;
  /**
   * Present when a page-level condition held `overallScore` below the
   * weighted average of the categories. Records the average and every cap
   * that lowered it, so no surface shows a capped score unexplained.
   *
   * A crawl is capped only by its start page, and only when search engines
   * cannot index it. Absent on stored audits, which do not persist it yet.
   */
  scoreCap?: {
    /** The weighted category average the caps overrode */
    uncappedScore: number;
    /** The caps below that average, lowest ceiling first */
    caps: ScoreCap[];
  };
  /**
   * Caps a staging audit waived: the noindex and robots.txt conditions that
   * would hold the score down in production. A reminder of what to lift at
   * launch; `overallScore` does not reflect them.
   */
  waivedCaps?: ScoreCap[];
  /** Results grouped by category */
  categoryResults: CategoryResult[];
  /** Timestamp of when the audit was performed */
  timestamp: string;
  /** Number of pages crawled (if crawl mode enabled) */
  crawledPages: number;
  /**
   * The pages covered and the shape of `categoryResults`.
   *
   * Optional: audits stored before 3.6.0 do not carry it, and a reader that
   * lacks it must not assume per-page detail.
   */
  coverage?: AuditCoverage;
  /**
   * Page-level signals for the report's previews and outline.
   *
   * Optional: crawl runs cover many pages and have no single page to snapshot,
   * and a stored audit predating this field has none.
   */
  page?: PageSnapshot;
  /** How the run ended; see {@link CompletionState} */
  completionState?: CompletionState;
  /**
   * The CI verdict for this run: the score threshold, every `fail_ci` rule
   * that failed or could not be evaluated, and the exit code. Set by the
   * commands that exit on it (`audit`, `analyze`).
   */
  gate?: AuditGate;
  /**
   * Things the run did that a caller should know about but that are not
   * findings, such as a clamped argument. Also printed to stderr.
   */
  warnings?: string[];
  /**
   * Run-level data beyond the per-rule results, kept with a stored audit:
   * the `[rules.override]` marks, and the crawl-wide sections later steps
   * add. Null on an audit whose stored extras could not be read.
   */
  extras?: AuditExtras | null;
}

/**
 * Run-level data stored with an audit. Each section is optional; an audit
 * stored before a section existed simply lacks it.
 */
export interface AuditExtras {
  /** `[rules.override]` marks by rule id, so a stored audit shows them */
  overrides?: Record<string, RuleOverrideMark>;
  /** Broken external link targets with the pages that link to each */
  externalLinks?: ExternalLinksExtras;
  /** Internal Link Score, 0 to 100, by normalised page URL (crawls only) */
  linkScores?: Record<string, number>;
  /** The ten best-linked pages and the ten weakest indexable ones */
  linkScoreSummary?: LinkScoreSummary;
  /** Results of `[[custom.search]]` and `[[custom.extract]]` */
  custom?: CustomResults;
  /** A section that exceeded its size cap, replaced by this marker */
  [section: string]: unknown;
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
