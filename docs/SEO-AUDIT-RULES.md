# SEO Audit Rules Reference

> **Type:** Reference

This is the catalog of every check SEOmator runs: **373 rules** across **20 categories**. For each rule it lists the ID, the name reports print, the rule's weight, the result it gives when it finds a problem, and what it checks. Rules that need more than one line also have a details entry below their category table. The rule IDs are the values that `[rules] enable` and `[rules] disable` in `seomator.toml` match.

## How to read this reference

### Rule results

Every rule returns one result for each audited page.

| Status | Score | Effect on the category score |
|--------|------:|------------------------------|
| `pass` | 100 | Counts at the rule's weight |
| `warn` | 50 | Counts at the rule's weight |
| `fail` | 0 | Counts at the rule's weight |
| `not-measured` | none | Weight 0: left out of every average |

A rule reports `not-measured` when its input is missing: the audit skipped the browser render (`--no-cwv`), the check compares pages and the audit was not a crawl, or the page has nothing for the rule to grade. In JSON output such a result still carries `"score": 50`, next to `"weight": 0`, and the weight keeps it out of the score. A rule that throws an error is recorded as `fail`.

To read individual results, filter the JSON report by rule ID:

```bash
seomator audit https://example.com --no-cwv --no-save --format json \
  | jq '.categoryResults[].results[]
        | select(.ruleId == "core-title-present" or .ruleId == "core-title-unique")
        | {ruleId, status, score, weight, message}'
```

```json
{
  "ruleId": "core-title-present",
  "status": "pass",
  "score": 100,
  "weight": 25,
  "message": "Title tag is present"
}
{
  "ruleId": "core-title-unique",
  "status": "not-measured",
  "score": 50,
  "weight": 0,
  "message": "Title uniqueness needs other pages to compare against - run with --crawl"
}
```

### Rule weight and category weight

- **Rule weight** (the Weight column, 1 to 25) sets how much a rule counts inside its category. The category score is the average of the category's rule scores, each multiplied by its rule weight, rounded to a whole number. In Core, `core-title-present` (weight 25) counts 25 times as much as `core-title-length` (weight 1). In a crawl, the results from every page are pooled before the average is taken.
- **Category weight** (the table under [Categories and weights](#categories-and-weights), summing to 100) sets how much a category counts in the overall score, which is the weighted average of the category scores. A category left out with `-c`, or with every rule switched off by `[rules]` patterns, does not count, and the remaining category weights are rescaled.

Page-level score caps can hold the overall score lower still. See [Score Calculation](#score-calculation).

### Table columns

- **Rule ID**: the identifier used in reports, JSON output and `[rules]` patterns.
- **Name**: the name reports print.
- **Weight**: the rule weight.
- **Severity**: the result the rule gives when its check finds a problem: `warn`, `fail`, or `warn/fail` when it depends on how far the page is off. `pass only` marks a rule that reports a finding without ever lowering the score. `not measured` marks a rule that never scores in an audit.
- **Description**: what the rule checks. A suffix marks a rule that reports `not-measured` unless the audit runs a certain way: `(requires --crawl)`; `(requires render; not measured with --no-cwv)` for rules that read the browser render that `--no-cwv` skips; `(requires --mobile)` for the mobile parity rules, which also need that render.

## Categories and weights

| Category | ID | Weight | Covers |
|----------|----|-------:|--------|
| [Core](#core) | `core` | 11% | Meta tags, canonical, H1, indexing directives |
| [Performance](#perf) | `perf` | 10% | Core Web Vitals and performance hints |
| [Links](#links) | `links` | 8% | Internal and external links, anchor text, validation |
| [Images](#images) | `images` | 8% | Alt text, dimensions, lazy loading, optimization |
| [Security](#security) | `security` | 8% | HTTPS, security headers, mixed content, cookie flags |
| [Technical SEO](#technical) | `technical` | 7% | robots.txt, sitemap, status codes, URL structure |
| [Crawlability](#crawl) | `crawl` | 5% | Indexability signals, sitemap conflicts, pagination, sitemap lastmod |
| [Structured Data](#schema) | `schema` | 5% | JSON-LD, microdata and RDFa, Schema.org types |
| [Content](#content) | `content` | 5% | Text quality, readability, headings, duplicates |
| [JavaScript Rendering](#js) | `js` | 5% | Rendered DOM, raw versus rendered differences, console errors |
| [Accessibility](#a11y) | `a11y` | 7% | WCAG checks, ARIA, keyboard navigation |
| [Social](#social) | `social` | 3% | Open Graph, Twitter Cards, social profiles |
| [E-E-A-T](#eeat) | `eeat` | 3% | Experience, Expertise, Authority, Trust signals |
| [URL Structure](#url) | `url` | 3% | Slug keywords, formatting, parameters |
| [Redirects](#redirect) | `redirect` | 3% | Redirect types, chains, loops |
| [Mobile](#mobile) | `mobile` | 2% | Font size, viewport, mobile parity |
| [Internationalization](#i18n) | `i18n` | 2% | Language declarations, hreflang validation |
| [HTML Validation](#htmlval) | `htmlval` | 2% | DOCTYPE, charset, head structure |
| [AI/GEO Readiness](#geo) | `geo` | 2% | Semantic HTML, AI bot access, llms.txt |
| [Legal Compliance](#legal) | `legal` | 1% | Cookie consent |

The ID is the value `-c` takes and the prefix of every rule ID in the category. The five Core Web Vitals rules in Performance are the exception: their IDs start with `cwv-`.

## Rules by category

<a id="core"></a>

### Core (24 rules)

Essential SEO checks for meta tags, canonical URLs, H1 headings, and indexing directives.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `core-title-present` | Title Tag Present | 25 | fail | Checks for a non-empty `<title>`; a `<title>` inside inline SVG does not count |
| `core-title-length` | Title Tag Length | 1 | warn/fail | Validates title length (30-60 characters) |
| `core-description-present` | Meta Description Present | 15 | fail | Checks for `<meta name="description">` |
| `core-description-length` | Meta Description Length | 1 | warn | Validates description length (120-160 characters) |
| `core-canonical-present` | Canonical URL Present | 10 | fail | Checks for `<link rel="canonical">` |
| `core-canonical-valid` | Canonical URL Valid | 1 | warn/fail | Checks the canonical href is an absolute http(s) URL; a page without a canonical warns |
| `core-viewport-present` | Viewport Meta Tag Present | 20 | fail | Checks for viewport meta tag |
| `core-favicon-present` | Favicon Present | 1 | fail | Checks for favicon link tags |
| `core-h1-present` | H1 Tag Present | 15 | fail | Checks for at least one `<h1>` tag |
| `core-h1-single` | Single H1 Tag | 1 | warn/fail | Validates only one `<h1>` per page |
| `core-canonical-header` | Canonical Header Validation | 7 | warn | Detects mismatch between HTML canonical and HTTP Link header |
| `core-nosnippet` | Nosnippet Directive | 7 | warn | Detects pages blocking search engine snippets |
| `core-robots-meta` | Robots Meta | 5 | warn | Checks for noindex, nofollow, noarchive directives |
| `core-title-unique` | Title Uniqueness | 5 | warn/fail | Checks titles are unique across crawled pages; a page without a title fails (requires --crawl) |
| `core-canonical-conflicting` | Conflicting Canonical URLs | 8 | fail | Fails when the HTML canonical and the Link header canonical point to different URLs |
| `core-canonical-to-homepage` | Canonical Pointing to Homepage | 6 | fail | Flags deep pages canonicalizing to homepage |
| `core-canonical-http-mismatch` | Canonical Protocol Mismatch | 7 | fail | Detects protocol mismatch between page and canonical |
| `core-canonical-loop` | Canonical Loop Detection | 7 | warn | Warns when the canonical points to another URL, which could point back; the target is not fetched |
| `core-canonical-to-noindex` | Canonical and Noindex Conflict | 7 | warn | Warns when a noindex page has a canonical pointing to a different URL |
| `core-canonical-outside-head` | Canonical Outside Head | 8 | fail | Detects `<link rel="canonical">` elements placed outside the `<head>` |
| `core-canonical-attributes` | Canonical Attributes | 7 | warn/fail | Checks canonical elements carry only `rel` and `href` attributes |
| `core-canonical-multiple` | Multiple Canonical Tags | 6 | warn/fail | Detects multiple canonical elements in the HTML and whether they agree |
| `core-robots-directive-mismatch` | Robots Directive Mismatch | 5 | warn/fail | Checks robots directives in meta tags and the X-Robots-Tag header are consistent |
| `core-canonical-external` | Canonical Points To External URL | 1 | pass only | Reports when the canonical URL points to a different host (insight; legitimate for syndication) |

#### core-title-present
- **What it checks:** A non-empty `<title>` element exists. A `<title>` inside inline SVG does not count. A missing or empty title fails.
- **Fix:** Add `<title>Page Title</title>` in `<head>`

#### core-title-length
- **Optimal:** 30-60 characters. Too short is vague; too long gets truncated in SERPs.

#### core-description-present
- **What it checks:** `<meta name="description" content="...">` exists
- **Fix:** Add a compelling meta description summarizing the page

#### core-description-length
- **Optimal:** 120-160 characters. Shorter is incomplete; longer gets truncated.

#### core-canonical-present
- **What it checks:** `<link rel="canonical" href="...">` exists
- **Fix:** Add a self-referencing canonical URL on every page

#### core-canonical-valid
- **What it checks:** The first canonical `href` parses as an absolute `http:` or `https:` URL. An empty or relative href fails; a page with no canonical warns. The URL is not fetched.

#### core-viewport-present
- **Fix:** Add `<meta name="viewport" content="width=device-width, initial-scale=1">`

#### core-favicon-present
- **What it checks:** A `<link rel="icon">` or `<link rel="shortcut icon">` with a non-empty `href`. A missing element, or one with an empty `href`, fails. `apple-touch-icon` alone does not count.
- **Recommended formats:** .ico (legacy), .svg (modern); add apple-touch-icon for iOS alongside them.

#### core-h1-present / core-h1-single
- **Fix:** Add exactly one descriptive `<h1>` per page representing the main topic. Convert extra H1s to H2.

#### core-canonical-header
- **What it checks:** Compares HTML `<link rel="canonical">` with HTTP Link header
- **Fix:** Use HTML canonical only; reserve Link header for non-HTML resources (PDFs)

#### core-nosnippet
- **Detects:** `nosnippet`, `max-snippet:0` in robots meta tags and X-Robots-Tag header
- **Fix:** Remove nosnippet unless needed for sensitive content

#### core-robots-meta
- **Detects:** noindex, nofollow, noarchive, noimageindex, none in meta tags and X-Robots-Tag
- **Fix:** Remove restrictive directives unless intentionally blocking search engines

#### core-title-unique
- **What it checks:** Duplicate titles across crawled pages, compared without case or extra whitespace. The first page with a title passes; each later page with the same title warns. A page with no title fails. A single-page audit reports it not measured.
- **Fix:** Create unique titles using pattern "Page Topic | Brand Name"

#### core-canonical-conflicting
- **What it checks:** The HTML `<link rel="canonical">` and the canonical in the HTTP `Link` header point to different URLs (compared lowercase, without a trailing slash). The sitemap is not consulted. Only one source present passes.
- **Fix:** Ensure all canonical signals agree on the same URL

#### core-canonical-to-homepage
- **What it checks:** Non-homepage pages with canonical pointing to the homepage
- **Fix:** Set self-referencing canonical on each page

#### core-canonical-http-mismatch
- **What it checks:** HTTPS page with HTTP canonical URL (or vice versa)
- **Fix:** Match the canonical protocol to the page protocol (prefer HTTPS)

#### core-canonical-loop
- **What it checks:** Whether the canonical points to a URL other than this page (compared lowercase, without a trailing slash). Any such canonical warns, because the target might point back. The target is not fetched; `crawl-canonical-loop` follows real loops in a crawl.
- **Fix:** Use a self-referencing canonical, or confirm the target does not canonicalize back to this page

#### core-canonical-to-noindex
- **What it checks:** This page carries `noindex` (robots or googlebot meta tag, or X-Robots-Tag) and its canonical points to a different URL, so the two signals conflict. A self-referencing canonical passes. The target page is not fetched; `crawl-canonical-to-noindex` checks targets in a crawl.
- **Fix:** Remove the noindex so the canonical can take effect, or remove the canonical and keep noindex if the page should stay out of the index

#### core-canonical-outside-head
- **What it checks:** `<link rel="canonical">` elements placed outside the `<head>` (e.g. in the `<body>`), which search engines ignore entirely
- **Fix:** Move the canonical element into the `<head>`

#### core-canonical-attributes
- **What it checks:** Canonical elements carrying attributes other than `rel` and `href`. `hreflang`, `lang`, `media`, or `type` change the element's semantics and cause search engines to ignore it (fail); any other extra attribute is superfluous (warn)
- **Fix:** Simplify the canonical element to only `rel` and `href`; use alternate annotations (e.g. hreflang links) where appropriate

#### core-canonical-multiple
- **What it checks:** More than one `<link rel="canonical">` in the same document. URLs that disagree fail (search engines may ignore the canonical entirely); identical duplicates warn
- **Fix:** Keep a single canonical element pointing at the correct URL

#### core-robots-directive-mismatch
- **What it checks:** Index/follow directives from meta robots tags vs the X-Robots-Tag header. Fails when one location declares index/follow and the other noindex/nofollow (the most restrictive wins); warns when noindex or nofollow is declared in more than one location
- **Fix:** Declare robots directives in one location only and make them agree

#### core-canonical-external
- **What it checks:** Insight-level: the canonical URL points to a different host. Cross-domain canonicals are the legitimate mechanism for content syndication and consolidating duplicates across owned domains, but the page cedes its ranking signals to the other host. Always passes; the finding travels in the message so the intent can be confirmed
- **Fix:** No action required; verify the external canonical target is deliberate

---

<a id="perf"></a>

### Performance (28 rules)

Core Web Vitals measurements and static performance optimization hints.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `cwv-lcp` | Largest Contentful Paint (LCP) | 25 | warn/fail | Largest Contentful Paint: under 2.5s passes, over 4.0s fails (requires render; not measured with --no-cwv) |
| `cwv-cls` | Cumulative Layout Shift (CLS) | 25 | warn/fail | Cumulative Layout Shift: under 0.1 passes, over 0.25 fails (requires render; not measured with --no-cwv) |
| `cwv-inp` | Interaction to Next Paint (INP) | 20 | not measured | Interaction to Next Paint. Not scored: an audit has no real user input, and `--simulate-interaction` gives an indicative value only |
| `cwv-ttfb` | Time to First Byte (TTFB) | 15 | warn/fail | Time to First Byte: under 800ms passes, over 1800ms fails (requires render; not measured with --no-cwv) |
| `cwv-fcp` | First Contentful Paint (FCP) | 15 | warn/fail | First Contentful Paint: under 1.8s passes, over 3.0s fails (requires render; not measured with --no-cwv) |
| `perf-dom-size` | DOM Size | 15 | warn/fail | Checks DOM node count, depth, and children |
| `perf-css-file-size` | CSS File Size | 10 | warn/fail | Checks external CSS count and inline CSS size |
| `perf-font-loading` | Font Loading | 15 | warn/fail | Checks font-display, preload, display=swap |
| `perf-preconnect` | Preconnect Hints | 15 | warn | Checks preconnect to critical third-party origins |
| `perf-render-blocking` | Render-Blocking Resources | 20 | warn/fail | Checks scripts in head without async/defer |
| `perf-lazy-above-fold` | Lazy Loading Above Fold | 15 | warn/fail | Detects lazy loading on above-fold images |
| `perf-lcp-hints` | LCP Optimization Hints | 10 | warn/fail | Checks LCP candidate for preload and fetchpriority |
| `perf-text-compression` | Text Compression | 8 | warn | Checks the page response is compressed (gzip, br, deflate or zstd) |
| `perf-brotli` | Brotli Compression | 5 | warn | Checks for Brotli over gzip for better ratios |
| `perf-cache-policy` | Cache Policy | 7 | warn | Checks the page response for caching headers (Cache-Control, ETag, Last-Modified, Expires); none at all warns |
| `perf-minify-css` | Minify Inline CSS | 5 | warn | Checks inline CSS is minified; with render data, also flags large external stylesheets lacking a `.min.` URL marker (heuristic) |
| `perf-minify-js` | Minify Inline JS | 5 | warn | Checks inline JavaScript is minified; with render data, also flags large external scripts lacking a `.min.` URL marker (heuristic) |
| `perf-asset-cache-policy` | Static Asset Cache Policy | 6 | warn | Per-asset check: static CSS/JS/image/font responses carry a cache-control max-age of at least 1 hour (requires render; not measured with --no-cwv) |
| `perf-asset-compression` | Text Asset Compression | 6 | warn | Per-asset check: text-based assets over 2KB are served with gzip/Brotli (requires render; not measured with --no-cwv) |
| `perf-image-encoding` | Efficient Image Encoding | 6 | warn/fail | Per-asset check: images transferred over 100KB (warn) or served in legacy BMP/TIFF formats (fail) (requires render; not measured with --no-cwv) |
| `perf-response-time` | Response Time | 7 | warn/fail | Measures server response time for the page |
| `perf-http2` | HTTP/2+ Support | 5 | warn | Warns when the response has no `alt-svc` header; the negotiated protocol is not checked |
| `perf-page-weight` | Page Weight | 8 | warn/fail | Size of the HTML document: over 100KB warns, over 300KB fails |
| `perf-js-file-size` | Inline JS Size | 5 | warn/fail | Total inline JavaScript in `<script>` tags without `src`: over 50KB warns, over 150KB fails |
| `perf-video-for-animations` | Video for Animations | 4 | warn | Warns on any GIF image and suggests `<video>`; it cannot tell whether the GIF is animated |
| `perf-legacy-javascript` | Legacy JavaScript | 5 | warn | Detects polyfills and transpiler runtimes modern browsers do not need |
| `perf-duplicate-js` | Duplicate JavaScript Libraries | 4 | warn | A known library is not loaded from more than one script URL |
| `perf-source-maps` | Exposed Source Maps | 2 | warn | No sourceMappingURL comment or SourceMap header |

#### Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | < 2.5s | 2.5-4.0s | > 4.0s |
| CLS | < 0.1 | 0.1-0.25 | > 0.25 |
| INP (not scored) | < 200ms | 200-500ms | > 500ms |
| TTFB | < 800ms | 800-1800ms | > 1800ms |
| FCP | < 1.8s | 1.8-3.0s | > 3.0s |

#### cwv-lcp / cwv-cls / cwv-inp / cwv-ttfb / cwv-fcp
- **Measured in a headless Chromium-based browser** through Playwright. Under `--no-cwv` all five report not measured, and so does any metric the render did not capture.
- **INP is not scored.** An automated audit has no real user input, so `cwv-inp` reports not measured. `--simulate-interaction` clicks and scrolls to get an indicative value, which is shown but still not scored. Use field data (CrUX or RUM) for INP.
- **Fix LCP:** Optimize largest image, use CDN, preload LCP element
- **Fix CLS:** Set image dimensions, avoid inserting content above existing
- **Fix INP:** Optimize JavaScript, break up long tasks
- **Fix TTFB:** Use CDN, optimize server, enable caching
- **Fix FCP:** Reduce render-blocking resources, inline critical CSS

#### perf-dom-size
- **Thresholds:** more than 800 nodes warns, more than 1,500 fails; nesting deeper than 32 warns, deeper than 48 fails; an element with more than 60 children warns
- **Fix:** Remove unused elements, use virtualization for long lists

#### perf-css-file-size / perf-js-file-size
- **Thresholds:** CSS: more than 3 external stylesheets warns, more than 6 fails; inline CSS over 50KB warns, over 100KB fails. JS: inline JavaScript (scripts without `src`) over 50KB in total warns, over 150KB fails. External script files are not measured.
- **Fix:** Bundle stylesheets, and move large inline scripts and styles into external files that browsers can cache

#### perf-font-loading
- **Fix:** Add `font-display: swap`, preload critical fonts, add `&display=swap` to Google Fonts

#### perf-render-blocking
- **Fix:** Add `async` for independent scripts, `defer` for scripts needing DOM

#### perf-lazy-above-fold
- **Fix:** Remove `loading="lazy"` from above-fold images; add `fetchpriority="high"` to hero image

#### perf-lcp-hints
- **Fix:** Add `<link rel="preload" as="image">` and `fetchpriority="high"` to LCP image

#### perf-text-compression / perf-brotli
- **Fix:** Enable gzip or Brotli compression on the server for text resources (HTML, CSS, JS)

#### perf-cache-policy
- **What it checks:** Caching headers on the page's own response. A `Cache-Control` with `max-age`, `no-cache` or `no-store` passes, as does an `ETag`, `Last-Modified` or `Expires` header. It warns when there is no caching header, or when `Cache-Control` has none of those directives and no other caching header is sent. Static assets are checked by perf-asset-cache-policy.
- **Fix:** Send a `Cache-Control` header with the HTML, or at least `ETag` or `Last-Modified` so browsers can revalidate

#### perf-minify-css / perf-minify-js
- **What it checks:** Inline CSS and JavaScript directly, once there is more than 500 bytes of it: more than 15% whitespace, or a block comment in JavaScript, warns. With render data, external stylesheets and scripts over 2KB (by content-length) whose URL has no `.min.` marker are also flagged. That part is a heuristic, because asset bodies are not captured, so it never goes beyond a warn. When some external files could not be sized and the inline check passes, the rule reports not measured.
- **Fix:** Use build tools (esbuild, terser, cssnano) to minify CSS and JavaScript

#### perf-asset-cache-policy
- **What it checks:** Static assets (stylesheets, scripts, images, fonts) seen during the rendered page load whose `cache-control` max-age is missing or below 1 hour. The Expires header is not read. Not measured under `--no-cwv`, because per-asset headers come from the Playwright render
- **Fix:** Serve static assets with `Cache-Control: max-age=3600` or longer (a year for content-hashed URLs)

#### perf-asset-compression
- **What it checks:** Text-based assets (CSS, JS, JSON, XML, SVG) over 2KB observed during render with no gzip/Brotli/deflate/zstd content-encoding. Size is read from the content-length header; chunked responses without one are not judged. Not measured under `--no-cwv`
- **Fix:** Enable gzip or Brotli compression for text resources

#### perf-image-encoding
- **What it checks:** Images observed during render: a transferred size over 100KB (content-length header) warns; legacy BMP/TIFF formats fail, since modern equivalents are smaller by an order of magnitude. Not measured under `--no-cwv`
- **Fix:** Compress oversized images; re-encode BMP/TIFF as WebP or AVIF

#### perf-response-time
- **Fix:** Optimize server processing, enable caching, use CDN

#### perf-http2
- **What it checks:** Only the `alt-svc` response header. With it the rule passes; without it the rule warns, even when the server already speaks HTTP/2. The negotiated protocol is not read.
- **Fix:** Enable HTTP/2 or HTTP/3 on your server or CDN, and advertise HTTP/3 with an `alt-svc` header

#### perf-page-weight
- **Thresholds:** the HTML document alone: over 100KB warns, over 300KB fails. Images, scripts and stylesheets are counted in the details but not weighed.
- **Fix:** Move inline scripts, styles and embedded data out of the HTML, or split very long pages

#### perf-video-for-animations
- **What it checks:** GIF images referenced by `<img>`, `<source type="image/gif">` or an inline `style`. Any GIF warns; the rule cannot tell whether it is animated.
- **Fix:** Convert animated GIFs to `<video>` elements (up to 90% smaller)

---

<a id="links"></a>

### Links (27 rules)

Analyzes internal and external links, anchor text, broken links, and link quality.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `links-broken-internal` | No Broken Internal Links | 1 | warn/fail | Fails on internal links that return 404, 410 or 5xx; warns when some links got no answer and could not be checked |
| `links-external-valid` | External Links Valid | 1 | warn | Checks external links are accessible |
| `links-internal-present` | Internal Links Present | 1 | warn | Checks page has internal links |
| `links-nofollow-appropriate` | Nofollow Used Appropriately | 1 | warn | Validates nofollow is used appropriately |
| `links-anchor-text` | Descriptive Anchor Text | 1 | warn | Checks for descriptive anchor text |
| `links-depth` | Page Depth | 4 | warn/fail | True click distance from the crawl entry point (requires --crawl) |
| `links-dead-end-pages` | No Dead-End Pages | 1 | warn | Checks page has outgoing internal links |
| `links-https-downgrade` | No HTTPS Downgrade Links | 1 | warn | Checks HTTPS pages don't link to HTTP |
| `links-external-count` | External Links Count | 1 | warn | Warns if >100 external links |
| `links-invalid` | No Invalid Links | 1 | warn | Detects empty, javascript:, or malformed hrefs |
| `links-tel-mailto` | Valid Tel & Mailto Links | 1 | warn | Validates tel: and mailto: link formats |
| `links-redirect-chains` | No Redirect Chains | 1 | warn/fail | Samples up to 20 internal link targets: 1-2 redirect hops warn, 3 or more fail |
| `links-orphan-pages` | Inbound Internal Links | 6 | warn/fail | Inbound internal link count (requires --crawl); true orphans via crawl-sitemap-orphan-urls |
| `links-localhost` | No Localhost Links | 8 | fail | Detects links to localhost, 127.0.0.1, 0.0.0.0 or a common dev-server port (:3000, :8080, :5173 and others) |
| `links-local-file` | No Local File References | 8 | fail | Detects `file://` URLs and `href` or `src` values that start with `/Users/`, `/home/`, `C:\` or `D:\` |
| `links-broken-fragment` | No Broken Fragment Links | 6 | warn | Detects #anchor links with no matching ID |
| `links-excessive` | Reasonable Link Count | 5 | warn/fail | Warns above 100 links on the page and fails above 300 |
| `links-onclick` | No Onclick Navigation | 5 | fail | Detects onclick-based navigation instead of hrefs |
| `links-whitespace-href` | No Whitespace in Hrefs | 4 | warn | Detects href values with leading/trailing whitespace |
| `links-non-http-protocol` | No Non-HTTP Protocol Links | 4 | warn | Detects anchor links using protocols other than HTTP(S), tel: or mailto: (e.g. ftp:, file:, intent:) |
| `links-inbound-all-nofollow` | Inbound Links All Nofollow | 2 | warn | Every inbound internal link is nofollow, so no link equity reaches the page (requires --crawl) |
| `links-inbound-mixed-follow` | Mixed Follow/Nofollow Inbound Links | 2 | warn | Page receives both followed and nofollowed internal links, suggesting inconsistent nofollow usage (requires --crawl) |
| `links-inbound-low-quality` | Inbound Links Passing No Link Equity | 3 | warn | Every inbound internal link is nofollow or comes from a page canonicalized elsewhere (requires --crawl) |
| `links-inbound-anchor-text` | Descriptive Inbound Anchor Text | 2 | warn | All followed inbound internal links use generic anchor text like "click here" (requires --crawl) |
| `links-nofollow-internal` | Nofollow On Internal Links | 4 | warn | Same-host links must not carry rel=nofollow |
| `links-weak-inbound` | Single Inbound Link | 3 | warn | A non-entry page has more than one dofollow inbound link (requires --crawl) |
| `links-chrome-inbound` | Chrome-Only Inbound Links | 4 | warn | At least one inbound link sits outside nav, header, and footer (requires --crawl) |

#### links-broken-internal
- **What it checks:** Each distinct internal link target on the page, with fragments stripped and links to the page itself skipped. Each target gets a HEAD request, confirmed with GET when HEAD fails. 404, 410 and 5xx fail. A target that gives no answer (timeout or network error) is reported as unchecked and warns. Other 4xx statuses pass.
- **Fix:** Update or remove links returning 404. Point to correct destination URLs.

#### links-external-valid
- **What it checks:** The first 20 external links on the page, each with HEAD and then GET when HEAD fails. A 4xx, a 5xx or no answer warns. Results are not cached between audits.
- **Fix:** Fix or remove dead external links.

#### links-anchor-text
- **Bad:** "click here", "read more", "link". **Good:** Descriptive text explaining the destination.

#### links-depth
- **Fix:** Restructure navigation so all important pages are within 3 clicks of the homepage.

#### links-dead-end-pages
- **Fix:** Add navigation links, related content, or breadcrumbs.

#### links-redirect-chains
- **Warn:** 1-2 hops. **Fail:** 3+ hops. **Fix:** Update links to point to final destination URL.

#### links-localhost / links-local-file
- **Fix:** Remove development links (localhost, 127.0.0.1, file://) before deploying to production.

#### links-broken-fragment
- **Fix:** Ensure `#anchor` links have a matching `id` attribute on the target element.

#### links-onclick
- **Fix:** Use proper `<a href="...">` links instead of `onclick` handlers for navigation.

#### links-whitespace-href
- **Fix:** Trim whitespace from href attribute values.

#### links-non-http-protocol
- **What it checks:** Anchor hrefs whose scheme is not `http:`, `https:`, `tel:`, `mailto:` or `javascript:`, such as `ftp:`, `file:`, `intent:`, `chrome:` or `data:`. Browsers hand these to external handlers. links-tel-mailto validates `tel:` and `mailto:` links, and links-invalid covers `javascript:`
- **Fix:** Prefer HTTP(S) URLs unless the non-HTTP protocol is intentional

#### links-inbound-all-nofollow / links-inbound-mixed-follow
- **What it checks:** The nofollow state of each internal link pointing at this page, from the crawl's inbound link graph. links-inbound-all-nofollow warns when every inbound link is nofollow, so the page receives no link equity; it never fails. links-inbound-mixed-follow warns when the page receives both followed and nofollowed links. Pages with no inbound links pass; links-orphan-pages covers them. Crawl mode only; not measured in a single-page audit
- **Fix:** Decide whether internal links to this page should be nofollowed and apply it consistently

#### links-inbound-low-quality
- **What it checks:** Whether any inbound internal link passes link equity. A link passes equity only when it is followed and its source page is not canonicalized to another URL. Warns when no inbound link passes. Pages with no inbound links pass; links-orphan-pages covers them. Crawl mode only
- **Fix:** Earn followed links from indexable, self-canonical pages so the URL receives internal link equity

#### links-inbound-anchor-text
- **What it checks:** Anchor text of followed inbound internal links. An anchor is generic when it is empty (image-only links), shorter than 2 characters, or exactly a phrase from the list links-anchor-text uses ("click here", "read more", …). Warns only when every followed inbound link is generic. Crawl mode only
- **Fix:** Use descriptive anchor text on internal links pointing to this page

---

<a id="images"></a>

### Images (14 rules)

Checks alt attributes, dimensions, lazy loading, optimization, and accessibility.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `images-alt-present` | Image Alt Attribute Present | 20 | fail | Checks all images have alt attribute |
| `images-alt-quality` | Image Alt Text Quality | 15 | warn | Validates alt text is descriptive |
| `images-dimensions` | Image Dimensions | 15 | warn | Checks width/height attributes present |
| `images-lazy-loading` | Image Lazy Loading | 10 | warn | Checks below-fold images use lazy loading |
| `images-modern-format` | Modern Image Formats | 10 | warn | Suggests WebP/AVIF for images |
| `images-size` | Image File Size | 10 | warn | Flags images that look oversized from filename hints or declared dimensions; file sizes are not fetched |
| `images-responsive` | Responsive Images | 10 | warn | Checks srcset for responsive images |
| `images-broken` | No Broken Images | 15 | fail | Checks images don't return 404 |
| `images-figure-captions` | Figure Captions | 5 | warn | Checks figure elements have figcaption |
| `images-filename-quality` | Image Filename Quality | 5 | warn | Checks for descriptive image filenames |
| `images-inline-svg-size` | Inline SVG Size | 5 | warn | Checks inline SVGs aren't too large (>5KB) |
| `images-picture-element` | Picture Element Validation | 10 | fail | Validates picture elements have img fallback |
| `images-alt-length` | Image Alt Text Length | 6 | warn/fail | Alt text over 125 characters warns; over 250 fails |
| `images-background-seo` | Background Images SEO | 5 | warn/fail | Counts inline-style CSS background images: 2 to 5 warn, more than 5 fail |

#### images-alt-present / images-alt-quality
- **Fix:** Add descriptive alt text to all images: `<img alt="Red running shoes on white background">`
- **Bad:** "image", "photo", filename. **Good:** Descriptive explanation of image content.

#### images-alt-length
- **Thresholds:** alt text over 125 characters warns, over 250 fails. There is no minimum length; images without alt text are left to images-alt-present.

#### images-dimensions
- **Fix:** Add `width` and `height` attributes to all images.

#### images-lazy-loading
- **Fix:** Add `loading="lazy"` to images below the initial viewport. Never on above-fold images.

#### images-modern-format
- **Fix:** Convert to WebP or AVIF (30-50% smaller than JPEG/PNG).

#### images-responsive
- **Fix:** Add `srcset` and `sizes` attributes for different screen sizes.

#### images-broken
- **Fix:** Fix or remove image references returning 404 errors.

#### images-figure-captions
- **Fix:** Add `<figcaption>` inside `<figure>` elements to describe the content.

#### images-filename-quality
- **Bad:** `IMG_001.jpg`, `DSC1234.png`. **Good:** `red-running-shoes.jpg`, `team-photo.webp`

#### images-inline-svg-size
- **Threshold:** >5KB should be external files. **Fix:** Move large SVGs to external files for caching.

#### images-picture-element
- **Fix:** Every `<picture>` must contain an `<img>` element as fallback.

#### images-background-seo
- **What it checks:** Elements whose inline `style` sets `background-image: url(...)`, excluding data URLs and gradients. One passes, 2 to 5 warn, more than 5 fail. Backgrounds set in stylesheets are not seen.
- **Fix:** Use `<img>` tags instead of CSS `background-image` for content-relevant images so search engines can index them.

---

<a id="security"></a>

### Security (26 rules)

Validates HTTPS, security headers, mixed content, SSL, and leaked secrets.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `security-https` | HTTPS | 10 | fail | Checks site uses HTTPS |
| `security-https-redirect` | HTTP to HTTPS Redirect | 8 | warn/fail | Checks HTTP redirects to HTTPS |
| `security-hsts` | HSTS Header | 6 | warn/fail | Checks Strict-Transport-Security header |
| `security-csp` | Content-Security-Policy | 4 | warn | Checks Content-Security-Policy header |
| `security-x-frame-options` | X-Frame-Options | 5 | warn/fail | Checks X-Frame-Options header |
| `security-x-content-type-options` | X-Content-Type-Options | 4 | fail | Checks X-Content-Type-Options: nosniff |
| `security-external-links` | External Link Security | 3 | warn | Checks target="_blank" has noopener/noreferrer |
| `security-form-https` | Form HTTPS | 5 | warn/fail | Checks form actions use HTTPS |
| `security-mixed-content` | Mixed Content | 8 | warn/fail | Checks for HTTP resources on HTTPS pages |
| `security-permissions-policy` | Permissions-Policy | 2 | warn | Checks for Permissions-Policy header |
| `security-referrer-policy` | Referrer-Policy | 2 | warn | Checks for Referrer-Policy header |
| `security-coop` | Cross-Origin-Opener-Policy | 3 | warn | Isolates the page from windows that open it |
| `security-csp-xss` | CSP Strength Against XSS | 6 | warn/fail | Grades whether the CSP actually constrains script execution |
| `security-info-disclosure` | Software Version Disclosure | 3 | warn | Headers do not advertise server software and version |
| `security-paste-blocking` | Inputs Allow Pasting | 2 | fail | Input fields do not prevent pasting |
| `security-trusted-types` | Trusted Types | 2 | warn | CSP requires Trusted Types for DOM XSS sinks |
| `security-leaked-secrets` | Leaked Secrets | 10 | fail | Detects exposed API keys, credentials in HTML/JS |
| `security-password-http` | Password Input on HTTP | 10 | fail | Detects password fields on non-HTTPS pages |
| `security-protocol-relative` | Protocol-Relative URLs | 6 | warn | Detects `//example.com` URLs |
| `security-cookie-flags` | Cookie Security Flags | 10 | warn/fail | Checks Set-Cookie for Secure, HttpOnly and SameSite |
| `security-cookie-lifetime` | Cookie Lifetime | 4 | warn | Flags cookies beyond the 400-day browser cap |
| `security-ssl-expiry` | SSL Certificate Health | 8 | warn/fail | Does not read the certificate: an HTTP page fails; HTTPS without HSTS, or an HSTS max-age under one year, warns |
| `security-ssl-protocol` | TLS Protocol Configuration | 6 | warn/fail | Does not test the TLS version: an HTTP page or a missing HSTS header fails; HSTS without includeSubDomains and preload warns |
| `security-sri` | Subresource Integrity | 3 | warn | Cross-origin scripts and stylesheets have an integrity hash |
| `security-obfuscated-script` | Obfuscated Inline Script | 4 | warn | No long high-entropy inline script calls eval, Function, or atob |
| `security-brand-impersonation` | Brand Sign-In Destination | 6 | warn | Brand sign-in links point at the brand or this host |

#### security-https / security-https-redirect
- **Fix:** Install SSL certificate, set up 301 redirect from HTTP to HTTPS.

#### security-hsts
- **Fix:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`

#### security-csp
- **What it checks:** A missing policy, or one sent only as `Content-Security-Policy-Report-Only`, warns. An enforced policy warns when it lacks `default-src`, `script-src`, `style-src`, `img-src` or `frame-ancestors`. `default-src` covers the three fetch directives, and `X-Frame-Options: DENY` or `SAMEORIGIN` covers `frame-ancestors`.
- **Fix:** Add `Content-Security-Policy` header restricting resource sources.

#### security-x-frame-options
- **Fix:** Add `X-Frame-Options: DENY` or `SAMEORIGIN` to prevent clickjacking.

#### security-x-content-type-options
- **Fix:** Add `X-Content-Type-Options: nosniff` to prevent MIME sniffing.

#### security-external-links
- **Fix:** Add `rel="noopener noreferrer"` to all external `target="_blank"` links.

#### security-mixed-content
- **Fix:** Replace all HTTP resource URLs with HTTPS on HTTPS pages.

#### security-permissions-policy
- **Fix:** Add `Permissions-Policy: camera=(), microphone=(), geolocation=()`

#### security-coop
- **Fix:** Send `Cross-Origin-Opener-Policy: same-origin`.

#### security-csp-xss
- **Note:** Not measured when the response has no Content-Security-Policy; `security-csp` reports the missing policy.
- **Fix:** Drop `'unsafe-inline'`/`'unsafe-eval'` or pair them with a nonce or hash; set `object-src 'none'` and `base-uri 'none'`.

#### security-info-disclosure
- **Fix:** Remove `X-Powered-By` and `X-AspNet-Version`; strip the version from `Server`. A bare `Server: nginx` passes.

#### security-paste-blocking
- **Fix:** Remove `onpaste` handlers that call `preventDefault()` or `return false`.

#### security-trusted-types
- **Note:** Only graded on sites that already ship a CSP.
- **Fix:** Add `require-trusted-types-for 'script'` to the Content-Security-Policy.

#### security-referrer-policy
- **Fix:** Add `Referrer-Policy: strict-origin-when-cross-origin`

#### security-leaked-secrets
- **Detects:** AWS keys, API tokens, private keys, database URLs in page source.
- **Fix:** Remove secrets immediately and rotate compromised credentials.

#### security-password-http
- **Fix:** Never serve login forms over HTTP. Ensure all password fields are on HTTPS pages.

#### security-protocol-relative
- **Fix:** Replace `//example.com/file.js` with `https://example.com/file.js`.

#### security-ssl-expiry
- **What it checks:** HSTS as a proxy for certificate upkeep. The certificate and its expiry date are not read. An HTTP page fails. On HTTPS, a missing `Strict-Transport-Security` header, a missing or invalid `max-age`, or a `max-age` under one year (31536000 seconds) warns.
- **Fix:** Serve the site over HTTPS and send `Strict-Transport-Security` with a `max-age` of 31536000 or more.

#### security-ssl-protocol
- **What it checks:** HSTS directives. The negotiated TLS version is not tested. An HTTP page fails, an HTTPS page without `Strict-Transport-Security` fails, and HSTS without both `includeSubDomains` and `preload` warns.
- **Fix:** Send `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.

---

<a id="technical"></a>

### Technical SEO (18 rules)

Validates robots.txt, sitemap, status codes, URL structure, and analytics tag setup.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `technical-robots-txt-exists` | Robots.txt Exists | 1 | fail | Checks /robots.txt is accessible |
| `technical-robots-txt-valid` | Robots.txt Valid Syntax | 1 | warn/fail | Validates robots.txt syntax |
| `technical-sitemap-exists` | Sitemap Exists | 1 | warn/fail | Checks for XML sitemap |
| `technical-sitemap-valid` | Sitemap Valid Structure | 1 | warn/fail | Validates sitemap format and entries |
| `technical-url-structure` | URL Structure | 1 | warn/fail | Checks URL format (lowercase, hyphens) |
| `technical-trailing-slash` | Trailing Slash Consistency | 1 | warn | Warns when one internal path is linked both with and without a trailing slash |
| `technical-www-redirect` | WWW Redirect | 1 | warn/fail | Validates www/non-www consistency |
| `technical-404-page` | Custom 404 Page | 1 | warn/fail | Checks for custom 404 page |
| `technical-soft-404` | Soft 404 Detection | 10 | fail | Detects pages returning 200 but showing error content |
| `technical-server-error` | Server Error Detection | 10 | fail | Detects 5xx server errors |
| `technical-4xx-non-404` | 4xx Client Error Detection | 8 | warn/fail | Detects 4xx errors other than 404 (403, 410, etc.) |
| `technical-timeout` | Response Timeout Check | 8 | warn/fail | Grades the page's response time: 3 seconds or more warns, over 10 seconds fails |
| `technical-bad-content-type` | Content-Type Header Check | 8 | warn/fail | Checks pages serve correct Content-Type header |
| `technical-empty-html` | Empty HTML | 10 | fail | Detects 200 responses with missing or empty HTML content |
| `technical-form-get-method` | Form GET Method | 4 | warn | Detects forms that submit with the GET method, exposing query-string URLs |
| `technical-duplicate-gtm` | Multiple Google Tag Manager Containers | 1 | warn | Detects more than one distinct Google Tag Manager container on the page |
| `technical-duplicate-ga` | Multiple Google Analytics Properties | 1 | warn | Detects more than one distinct Google Analytics property ID (UA- or G-) on the page |
| `technical-consent-mode` | Google Consent Mode | 3 | warn | A Google tag is paired with a consent update |

#### technical-robots-txt-exists / technical-robots-txt-valid
- **Fix:** Create robots.txt with proper User-agent, Allow, Disallow, and Sitemap directives.

#### technical-sitemap-exists / technical-sitemap-valid
- **Fix:** Create sitemap.xml with all canonical URLs. Validate format and lastmod dates.

#### technical-url-structure
- **Good:** Lowercase, hyphens, descriptive. **Bad:** Uppercase, underscores, special characters.

#### technical-trailing-slash
- **What it checks:** The distinct internal paths the page links to. Warns when the same path is linked both with and without a trailing slash. Different paths in different forms pass. The root path, file paths and links to the page itself are skipped.
- **Fix:** Link each page in the form the server serves, and redirect the other form to it.

#### technical-www-redirect
- **Fix:** Set up 301 redirect so www and non-www resolve to one canonical form.

#### technical-404-page
- **Fix:** Create a helpful custom 404 page with navigation links to main content.

#### technical-soft-404
- **Fix:** Return proper 404 status codes for pages that don't exist. Don't serve error content with 200.

#### technical-server-error / technical-4xx-non-404 / technical-timeout
- **What it checks:** The audited page's status and response time. technical-server-error fails on 5xx. technical-4xx-non-404 fails on 401, 403 and other 4xx codes, and warns on 410 and 429. technical-timeout warns at a response time of 3 seconds or more and fails above 10 seconds. A single-page audit of a page that returns 4xx or 5xx stops with exit code 2 (`http-error`), so the two status rules report findings in crawls.
- **Fix:** Investigate and fix server errors (5xx), access issues (403), gone pages (410), and timeout issues.

#### technical-bad-content-type
- **Fix:** Configure server to send `Content-Type: text/html; charset=utf-8` for HTML pages.

#### technical-empty-html
- **What it checks:** Pages that return HTTP 200 with an empty response body, or with a document whose `<head>` and `<body>` are both empty. Such a page gives users and search engines nothing to see or index
- **Fix:** Investigate why the server returns no HTML; restore the content or serve a 404/410 if the page should not exist

#### technical-form-get-method
- **What it checks:** Forms submitted with GET (the HTML default when `method` is omitted) append their input data to the action URL as a query string. Those URLs can be crawled, cached and indexed, and unrestricted inputs can generate an unbounded number of unique URLs
- **Fix:** Switch the form method to POST, or block the form action URL from crawlers via robots.txt if GET URLs are intentional

#### technical-duplicate-gtm / technical-duplicate-ga
- **What it checks:** More than one distinct Google Tag Manager container ID (`GTM-`), or more than one distinct Google Analytics property ID (`UA-` or `G-`), in the page HTML. This is usually a configuration error, such as a plugin adding a second snippet
- **Fix:** Verify all containers/properties are intentional; consolidate into a single one where possible

---

<a id="crawl"></a>

### Crawlability (38 rules)

Validates indexability signals, sitemap conflicts, canonical chains, and pagination.

The cross-page rules (`crawl-sitemap-orphan-urls`, `crawl-pagination-isolated`, `crawl-sitemap-non-200`, `crawl-sitemap-non-canonical`, `crawl-sitemap-disallowed`, `crawl-sitemap-cross-duplicates`, `crawl-canonical-to-noindex`, `crawl-canonical-to-disallowed`, `crawl-canonical-chain`, `crawl-canonical-loop`, `crawl-hreflang-to-noindex`, `crawl-hreflang-to-disallowed`, `crawl-hreflang-disallowed-target`, `crawl-hreflang-incoming-conflict`, `crawl-hreflang-reciprocity`, `crawl-isolated-url`, `crawl-canonical-form-drift`) read data that only a multi-page crawl records, so they measure only with `--crawl`. In a single-page audit they report as not measured (weight 0, excluded from the score). `crawl-canonical-form-drift` also needs at least two crawled pages.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `crawl-schema-noindex-conflict` | Schema + Noindex Conflict | 15 | fail | Rich result schema on noindexed pages |
| `crawl-pagination-canonical` | Pagination Canonical | 10 | warn/fail | Paginated pages have self-referencing canonicals |
| `crawl-sitemap-domain` | Sitemap Domain Validation | 15 | warn/fail | Sitemap page URLs, read through any index, sit on the audited host; over 10% elsewhere fails, and a missing sitemap warns |
| `crawl-noindex-in-sitemap` | Noindex in Sitemap | 15 | warn/fail | A noindex page is listed in the sitemap; warns when no sitemap could be fetched to check |
| `crawl-indexability-conflict` | Indexability Conflict | 15 | warn | Googlebot's robots.txt group disallows the page, whether or not the page also carries noindex |
| `crawl-canonical-redirect` | Canonical Redirect Chain | 15 | warn/fail | Canonical URL redirects (1-2 hops warn, 3 or more fail) or returns 4xx/5xx; a page without a canonical warns |
| `crawl-sitemap-url-limit` | Sitemap URL Limit | 6 | warn/fail | A sitemap file lists over 40,000 URLs (warn) or 50,000 (fail); each file behind an index is judged on its own |
| `crawl-sitemap-size-limit` | Sitemap Size Limit | 5 | warn/fail | A sitemap file is over 40 MB (warn) or 50 MB (fail) uncompressed; each file behind an index is judged on its own |
| `crawl-sitemap-duplicate-urls` | Sitemap Duplicate URLs | 6 | warn | A page URL appears more than once across the fetched sitemap files |
| `crawl-sitemap-orphan-urls` | Sitemap Orphan URLs | 7 | warn | Sitemap URLs not linked from any crawled page (requires --crawl) |
| `crawl-blocked-resources` | Blocked Resources | 7 | warn | CSS/JS blocked by robots.txt |
| `crawl-blocked-images` | Blocked Images | 7 | fail | Image URLs disallowed by robots.txt cannot be crawled for image indexing |
| `crawl-crawl-delay` | Crawl Delay | 5 | warn | Crawl-delay above 10 seconds for `*`, Googlebot or Bingbot in robots.txt |
| `crawl-sitemap-in-robotstxt` | Sitemap in robots.txt | 6 | warn | Sitemap not referenced in robots.txt |
| `crawl-sitemap-lastmod` | Sitemap lastmod Quality | 5 | warn | No sitemap entry has a lastmod, or values are invalid, future-dated, or 90% on one day |
| `crawl-pagination-broken` | Pagination Broken Links | 6 | fail | A `rel="next"` or `rel="prev"` href does not parse as a URL; the targets are not fetched |
| `crawl-pagination-loop` | Pagination Loop Detection | 6 | fail | `rel="next"` or `rel="prev"` points back to the page itself |
| `crawl-pagination-sequence` | Pagination Sequence Validation | 5 | fail | `rel="next"` and `rel="prev"` point to the same URL |
| `crawl-pagination-noindex` | Pagination Noindex Check | 6 | warn | Paginated pages have noindex |
| `crawl-pagination-orphaned` | Pagination Orphaned | 5 | warn | A URL shaped like a paginated page (such as `?page=N` or `/page/N`) has no `rel="next"` or `rel="prev"` tag |
| `crawl-pagination-isolated` | Pagination URL Without Incoming Links | 5 | fail | Paginated URL has no incoming internal anchor links (requires --crawl) |
| `crawl-sitemap-non-200` | Non-200 URLs in Sitemap | 10 | warn/fail | Sitemap URLs cross-referenced against crawled status codes; 4xx/5xx fail, 3xx and timeouts warn (requires --crawl) |
| `crawl-sitemap-non-canonical` | Canonicalised URLs in Sitemap | 7 | fail | Sitemap URLs whose canonical resolves to a different URL (requires --crawl) |
| `crawl-sitemap-disallowed` | Disallowed URLs in Sitemap | 7 | fail | Sitemap URLs disallowed by robots.txt (requires --crawl) |
| `crawl-sitemap-cross-duplicates` | URLs in Multiple Sitemaps | 2 | warn | URLs declared by more than one sitemap document (requires --crawl) |
| `crawl-canonical-to-noindex` | Canonical Points To Noindex URL | 8 | fail | Canonical target is itself noindex (requires --crawl) |
| `crawl-canonical-to-disallowed` | Canonical Points To Disallowed URL | 8 | fail | Canonical target is disallowed by robots.txt (requires --crawl) |
| `crawl-canonical-chain` | Canonical Chain | 6 | warn | Canonical target is itself canonicalized elsewhere (requires --crawl) |
| `crawl-canonical-loop` | Canonical Loop | 8 | fail | Canonical targets form a loop with no final destination (requires --crawl) |
| `crawl-hreflang-to-noindex` | Hreflang To Noindex URLs | 8 | fail | Outgoing hreflang annotations point to noindex URLs (requires --crawl) |
| `crawl-hreflang-to-disallowed` | Hreflang To Disallowed URLs | 7 | fail | Outgoing hreflang annotations point to robots.txt-disallowed URLs (requires --crawl) |
| `crawl-hreflang-disallowed-target` | Disallowed URL Has Incoming Hreflang | 7 | fail | Other pages point hreflang at this robots.txt-disallowed page (requires --crawl) |
| `crawl-hreflang-incoming-conflict` | Conflicting Incoming Hreflang Annotations | 7 | fail | Other crawled pages annotate this URL with different hreflang codes (requires --crawl) |
| `crawl-hreflang-reciprocity` | Hreflang Reciprocity | 6 | warn | Crawled hreflang targets do not annotate this page in return (requires --crawl) |
| `crawl-isolated-url` | Isolated URL | 8 | fail | URL reachable only via canonicals, redirects, the sitemap, noindex,follow paths, or other isolated URLs (requires --crawl) |
| `crawl-canonical-form-drift` | Canonical Form Drift | 6 | warn | Canonicals agree on www, scheme, and trailing slash (requires --crawl) |
| `crawl-sitemap-date-drift` | Sitemap Date Drift | 4 | warn | Sitemap lastmod and schema dateModified fall on the same day |
| `crawl-pdf-size` | Linked PDF Size | 3 | warn | Linked PDF files are at most 10 MB; a missing Content-Length is skipped |

#### crawl-schema-noindex-conflict
- **Fix:** Remove noindex to allow rich results, or remove schema if the page should stay hidden.

#### crawl-pagination-canonical
- **Fix:** Each paginated page should have its own self-referencing canonical. Never canonicalize all to page 1.

#### crawl-sitemap-domain
- **What it checks:** The page URLs the sitemap lists, read through any sitemap index, against the audited host; the www and non-www forms both count. More than 10% on another host fails, fewer warns. A sitemap that cannot be found or lists no URLs also warns
- **Fix:** Remove cross-domain URLs from the sitemap. Every URL must be on the audited host, with or without `www.`.

#### crawl-noindex-in-sitemap
- **What it checks:** Applies only to a page with noindex (the `robots` or `googlebot` meta tag, or X-Robots-Tag). It fetches `/sitemap.xml`, falling back to the first `Sitemap:` line in robots.txt, and reads at most the first 3 sitemaps of an index. Fails when the page is listed; warns when no sitemap could be fetched
- **Fix:** Either remove the page from the sitemap or remove the noindex directive.

#### crawl-indexability-conflict
- **What it checks:** The page against Googlebot's group in robots.txt (the `*` group when no group names Googlebot). A disallowed page warns either way: with noindex, Googlebot never fetches the page to read the directive; without it, the URL can still be indexed from links. Noindex comes from the `robots` or `googlebot` meta tag or the X-Robots-Tag header. Passes when no robots.txt can be read
- **Fix:** To keep a page out of the index, allow it in robots.txt and add noindex. A Disallow on its own still warns.

#### crawl-canonical-redirect
- **Fix:** Update canonical to point directly to the final destination URL. Avoid redirect chains.

#### crawl-sitemap-url-limit / crawl-sitemap-size-limit
- **What it checks:** Each sitemap file on its own. Behind a sitemap index, every listed sitemap that was fetched is judged (at most 10 are fetched) and the index file itself is not. Each rule judges the largest file: `crawl-sitemap-url-limit` warns above 40,000 URLs and fails above 50,000; `crawl-sitemap-size-limit` warns above 40 MB and fails above 50 MB, measured uncompressed. Both report not measured when the sitemap is an index and none of its sitemaps could be fetched
- **Fix:** Split large sitemaps into a sitemap index with multiple smaller sitemaps.

#### crawl-sitemap-duplicate-urls
- **Fix:** Remove duplicate entries from sitemap. Each URL should appear once.

#### crawl-sitemap-orphan-urls
- **Fix:** Add internal links to sitemap-only URLs, or remove them from the sitemap.

#### crawl-blocked-resources
- **Fix:** Unblock CSS and JS in robots.txt so search engines can render pages correctly.

#### crawl-blocked-images
- **What it checks:** Same-origin image URLs matched against robots.txt with the RFC 9309 matcher; a disallowed image cannot be crawled, so it will not appear in image search. Not measured when robots.txt was not fetched.
- **Fix:** Remove the disallow covering the image paths, or move images to an allowed path.

#### crawl-sitemap-in-robotstxt
- **Fix:** Add `Sitemap: https://example.com/sitemap.xml` to robots.txt.

#### crawl-pagination-broken / crawl-pagination-loop / crawl-pagination-sequence
- **Fix:** Ensure pagination links are valid, non-circular, and sequential.

#### crawl-pagination-noindex / crawl-pagination-orphaned
- **What it checks:** `crawl-pagination-noindex` warns when a page with a `rel="next"` or `rel="prev"` tag carries noindex. `crawl-pagination-orphaned` warns when the URL matches a pagination pattern (`?page=N`, `?p=N`, `?pg=N`, `?offset=N`, `?start=N`, `?paged=N`, `/page/N`) but the page has neither tag
- **Fix:** Allow paginated pages to be indexed, and declare the series with `<link rel="next">` and `<link rel="prev">`.

#### crawl-pagination-isolated
- **What it checks:** A paginated URL (pattern like `?page=N` or `/page/N`, or self-declared rel="next"/"prev") that no internal anchor link points to. Crawl mode only; pages the crawler reached by following anchors necessarily have an inbound link, so this fires for paginated URLs discovered another way
- **Fix:** Link to the pagination series from ordinary anchors (e.g. a pager in the body), not only rel="next"/"prev" tags

#### crawl-sitemap-non-200
- **What it checks:** Every sitemap URL cross-referenced against the status code recorded during the crawl. 4xx and 5xx fail outright; 3xx and timed-out URLs warn. Sitemap URLs the crawl never reached carry no reading (crawl-sitemap-orphan-urls covers that gap)
- **Fix:** Remove dead URLs from the sitemap, and list final destination URLs instead of redirecting ones

#### crawl-sitemap-non-canonical
- **What it checks:** Sitemap URLs whose canonical link element resolves to a different URL. The sitemap says "index this", the canonical says "index that", and the canonical wins. Sitemap URLs the crawl did not visit are skipped
- **Fix:** List only canonical (self-referencing) URLs in the sitemap

#### crawl-sitemap-disallowed
- **What it checks:** Sitemap URLs that robots.txt disallows, a direct contradiction between the two crawl signals. When no robots.txt content was captured and nothing was disallowed anywhere, the rule reports unmeasured rather than a vacuous pass
- **Fix:** Remove the URL from the sitemap or the Disallow from robots.txt; a disallowed page may be indexed blind (URL only)

#### crawl-sitemap-cross-duplicates
- **What it checks:** Page URLs declared by more than one sitemap document. A URL repeated inside one file counts once here. `crawl-sitemap-duplicate-urls` checks the combined URL list of every fetched sitemap file instead, so a URL listed in two files trips both rules. Informational: crawlers dedupe on their side
- **Fix:** Assign each URL to a single sitemap; overlapping declarations usually mean sitemap ownership is unclear

#### crawl-canonical-to-noindex / crawl-canonical-to-disallowed
- **What it checks:** The page's canonical target is itself noindex, or disallowed by robots.txt, so the page hands indexing to a URL that cannot be indexed or even fetched. Self-referencing canonicals pass. Uncrawled targets report unmeasured
- **Fix:** Point the canonical at an indexable, crawlable URL, or remove the noindex/Disallow from the target

#### crawl-canonical-chain
- **What it checks:** The canonical target is itself canonicalized to a different URL (A → B → C). Each hop weakens the signal and the final destination may not be the intended one. Loops are reported by crawl-canonical-loop instead
- **Fix:** Point the canonical directly at the final destination URL

#### crawl-canonical-loop
- **What it checks:** Following canonical targets leads back to an already-visited URL (A ↔ B), leaving search engines no final destination
- **Fix:** Make every page in the loop canonicalize to a single final URL

#### crawl-hreflang-to-noindex / crawl-hreflang-to-disallowed
- **What it checks:** Outgoing hreflang annotations whose crawled targets are noindex or disallowed by robots.txt. The annotation asks for the target to be served while the target cannot be indexed or fetched, so the localized cluster can break down. Targets the crawl never visited are skipped; when none were crawled the rule is not measured
- **Fix:** Remove noindex/Disallow from the hreflang targets, or drop the annotations pointing at them

#### crawl-hreflang-disallowed-target
- **What it checks:** The mirror direction: this page is disallowed by robots.txt while other crawled pages point hreflang annotations at it, so its return tags can never be confirmed
- **Fix:** Remove the robots.txt Disallow for this URL, or remove the hreflang annotations pointing at it

#### crawl-hreflang-incoming-conflict
- **What it checks:** The incoming side of hreflang conflicts: annotations from OTHER crawled pages that target this URL must agree on a single language/region code. The page's own annotations are excluded (i18n-hreflang-conflicting's job). x-default never conflicts, because it is a fallback, not a language claim
- **Fix:** Make every page in the hreflang cluster annotate each member URL with the same single language/region code

#### crawl-hreflang-reciprocity
- **What it checks:** Every crawled hreflang target of this page annotates this page in return (return tags), because annotations are only honoured when mutual. Warns rather than fails, since missing return tags are usually a template gap. Targets the crawl never visited are skipped; when none were crawled the rule is not measured
- **Fix:** Add reciprocal hreflang annotations on the target pages pointing back at this URL

#### crawl-isolated-url
- **What it checks:** How the crawl discovered this URL (internal link, canonical tag, redirect, XML sitemap, or the crawl entry point). Fails when no anchor link points to it (found only via a canonical, a redirect or the sitemap), when every linking page is noindex,follow, or when every linker is itself isolated (one propagation pass). The crawl entry point always passes. Crawl mode only
- **Fix:** Link to the page from ordinary anchors on relevant, indexable pages; do not rely on canonicals, redirects or the sitemap for discovery

#### crawl-pdf-size
- **Warn:** A linked `.pdf` reports `Content-Length` above 10 MB. Up to eight PDF links are checked with HEAD. A missing length is skipped. A page with no PDF links passes.

---

<a id="schema"></a>

### Structured Data (19 rules)

Checks for valid JSON-LD, Schema.org markup, and rich snippet eligibility.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `schema-present` | Structured Data Present | 25 | warn/fail | Fails with no JSON-LD, microdata, or RDFa (`typeof`); warns with microdata or RDFa only. Open Graph `property=` tags do not count |
| `schema-valid` | Structured Data Valid JSON | 25 | warn/fail | Each JSON-LD script parses as JSON: some invalid warns, all invalid fails. Not measured without JSON-LD |
| `schema-type` | Structured Data Type Present | 25 | warn/fail | Each JSON-LD script declares @type: some missing warns, none fails. Not measured without JSON-LD |
| `schema-required-fields` | Structured Data Required Fields | 25 | warn/fail | Required and recommended properties for common @types: a missing required one fails, a missing recommended one warns. Not measured without JSON-LD |
| `schema-article` | Article Schema | 12 | warn/fail | Validates Article/BlogPosting |
| `schema-breadcrumb` | Breadcrumb Schema | 8 | warn | Pages other than the homepage have a BreadcrumbList in JSON-LD, RDFa, or microdata with at least 2 items |
| `schema-faq` | FAQ Schema | 8 | fail | Validates FAQPage structure |
| `schema-local-business` | LocalBusiness Schema | 10 | warn/fail | Validates LocalBusiness for local SEO |
| `schema-organization` | Organization Schema | 8 | warn | Validates Organization schema |
| `schema-product` | Product Schema | 12 | warn/fail | Validates Product for e-commerce |
| `schema-review` | Review Schema | 10 | warn/fail | Validates Review/AggregateRating |
| `schema-video` | Video Schema | 10 | warn/fail | Validates VideoObject |
| `schema-website-search` | WebSite Search Schema | 8 | warn | Checks sitelinks searchbox eligibility |
| `schema-entity-id` | Schema Entity @id | 8 | warn | Organization, WebSite, Person, and Business entities use an absolute @id |
| `schema-rating-scope` | AggregateRating Scope | 8 | warn | AggregateRating is not on a legal or account URL, and ratingValue is visible |
| `schema-entity-conflict` | Schema Entity Conflicts | 6 | warn | One absolute @id does not carry two logos or two phone numbers (requires --crawl) |
| `schema-entity-dangling` | Dangling Schema References | 6 | warn | Absolute @id references (publisher, author, isPartOf, about, brand, and others) are declared somewhere in the crawl (requires --crawl) |
| `schema-entity-type-drift` | Schema Type Drift | 5 | warn | One absolute @id keeps the same @type across the crawl (requires --crawl) |
| `schema-entity-split` | Split Schema Identity | 6 | warn | One organization or person name is not published under two absolute @ids (requires --crawl) |

#### schema-present
- **Fix:** Add `<script type="application/ld+json">` with appropriate schema for the page type.

#### schema-valid
- **Fix:** Fix JSON syntax errors. Validate at https://search.google.com/test/rich-results

#### schema-type / schema-required-fields
- **Fix:** Include `@type` and all required properties for the chosen schema type.

#### schema-article
- **Required (missing fails):** headline, author, datePublished. **Recommended (missing warns):** image, publisher, dateModified, description, mainEntityOfPage. An `author` given as a plain string instead of a Person or Organization warns.

#### schema-breadcrumb
- **Fix:** Add BreadcrumbList with at least 2 itemListElement items on non-homepage pages.

#### schema-faq
- **Fix:** Each Question in mainEntity needs `name` and `acceptedAnswer` with `text`.

#### schema-local-business
- **Fix:** Include name, address (as PostalAddress), telephone, geo coordinates.

#### schema-organization
- **Fix:** Include name, logo URL, sameAs array with social media profile URLs.

#### schema-product
- **Fix:** Include offers with price, priceCurrency, and availability.

#### schema-review
- **Fix:** Include itemReviewed, author, and reviewRating with ratingValue.

#### schema-video
- **Fix:** Include name, thumbnailUrl, uploadDate. Use ISO 8601 for duration (PT1M30S).

#### schema-website-search
- **Fix:** Add WebSite schema with SearchAction and target containing `{search_term_string}`.

#### schema-entity-split
- **Warn:** The same organization or person name is published under two or more absolute `@id`s. Needs a crawl of at least two pages. Relative `@id`s are ignored.

---

<a id="content"></a>

### Content (27 rules)

Analyzes text quality, readability, headings, and duplicate content.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `content-word-count` | Word Count | 4 | warn/fail | Checks content length for thin content |
| `content-reading-level` | Reading Level | 3 | warn | Analyzes readability using Flesch-Kincaid |
| `content-keyword-stuffing` | Keyword Stuffing | 5 | warn | Detects excessive keyword repetition |
| `content-article-links` | Article Link Density | 4 | warn | Checks link-to-content ratio |
| `content-broken-html` | Broken HTML | 4 | warn/fail | Detects malformed HTML structure |
| `content-meta-in-body` | Meta Tags in Body | 8 | fail | Meta tags incorrectly placed in body |
| `content-mime-type` | MIME Type Validation | 5 | warn/fail | Validates Content-Type header |
| `content-duplicate-description` | Duplicate Description | 5 | warn/fail | Duplicate or under-50-character meta descriptions warn (requires --crawl); a missing description fails in any audit |
| `content-heading-hierarchy` | Heading Hierarchy | 1 | warn/fail | Checks H1-H6 hierarchy sequence |
| `content-heading-length` | Heading Content Length | 1 | warn | Validates heading text length |
| `content-heading-unique` | Unique Heading Content | 1 | warn | Checks for duplicate heading text on page |
| `content-text-html-ratio` | Text to HTML Ratio | 7 | warn/fail | Checks text to HTML code ratio |
| `content-title-same-as-h1` | Title Same as H1 | 6 | warn | Detects identical title and H1 |
| `content-title-pixel-width` | Title Pixel Width | 7 | warn/fail | Checks title fits SERP pixel limit |
| `content-description-pixel-width` | Description Pixel Width | 6 | warn/fail | Checks description fits SERP pixel limit |
| `content-duplicate-exact` | Exact Duplicate Content | 8 | fail | Detects pages with identical visible text (requires --crawl) |
| `content-duplicate-near` | Near-Duplicate Content | 7 | warn/fail | Detects pages with very similar main content (requires --crawl) |
| `content-title-same-as-description` | Title Same as Meta Description | 4 | warn | Detects identical title tag and meta description text |
| `content-duplicate-h1` | Duplicate H1 Across Pages | 5 | warn | Detects pages whose H1 text is identical to another crawled page (requires --crawl) |
| `content-mojibake` | Mojibake In Visible Text | 8 | fail | Visible text contains UTF-8 decoded as Latin-1 or Windows-1252 |
| `content-unrendered-markup` | Unrendered Markup | 6 | warn | Literal Markdown such as **bold** outside code and pre |
| `content-placeholder-text` | Placeholder Text | 8 | warn/fail | Unrendered template syntax or TODO/FIXME notes in visible text |
| `content-stale-copyright` | Stale Copyright Year | 2 | warn | Footer copyright year is behind the current year |
| `content-date-agreement` | Date Agreement | 5 | warn | datePublished, time datetime, and a year in the URL disagree |
| `content-hidden-text` | Hidden Text | 6 | warn | Long text hidden with an inline style, excluding nav, dialogs, and sr-only |
| `content-thin-vs-site` | Thin Versus Site Norm | 4 | warn | A page is not far shorter than the median page of the same kind (requires --crawl) |
| `content-title-pattern` | Title Template | 3 | warn | The title keeps the suffix most of the site uses (requires --crawl) |

#### content-word-count
- **Pass:** >= 300 words. **Warn:** 100-299 (thin). **Fail:** < 100 (extremely thin).
- **Fix:** Expand content to 300+ words; 500+ for standard pages, 1000+ for articles.

#### content-reading-level
- **Optimal:** 60-70 Flesch-Kincaid (8th grade level, accessible to general audience).
- **Fix:** Use shorter sentences, simpler vocabulary, bullet points.

#### content-keyword-stuffing
- **Fix:** Write naturally for users. Use synonyms and related terms instead of repeating keywords.

#### content-heading-hierarchy
- **Valid:** H1 -> H2 -> H3. **Invalid:** H1 -> H3 (skips H2).
- **Fix:** Use proper heading sequence without skipping levels.

#### content-heading-length
- **Too short:** under 10 characters. **Too long:** over 70 characters. Either warns; empty headings are not counted. Keep headings meaningful and concise.

#### content-heading-unique
- **Fix:** Write unique headings for each section. Duplicate headings confuse content structure.

#### content-text-html-ratio
- **Fix:** Increase visible text content relative to HTML markup. Remove unnecessary code.

#### content-title-same-as-h1
- **Fix:** Differentiate the title tag and H1. Title for SERPs, H1 for on-page context.

#### content-title-pixel-width / content-description-pixel-width
- **Fix:** Keep title under ~580px and description under ~920px to avoid SERP truncation.

#### content-duplicate-exact / content-duplicate-near
- **Fix:** Consolidate duplicate pages with canonical tags or 301 redirects. Rewrite near-duplicate content.

#### content-broken-html
- **Fix:** Use an HTML validator. Fix duplicate IDs, invalid nesting, empty elements.

#### content-meta-in-body
- **What it checks:** `<meta>`, `<title>`, `<link rel="canonical">`, and icon links inside `<body>`. Microdata `<meta itemprop>` and RDFa `<meta property>` inside a `typeof` or `vocab` element are structured data and pass.
- **Fix:** Move document `<meta>`, `<title>`, and `<link rel="canonical">` tags to `<head>`.

#### content-mime-type
- **Fix:** Configure server to send `Content-Type: text/html; charset=utf-8`.

#### content-duplicate-description
- **Fix:** Write unique, compelling descriptions (120-160 chars) for each page.

#### content-title-same-as-description
- **What it checks:** The title tag and meta description contain identical text. Title and description serve different purposes in search results; identical text wastes the SERP snippet
- **Fix:** Write a distinct meta description that expands on the title and encourages clicks from search results

#### content-duplicate-h1
- **What it checks:** This page's H1 is the exact same text as the H1 of at least one other crawled page. Identical H1s suggest templated or duplicated content. Requires `--crawl`. A missing or empty H1 reports not measured, because the heading rules cover that case
- **Fix:** Give each page a distinct H1 that describes its specific content

#### content-mojibake
- **Fail:** Visible text contains a UTF-8 sequence decoded as Latin-1 or Windows-1252, such as a curly apostrophe shown as `â€™`.
- **Fix:** Re-save the source as UTF-8 and serve `charset=utf-8`.

#### content-unrendered-markup
- **Warn:** Literal Markdown (`**bold**`, `[label](url)`) outside `code` and `pre`.
- **Fix:** Render the field to HTML before publishing.

#### content-placeholder-text
- **Fail:** `{{ }}`, `{% %}`, `<% %>`, or `[object Object]` in visible text. **Warn:** `TODO:` or `FIXME:`.
- **Fix:** Render the template and remove author notes. Lorem ipsum stays on `htmlval-lorem-ipsum`.

#### content-stale-copyright
- **Warn:** A copyright year in `footer` or `role=contentinfo` is behind the current year. A range uses its end year. No footer copyright passes.

#### content-date-agreement
- **Warn:** `datePublished`, a `<time datetime>`, and a `/20xx/` path disagree on the year. `dateModified` is not compared. One source passes.

#### content-hidden-text
- **Warn:** 80 or more characters hidden by an inline style (`display:none`, `visibility:hidden`, `font-size:0`, a large negative `text-indent`, `opacity:0`). Navigation, dialogs, and `sr-only` classes are ignored. Stylesheet-only hiding is not visible to this rule.

#### content-thin-vs-site
- **Warn:** The page has fewer than half the median word count of the crawled pages of the same kind (article, product, or other), this page included. With fewer than four pages of that kind it passes. A single-page audit, or a crawl of fewer than four pages, is not measured.

#### content-title-pattern
- **Warn:** The title does not end with the suffix used on at least 60% of crawled titles. A title that is exactly the brand passes. Needs at least four pages.

---

<a id="js"></a>

### JavaScript Rendering (16 rules)

Compares the served HTML with the DOM after JavaScript runs, and checks the render for errors and failed requests.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `js-rendered-title` | Rendered Title Present | 10 | fail | A non-empty `<title>` exists in the rendered DOM after JavaScript runs (requires render; not measured with --no-cwv) |
| `js-rendered-description` | Rendered Meta Description Present | 8 | fail | A meta description exists in the rendered DOM after JavaScript runs (requires render; not measured with --no-cwv) |
| `js-rendered-h1` | Rendered H1 Present | 8 | fail | A non-empty H1 exists in the rendered DOM after JavaScript runs (requires render; not measured with --no-cwv) |
| `js-rendered-canonical` | Rendered Canonical Present | 8 | fail | A canonical link exists in the rendered DOM after JavaScript runs (requires render; not measured with --no-cwv) |
| `js-canonical-mismatch` | Canonical Mismatch (Raw vs Rendered) | 10 | fail | Canonical differs between HTML source and rendered DOM (requires render; not measured with --no-cwv) |
| `js-noindex-mismatch` | Noindex/Nofollow Mismatch (Raw vs Rendered) | 10 | fail | Noindex or nofollow in `<meta name="robots">` differs between source and rendered DOM (requires render; not measured with --no-cwv) |
| `js-title-modified` | Title Modified by JavaScript | 8 | warn | JavaScript modifies title after initial load (requires render; not measured with --no-cwv) |
| `js-description-modified` | Meta Description Modified by JavaScript | 7 | warn | JavaScript modifies description after initial load (requires render; not measured with --no-cwv) |
| `js-h1-modified` | H1 Modified by JavaScript | 7 | warn | JavaScript modifies H1 after initial load (requires render; not measured with --no-cwv) |
| `js-rendered-content` | Rendered Content Dependency | 8 | warn/fail | Main content relies on JavaScript to render (requires render; not measured with --no-cwv) |
| `js-rendered-links` | Rendered Links Dependency | 7 | warn | JavaScript adds most links: the rendered `a[href]` count is over double the source count and more than 10 higher (requires render; not measured with --no-cwv) |
| `js-blocked-resources` | Blocked JavaScript Resources | 7 | warn | Same-host scripts disallowed for `User-agent: *` in robots.txt; stylesheets are not checked |
| `js-ssr-check` | Server-Side Rendering Check | 10 | warn/fail | Checks if server-side rendering is implemented |
| `js-console-errors` | JavaScript Console Errors | 8 | warn/fail | Uncaught exceptions (fail) and console errors (warn) captured while rendering (requires render; not measured with --no-cwv) |
| `js-failed-requests` | Failed Resource Requests | 8 | warn/fail | Subresources that failed to load while rendering; a failed script, stylesheet, document, fetch or XHR fails (requires render; not measured with --no-cwv) |
| `js-document-write` | No document.write() | 7 | warn | Inline scripts do not use `document.write()` |

#### js-rendered-title / js-rendered-description / js-rendered-h1 / js-rendered-canonical
- **What it checks:** The title, meta description, H1 and canonical link in the DOM after JavaScript runs. Each rule fails when its element is missing or empty there, so an element injected by JavaScript passes. Not measured with `--no-cwv`.
- **Fix:** Output these elements in the server HTML (SSR or static generation) so they are present before and after JavaScript runs.

#### js-canonical-mismatch / js-noindex-mismatch
- **What it checks:** The canonical URL, and `noindex` or `nofollow` in `<meta name="robots">`, compared between the served HTML and the rendered DOM. The X-Robots-Tag header is not compared. Not measured with `--no-cwv`.
- **Fix:** Ensure the rendered DOM matches the initial HTML for canonical and indexing directives (noindex, nofollow). Avoid JavaScript that modifies these elements, and set the directives in server-side HTML instead.

#### js-title-modified / js-description-modified / js-h1-modified
- **Fix:** Set title, description, and H1 server-side. Avoid client-side JavaScript that overwrites them.

#### js-rendered-content
- **What it checks:** Visible body text length in the served HTML against the rendered DOM. Fails when the served HTML has under 100 characters and the render over 500; warns when the render has more than three times the served text. Not measured with `--no-cwv`.
- **Fix:** Render main content server-side. Use SSR or static generation for content-heavy pages.

#### js-rendered-links
- **Fix:** Include internal navigation links in the initial HTML so crawlers can discover them without executing JavaScript.

#### js-blocked-resources
- **What it checks:** Same-host `<script src>` URLs against the `Disallow` lines of the `User-agent: *` group, by prefix or `*` wildcard. `Allow` lines are not read and stylesheets are not checked. Passes when no robots.txt was fetched.
- **Fix:** Unblock JavaScript and CSS in robots.txt so search engines can render the page correctly.

#### js-ssr-check
- **Fix:** Implement SSR, SSG, or pre-rendering for JavaScript-heavy sites. Verify with `view-source:` that content is in the HTML.

---

<a id="a11y"></a>

### Accessibility (36 rules)

Checks for WCAG compliance, screen reader support, and keyboard navigation.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `a11y-aria-labels` | ARIA Labels | 10 | warn/fail | Interactive elements have accessible names |
| `a11y-color-contrast` | Color Contrast | 8 | warn | Heuristic check of inline-style colours for likely low contrast; not measured when no element has an inline colour |
| `a11y-focus-visible` | Focus Visible | 8 | warn/fail | Checks for focus indicator styles |
| `a11y-form-labels` | Form Labels | 10 | warn/fail | Form inputs have associated labels |
| `a11y-heading-order` | Heading Order | 8 | warn/fail | Heading levels don't skip |
| `a11y-landmark-regions` | Landmark Regions | 6 | warn | Page has main, nav, header and footer landmarks; several `<main>` elements or unlabelled `<nav>`s also warn |
| `a11y-link-text` | Link Text | 8 | warn/fail | Descriptive link text |
| `a11y-skip-link` | Skip Link | 6 | warn | Skip-to-content link present |
| `a11y-table-headers` | Table Headers | 6 | warn/fail | Data tables have proper headers |
| `a11y-touch-targets` | Touch Targets | 6 | warn | Minimum 44x44px touch target size |
| `a11y-video-captions` | Video Captions | 8 | warn/fail | Videos have captions or transcripts |
| `a11y-zoom-disabled` | Zoom Disabled | 10 | fail | Viewport doesn't disable user zoom |
| `a11y-aria-hidden-focusable` | aria-hidden Not Over Focusable Content | 4 | fail | aria-hidden not on body or wrapping focusable elements |
| `a11y-aria-valid` | Valid ARIA Roles and Attributes | 5 | fail | ARIA roles exist and aria-* attributes are spelled correctly |
| `a11y-accesskey-unique` | Unique Access Keys | 2 | warn | No accesskey assigned to more than one element |
| `a11y-duplicate-id` | Unique Element IDs | 4 | warn/fail | No ID reused where ARIA or labels reference it |
| `a11y-empty-heading` | Headings Contain Content | 5 | fail | No heading element is empty or inaccessible |
| `a11y-form-multiple-labels` | Single Label Per Field | 3 | warn | No form control targeted by more than one `<label>` |
| `a11y-identical-links-purpose` | Identical Links Same Purpose | 4 | warn | Links sharing text point to the same destination |
| `a11y-iframe-title` | Frame Titles | 5 | fail | `<iframe>` and `<frame>` elements have a title |
| `a11y-input-image-alt` | Image Button Alt Text | 4 | fail | `<input type="image">` elements have alt text |
| `a11y-label-name-mismatch` | Accessible Name Matches Visible Label | 3 | warn | aria-label contains the element visible text |
| `a11y-button-name` | Button Accessible Name | 6 | warn | Buttons and role=button controls have an accessible name |
| `a11y-autocomplete` | Autocomplete Tokens | 3 | warn | Email and tel inputs set the matching autocomplete token |
| `a11y-xml-lang-mismatch` | lang and xml:lang Mismatch | 3 | warn | lang and xml:lang on html name the same language |
| `a11y-aria-hidden-body` | aria-hidden on Document | 8 | fail | html and body are not aria-hidden |
| `a11y-aria-required` | Required ARIA Structure | 4 | warn | Explicit ARIA widget roles have their required parent and child roles |
| `a11y-list-structure` | List Structure | 4 | fail | Lists contain only list items; items sit inside a list |
| `a11y-main-landmark` | Main Landmark | 5 | warn/fail | Page has exactly one `<main>` or role="main" |
| `a11y-object-alt` | Object Alternative Text | 3 | fail | `<object>` elements provide a text alternative |
| `a11y-presentation-role-conflict` | Presentation Role Conflicts | 3 | warn | role="none"/"presentation" not negated by ARIA or focusability |
| `a11y-redundant-alt` | Non-Redundant Alt Text | 3 | warn | Alt text does not duplicate adjacent link or caption text |
| `a11y-svg-img-alt` | SVG Image Alt Text | 3 | fail | SVGs with an img role have an accessible name |
| `a11y-table-caption` | Table Captions | 3 | warn | Data tables use `<caption>` rather than a spanning cell |
| `a11y-tabindex-positive` | No Positive Tabindex | 3 | warn | No element uses a tabindex greater than 0 |
| `a11y-valid-lang-element` | Valid Element Language Tags | 2 | warn | Element lang attributes are well-formed BCP 47 |

#### a11y-aria-labels
- **Fix:** Add `aria-label`, visible text content, or `title` to interactive elements (buttons, links, inputs).

#### a11y-color-contrast
- **What it checks:** Inline `style` colours only, by heuristic: text and background colour names from a known low-contrast list (such as yellow on white), light grey text, and text over a `background-image` with no `background-color`. It computes no contrast ratio. Not measured when no element has an inline colour or background image.
- **Fix:** Ensure minimum 4.5:1 contrast ratio for normal text, 3:1 for large text.

#### a11y-focus-visible
- **Fix:** Keep visible focus indicators. Use `:focus-visible` for keyboard-only focus styles.

#### a11y-form-labels
- **Fix:** Add `<label for="inputId">` or `aria-label` to all form inputs. Placeholder is not a substitute.

#### a11y-heading-order
- **Fix:** Use proper heading sequence (H1 -> H2 -> H3). Don't skip levels.

#### a11y-landmark-regions
- **What it checks:** Warns when `<main>`, `<nav>`, `<header>` or `<footer>` (or the matching ARIA role) is missing, when the page has more than one `<main>`, or when it has several `<nav>` elements and not all are labelled.
- **Fix:** Add `<main>`, `<nav>`, `<header>`, `<footer>` elements for screen reader navigation.

#### a11y-link-text
- **Bad:** "click here", "read more". **Fix:** Use descriptive text that makes sense out of context.

#### a11y-skip-link
- **Fix:** Add `<a href="#main" class="skip-link">Skip to content</a>` before navigation.

#### a11y-table-headers
- **Fix:** Use `<th scope="col">` for column headers, `<th scope="row">` for row headers.

#### a11y-touch-targets
- **What it checks:** A heuristic, not a rendered measurement: inline `width` or `height` on links, buttons and other focusable controls; `<style>` rules that size `a`, `button`, `.btn` or `role=button` under 44px; images inside links or buttons with `width` or `height` under 44; and icon-only controls with inline padding under 10px.
- **Fix:** Ensure interactive elements are at least 44x44 CSS pixels (WCAG 2.5.5 Target Size, Level AAA). The Level AA minimum in WCAG 2.5.8 is 24x24.

#### a11y-video-captions
- **Fix:** Add `<track kind="captions">` to video elements or provide a transcript link nearby.

#### a11y-zoom-disabled
- **Fix:** Remove `user-scalable=no` and `maximum-scale=1` from the viewport meta tag.

#### a11y-aria-hidden-focusable
- **Fix:** Add `tabindex="-1"` to focusable descendants, or use `display:none`/`hidden` instead.

#### a11y-aria-valid
- **Fix:** Correct the spelling (`aria-lable` -> `aria-label`) and use a role from the WAI-ARIA specification.

#### a11y-accesskey-unique
- **Fix:** Give each `accesskey` a distinct value, or remove them. Browser shortcut conflicts make them unreliable.

#### a11y-duplicate-id
- **Note:** IDs duplicated only inside `<svg>` (e.g. `clipPath` defs from a repeated inline icon) are referenced by `url(#id)`, not ARIA, and pass.
- **Fix:** Make IDs unique, especially any that ARIA or a label targets.

#### a11y-empty-heading
- **Fix:** Give the heading text, or remove it. An image inside a heading needs non-empty `alt`.

#### a11y-form-multiple-labels
- **Fix:** Keep one `<label for>` per control; move supplementary text to `aria-describedby`.

#### a11y-identical-links-purpose
- **Fix:** Make the link text or `aria-label` unique per destination.

#### a11y-iframe-title
- **Fix:** Add `title="..."` describing the frame's contents.

#### a11y-input-image-alt
- **Fix:** Add `alt="..."` describing what submitting the form does.

#### a11y-label-name-mismatch
- **Fix:** Make the accessible name contain the visible text.

#### a11y-list-structure
- **Fix:** Put only `<li>` (plus `<script>`/`<template>`) directly inside `<ul>`/`<ol>`, and keep `<dt>`/`<dd>` within a `<dl>`.

#### a11y-main-landmark
- **Fix:** Wrap the primary content in a single `<main>` element.

#### a11y-object-alt
- **Fix:** Provide fallback content inside the `<object>`, or an `aria-label`.

#### a11y-presentation-role-conflict
- **Fix:** Remove global ARIA attributes and focusability from elements with `role="none"`/`"presentation"`.

#### a11y-redundant-alt
- **Fix:** Use `alt=""` when the image sits beside text that already says the same thing.

#### a11y-svg-img-alt
- **Fix:** Add `<title>` as the SVG's first child, or an `aria-label`.

#### a11y-table-caption
- **Fix:** Use `<caption>` rather than a first row whose single cell spans the table.

#### a11y-tabindex-positive
- **Fix:** Use `tabindex="0"` and rely on DOM order; a positive value overrides the whole page's tab sequence.

#### a11y-valid-lang-element
- **Fix:** Use a BCP 47 tag (`en`, `pt-BR`) so screen readers switch pronunciation correctly.

#### a11y-aria-required
- **Warn:** An element with an explicit `role` is missing its required parent (`tab` inside `tablist`, `option` inside `listbox`, and the same for menu, list, and tree) or a widget role has none of its required children. A normal `ul`/`li` is not flagged.

---

<a id="social"></a>

### Social (9 rules)

Validates Open Graph, Twitter Cards, and social sharing metadata.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `social-og-title` | Open Graph Title | 1 | warn/fail | `og:title` tag with content. Missing or empty fails; declared with `name=` instead of `property=` warns |
| `social-og-description` | Open Graph Description | 1 | warn/fail | `og:description` tag with content. Missing or empty fails; declared with `name=` instead of `property=` warns |
| `social-og-image` | Open Graph Image | 1 | warn/fail | `og:image` tag with an absolute http(s) URL. Missing or empty fails; any other URL, or a `name=` declaration, warns |
| `social-og-image-size` | Open Graph Image Size | 1 | warn/fail | Declared `og:image:width` and `og:image:height`: missing tags or under 1200x630 warn; under 200x200, or no `og:image`, fails |
| `social-og-url` | Open Graph URL | 1 | warn/fail | `og:url` tag with an absolute http(s) URL. Missing or empty fails; any other URL, or a `name=` declaration, warns |
| `social-og-url-canonical` | Open Graph URL Matches Canonical | 1 | warn/fail | `og:url` matches the canonical URL. A mismatch, or a canonical with no `og:url`, fails; `og:url` alone, or neither, warns |
| `social-twitter-card` | Twitter Card | 1 | warn/fail | `twitter:card` tag with a known type (summary, summary_large_image, app, player). Missing or empty fails; an unknown type warns |
| `social-share-buttons` | Social Share Buttons | 1 | warn | Checks for social sharing buttons |
| `social-profiles` | Social Profile Links | 1 | warn | Checks for links to social media profiles |

#### social-og-title / social-og-description / social-og-image
- **What it checks:** Each tag must exist with non-empty content; a missing or empty tag fails. A tag declared with `name=` (for example `<meta name="og:title">`) instead of `property=` is still found, and warns. `og:image` must be an absolute http(s) URL; any other value warns.
- **Fix:** Add `<meta property="og:title">`, `og:description`, and `og:image` (1200x630px) for social sharing.

#### social-og-image-size
- **Fix:** Add `og:image:width` (1200) and `og:image:height` (630) meta tags.

#### social-og-url / social-og-url-canonical
- **What it checks:** `social-og-url` applies the same presence, `name=` and absolute-URL checks as `og:image`. `social-og-url-canonical` compares `og:url` with the canonical after lowercasing the host and dropping a trailing slash: a mismatch, or a canonical with no `og:url`, fails; `og:url` with no canonical, or neither tag, warns.
- **Fix:** Set `og:url` to match the canonical URL exactly.

#### social-twitter-card
- **Fix:** Add `<meta name="twitter:card" content="summary_large_image">`.

#### social-share-buttons
- **Fix:** Add share buttons for Facebook, Twitter/X, LinkedIn. 2+ platforms recommended.

#### social-profiles
- **Fix:** Add profile links in header/footer. Include in Organization schema `sameAs`. 3+ profiles recommended.

---

<a id="eeat"></a>

### E-E-A-T (16 rules)

Experience, Expertise, Authority, and Trust signals for content quality.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `eeat-about-page` | About Page | 8 | warn | Checks for About/About Us page |
| `eeat-affiliate-disclosure` | Affiliate Disclosure | 5 | warn | Checks affiliate content has FTC disclosure |
| `eeat-author-byline` | Author Bylines | 8 | warn | Checks for author attribution |
| `eeat-author-expertise` | Author Expertise | 8 | warn | Checks for author credentials and bio; not measured when the page has no author |
| `eeat-citations` | Citations | 6 | warn | Links in the page content to authoritative sources; nav, header, footer and aside links do not count |
| `eeat-contact-page` | Contact Page | 8 | warn | Checks for contact information |
| `eeat-content-dates` | Content Dates | 8 | warn | Checks for datePublished/dateModified |
| `eeat-disclaimers` | Disclaimers | 4 | warn | Checks YMYL content has appropriate disclaimers |
| `eeat-editorial-policy` | Editorial Policy | 4 | warn | Checks for editorial policy page |
| `eeat-physical-address` | Physical Address | 6 | warn | Checks for business address |
| `eeat-privacy-policy` | Privacy Policy | 8 | warn | Checks for privacy policy link |
| `eeat-terms-of-service` | Terms of Service | 6 | warn | Checks for ToS link |
| `eeat-trust-signals` | Trust Signals | 6 | pass only | Lists the trust signals found, such as reviews, certifications and badges; always passes |
| `eeat-ymyl-detection` | YMYL Detection | 5 | pass only | Detects Your Money or Your Life content and its categories; always passes |
| `eeat-geo-meta` | Geo Meta Tags | 2 | warn | A page with local-business schema also sets a geo meta tag |
| `eeat-nap-consistency` | NAP Consistency | 4 | warn | One organization name keeps a single phone number and address across the crawl's JSON-LD (requires --crawl) |

#### eeat-about-page
- **Fix:** Add an "About" or "About Us" page explaining who you are and your expertise.

#### eeat-affiliate-disclosure
- **Fix:** Add FTC-compliant disclosure near affiliate content: "This post contains affiliate links."

#### eeat-author-byline / eeat-author-expertise
- **Fix:** Add visible author name with link to bio page. Include credentials, professional background, and social links.

#### eeat-citations
- **What it checks:** External links in the content to recognised authoritative hosts: government (.gov, .mil), education (.edu, .ac.*), .org and health organisations, research (PubMed, arXiv, DOI and others) and major news sites. Links in nav, header, footer and aside, and links to the publisher's own domain, do not count. Warns when the content links out but to none of these; a page with no external links passes.
- **Fix:** Link to authoritative sources (.gov, .edu, research papers, industry publications).

#### eeat-contact-page
- **Fix:** Add a contact page with email, phone, contact form, and/or physical address.

#### eeat-content-dates
- **Fix:** Add `datePublished` and `dateModified` to Article schema, or use `<time>` elements.

#### eeat-disclaimers
- **Fix:** Add appropriate disclaimers for medical, financial, or legal content (YMYL topics).

#### eeat-editorial-policy
- **Fix:** Add an editorial policy page documenting content standards, fact-checking process.

#### eeat-physical-address
- **Fix:** Add business address using Schema.org PostalAddress in Organization or LocalBusiness schema.

#### eeat-privacy-policy / eeat-terms-of-service
- **Fix:** Add privacy policy and terms of service links in the footer of every page.

#### eeat-trust-signals
- **Always passes.** Lists the trust signal types found (security, business, review, media, payment and professional badges, review schema, and customer counts) and recommends more when fewer than three types appear.
- **Fix:** Display customer reviews, certifications, security badges, or media mentions.

#### eeat-ymyl-detection
- **Always passes.** Reports whether the page covers YMYL (Your Money or Your Life) topics, with the matched categories and a confidence level. `eeat-disclaimers` uses the same detection.

#### eeat-nap-consistency
- **Warn:** One organization name publishes more than one phone number or postal address in the crawl's JSON-LD. Different names are treated as different places. Needs a crawl of at least two pages; a crawl with no JSON-LD is not measured.

---

<a id="url"></a>

### URL Structure (14 rules)

Analyzes URL formatting, keywords, parameters, and common issues.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `url-slug-keywords` | Slug Keywords | 15 | warn/fail | URL slug contains descriptive keywords |
| `url-stop-words` | URL Stop Words | 10 | warn | Warns when stop words such as a, the and of make up more than 40% of the words in the URL path |
| `url-uppercase` | Uppercase Letters in URL | 5 | warn | Detects uppercase characters in URLs |
| `url-underscores` | Underscores in URL | 4 | warn | Detects underscores instead of hyphens |
| `url-double-slash` | Double Slashes in URL Path | 5 | fail | Detects `//` in URL path |
| `url-spaces` | Spaces in URL | 6 | fail | Detects encoded spaces (%20) in URLs |
| `url-non-ascii` | Non-ASCII Characters in URL | 4 | warn | Detects non-ASCII characters in URLs |
| `url-length` | URL Length | 5 | warn/fail | Checks URL total length |
| `url-repetitive-path` | Repetitive Path Segments | 4 | fail | Detects the same path segment repeated back to back, such as `/blog/blog/` |
| `url-parameters` | Excessive URL Parameters | 5 | warn/fail | Detects excessive query parameters |
| `url-session-ids` | Session IDs in URL | 7 | fail | Detects session IDs in URLs |
| `url-tracking-params` | Tracking Parameters in URL | 5 | warn | Detects UTM and tracking parameters |
| `url-internal-search` | Internal Search URL | 4 | warn | Warns when the URL looks like an internal search results page: a search parameter such as `q` or `s`, or a `/search` path with a query |
| `url-http-https-duplicate` | HTTP/HTTPS Canonical Mismatch | 4 | warn | Warns when an absolute canonical URL uses a different protocol (HTTP vs HTTPS) than the page |

#### url-slug-keywords
- **Good:** `/blue-running-shoes`. **Bad:** `/product-12345`, `/?p=123`.
- **Fix:** Use descriptive keywords in URL slugs. Avoid numeric IDs and query parameters.

#### url-stop-words
- **Fix:** Remove unnecessary stop words. Prefer `/best-running-shoes` over `/the-best-running-shoes-for-you`.

#### url-uppercase
- **Fix:** Use lowercase URLs. Set up redirects from uppercase to lowercase versions.

#### url-underscores
- **Fix:** Use hyphens (`-`) instead of underscores (`_`). Google treats hyphens as word separators.

#### url-double-slash
- **Fix:** Remove double slashes from URL paths. Configure server to normalize.

#### url-spaces
- **Fix:** Replace spaces with hyphens in URLs. Never use `%20` in permanent URLs.

#### url-non-ascii
- **Fix:** Use ASCII-only characters in URLs. Transliterate non-ASCII characters.

#### url-length
- **Thresholds:** The full URL, scheme and host included, passes at 75 characters or fewer, warns up to 200, and fails above 200.
- **Fix:** Keep URLs short and descriptive.

#### url-repetitive-path
- **Fix:** Remove repeated segments like `/shoes/shoes/blue-shoes`.

#### url-parameters
- **What it checks:** Excessive query parameters (3-5 warn, more than 5 fail), plus malformed query strings: the same parameter name repeated, or more than one literal `?` in the URL (usually a concatenation mistake)
- **Fix:** Minimize query parameters. Use clean URL paths instead. Join values of repeated parameters and ensure only one `?` separates the path from the query

#### url-session-ids
- **Fix:** Remove session IDs from URLs. Use cookies for session management instead.

#### url-tracking-params
- **Fix:** Strip UTM and tracking parameters from canonical URLs. Handle via server-side analytics.

#### url-internal-search
- **What it checks:** The URL only: a query parameter that search forms use (`q`, `s`, `query`, `search`, `keyword` and similar), or a path ending in `/search`, `/results`, `/search-results` or `/site-search` with a query string. A noindex on the page does not change the result.
- **Fix:** Block internal search result pages from indexing with noindex or robots.txt.

#### url-http-https-duplicate
- **What it checks:** An absolute canonical URL whose protocol differs from the page's, such as an HTTPS page with an `http://` canonical. A missing or relative canonical passes. The rule does not request the page over the other protocol.
- **Fix:** Make the canonical use the same protocol as the page, preferably HTTPS for both.

---

<a id="redirect"></a>

### Redirects (11 rules)

Validates redirect implementation, types, and common redirect issues.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `redirect-meta-refresh` | No Meta Refresh Redirect | 15 | warn/fail | Detects `<meta http-equiv="refresh">` redirects |
| `redirect-javascript` | No JavaScript Redirects | 12 | warn | Detects JavaScript-based redirects |
| `redirect-http-refresh` | No HTTP Refresh Header | 10 | fail | Detects Refresh HTTP header redirects |
| `redirect-loop` | No Redirect Loops | 15 | fail | Detects circular redirect chains |
| `redirect-type` | Redirect Type | 12 | warn | Warns when a hop in the page's redirect chain is temporary (302, 303, 307) rather than 301 or 308 |
| `redirect-broken` | No Broken Redirects | 15 | fail | The page's final status after its redirect chain is 4xx or 5xx |
| `redirect-resource` | No HTTP Resource Redirects | 10 | warn | HTTPS page loads stylesheets, scripts or images from `http://` URLs, which usually redirect |
| `redirect-case-normalization` | URL Case Normalization | 8 | warn | The served URL differs from its canonical only by letter case |
| `redirect-resource-broken` | No Broken Resource Redirects | 12 | fail | Redirected page resources resolve to a 4xx/5xx status (requires render; not measured with --no-cwv) |
| `redirect-resource-loop` | No Resource Redirect Loops | 12 | fail | Page resources caught in a redirect loop and never resolve (requires render; not measured with --no-cwv) |
| `redirect-resource-chain` | No Resource Redirect Chains | 8 | warn | Page resources resolve through multi-hop redirect chains (requires render; not measured with --no-cwv) |

#### redirect-meta-refresh
- **Fix:** Replace `<meta http-equiv="refresh">` with server-side 301 redirects.

#### redirect-javascript
- **Fix:** Replace `window.location` redirects with server-side 301 redirects. Crawlers may not execute JS.

#### redirect-http-refresh
- **Fix:** Replace HTTP Refresh headers with proper 301/302 status codes.

#### redirect-loop
- **Fix:** Trace the redirect chain and break the circular reference.

#### redirect-type
- **301 (permanent):** For pages that have moved permanently. Passes link equity.
- **302 (temporary):** For temporary moves only. **Fix:** Use 301 for permanent redirects.

#### redirect-broken
- **What it checks:** The page's final status after its recorded redirect chain. A 4xx or 5xx fails, including on a crawled page that was reached without any redirect. A single-page audit of such a page stops with exit code 2 (`http-error`) before rules run. Not measured when no redirect chain was recorded
- **Fix:** Update or remove redirects whose target URL returns 4xx or 5xx errors.

#### redirect-resource
- **What it checks:** On an HTTPS page, stylesheets, scripts and images whose URL starts with `http://`. No request is made: such URLs usually redirect to HTTPS. Pages served over HTTP pass
- **Fix:** Change the resource URLs to `https://`.

#### redirect-case-normalization
- **What it checks:** The URL the server finally served, after redirects, against the page's canonical URL. A difference only in letter case warns. A requested case variant that 301s to the canonical form passes
- **Fix:** Redirect every other casing of the URL to the canonical form with a 301.

#### redirect-resource-broken
- **What it checks:** Page subresources (scripts, stylesheets, images, fonts and others) whose requests were redirected and ended in a 4xx or 5xx response. The page loads without the resource. js-failed-requests reports resources that fail without a redirect. Not measured under `--no-cwv`, because per-resource redirect chains come from the Playwright render
- **Fix:** Update the resource URLs to point directly at a working destination

#### redirect-resource-loop
- **What it checks:** A page resource request that loops back to a URL already present in its own redirect chain. The browser aborts with ERR_TOO_MANY_REDIRECTS, so the page loads without that script, stylesheet, or image. Not measured under `--no-cwv`
- **Fix:** Fix the redirect target so the chain resolves to a final resource instead of looping

#### redirect-resource-chain
- **What it checks:** Page resources that resolve through redirect chains of 2 or more hops. Each extra hop adds latency. A single hop (http to https, trailing-slash normalisation) passes, and redirect-resource-loop reports looping resources instead. Not measured under `--no-cwv`
- **Fix:** Point resource URLs directly at the final destination

---

<a id="mobile"></a>

### Mobile (12 rules)

Mobile-friendliness checks for font size, viewport, and responsive layout.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `mobile-font-size` | Mobile Font Size | 15 | warn/fail | Checks for readable font sizes on mobile |
| `mobile-horizontal-scroll` | Horizontal Scroll | 15 | warn/fail | Detects elements causing horizontal scrolling |
| `mobile-interstitials` | Intrusive Interstitials | 10 | warn/fail | Detects popups and overlays covering content |
| `mobile-viewport-width` | Viewport Fixed Width | 10 | fail | Fails when the viewport meta tag sets a fixed pixel width instead of `device-width` |
| `mobile-multiple-viewports` | Multiple Viewport Tags | 8 | fail | Detects multiple viewport meta tags |
| `mobile-parity-content` | Mobile Content Parity | 10 | warn/fail | Mobile body content vs desktop render (requires --mobile) |
| `mobile-parity-title` | Mobile Title & Description Parity | 8 | warn/fail | Title/description match between renders (requires --mobile) |
| `mobile-parity-canonical` | Mobile Canonical Parity | 8 | fail | Canonical matches between renders (requires --mobile) |
| `mobile-parity-structured-data` | Mobile Structured Data Parity | 8 | fail | JSON-LD present on mobile as on desktop (requires --mobile) |
| `mobile-parity-links` | Mobile Internal Link Parity | 6 | warn | Mobile shows at least half as many links as desktop; counts every `a[href]` except fragments and `javascript:` (requires --mobile) |
| `mobile-image-maps` | Image Maps | 8 | warn | Detects `<map>`/`<area>` image maps, whose fixed-coordinate tap targets do not adapt to mobile screens |
| `mobile-viewport-content` | Viewport Meta Content | 10 | warn | Validates viewport directives: width present, initial-scale=1, no minimum-scale |

#### mobile-font-size
- **What it checks:** Font sizes in inline `style` attributes and `<style>` blocks; external stylesheets are not read. `em`, `rem` and `%` convert at 16px, so relative units are judged too. **Fail:** any size below 12px. **Warn:** an inline size from 12px up to 16px, a line-height below 1.2, or an inline `<body>` or `<html>` font size below 14px.
- **Fix:** Use minimum 16px for body text, 12px absolute minimum. Prefer rem/em units.

#### mobile-horizontal-scroll
- **Fix:** Add `max-width: 100%` to images, `overflow-x: auto` to tables, use responsive iframes.

#### mobile-interstitials
- **Skips:** Cookie consent, GDPR, age verification, login dialogs.
- **Fix:** Remove popups covering main content. Use compact banners instead of full-screen overlays.

#### mobile-viewport-width
- **Fix:** Use `width=device-width` in the viewport meta tag, not a fixed pixel width.

#### mobile-multiple-viewports
- **Fix:** Use a single `<meta name="viewport">` tag. Remove duplicates.

#### mobile-image-maps
- **What it checks:** Client-side image maps (`<map>` with `<area>` children). Their tap targets rely on precise pixel coordinates over a fixed-size image, so they do not reflow or rescale and are effectively unusable on small touch screens
- **Fix:** Replace image maps with SVG links or positioned anchors over a fluid image

#### mobile-viewport-content
- **What it checks:** The directives inside the viewport meta tag's content attribute: a `width` directive must be present, `initial-scale` must be present and equal to 1, and `minimum-scale` must not be set (it limits how far users can zoom out). Not measured when no viewport tag exists at all (handled by core-viewport-present)
- **Fix:** Use `<meta name="viewport" content="width=device-width, initial-scale=1">`

---

<a id="i18n"></a>

### Internationalization (13 rules)

Checks language declarations and multi-language hreflang implementation.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `i18n-lang-attribute` | Lang Attribute | 10 | warn/fail | Checks `lang` on `<html>` element |
| `i18n-hreflang` | Hreflang Tags | 10 | warn/fail | Validates hreflang link elements; a page without them warns only when it links to its own path under another locale prefix |
| `i18n-hreflang-return-links` | Hreflang Return Links | 12 | warn | Warns when the page's hreflang set has no entry pointing at this page (self-reference) |
| `i18n-hreflang-to-noindex` | Hreflang to Noindex Conflict | 10 | fail | Fails when this page declares hreflang and also carries noindex (robots or googlebot meta tag, or X-Robots-Tag) |
| `i18n-hreflang-to-non-canonical` | Hreflang to Non-Canonical URL | 10 | warn | Warns when the hreflang entry for this page points at a URL other than the page's canonical |
| `i18n-hreflang-to-broken` | Hreflang to Broken URLs | 10 | warn/fail | Malformed hreflang URLs; in crawl mode also targets that returned 4xx/5xx, or timed out (warn) |
| `i18n-hreflang-to-redirect` | Hreflang to Redirect | 8 | warn | Hreflang target redirects (HTTP on HTTPS site; in crawl mode also crawled 3xx targets) |
| `i18n-hreflang-conflicting` | Conflicting Hreflang Annotations | 10 | fail | Conflicting hreflang declarations |
| `i18n-hreflang-lang-mismatch` | Hreflang Lang Mismatch | 8 | warn | Warns when the primary language of `<html lang>` differs from the page's hreflang self-reference code |
| `i18n-hreflang-multiple-methods` | Hreflang Multiple Methods | 6 | warn | Warns when hreflang is declared in both HTML link tags and the HTTP Link header |
| `i18n-hreflang-relative-url` | Hreflang Relative URLs | 6 | fail | Hreflang annotations must use absolute URLs, not relative ones |
| `i18n-hreflang-x-default` | Hreflang Annotation Also X-Default | 1 | pass only | Reports when a language annotation targets the same URL as x-default (insight) |
| `i18n-hreflang-incoming-invalid` | Invalid Incoming Hreflang Annotations | 8 | fail | Hreflang annotations from other crawled pages targeting this URL use invalid language/region codes (requires --crawl) |

#### i18n-lang-attribute
- **Fix:** Add `<html lang="en">` with a valid BCP 47 language code (e.g., "en", "en-US", "zh-Hans").

#### i18n-hreflang
- **What it checks:** Each `<link rel="alternate" hreflang>`. An empty value, a code not written `xx` or `xx-YY` (lowercase language, uppercase region), or a repeated code fails. A relative href, no self-reference, or no x-default among two or more annotations warns. A page with no hreflang link elements passes when the HTTP `Link` header declares hreflang. Otherwise it warns only when the page links to its own path under another locale prefix (`/en/docs/x` to `/fr/docs/x`) and its first path segment matches `<html lang>`. Hreflang in the XML sitemap is not read.
- **Fix:** Add `<link rel="alternate" hreflang="xx" href="...">` for each language version. Include x-default.

#### i18n-hreflang-return-links
- **What it checks:** Whether the page's own hreflang set contains an entry whose href is this page (same host and path). It does not fetch the targets. In a crawl, `crawl-hreflang-reciprocity` checks that targets annotate this page in return.
- **Fix:** Add a `<link rel="alternate" hreflang="xx" href="...">` that points at the current page URL.

#### i18n-hreflang-to-noindex
- **What it checks:** This page declares hreflang link elements and also carries `noindex` in a `robots` or `googlebot` meta tag or the X-Robots-Tag header. Noindex hreflang targets are checked by `crawl-hreflang-to-noindex` in a crawl.
- **Fix:** Remove the noindex so this language version can be indexed, or remove the hreflang annotations.

#### i18n-hreflang-to-non-canonical
- **Fix:** Point hreflang to canonical URLs only. Don't reference non-canonical URL variants.

#### i18n-hreflang-to-broken / i18n-hreflang-to-redirect
- **What it checks:** Statically: empty, fragment-only, `javascript:`, unparsable or non-HTTP(S) hreflang hrefs (broken), and hreflang using HTTP on an HTTPS page (redirect heuristic). In crawl mode (`--crawl`) both rules add a live check against the crawled targets' status codes: 4xx/5xx fail as broken, fetch timeouts warn, and 3xx responses warn as redirects. Targets the crawl never visited are skipped
- **Fix:** Update hreflang targets to valid, non-redirecting URLs. All hreflang targets should return 200.

#### i18n-hreflang-conflicting
- **What it checks:** Three conflict forms: the same language/region code pointing to multiple different URLs, the same URL targeted by multiple different codes, and the current page self-referenced by multiple different codes. A language code that shares its target with x-default is not a conflict, because x-default is a fallback declaration.
- **Fix:** Resolve conflicting hreflang declarations. Each language/region pair should map to exactly one URL, each URL to exactly one code, and the page should self-reference under a single code.

#### i18n-hreflang-lang-mismatch
- **What it checks:** The primary language subtag of `<html lang>` against that of the hreflang entry pointing at this page, so `en-US` matches `en`. The page text is not analysed. Without a lang attribute or a self-reference, the rule passes.
- **Fix:** Make `<html lang>` and the page's own hreflang code name the same language.

#### i18n-hreflang-multiple-methods
- **What it checks:** Hreflang declared both in HTML `<link rel="alternate" hreflang>` tags and in an HTTP `Link` header on the same page. Hreflang in the XML sitemap is not read.
- **Fix:** Use a single method for hreflang: HTML link tags, HTTP headers, or sitemap. Don't mix methods.

#### i18n-hreflang-relative-url
- **What it checks:** Hreflang annotations whose href is a relative URL (`/fr/`, `fr/page`, or protocol-relative `//example.com/fr/`). Targets must be absolute URLs including the protocol; relative ones are invalid per the hreflang specification and may break the entire annotation set
- **Fix:** Rewrite hreflang hrefs as absolute URLs (e.g. `https://example.com/fr/`)

#### i18n-hreflang-x-default
- **What it checks:** Insight-level: the URL targeted by the x-default annotation is also targeted by a language/region annotation on the same page. This is not an error: x-default is the fallback shown when no language matches. The rule reports the overlap so you can confirm it is deliberate, and always passes.
- **Fix:** No action required; confirm the overlap is intentional

#### i18n-hreflang-incoming-invalid
- **What it checks:** The incoming counterpart to i18n-hreflang's outgoing validation: other crawled pages pointing hreflang annotations AT this URL must use valid language/region codes (`xx` or `xx-YY`; x-default is always valid). An invalid code makes the annotation unusable, so this page loses the cluster membership the source page tried to declare. Crawl mode only
- **Fix:** Fix the annotations on the source pages to use valid ISO 639-1 language codes with optional ISO 3166-1 Alpha-2 region codes (e.g. "en", "en-GB")

---

<a id="htmlval"></a>

### HTML Validation (11 rules)

Validates HTML document structure, DOCTYPE, charset, and common markup issues.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `htmlval-missing-doctype` | DOCTYPE Declaration | 15 | fail | Checks that the document starts with a `<!DOCTYPE>` declaration; any DOCTYPE passes |
| `htmlval-missing-charset` | Charset Declaration | 15 | warn/fail | Checks for charset declaration |
| `htmlval-invalid-head` | Valid Head Elements | 10 | warn | Checks head contains only valid elements |
| `htmlval-noscript-in-head` | Noscript in Head | 5 | warn | Warns when a `<noscript>` in `<head>` contains elements other than `<link>`, `<style>` and `<meta>` |
| `htmlval-multiple-heads` | Single Head Element | 10 | fail | Detects multiple `<head>` elements |
| `htmlval-size-limit` | HTML Document Size | 8 | warn/fail | Checks HTML document size |
| `htmlval-lorem-ipsum` | No Placeholder Text | 5 | fail | Detects placeholder lorem ipsum text |
| `htmlval-multiple-titles` | Single Title Element | 12 | fail | Detects multiple `<title>` tags |
| `htmlval-multiple-descriptions` | Single Meta Description | 10 | fail | Detects multiple meta description tags |
| `htmlval-title-outside-head` | Title Element Inside Head | 12 | fail | Detects `<title>` elements placed outside of `<head>` |
| `htmlval-base-url` | Valid Base URL | 6 | warn/fail | Checks the document has at most one `<base>` element with a valid href |

#### htmlval-missing-doctype
- **Fix:** Add `<!DOCTYPE html>` as the first line of every HTML document.

#### htmlval-missing-charset
- **Fix:** Add `<meta charset="utf-8">` as the first element in `<head>`.

#### htmlval-invalid-head
- **What it checks:** Start tags in the served source between `<head>` and `</head>` (or `<body>`), leaving out comments and the content of script, style, template and `<noscript>`. Body elements such as `div`, `span`, `p`, `img`, `a`, `form`, `table`, lists and `h2` to `h6` warn. The rule reads the source because the parsed DOM has already moved these elements into `<body>`.
- **Fix:** Only place valid elements in `<head>`: meta, title, link, script, style, base, noscript.

#### htmlval-noscript-in-head
- **Fix:** Move `<noscript>` elements from `<head>` to `<body>` (except for simple link/style fallbacks).

#### htmlval-multiple-heads
- **Fix:** Ensure only one `<head>` element exists. Fix template or CMS generating duplicates.

#### htmlval-size-limit
- **Thresholds:** Warn above 250 KB, fail above 500 KB. Above ~2 MB, Googlebot may only crawl and index the first part of the HTML, so content and links near the end of the document can be missed entirely.
- **Fix:** Reduce HTML size by removing inline data, externalizing scripts/styles, paginating content.

#### htmlval-lorem-ipsum
- **Fix:** Replace placeholder "Lorem ipsum" text with real content before publishing.

#### htmlval-multiple-titles / htmlval-multiple-descriptions
- **Fix:** Ensure only one `<title>` tag and one `<meta name="description">` exist per page.

#### htmlval-title-outside-head
- **What it checks:** `<title>` elements placed outside of `<head>`, for example in the `<body>`. Search engines may ignore such a title, which leaves the page without a recognised title for indexing and search display. An inline SVG's own `<title>` is not counted.
- **Fix:** Move the `<title>` element into the `<head>`

#### htmlval-base-url
- **What it checks:** The `<base>` element, which sets the base URL for every relative link on the page. Fails on an empty or malformed href, a non-HTTP(S) absolute href, or multiple `<base>` elements with different hrefs; warns on multiple identical `<base>` elements (only one is allowed per document)
- **Fix:** Keep at most one `<base>` element with a valid href so relative links resolve correctly for crawlers

---

<a id="geo"></a>

### AI/GEO Readiness (13 rules)

Checks for Generative Engine Optimization: semantic HTML, content structure, and AI bot accessibility.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `geo-semantic-html` | Semantic HTML Structure | 25 | warn/fail | Checks for semantic HTML5 elements |
| `geo-content-structure` | Content Structure for AI | 25 | warn/fail | Checks content is well-structured for extraction |
| `geo-ai-bot-access` | AI Bot Access | 20 | warn/fail | Warns when robots.txt blocks some AI answer-engine crawlers with `Disallow: /`, fails when it blocks all; training-only crawlers are not penalised |
| `geo-llms-txt` | llms.txt Reference | 15 | warn | Warns when the page does not reference an llms.txt file; the file itself is not fetched |
| `geo-schema-drift` | Schema Content Drift | 15 | warn/fail | Checks schema markup matches actual content |
| `geo-content-signals` | Content-Signal Policy | 6 | warn | robots.txt Content-Signal syntax and contradictions with training-crawler blocks |
| `geo-noai-signals` | AI Opt-Out Directives | 1 | pass only | Reports noai and noimageai without scoring them down |
| `geo-agents-md` | AGENTS.md | 2 | warn | An AGENTS.md file exists and is not an HTML fallback |
| `geo-well-known` | Well-Known Agent Manifest | 1 | warn | An MCP or agent-card file exists under .well-known |
| `geo-rsl-license` | Robots License Target | 4 | warn | A robots.txt License URL resolves to a license document |
| `geo-markdown-response` | Markdown Response | 2 | warn | The origin serves Markdown for / |
| `geo-markdown-page` | Markdown For This URL | 1 | warn | A non-root URL has a Markdown representation |
| `geo-pay-per-crawl` | Pay-Per-Crawl Response | 3 | warn | An HTTP 402 response includes payment terms |

#### geo-semantic-html
- **Fix:** Use semantic elements (`<article>`, `<section>`, `<aside>`, `<nav>`, `<main>`) instead of generic `<div>` wrappers.

#### geo-content-structure
- **Fix:** Organize content with clear headings, lists, tables, and paragraphs. Use definition lists for Q&A content.

#### geo-ai-bot-access
- **What it checks:** robots.txt groups with `Disallow: /` that apply, by name or through `User-agent: *`, to 13 answer-engine crawlers (OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended and others) and 13 training crawlers (GPTBot, CCBot, Claude-Web and others). Some answer engines blocked warns; all of them blocked fails. Blocked training crawlers are listed but pass. A missing robots.txt passes.
- **Fix:** Allow the answer-engine crawlers (OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended) in robots.txt. Training crawlers such as GPTBot can stay blocked if that is your policy.

#### geo-llms-txt
- **What it checks:** The page HTML for a reference to llms.txt: `<link rel="llms">`, `<meta name="llms">`, or an `<a>` or `<link>` whose href ends in `/llms.txt` or `/.well-known/llms.txt`. The file itself is not fetched, so a site with `/llms.txt` and no reference on the page still warns.
- **Fix:** Add a `/llms.txt` file describing your site for AI systems (see llmstxt.org), and reference it, for example with `<link rel="llms" href="/llms.txt">` in `<head>`.

#### geo-schema-drift
- **Fix:** Ensure structured data (schema.org) accurately reflects the visible page content. Don't include schema for content that doesn't exist on the page.

#### geo-content-signals
- **Pass:** No `Content-Signal` line, or a valid one that does not contradict robots.txt. **Warn:** A bad key or value, or `ai-train=yes` while GPTBot, CCBot, Google-Extended, ClaudeBot, or Bytespider is `Disallow: /`.
- **Not measured:** robots.txt was not fetched.

#### geo-noai-signals
- **Pass either way.** Lists `noai` and `noimageai` from robots meta tags and `X-Robots-Tag`. Declaring them is not a penalty.

#### geo-markdown-page
- **Warn:** A URL other than `/` has neither an `Accept: text/markdown` response nor a sibling `.md` document. `/` is covered by `geo-markdown-response`.

#### geo-pay-per-crawl
- **Warn:** The response status is 402 and none of `Pay`, `Crawler-Price`, `X-Crawler-Price`, or a `Link` header containing `payment` is set. Any other status passes.

---

<a id="legal"></a>

### Legal Compliance (1 rule)

Privacy and legal compliance signals.

| Rule ID | Name | Weight | Severity | Description |
|---------|------|-------:|----------|-------------|
| `legal-cookie-consent` | Cookie Consent | 15 | warn | Checks for cookie consent mechanism |

#### legal-cookie-consent
- **Detects:** Consent platforms by name (CookieYes, OneTrust, Cookiebot, Termly, Quantcast, TrustArc, CookiePro, iubenda, Osano, Civic), cookie or consent banner classes and IDs, consent button text, and consent platform scripts.
- **Pass:** Cookie consent mechanism detected, or no tracking scripts present.
- **Warn:** Tracking scripts detected but no cookie consent mechanism found.
- **Fix:** Add a cookie consent banner using CookieYes, OneTrust, or Cookiebot.

---

## Disabling Rules

Rules are switched on and off by patterns in the `[rules]` section of `seomator.toml` (or the file passed with `--config <path>`).

| Key | Type | Default | Meaning |
|-----|------|---------|---------|
| `enable` | array of patterns | `["*"]` | Only rules that match a pattern run. Setting it replaces the default. |
| `disable` | array of patterns | `[]` | Rules that match never run. `disable` wins over `enable`. |

A pattern matches a whole rule ID. Each `*` in it matches any run of characters, so `core-*` matches every Core rule and `*` alone matches every rule.

### Disable Specific Rule
```toml
[rules]
disable = ["core-nosnippet"]
```

### Disable by Category Prefix
```toml
[rules]
disable = ["core-*", "security-*", "js-*"]
```

List every pattern in one array. A TOML table holds each key once, so a second `disable =` line is a parse error and the audit exits 2.

### Enable Only Specific Categories
```toml
[rules]
enable = ["core-*", "perf-*", "links-*"]
```

Do not add `disable = ["*"]` here: it matches every rule, and `disable` wins, so nothing runs. `perf-*` also skips the five `cwv-*` rules. To run whole categories, the `-c` flag is simpler and keeps them:

```bash
seomator audit https://example.com -c core,perf,links
```

---

## Score Calculation

1. Each rule returns a score: **0** (fail), **50** (warn), or **100** (pass)
2. Category score = weighted average of rule scores within that category
3. Overall score = weighted sum of category scores (using category weights)
4. In a single-page audit, a page-level condition caps the overall score while
   it holds: `noindex` for Google or a robots.txt disallow (20), no `<title>` and
   fewer than 20 words of main content (30), fewer than 20 words (49), no
   `<title>` (69). A crawl takes the noindex and robots.txt caps of its start
   page. The result's `scoreCap` records the uncapped average and the reasons.
   Category scores are not capped. `--staging` waives the noindex and robots.txt
   caps and records them in `waivedCaps`.

### Example
- Core SEO: 85/100 x 11% = 9.35
- Performance: 70/100 x 10% = 7.0
- Links: 90/100 x 8% = 7.2
- ...
- **Overall: Sum of all category contributions (0-100)**, then any cap from step 4

### Score Ranges
| Range | Grade | Label |
|-------|-------|-------|
| 90-100 | A | Excellent |
| 80-89 | B | Good |
| 70-79 | C | Fair |
| 50-69 | D | Needs Work |
| 0-49 | F | Poor |

---

## Resources

- **CLI:** `npm install -g @seomator/seo-audit`
- **npm:** https://www.npmjs.com/package/@seomator/seo-audit
- **GitHub:** https://github.com/seo-skills/seo-audit-skill
- **Web UI:** https://seomator.com/free-seo-audit-tool
- **Schema Validator:** https://search.google.com/test/rich-results
- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG22/quickref/
- **Core Web Vitals:** https://web.dev/vitals/
- **llms.txt Spec:** https://llmstxt.org/

## Related

- [Quickstart](./quickstart.md): install SEOmator and run a first audit.
- [Configuration](./configuration.md): `seomator.toml` keys, including `[rules]`, and CLI options.
- [Introduction](./introduction.md): an overview of SEOmator and its features.
- [AI Agent Integration](./ai-agent-integration.md): using SEOmator with Claude Code, Cursor and other AI agents.
- [Technical Architecture](./technical-architecture.md): the audit engine's data flow and components.
- [Documentation index](./README.md): all SEOmator docs.
