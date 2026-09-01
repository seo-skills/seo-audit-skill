# SEO Audit Rules Reference

> Complete reference of all 331 SEO audit rules across 20 categories (v3.3.0)

## Overview

SEOmator audits websites using 332 rules organized into 20 categories. Each rule returns one of three statuses:
- **Pass** (score: 100) - Meets best practices
- **Warn** (score: 50) - Potential issue, should address
- **Fail** (score: 0) - Critical issue, must fix

---

## Categories & Weights

| Category | Weight | Rules | Description |
|----------|--------|-------|-------------|
| [Core SEO]((#core-seo)) | 11% | 24 | Meta tags, canonical, H1, indexing directives |
| [Performance]((#performance)) | 10% | 26 | Core Web Vitals + performance optimization hints |
| [Links]((#links)) | 8% | 24 | Internal/external links, anchor text, validation |
| [Images]((#images)) | 8% | 14 | Alt text, dimensions, lazy loading, optimization |
| [Security]((#security)) | 8% | 23 | HTTPS, security headers, mixed content, SSL, cookie flags |
| [Technical SEO]((#technical-seo)) | 7% | 17 | Robots.txt, sitemap, status codes, URL structure |
| [Crawlability]((#crawlability)) | 5% | 34 | Indexability signals, sitemap conflicts, pagination, sitemap lastmod |
| [Structured Data]((#structured-data)) | 5% | 13 | JSON-LD, Schema.org markup |
| [Content]((#content)) | 5% | 19 | Text quality, readability, headings, duplicates |
| [JavaScript Rendering]((#javascript-rendering)) | 5% | 16 | SSR validation, JS-dependent SEO elements, console errors |
| [Accessibility]((#accessibility)) | 7% | 31 | WCAG compliance, ARIA, keyboard navigation |
| [Social]((#social)) | 3% | 9 | Open Graph, Twitter Cards, social profiles |
| [E-E-A-T]((#e-e-a-t)) | 3% | 14 | Experience, Expertise, Authority, Trust signals |
| [URL Structure]((#url-structure)) | 3% | 14 | Slug keywords, formatting, parameters |
| [Redirects]((#redirects)) | 3% | 11 | Redirect types, chains, loops |
| [Mobile]((#mobile)) | 2% | 12 | Font size, viewport, responsive layout |
| [Internationalization]((#internationalization)) | 2% | 13 | Language declarations, hreflang validation |
| [HTML Validation]((#html-validation)) | 2% | 11 | DOCTYPE, charset, head structure |
| [AI/GEO Readiness]((#aigeo-readiness)) | 2% | 5 | Semantic HTML, AI bot access, llms.txt |
| [Legal Compliance]((#legal-compliance)) | 1% | 1 | Cookie consent |

**Total: 100% weight, 332 rules**

---

## Core SEO

Essential SEO checks for meta tags, canonical URLs, H1 headings, and indexing directives.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `core-title-present` | Title Present | fail | Checks for `<title>` tag in document head |
| `core-title-length` | Title Length | warn | Validates title length (30-60 characters) |
| `core-description-present` | Description Present | fail | Checks for `<meta name="description">` |
| `core-description-length` | Description Length | warn | Validates description length (120-160 characters) |
| `core-canonical-present` | Canonical Present | fail | Checks for `<link rel="canonical">` |
| `core-canonical-valid` | Canonical Valid | warn | Validates canonical URL format and accessibility |
| `core-viewport-present` | Viewport Present | fail | Checks for viewport meta tag |
| `core-favicon-present` | Favicon Present | warn | Checks for favicon link tags |
| `core-h1-present` | H1 Present | fail | Checks for at least one `<h1>` tag |
| `core-h1-single` | H1 Single | warn | Validates only one `<h1>` per page |
| `core-canonical-header` | Canonical Header | warn | Detects mismatch between HTML canonical and HTTP Link header |
| `core-nosnippet` | Nosnippet Directive | warn | Detects pages blocking search engine snippets |
| `core-robots-meta` | Robots Meta | warn | Checks for noindex, nofollow, noarchive directives |
| `core-title-unique` | Title Uniqueness | warn/fail | Checks titles are unique across the site (crawl mode) |
| `core-canonical-conflicting` | Conflicting Canonicals | fail | Detects canonical URL disagreements between sources |
| `core-canonical-to-homepage` | Canonical to Homepage | warn | Flags deep pages canonicalizing to homepage |
| `core-canonical-http-mismatch` | Canonical HTTP Mismatch | warn | Detects protocol mismatch between page and canonical |
| `core-canonical-loop` | Canonical Loop | fail | Detects circular canonical references |
| `core-canonical-to-noindex` | Canonical to Noindex | fail | Detects canonicals pointing to noindexed pages |
| `core-canonical-outside-head` | Canonical Outside Head | fail | Detects `<link rel="canonical">` elements placed outside the `<head>` |
| `core-canonical-attributes` | Canonical Attributes | warn/fail | Checks canonical elements carry only `rel` and `href` attributes |
| `core-canonical-multiple` | Multiple Canonical Tags | warn/fail | Detects multiple canonical elements in the HTML and whether they agree |
| `core-robots-directive-mismatch` | Robots Directive Mismatch | warn/fail | Checks robots directives in meta tags and the X-Robots-Tag header are consistent |
| `core-canonical-external` | Canonical Points To External URL | info | Reports when the canonical URL points to a different host (insight; legitimate for syndication) |

### Rule Details

#### core-title-present
- **What it checks:** `<title>` tag exists in document `<head>`
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
- **What it checks:** Canonical URL is absolute, well-formed, and accessible (returns 200)

#### core-viewport-present
- **Fix:** Add `<meta name="viewport" content="width=device-width, initial-scale=1">`

#### core-favicon-present
- **Recommended formats:** .ico (legacy), .svg (modern), apple-touch-icon (iOS)

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
- **What it checks:** Duplicate page titles across crawled pages
- **Fix:** Create unique titles using pattern "Page Topic | Brand Name"

#### core-canonical-conflicting
- **What it checks:** Multiple canonical signals (HTML tag, HTTP header, sitemap) pointing to different URLs
- **Fix:** Ensure all canonical signals agree on the same URL

#### core-canonical-to-homepage
- **What it checks:** Non-homepage pages with canonical pointing to the homepage
- **Fix:** Set self-referencing canonical on each page

#### core-canonical-http-mismatch
- **What it checks:** HTTPS page with HTTP canonical URL (or vice versa)
- **Fix:** Match the canonical protocol to the page protocol (prefer HTTPS)

#### core-canonical-loop
- **What it checks:** Page A canonicalizes to B, and B canonicalizes back to A
- **Fix:** Break the loop by choosing one canonical target

#### core-canonical-to-noindex
- **What it checks:** Canonical URL has a noindex directive, making it unsearchable
- **Fix:** Remove noindex from the canonical target or change the canonical URL

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

## Performance

Core Web Vitals measurements and static performance optimization hints.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `cwv-lcp` | LCP | warn/fail | Largest Contentful Paint (< 2.5s good) |
| `cwv-cls` | CLS | warn/fail | Cumulative Layout Shift (< 0.1 good) |
| `cwv-inp` | INP | warn/fail | Interaction to Next Paint (< 200ms good) |
| `cwv-ttfb` | TTFB | warn/fail | Time to First Byte (< 800ms good) |
| `cwv-fcp` | FCP | warn/fail | First Contentful Paint (< 1.8s good) |
| `perf-dom-size` | DOM Size | warn/fail | Checks DOM node count, depth, and children |
| `perf-css-file-size` | CSS File Size | warn/fail | Checks external CSS count and inline CSS size |
| `perf-font-loading` | Font Loading | warn/fail | Checks font-display, preload, display=swap |
| `perf-preconnect` | Preconnect Hints | warn | Checks preconnect to critical third-party origins |
| `perf-render-blocking` | Render-Blocking | warn/fail | Checks scripts in head without async/defer |
| `perf-lazy-above-fold` | Lazy Above Fold | warn/fail | Detects lazy loading on above-fold images |
| `perf-lcp-hints` | LCP Hints | warn/fail | Checks LCP candidate for preload and fetchpriority |
| `perf-text-compression` | Text Compression | warn | Checks gzip/brotli compression on text resources |
| `perf-brotli` | Brotli Compression | warn | Checks for Brotli over gzip for better ratios |
| `perf-cache-policy` | Cache Policy | warn | Validates Cache-Control headers on static assets |
| `perf-minify-css` | Minify CSS | warn | Checks inline CSS is minified; with render data, also flags large external stylesheets lacking a `.min.` URL marker (heuristic) |
| `perf-minify-js` | Minify JS | warn | Checks inline JavaScript is minified; with render data, also flags large external scripts lacking a `.min.` URL marker (heuristic) |
| `perf-asset-cache-policy` | Static Asset Cache Policy | warn | Per-asset check: static CSS/JS/image/font responses carry a cache-control max-age of at least 1 hour (requires render; not measured with --no-cwv) |
| `perf-asset-compression` | Text Asset Compression | warn | Per-asset check: text-based assets over 2KB are served with gzip/Brotli (requires render; not measured with --no-cwv) |
| `perf-image-encoding` | Efficient Image Encoding | warn/fail | Per-asset check: images transferred over 100KB (warn) or served in legacy BMP/TIFF formats (fail) (requires render; not measured with --no-cwv) |
| `perf-response-time` | Response Time | warn/fail | Measures server response time for the page |
| `perf-http2` | HTTP/2 | warn | Checks site is served over HTTP/2 or HTTP/3 |
| `perf-page-weight` | Page Weight | warn/fail | Total page size including all resources |
| `perf-js-file-size` | JS File Size | warn/fail | Checks individual JavaScript file sizes |
| `perf-video-for-animations` | Video for Animations | warn | Suggests `<video>` over animated GIFs |
| `perf-legacy-javascript` | Legacy JavaScript | warn | Detects polyfills and transpiler runtimes modern browsers do not need |

### Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | <= 2.5s | 2.5-4.0s | > 4.0s |
| CLS | <= 0.1 | 0.1-0.25 | > 0.25 |
| INP | <= 200ms | 200-500ms | > 500ms |
| TTFB | <= 800ms | 800-1800ms | > 1800ms |
| FCP | <= 1.8s | 1.8-3.0s | > 3.0s |

### Rule Details

#### cwv-lcp / cwv-cls / cwv-inp / cwv-ttfb / cwv-fcp
- **Measured in real browser** using Chrome/Chromium. Skip with `--no-cwv`.
- **Fix LCP:** Optimize largest image, use CDN, preload LCP element
- **Fix CLS:** Set image dimensions, avoid inserting content above existing
- **Fix INP:** Optimize JavaScript, break up long tasks
- **Fix TTFB:** Use CDN, optimize server, enable caching
- **Fix FCP:** Reduce render-blocking resources, inline critical CSS

#### perf-dom-size
- **Thresholds:** <800 nodes pass, 800-1500 warn, >1500 fail; depth >32 warn
- **Fix:** Remove unused elements, use virtualization for long lists

#### perf-css-file-size / perf-js-file-size
- **Fix:** Bundle files, extract critical CSS inline, code-split JavaScript

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
- **Fix:** Set `Cache-Control: max-age=31536000` for static assets with content hashes

#### perf-minify-css / perf-minify-js
- **What it checks:** Inline CSS/JS is checked directly (whitespace ratio, and block comments for JS). When per-asset render data is available, external scripts/stylesheets over 2KB (by content-length) whose URL lacks a `.min.` marker are additionally flagged as suspects — a heuristic only, since asset bodies are not captured, and never stronger than a warn
- **Fix:** Use build tools (esbuild, terser, cssnano) to minify CSS and JavaScript

#### perf-asset-cache-policy
- **What it checks:** Static assets (stylesheets, scripts, images, fonts) observed during the rendered page load whose cache-control max-age is below 1 hour or missing. The Expires header is intentionally not consulted. Not measured under `--no-cwv` — per-asset headers come from the Playwright render
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
- **Fix:** Enable HTTP/2 on your server or CDN for multiplexed connections

#### perf-page-weight
- **Threshold:** <3MB total page weight recommended
- **Fix:** Compress images, minify code, lazy load below-fold resources

#### perf-video-for-animations
- **Fix:** Convert animated GIFs to `<video>` elements (up to 90% smaller)

---

## Links

Analyzes internal and external links, anchor text, broken links, and link quality.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `links-broken-internal` | Broken Internal | fail | Checks internal links return 200 |
| `links-external-valid` | External Valid | warn | Checks external links are accessible |
| `links-internal-present` | Internal Links | warn | Checks page has internal links |
| `links-nofollow-appropriate` | Nofollow Usage | warn | Validates nofollow is used appropriately |
| `links-anchor-text` | Anchor Text | warn | Checks for descriptive anchor text |
| `links-depth` | Page Depth | warn/fail | True click distance from the crawl entry point (requires --crawl) |
| `links-dead-end-pages` | Dead-End Pages | warn | Checks page has outgoing internal links |
| `links-https-downgrade` | HTTPS Downgrade | warn | Checks HTTPS pages don't link to HTTP |
| `links-external-count` | External Count | warn | Warns if >100 external links |
| `links-invalid` | Invalid Links | warn | Detects empty, javascript:, or malformed hrefs |
| `links-tel-mailto` | Tel & Mailto | warn | Validates tel: and mailto: link formats |
| `links-redirect-chains` | Redirect Chains | warn/fail | Detects links through multiple redirects |
| `links-orphan-pages` | Inbound Internal Links | warn/fail | Inbound internal link count (requires --crawl); true orphans via crawl-sitemap-orphan-urls |
| `links-localhost` | Localhost Links | fail | Detects links to localhost or 127.0.0.1 |
| `links-local-file` | Local File Links | fail | Detects file:// protocol links |
| `links-broken-fragment` | Broken Fragments | warn | Detects #anchor links with no matching ID |
| `links-excessive` | Excessive Links | warn | Warns when page has too many total links |
| `links-onclick` | OnClick Navigation | warn | Detects onclick-based navigation instead of hrefs |
| `links-whitespace-href` | Whitespace Href | warn | Detects href values with leading/trailing whitespace |
| `links-non-http-protocol` | Non-HTTP Protocol Links | warn | Detects anchor links using protocols other than HTTP(S), tel: or mailto: (e.g. ftp:, file:, intent:) |
| `links-inbound-all-nofollow` | Inbound Links All Nofollow | warn | Every inbound internal link is nofollow, so no link equity reaches the page (requires --crawl) |
| `links-inbound-mixed-follow` | Mixed Follow/Nofollow Inbound | warn | Page receives both followed and nofollowed internal links, suggesting inconsistent nofollow usage (requires --crawl) |
| `links-inbound-low-quality` | Inbound Links Passing No Link Equity | warn | Every inbound internal link is nofollow or comes from a page canonicalized elsewhere (requires --crawl) |
| `links-inbound-anchor-text` | Descriptive Inbound Anchor Text | warn | All followed inbound internal links use generic anchor text like "click here" (requires --crawl) |

### Rule Details

#### links-broken-internal
- **Fix:** Update or remove links returning 404. Point to correct destination URLs.

#### links-external-valid
- **Note:** Results are cached to reduce requests. Fix or remove dead external links.

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
- **What it checks:** Anchor hrefs using protocols other than HTTP(S) — `ftp:`, `file:`, `intent:`, `chrome:`, and so on. Browsers hand these to external handlers, so behavior is unpredictable and link equity is lost. Legitimate `tel:` and `mailto:` links are excluded (validated by links-tel-mailto)
- **Fix:** Prefer HTTP(S) URLs unless the non-HTTP protocol is intentional

#### links-inbound-all-nofollow / links-inbound-mixed-follow
- **What it checks:** Per-edge nofollow state of the internal links pointing at this page, from the crawl's inbound link graph. All-nofollow means the page is linked yet receives no link equity (insight-level, so it warns at most); a follow/nofollow mix usually means nofollow was applied inconsistently rather than as policy. Pages with no inbound links pass — that is links-orphan-pages' territory. Crawl mode only; not measured in a single-page audit
- **Fix:** Decide whether internal links to this page should be nofollowed and apply it consistently

#### links-inbound-low-quality
- **What it checks:** Whether any inbound internal link passes link equity at all: an edge passes equity only when it is followed AND its source page is not canonicalized to another URL (a canonicalized-away source consolidates its signals onto the canonical target). Pages with no inbound links pass — that is links-orphan-pages' territory. Crawl mode only
- **Fix:** Earn followed links from indexable, self-canonical pages so the URL receives internal link equity

#### links-inbound-anchor-text
- **What it checks:** Anchor text of followed inbound internal links: empty (image-only links), under 2 characters, or an exact match of the generic-phrase list shared with links-anchor-text ("click here", "read more", …). Warns only when every followed inbound link is generic — inbound anchor text is a relevance signal for the target page. Crawl mode only
- **Fix:** Use descriptive anchor text on internal links pointing to this page

---

## Images

Checks alt attributes, dimensions, lazy loading, optimization, and accessibility.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `images-alt-present` | Alt Present | fail | Checks all images have alt attribute |
| `images-alt-quality` | Alt Quality | warn | Validates alt text is descriptive |
| `images-dimensions` | Dimensions | warn | Checks width/height attributes present |
| `images-lazy-loading` | Lazy Loading | warn | Checks below-fold images use lazy loading |
| `images-modern-format` | Modern Format | warn | Suggests WebP/AVIF for images |
| `images-size` | Size | warn | Checks image file sizes |
| `images-responsive` | Responsive | warn | Checks srcset for responsive images |
| `images-broken` | Broken Images | fail | Checks images don't return 404 |
| `images-figure-captions` | Figure Captions | warn | Checks figure elements have figcaption |
| `images-filename-quality` | Filename Quality | warn | Checks for descriptive image filenames |
| `images-inline-svg-size` | Inline SVG Size | warn | Checks inline SVGs aren't too large (>5KB) |
| `images-picture-element` | Picture Element | fail | Validates picture elements have img fallback |
| `images-alt-length` | Alt Length | warn | Validates alt text length (5-125 characters) |
| `images-background-seo` | Background Image SEO | warn | Detects important images in CSS backgrounds |

### Rule Details

#### images-alt-present / images-alt-quality
- **Fix:** Add descriptive alt text to all images: `<img alt="Red running shoes on white background">`
- **Bad:** "image", "photo", filename. **Good:** Descriptive explanation of image content.

#### images-alt-length
- **Optimal:** 5-125 characters. Too short is meaningless; too long is keyword stuffing.

#### images-dimensions
- **Why:** Prevents CLS. **Fix:** Add `width` and `height` attributes to all images.

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
- **Fix:** Use `<img>` tags instead of CSS `background-image` for content-relevant images so search engines can index them.

---

## Security

Validates HTTPS, security headers, mixed content, SSL, and leaked secrets.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `security-https` | HTTPS | fail | Checks site uses HTTPS |
| `security-https-redirect` | HTTPS Redirect | warn | Checks HTTP redirects to HTTPS |
| `security-hsts` | HSTS | warn | Checks Strict-Transport-Security header |
| `security-csp` | CSP | warn | Checks Content-Security-Policy header |
| `security-x-frame-options` | X-Frame-Options | warn | Checks X-Frame-Options header |
| `security-x-content-type-options` | X-Content-Type | warn | Checks X-Content-Type-Options: nosniff |
| `security-external-links` | External Link Security | warn | Checks target="_blank" has noopener/noreferrer |
| `security-form-https` | Form HTTPS | warn/fail | Checks form actions use HTTPS |
| `security-mixed-content` | Mixed Content | warn/fail | Checks for HTTP resources on HTTPS pages |
| `security-permissions-policy` | Permissions-Policy | warn | Checks for Permissions-Policy header |
| `security-referrer-policy` | Referrer-Policy | warn | Checks for Referrer-Policy header |
| `security-coop` | Cross-Origin-Opener-Policy | warn | Isolates the page from windows that open it |
| `security-csp-xss` | CSP Strength Against XSS | warn/fail | Grades whether the CSP actually constrains script execution |
| `security-info-disclosure` | Software Version Disclosure | warn | Headers do not advertise server software and version |
| `security-paste-blocking` | Inputs Allow Pasting | fail | Input fields do not prevent pasting |
| `security-trusted-types` | Trusted Types | warn | CSP requires Trusted Types for DOM XSS sinks |
| `security-leaked-secrets` | Leaked Secrets | fail | Detects exposed API keys, credentials in HTML/JS |
| `security-password-http` | Password over HTTP | fail | Detects password fields on non-HTTPS pages |
| `security-protocol-relative` | Protocol-Relative URLs | warn | Detects `//example.com` URLs |
| `security-cookie-flags` | Cookie Security Flags | warn/fail | Checks Set-Cookie for Secure, HttpOnly and SameSite |
| `security-cookie-lifetime` | Cookie Lifetime | warn | Flags cookies beyond the 400-day browser cap |
| `security-ssl-expiry` | SSL Expiry | warn/fail | Checks SSL certificate is not near expiration |
| `security-ssl-protocol` | SSL Protocol | warn/fail | Checks TLS version (1.2+ required) |

### Rule Details

#### security-https / security-https-redirect
- **Fix:** Install SSL certificate, set up 301 redirect from HTTP to HTTPS.

#### security-hsts
- **Fix:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`

#### security-csp
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
- **Why:** Without COOP, any page that opens this one keeps a handle on its window and shares a browsing context group with it — the basis of tabnabbing.
- **Fix:** Send `Cross-Origin-Opener-Policy: same-origin`.

#### security-csp-xss
- **Why:** `security-csp` asks whether a policy exists; this asks whether it does anything. A policy with `'unsafe-inline'` and no nonce blocks nothing.
- **Note:** Reports at weight 0 when there is no CSP at all, so a missing policy is penalised once by `security-csp` rather than three times.
- **Fix:** Drop `'unsafe-inline'`/`'unsafe-eval'` or pair them with a nonce or hash; set `object-src 'none'` and `base-uri 'none'`.

#### security-info-disclosure
- **Why:** Naming the exact server and version tells an attacker which published vulnerabilities to try first.
- **Fix:** Remove `X-Powered-By` and `X-AspNet-Version`; strip the version from `Server`. A bare `Server: nginx` passes.

#### security-paste-blocking
- **Why:** Blocking paste breaks password managers, which pushes people toward weaker, typeable passwords — the practice makes the form less secure, not more.
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
- **Fix:** Renew SSL certificate before expiration. Set up auto-renewal.

#### security-ssl-protocol
- **Fix:** Disable TLS 1.0 and 1.1. Require TLS 1.2 or higher.

---

## Technical SEO

Validates robots.txt, sitemap, SSL, status codes, and URL structure.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `technical-robots-txt-exists` | Robots.txt Exists | warn | Checks /robots.txt is accessible |
| `technical-robots-txt-valid` | Robots.txt Valid | warn | Validates robots.txt syntax |
| `technical-sitemap-exists` | Sitemap Exists | warn | Checks for XML sitemap |
| `technical-sitemap-valid` | Sitemap Valid | warn | Validates sitemap format and entries |
| `technical-url-structure` | URL Structure | warn | Checks URL format (lowercase, hyphens) |
| `technical-trailing-slash` | Trailing Slash | warn | Checks consistent trailing slash usage |
| `technical-www-redirect` | WWW Redirect | warn | Validates www/non-www consistency |
| `technical-404-page` | 404 Page | warn | Checks for custom 404 page |
| `technical-soft-404` | Soft 404 | warn | Detects pages returning 200 but showing error content |
| `technical-server-error` | Server Error | fail | Detects 5xx server errors |
| `technical-4xx-non-404` | Non-404 Client Error | warn | Detects 4xx errors other than 404 (403, 410, etc.) |
| `technical-timeout` | Timeout | fail | Detects pages that time out |
| `technical-bad-content-type` | Bad Content-Type | warn/fail | Checks pages serve correct Content-Type header |
| `technical-empty-html` | Empty HTML | fail | Detects 200 responses with missing or empty HTML content |
| `technical-form-get-method` | Form GET Method | warn | Detects forms that submit with the GET method, exposing query-string URLs |
| `technical-duplicate-gtm` | Multiple GTM Containers | warn | Detects more than one distinct Google Tag Manager container on the page |
| `technical-duplicate-ga` | Multiple GA Properties | warn | Detects more than one distinct Google Analytics property ID (UA- or G-) on the page |

### Rule Details

#### technical-robots-txt-exists / technical-robots-txt-valid
- **Fix:** Create robots.txt with proper User-agent, Allow, Disallow, and Sitemap directives.

#### technical-sitemap-exists / technical-sitemap-valid
- **Fix:** Create sitemap.xml with all canonical URLs. Validate format and lastmod dates.

#### technical-url-structure
- **Good:** Lowercase, hyphens, descriptive. **Bad:** Uppercase, underscores, special characters.

#### technical-trailing-slash
- **Fix:** Choose one format (with or without trailing slash) and redirect the other.

#### technical-www-redirect
- **Fix:** Set up 301 redirect so www and non-www resolve to one canonical form.

#### technical-404-page
- **Fix:** Create a helpful custom 404 page with navigation links to main content.

#### technical-soft-404
- **Fix:** Return proper 404 status codes for pages that don't exist. Don't serve error content with 200.

#### technical-server-error / technical-4xx-non-404 / technical-timeout
- **Fix:** Investigate and fix server errors (5xx), access issues (403), gone pages (410), and timeout issues.

#### technical-bad-content-type
- **Fix:** Configure server to send `Content-Type: text/html; charset=utf-8` for HTML pages.

#### technical-empty-html
- **What it checks:** Pages returning HTTP 200 with an empty response body, or a document whose `<head>` and `<body>` are both empty — nothing for users or search engines to see or index
- **Fix:** Investigate why the server returns no HTML; restore the content or serve a 404/410 if the page should not exist

#### technical-form-get-method
- **What it checks:** Forms submitted with GET (the HTML default when `method` is omitted) append their input data to the action URL as a query string. Those URLs can be crawled, cached and indexed, and unrestricted inputs can generate an unbounded number of unique URLs
- **Fix:** Switch the form method to POST, or block the form action URL from crawlers via robots.txt if GET URLs are intentional

#### technical-duplicate-gtm / technical-duplicate-ga
- **What it checks:** More than one distinct Google Tag Manager container ID or Google Analytics property ID embedded in the page — usually a configuration error (e.g. a plugin adding a second snippet)
- **Fix:** Verify all containers/properties are intentional; consolidate into a single one where possible

---

## Crawlability

Validates indexability signals, sitemap conflicts, canonical chains, and pagination.

The cross-page rules (`crawl-sitemap-non-200`, `crawl-sitemap-non-canonical`, `crawl-sitemap-disallowed`, `crawl-sitemap-cross-duplicates`, `crawl-canonical-to-noindex`, `crawl-canonical-to-disallowed`, `crawl-canonical-chain`, `crawl-canonical-loop`, `crawl-hreflang-to-noindex`, `crawl-hreflang-to-disallowed`, `crawl-hreflang-disallowed-target`, `crawl-pagination-isolated`, `crawl-hreflang-incoming-conflict`, `crawl-hreflang-reciprocity`, `crawl-isolated-url`) need the per-URL state recorded during a multi-page crawl, so they only measure with `--crawl`; in a single-page audit they report as not measured (weight 0, excluded from the score).

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `crawl-schema-noindex-conflict` | Schema + Noindex | fail | Rich result schema on noindexed pages |
| `crawl-pagination-canonical` | Pagination Canonical | warn/fail | Paginated pages have self-referencing canonicals |
| `crawl-sitemap-domain` | Sitemap Domain | warn/fail | All sitemap URLs match expected domain |
| `crawl-noindex-in-sitemap` | Noindex in Sitemap | fail | Noindexed pages listed in sitemap |
| `crawl-indexability-conflict` | Indexability Conflict | warn | Conflict between robots.txt and noindex meta |
| `crawl-canonical-redirect` | Canonical Redirect | warn/fail | Canonical URL redirects to another URL |
| `crawl-sitemap-url-limit` | Sitemap URL Limit | warn | Sitemap exceeds 50,000 URL limit |
| `crawl-sitemap-size-limit` | Sitemap Size Limit | warn | Sitemap file exceeds 50MB uncompressed limit |
| `crawl-sitemap-duplicate-urls` | Sitemap Duplicates | warn | Duplicate URLs within sitemap |
| `crawl-sitemap-orphan-urls` | Sitemap Orphan URLs | warn | Sitemap URLs not linked from the site |
| `crawl-blocked-resources` | Blocked Resources | warn | CSS/JS blocked by robots.txt |
| `crawl-blocked-images` | Blocked Images | fail | Image URLs disallowed by robots.txt cannot be crawled for image indexing |
| `crawl-crawl-delay` | Crawl Delay | info | Detects crawl-delay directive in robots.txt |
| `crawl-sitemap-in-robotstxt` | Sitemap in Robots.txt | warn | Sitemap not referenced in robots.txt |
| `crawl-sitemap-lastmod` | Sitemap lastmod Quality | warn | Invalid, future-dated or bulk-identical lastmod values |
| `crawl-pagination-broken` | Pagination Broken | fail | Paginated page links are broken (404) |
| `crawl-pagination-loop` | Pagination Loop | fail | Pagination creates circular links |
| `crawl-pagination-sequence` | Pagination Sequence | warn | Pagination sequence has gaps or inconsistencies |
| `crawl-pagination-noindex` | Pagination Noindex | warn | Paginated pages have noindex |
| `crawl-pagination-orphaned` | Pagination Orphaned | warn | Paginated pages not linked from main navigation |
| `crawl-pagination-isolated` | Pagination URL Without Incoming Links | fail | Paginated URL has no incoming internal anchor links (crawl mode) |
| `crawl-sitemap-non-200` | Non-200 URLs in Sitemap | warn/fail | Sitemap URLs cross-referenced against crawled status codes; 4xx/5xx fail, 3xx and timeouts warn (crawl mode) |
| `crawl-sitemap-non-canonical` | Canonicalised URLs in Sitemap | fail | Sitemap URLs whose canonical resolves to a different URL (crawl mode) |
| `crawl-sitemap-disallowed` | Disallowed URLs in Sitemap | fail | Sitemap URLs disallowed by robots.txt (crawl mode) |
| `crawl-sitemap-cross-duplicates` | URLs in Multiple Sitemaps | warn | URLs declared by more than one sitemap document (crawl mode) |
| `crawl-canonical-to-noindex` | Canonical Points To Noindex URL | fail | Canonical target is itself noindex (crawl mode) |
| `crawl-canonical-to-disallowed` | Canonical Points To Disallowed URL | fail | Canonical target is disallowed by robots.txt (crawl mode) |
| `crawl-canonical-chain` | Canonical Chain | warn | Canonical target is itself canonicalized elsewhere (crawl mode) |
| `crawl-canonical-loop` | Canonical Loop | fail | Canonical targets form a loop with no final destination (crawl mode) |
| `crawl-hreflang-to-noindex` | Hreflang To Noindex URLs | fail | Outgoing hreflang annotations point to noindex URLs (crawl mode) |
| `crawl-hreflang-to-disallowed` | Hreflang To Disallowed URLs | fail | Outgoing hreflang annotations point to robots.txt-disallowed URLs (crawl mode) |
| `crawl-hreflang-disallowed-target` | Disallowed URL Has Incoming Hreflang | fail | Other pages point hreflang at this robots.txt-disallowed page (crawl mode) |
| `crawl-hreflang-incoming-conflict` | Conflicting Incoming Hreflang | fail | Other crawled pages annotate this URL with different hreflang codes (crawl mode) |
| `crawl-hreflang-reciprocity` | Hreflang Reciprocity | warn | Crawled hreflang targets do not annotate this page in return (crawl mode) |
| `crawl-isolated-url` | Isolated URL | fail | URL reachable only via canonicals, redirects, the sitemap, noindex,follow paths, or other isolated URLs (crawl mode) |

### Rule Details

#### crawl-schema-noindex-conflict
- **Fix:** Remove noindex to allow rich results, or remove schema if the page should stay hidden.

#### crawl-pagination-canonical
- **Fix:** Each paginated page should have its own self-referencing canonical. Never canonicalize all to page 1.

#### crawl-sitemap-domain
- **Fix:** Remove cross-domain URLs from sitemap. All URLs must match the sitemap host domain.

#### crawl-noindex-in-sitemap
- **Fix:** Either remove the page from the sitemap or remove the noindex directive.

#### crawl-indexability-conflict
- **Fix:** Choose one blocking method: robots.txt disallow OR noindex meta, not both.

#### crawl-canonical-redirect
- **Fix:** Update canonical to point directly to the final destination URL. Avoid redirect chains.

#### crawl-sitemap-url-limit / crawl-sitemap-size-limit
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
- **Fix:** Allow paginated pages to be indexed. Link to them from the main content or navigation.

#### crawl-pagination-isolated
- **What it checks:** A paginated URL (pattern like `?page=N` or `/page/N`, or self-declared rel="next"/"prev") that no internal anchor link points to. Crawl mode only; pages the crawler reached by following anchors necessarily have an inbound link, so this fires for paginated URLs discovered another way
- **Fix:** Link to the pagination series from ordinary anchors (e.g. a pager in the body), not only rel="next"/"prev" tags

#### crawl-sitemap-non-200
- **What it checks:** Every sitemap URL cross-referenced against the status code recorded during the crawl. 4xx and 5xx fail outright; 3xx and timed-out URLs warn. Sitemap URLs the crawl never reached carry no reading (crawl-sitemap-orphan-urls covers that gap)
- **Fix:** Remove dead URLs from the sitemap, and list final destination URLs instead of redirecting ones

#### crawl-sitemap-non-canonical
- **What it checks:** Sitemap URLs whose canonical link element resolves to a different URL — the sitemap says "index this", the canonical says "index that", and the canonical wins
- **Fix:** List only canonical (self-referencing) URLs in the sitemap

#### crawl-sitemap-disallowed
- **What it checks:** Sitemap URLs that robots.txt disallows — a direct contradiction between the two crawl signals. When no robots.txt content was captured and nothing was disallowed anywhere, the rule reports unmeasured rather than a vacuous pass
- **Fix:** Remove the URL from the sitemap or the Disallow from robots.txt; a disallowed page may be indexed blind (URL only)

#### crawl-sitemap-cross-duplicates
- **What it checks:** Page URLs declared by more than one sitemap document (unlike crawl-sitemap-duplicate-urls, which spots repeated entries within a single sitemap). Informational — crawlers dedupe on their side
- **Fix:** Assign each URL to a single sitemap; overlapping declarations usually mean sitemap ownership is unclear

#### crawl-canonical-to-noindex / crawl-canonical-to-disallowed
- **What it checks:** The page's canonical target is itself noindex, or disallowed by robots.txt — the page delegates indexing to a URL that cannot be indexed or even fetched. Self-referencing canonicals pass. Uncrawled targets report unmeasured
- **Fix:** Point the canonical at an indexable, crawlable URL, or remove the noindex/Disallow from the target

#### crawl-canonical-chain
- **What it checks:** The canonical target is itself canonicalized to a different URL (A → B → C). Each hop weakens the signal and the final destination may not be the intended one. Loops are reported by crawl-canonical-loop instead
- **Fix:** Point the canonical directly at the final destination URL

#### crawl-canonical-loop
- **What it checks:** Following canonical targets leads back to an already-visited URL (A ↔ B), leaving search engines no final destination
- **Fix:** Make every page in the loop canonicalize to a single final URL

#### crawl-hreflang-to-noindex / crawl-hreflang-to-disallowed
- **What it checks:** Outgoing hreflang annotations whose crawled targets are noindex or disallowed by robots.txt — the annotation asks for the target to be served while the target cannot be indexed or fetched, so the localized cluster can break down
- **Fix:** Remove noindex/Disallow from the hreflang targets, or drop the annotations pointing at them

#### crawl-hreflang-disallowed-target
- **What it checks:** The mirror direction: this page is disallowed by robots.txt while other crawled pages point hreflang annotations at it, so its return tags can never be confirmed
- **Fix:** Remove the robots.txt Disallow for this URL, or remove the hreflang annotations pointing at it

#### crawl-hreflang-incoming-conflict
- **What it checks:** The incoming side of hreflang conflicts: annotations from OTHER crawled pages that target this URL must agree on a single language/region code. The page's own annotations are excluded (i18n-hreflang-conflicting's job), and x-default never conflicts — it is a fallback, not a language claim
- **Fix:** Make every page in the hreflang cluster annotate each member URL with the same single language/region code

#### crawl-hreflang-reciprocity
- **What it checks:** Every crawled hreflang target of this page annotates this page in return (return tags) — annotations are only honoured when mutual. Warns rather than fails, since missing return tags are usually a template gap. Targets the crawl never visited are skipped; when none were crawled the rule is not measured
- **Fix:** Add reciprocal hreflang annotations on the target pages pointing back at this URL

#### crawl-isolated-url
- **What it checks:** How the crawl discovered this URL (internal link, canonical tag, redirect, XML sitemap, or the crawl entry point). Fails when no anchor link points to it (found only via a canonical, a redirect or the sitemap), when every linking page is noindex,follow, or when every linker is itself isolated (one propagation pass). The crawl entry point always passes. Crawl mode only
- **Fix:** Link to the page from ordinary anchors on relevant, indexable pages; do not rely on canonicals, redirects or the sitemap for discovery

---

## Structured Data

Checks for valid JSON-LD, Schema.org markup, and rich snippet eligibility.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `schema-present` | Schema Present | warn | Checks for JSON-LD structured data |
| `schema-valid` | Schema Valid | fail | Validates JSON-LD syntax |
| `schema-type` | Schema Type | warn | Checks @type is specified |
| `schema-required-fields` | Required Fields | warn | Validates required properties per type |
| `schema-article` | Article Schema | warn | Validates Article/BlogPosting |
| `schema-breadcrumb` | Breadcrumb Schema | info | Checks BreadcrumbList on non-homepage |
| `schema-faq` | FAQ Schema | fail | Validates FAQPage structure |
| `schema-local-business` | LocalBusiness | warn | Validates LocalBusiness for local SEO |
| `schema-organization` | Organization | info | Validates Organization schema |
| `schema-product` | Product Schema | fail | Validates Product for e-commerce |
| `schema-review` | Review Schema | warn | Validates Review/AggregateRating |
| `schema-video` | Video Schema | warn | Validates VideoObject |
| `schema-website-search` | WebSite Search | info | Checks sitelinks searchbox eligibility |

### Rule Details

#### schema-present
- **Fix:** Add `<script type="application/ld+json">` with appropriate schema for the page type.

#### schema-valid
- **Fix:** Fix JSON syntax errors. Validate at https://search.google.com/test/rich-results

#### schema-type / schema-required-fields
- **Fix:** Include `@type` and all required properties for the chosen schema type.

#### schema-article
- **Required:** headline, author (as Person/Organization), datePublished, image

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

---

## Content

Analyzes text quality, readability, headings, and duplicate content.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `content-word-count` | Word Count | warn/fail | Checks content length for thin content |
| `content-reading-level` | Reading Level | warn | Analyzes readability using Flesch-Kincaid |
| `content-keyword-stuffing` | Keyword Stuffing | warn/fail | Detects excessive keyword repetition |
| `content-article-links` | Article Link Density | warn | Checks link-to-content ratio |
| `content-broken-html` | Broken HTML | warn/fail | Detects malformed HTML structure |
| `content-meta-in-body` | Meta in Body | fail | Meta tags incorrectly placed in body |
| `content-mime-type` | MIME Type | warn/fail | Validates Content-Type header |
| `content-duplicate-description` | Duplicate Description | warn/fail | Duplicate meta descriptions (crawl mode) |
| `content-heading-hierarchy` | Heading Hierarchy | warn | Checks H1-H6 hierarchy sequence |
| `content-heading-length` | Heading Length | warn | Validates heading text length |
| `content-heading-unique` | Heading Unique | warn | Checks for duplicate heading text on page |
| `content-text-html-ratio` | Text/HTML Ratio | warn | Checks text to HTML code ratio |
| `content-title-same-as-h1` | Title Same as H1 | warn | Detects identical title and H1 |
| `content-title-pixel-width` | Title Pixel Width | warn | Checks title fits SERP pixel limit |
| `content-description-pixel-width` | Description Pixel Width | warn | Checks description fits SERP pixel limit |
| `content-duplicate-exact` | Exact Duplicate | fail | Detects pages with identical content (crawl mode) |
| `content-duplicate-near` | Near Duplicate | warn | Detects pages with very similar content (crawl mode) |
| `content-title-same-as-description` | Title Same as Description | warn | Detects identical title tag and meta description text |
| `content-duplicate-h1` | Duplicate H1 Across Pages | warn | Detects pages whose H1 text is identical to another crawled page (crawl mode) |

### Rule Details

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
- **Too short:** < 3 chars. **Too long:** > 100 chars. Keep headings meaningful and concise.

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
- **Fix:** Move all `<meta>`, `<title>`, and `<link rel="canonical">` tags to `<head>`.

#### content-mime-type
- **Fix:** Configure server to send `Content-Type: text/html; charset=utf-8`.

#### content-duplicate-description
- **Fix:** Write unique, compelling descriptions (120-160 chars) for each page.

#### content-title-same-as-description
- **What it checks:** The title tag and meta description contain identical text. Title and description serve different purposes in search results; identical text wastes the SERP snippet
- **Fix:** Write a distinct meta description that expands on the title and encourages clicks from search results

#### content-duplicate-h1
- **What it checks:** This page's H1 is the exact same text as the H1 of at least one other crawled page — identical H1s suggest templated or duplicated content. Crawl mode only; a missing or empty H1 reports unmeasured (the heading rules cover that case)
- **Fix:** Give each page a distinct H1 that describes its specific content

---

## JavaScript Rendering

Validates that critical SEO elements are accessible without JavaScript or match the rendered output.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `js-rendered-title` | JS Rendered Title | fail | Checks title is present in initial HTML |
| `js-rendered-description` | JS Rendered Description | warn | Checks description is present in initial HTML |
| `js-rendered-h1` | JS Rendered H1 | fail | Checks H1 is present in initial HTML |
| `js-rendered-canonical` | JS Rendered Canonical | fail | Checks canonical is present in initial HTML |
| `js-canonical-mismatch` | JS Canonical Mismatch | fail | Canonical differs between HTML source and rendered DOM |
| `js-noindex-mismatch` | Noindex/Nofollow Mismatch | fail | Noindex or nofollow directives differ between source and rendered DOM |
| `js-title-modified` | JS Title Modified | warn | JavaScript modifies title after initial load |
| `js-description-modified` | JS Description Modified | warn | JavaScript modifies description after initial load |
| `js-h1-modified` | JS H1 Modified | warn | JavaScript modifies H1 after initial load |
| `js-rendered-content` | JS Rendered Content | warn | Main content relies on JavaScript to render |
| `js-rendered-links` | JS Rendered Links | warn | Internal links are generated by JavaScript |
| `js-blocked-resources` | JS Blocked Resources | warn | JavaScript or CSS files blocked by robots.txt |
| `js-ssr-check` | SSR Check | warn/fail | Checks if server-side rendering is implemented |
| `js-console-errors` | JavaScript Console Errors | warn/fail | Uncaught exceptions and console errors captured while rendering |
| `js-failed-requests` | Failed Resource Requests | warn/fail | Scripts, stylesheets and other subresources that failed to load |
| `js-document-write` | No document.write() | warn | Inline scripts do not use `document.write()` |

### Rule Details

#### js-rendered-title / js-rendered-description / js-rendered-h1 / js-rendered-canonical
- **Fix:** Implement SSR (server-side rendering) so critical SEO elements are in the initial HTML response, not injected by JavaScript.

#### js-canonical-mismatch / js-noindex-mismatch
- **Fix:** Ensure the rendered DOM matches the initial HTML for canonical and indexing directives (noindex, nofollow). Avoid JavaScript that modifies these elements — set the directives in server-side HTML instead.

#### js-title-modified / js-description-modified / js-h1-modified
- **Fix:** Set title, description, and H1 server-side. Avoid client-side JavaScript that overwrites them.

#### js-rendered-content
- **Fix:** Render main content server-side. Use SSR or static generation for content-heavy pages.

#### js-rendered-links
- **Fix:** Include internal navigation links in the initial HTML so crawlers can discover them without executing JavaScript.

#### js-blocked-resources
- **Fix:** Unblock JavaScript and CSS in robots.txt so search engines can render the page correctly.

#### js-ssr-check
- **Fix:** Implement SSR, SSG, or pre-rendering for JavaScript-heavy sites. Verify with `view-source:` that content is in the HTML.

---

## Accessibility

Checks for WCAG compliance, screen reader support, and keyboard navigation.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `a11y-aria-labels` | ARIA Labels | warn/fail | Interactive elements have accessible names |
| `a11y-color-contrast` | Color Contrast | warn | Detects potential low contrast issues |
| `a11y-focus-visible` | Focus Visible | warn/fail | Checks for focus indicator styles |
| `a11y-form-labels` | Form Labels | warn/fail | Form inputs have associated labels |
| `a11y-heading-order` | Heading Order | warn/fail | Heading levels don't skip |
| `a11y-landmark-regions` | Landmarks | warn | Proper landmark regions (main, nav, footer) |
| `a11y-link-text` | Link Text | warn/fail | Descriptive link text |
| `a11y-skip-link` | Skip Link | warn | Skip-to-content link present |
| `a11y-table-headers` | Table Headers | warn/fail | Data tables have proper headers |
| `a11y-touch-targets` | Touch Targets | warn | Minimum 44x44px touch target size |
| `a11y-video-captions` | Video Captions | warn/fail | Videos have captions or transcripts |
| `a11y-zoom-disabled` | Zoom Disabled | fail | Viewport doesn't disable user zoom |
| `a11y-aria-hidden-focusable` | aria-hidden Not Over Focusable Content | fail | aria-hidden not on body or wrapping focusable elements |
| `a11y-aria-valid` | Valid ARIA Roles and Attributes | fail | ARIA roles exist and aria-* attributes are spelled correctly |
| `a11y-accesskey-unique` | Unique Access Keys | warn | No accesskey assigned to more than one element |
| `a11y-duplicate-id` | Unique Element IDs | warn/fail | No ID reused where ARIA or labels reference it |
| `a11y-empty-heading` | Headings Contain Content | fail | No heading element is empty or inaccessible |
| `a11y-form-multiple-labels` | Single Label Per Field | warn | No form control targeted by more than one `<label>` |
| `a11y-identical-links-purpose` | Identical Links Same Purpose | warn | Links sharing text point to the same destination |
| `a11y-iframe-title` | Frame Titles | fail | `<iframe>` and `<frame>` elements have a title |
| `a11y-input-image-alt` | Image Button Alt Text | fail | `<input type="image">` elements have alt text |
| `a11y-label-name-mismatch` | Accessible Name Matches Visible Label | warn | aria-label contains the element visible text |
| `a11y-list-structure` | List Structure | fail | Lists contain only list items; items sit inside a list |
| `a11y-main-landmark` | Main Landmark | warn/fail | Page has exactly one `<main>` or role="main" |
| `a11y-object-alt` | Object Alternative Text | fail | `<object>` elements provide a text alternative |
| `a11y-presentation-role-conflict` | Presentation Role Conflicts | warn | role="none"/"presentation" not negated by ARIA or focusability |
| `a11y-redundant-alt` | Non-Redundant Alt Text | warn | Alt text does not duplicate adjacent link or caption text |
| `a11y-svg-img-alt` | SVG Image Alt Text | fail | SVGs with an img role have an accessible name |
| `a11y-table-caption` | Table Captions | warn | Data tables use `<caption>` rather than a spanning cell |
| `a11y-tabindex-positive` | No Positive Tabindex | warn | No element uses a tabindex greater than 0 |
| `a11y-valid-lang-element` | Valid Element Language Tags | warn | Element lang attributes are well-formed BCP 47 |

### Rule Details

#### a11y-aria-labels
- **Fix:** Add `aria-label`, visible text content, or `title` to interactive elements (buttons, links, inputs).

#### a11y-color-contrast
- **Fix:** Ensure minimum 4.5:1 contrast ratio for normal text, 3:1 for large text.

#### a11y-focus-visible
- **Fix:** Keep visible focus indicators. Use `:focus-visible` for keyboard-only focus styles.

#### a11y-form-labels
- **Fix:** Add `<label for="inputId">` or `aria-label` to all form inputs. Placeholder is not a substitute.

#### a11y-heading-order
- **Fix:** Use proper heading sequence (H1 -> H2 -> H3). Don't skip levels.

#### a11y-landmark-regions
- **Fix:** Add `<main>`, `<nav>`, `<header>`, `<footer>` elements for screen reader navigation.

#### a11y-link-text
- **Bad:** "click here", "read more". **Fix:** Use descriptive text that makes sense out of context.

#### a11y-skip-link
- **Fix:** Add `<a href="#main" class="skip-link">Skip to content</a>` before navigation.

#### a11y-table-headers
- **Fix:** Use `<th scope="col">` for column headers, `<th scope="row">` for row headers.

#### a11y-touch-targets
- **Fix:** Ensure interactive elements are at least 44x44 CSS pixels (WCAG 2.5.8).

#### a11y-video-captions
- **Fix:** Add `<track kind="captions">` to video elements or provide a transcript link nearby.

#### a11y-zoom-disabled
- **Fix:** Remove `user-scalable=no` and `maximum-scale=1` from the viewport meta tag.

#### a11y-aria-hidden-focusable
- **Why:** `aria-hidden="true"` removes an element from the accessibility tree but not from the tab order, so a keyboard user can focus a control that announces nothing.
- **Fix:** Add `tabindex="-1"` to focusable descendants, or use `display:none`/`hidden` instead.

#### a11y-aria-valid
- **Why:** Browsers silently discard an invalid role or a misspelled `aria-*` attribute. The markup reads as accessible while behaving as though it carried no ARIA at all.
- **Fix:** Correct the spelling (`aria-lable` -> `aria-label`) and use a role from the WAI-ARIA specification.

#### a11y-accesskey-unique
- **Fix:** Give each `accesskey` a distinct value, or remove them — browser shortcut conflicts make them unreliable.

#### a11y-duplicate-id
- **Why:** `aria-labelledby`, `aria-describedby` and `<label for>` resolve to the first match, so a duplicate leaves every other reference unnamed.
- **Note:** IDs duplicated only inside `<svg>` (e.g. `clipPath` defs from a repeated inline icon) are referenced by `url(#id)`, not ARIA, and pass.
- **Fix:** Make IDs unique, especially any that ARIA or a label targets.

#### a11y-empty-heading
- **Fix:** Give the heading text, or remove it. An image inside a heading needs non-empty `alt`.

#### a11y-form-multiple-labels
- **Fix:** Keep one `<label for>` per control; move supplementary text to `aria-describedby`.

#### a11y-identical-links-purpose
- **Why:** Screen reader users can list every link out of context. Two "read more" links to different pages are indistinguishable there.
- **Fix:** Make the link text or `aria-label` unique per destination.

#### a11y-iframe-title
- **Fix:** Add `title="..."` describing the frame's contents.

#### a11y-input-image-alt
- **Fix:** Add `alt="..."` describing what submitting the form does.

#### a11y-label-name-mismatch
- **Why:** Speech-recognition users say what they see. If the visible text is "Submit" but `aria-label` is "Send form", the voice command matches nothing.
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

---

## Social

Validates Open Graph, Twitter Cards, and social sharing metadata.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `social-og-title` | OG Title | warn | Checks `og:title` meta tag |
| `social-og-description` | OG Description | warn | Checks `og:description` meta tag |
| `social-og-image` | OG Image | warn | Checks `og:image` meta tag |
| `social-og-image-size` | OG Image Size | warn | Checks og:image dimensions (1200x630 recommended) |
| `social-og-url` | OG URL | warn | Checks `og:url` meta tag |
| `social-og-url-canonical` | OG URL Canonical | fail | Checks og:url matches canonical URL |
| `social-twitter-card` | Twitter Card | warn | Checks `twitter:card` meta tag |
| `social-share-buttons` | Share Buttons | warn | Checks for social sharing buttons |
| `social-profiles` | Social Profiles | warn | Checks for links to social media profiles |

### Rule Details

#### social-og-title / social-og-description / social-og-image
- **Fix:** Add `<meta property="og:title">`, `og:description`, and `og:image` (1200x630px) for social sharing.

#### social-og-image-size
- **Fix:** Add `og:image:width` (1200) and `og:image:height` (630) meta tags.

#### social-og-url / social-og-url-canonical
- **Fix:** Set `og:url` to match the canonical URL exactly.

#### social-twitter-card
- **Fix:** Add `<meta name="twitter:card" content="summary_large_image">`.

#### social-share-buttons
- **Fix:** Add share buttons for Facebook, Twitter/X, LinkedIn. 2+ platforms recommended.

#### social-profiles
- **Fix:** Add profile links in header/footer. Include in Organization schema `sameAs`. 3+ profiles recommended.

---

## E-E-A-T

Experience, Expertise, Authority, and Trust signals for content quality.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `eeat-about-page` | About Page | warn | Checks for About/About Us page |
| `eeat-affiliate-disclosure` | Affiliate Disclosure | warn | Checks affiliate content has FTC disclosure |
| `eeat-author-byline` | Author Byline | warn | Checks for author attribution |
| `eeat-author-expertise` | Author Expertise | warn | Checks for author credentials and bio |
| `eeat-citations` | Citations | warn | Checks for links to authoritative sources |
| `eeat-contact-page` | Contact Page | warn | Checks for contact information |
| `eeat-content-dates` | Content Dates | warn | Checks for datePublished/dateModified |
| `eeat-disclaimers` | Disclaimers | warn | Checks YMYL content has appropriate disclaimers |
| `eeat-editorial-policy` | Editorial Policy | warn | Checks for editorial policy page |
| `eeat-physical-address` | Physical Address | warn | Checks for business address |
| `eeat-privacy-policy` | Privacy Policy | warn | Checks for privacy policy link |
| `eeat-terms-of-service` | Terms of Service | warn | Checks for ToS link |
| `eeat-trust-signals` | Trust Signals | warn | Checks for reviews, certifications, badges |
| `eeat-ymyl-detection` | YMYL Detection | info | Detects Your Money or Your Life content |

### Rule Details

#### eeat-about-page
- **Fix:** Add an "About" or "About Us" page explaining who you are and your expertise.

#### eeat-affiliate-disclosure
- **Fix:** Add FTC-compliant disclosure near affiliate content: "This post contains affiliate links."

#### eeat-author-byline / eeat-author-expertise
- **Fix:** Add visible author name with link to bio page. Include credentials, professional background, and social links.

#### eeat-citations
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
- **Fix:** Display customer reviews, certifications, security badges, or media mentions.

#### eeat-ymyl-detection
- **Info:** Detects YMYL (Your Money or Your Life) content that requires higher E-E-A-T standards.

---

## URL Structure

Analyzes URL formatting, keywords, parameters, and common issues.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `url-slug-keywords` | Slug Keywords | fail/warn | URL slug contains descriptive keywords |
| `url-stop-words` | Stop Words | warn | Flags common stop words in URL slugs |
| `url-uppercase` | Uppercase URLs | warn | Detects uppercase characters in URLs |
| `url-underscores` | Underscores | warn | Detects underscores instead of hyphens |
| `url-double-slash` | Double Slashes | warn | Detects `//` in URL path |
| `url-spaces` | Spaces in URL | fail | Detects encoded spaces (%20) in URLs |
| `url-non-ascii` | Non-ASCII | warn | Detects non-ASCII characters in URLs |
| `url-length` | URL Length | warn | Checks URL total length |
| `url-repetitive-path` | Repetitive Path | warn | Detects repeated path segments |
| `url-parameters` | URL Parameters | warn | Detects excessive query parameters |
| `url-session-ids` | Session IDs | fail | Detects session IDs in URLs |
| `url-tracking-params` | Tracking Params | warn | Detects UTM and tracking parameters |
| `url-internal-search` | Internal Search | warn | Detects internal search URLs being indexed |
| `url-http-https-duplicate` | HTTP/HTTPS Duplicate | warn | Same URL accessible via both HTTP and HTTPS |

### Rule Details

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
- **Fix:** Keep URLs short and descriptive. Aim for under 75 characters in the path.

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
- **Fix:** Block internal search result pages from indexing with noindex or robots.txt.

#### url-http-https-duplicate
- **Fix:** Set up 301 redirect from HTTP to HTTPS. Use HTTPS canonical on all pages.

---

## Redirects

Validates redirect implementation, types, and common redirect issues.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `redirect-meta-refresh` | Meta Refresh | warn | Detects `<meta http-equiv="refresh">` redirects |
| `redirect-javascript` | JavaScript Redirect | warn | Detects JavaScript-based redirects |
| `redirect-http-refresh` | HTTP Refresh Header | warn | Detects Refresh HTTP header redirects |
| `redirect-loop` | Redirect Loop | fail | Detects circular redirect chains |
| `redirect-type` | Redirect Type | warn | Validates 301 vs 302 redirect usage |
| `redirect-broken` | Broken Redirect | fail | Redirect target returns error |
| `redirect-resource` | Resource Redirect | warn | Static resources (CSS/JS/images) being redirected |
| `redirect-case-normalization` | Case Normalization | warn | URL case differences causing redirects |
| `redirect-resource-broken` | Broken Resource Redirects | fail | Redirected page resources resolve to a 4xx/5xx status (requires render; not measured with --no-cwv) |
| `redirect-resource-loop` | Resource Redirect Loops | fail | Page resources caught in a redirect loop and never resolve (requires render; not measured with --no-cwv) |
| `redirect-resource-chain` | Resource Redirect Chains | warn | Page resources resolve through multi-hop redirect chains (requires render; not measured with --no-cwv) |

### Rule Details

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
- **Fix:** Update or remove redirects whose target URL returns 4xx or 5xx errors.

#### redirect-resource
- **Fix:** Serve static resources (images, CSS, JS) directly without redirects to avoid latency.

#### redirect-case-normalization
- **Fix:** Normalize URL case on the server. Redirect uppercase URLs to lowercase with 301.

#### redirect-resource-broken
- **What it checks:** Page resources (scripts, stylesheets, images, fonts) whose requests were redirected and ended in a 4xx/5xx response — the redirect destination is broken, so the hops are wasted and the page still loads without the resource. Resources that fail without any redirect are js-failed-requests' territory. Not measured under `--no-cwv` — per-resource redirect chains come from the Playwright render
- **Fix:** Update the resource URLs to point directly at a working destination

#### redirect-resource-loop
- **What it checks:** A page resource request that loops back to a URL already present in its own redirect chain. The browser aborts with ERR_TOO_MANY_REDIRECTS, so the page loads without that script, stylesheet, or image. Not measured under `--no-cwv`
- **Fix:** Fix the redirect target so the chain resolves to a final resource instead of looping

#### redirect-resource-chain
- **What it checks:** Page resources resolving through redirect chains of 2 or more hops — each extra hop adds latency and wastes crawl budget. A single hop (http to https, trailing-slash normalisation) is treated as benign, and looping resources are excluded (redirect-resource-loop reports those). Not measured under `--no-cwv`
- **Fix:** Point resource URLs directly at the final destination

---

## Mobile

Mobile-friendliness checks for font size, viewport, and responsive layout.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `mobile-font-size` | Font Size | fail/warn | Checks for readable font sizes on mobile |
| `mobile-horizontal-scroll` | Horizontal Scroll | fail/warn | Detects elements causing horizontal scrolling |
| `mobile-interstitials` | Interstitials | fail/warn | Detects popups and overlays covering content |
| `mobile-viewport-width` | Viewport Width | warn | Checks viewport uses device-width |
| `mobile-multiple-viewports` | Multiple Viewports | fail | Detects multiple viewport meta tags |
| `mobile-parity-content` | Mobile Content Parity | warn/fail | Mobile body content vs desktop render (requires --mobile) |
| `mobile-parity-title` | Mobile Title & Description Parity | warn/fail | Title/description match between renders (requires --mobile) |
| `mobile-parity-canonical` | Mobile Canonical Parity | fail | Canonical matches between renders (requires --mobile) |
| `mobile-parity-structured-data` | Mobile Structured Data Parity | fail | JSON-LD present on mobile as on desktop (requires --mobile) |
| `mobile-parity-links` | Mobile Internal Link Parity | warn | Comparable internal link count (requires --mobile) |
| `mobile-image-maps` | Image Maps | warn | Detects `<map>`/`<area>` image maps, whose fixed-coordinate tap targets do not adapt to mobile screens |
| `mobile-viewport-content` | Viewport Content | warn | Validates viewport directives: width present, initial-scale=1, no minimum-scale |

### Rule Details

#### mobile-font-size
- **Pass:** Body text 16px+ or relative units (rem, em). **Fail:** Below 12px.
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

## Internationalization

Checks language declarations and multi-language hreflang implementation.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `i18n-lang-attribute` | Lang Attribute | fail | Checks `lang` on `<html>` element |
| `i18n-hreflang` | Hreflang Tags | warn/fail | Checks for hreflang link elements |
| `i18n-hreflang-return-links` | Hreflang Return Links | fail | Each hreflang target links back |
| `i18n-hreflang-to-noindex` | Hreflang to Noindex | fail | Hreflang points to noindexed page |
| `i18n-hreflang-to-non-canonical` | Hreflang to Non-Canonical | warn | Hreflang points to non-canonical URL |
| `i18n-hreflang-to-broken` | Hreflang to Broken | fail | Malformed hreflang URLs; in crawl mode also targets that returned 4xx/5xx, or timed out (warn) |
| `i18n-hreflang-to-redirect` | Hreflang to Redirect | warn | Hreflang target redirects (HTTP on HTTPS site; in crawl mode also crawled 3xx targets) |
| `i18n-hreflang-conflicting` | Hreflang Conflicting | fail | Conflicting hreflang declarations |
| `i18n-hreflang-lang-mismatch` | Hreflang Lang Mismatch | warn | Hreflang language doesn't match page content |
| `i18n-hreflang-multiple-methods` | Hreflang Multiple Methods | warn | Hreflang declared in multiple locations |
| `i18n-hreflang-relative-url` | Hreflang Relative URLs | fail | Hreflang annotations must use absolute URLs, not relative ones |
| `i18n-hreflang-x-default` | Hreflang Also X-Default | info | Reports when a language annotation targets the same URL as x-default (insight) |
| `i18n-hreflang-incoming-invalid` | Invalid Incoming Hreflang | fail | Hreflang annotations from other crawled pages targeting this URL use invalid language/region codes (crawl mode) |

### Rule Details

#### i18n-lang-attribute
- **Fix:** Add `<html lang="en">` with a valid BCP 47 language code (e.g., "en", "en-US", "zh-Hans").

#### i18n-hreflang
- **Fix:** Add `<link rel="alternate" hreflang="xx" href="...">` for each language version. Include x-default.

#### i18n-hreflang-return-links
- **Fix:** Every page referenced by hreflang must link back. If page A references page B, page B must reference page A.

#### i18n-hreflang-to-noindex
- **Fix:** Don't point hreflang to noindexed pages. Either remove noindex or remove the hreflang reference.

#### i18n-hreflang-to-non-canonical
- **Fix:** Point hreflang to canonical URLs only. Don't reference non-canonical URL variants.

#### i18n-hreflang-to-broken / i18n-hreflang-to-redirect
- **What it checks:** Statically: empty, fragment-only, `javascript:` or unparsable hreflang hrefs (broken), and hreflang using HTTP on an HTTPS page (redirect heuristic). In crawl mode (`--crawl`) both rules add a live check against the crawled targets' status codes: 4xx/5xx fail as broken, fetch timeouts warn, and 3xx responses warn as redirects. Targets the crawl never visited are skipped
- **Fix:** Update hreflang targets to valid, non-redirecting URLs. All hreflang targets should return 200.

#### i18n-hreflang-conflicting
- **What it checks:** Three conflict forms: the same language/region code pointing to multiple different URLs, the same URL targeted by multiple different codes, and the current page self-referenced by multiple different codes. The x-default code is excluded — sharing a target with x-default is a fallback declaration, not a conflict
- **Fix:** Resolve conflicting hreflang declarations. Each language/region pair should map to exactly one URL, each URL to exactly one code, and the page should self-reference under a single code.

#### i18n-hreflang-lang-mismatch
- **Fix:** Ensure the hreflang language code matches the actual content language of the target page.

#### i18n-hreflang-multiple-methods
- **Fix:** Use a single method for hreflang: HTML link tags, HTTP headers, or sitemap. Don't mix methods.

#### i18n-hreflang-relative-url
- **What it checks:** Hreflang annotations whose href is a relative URL (`/fr/`, `fr/page`, or protocol-relative `//example.com/fr/`). Targets must be absolute URLs including the protocol; relative ones are invalid per the hreflang specification and may break the entire annotation set
- **Fix:** Rewrite hreflang hrefs as absolute URLs (e.g. `https://example.com/fr/`)

#### i18n-hreflang-x-default
- **What it checks:** Insight-level: the URL targeted by the x-default annotation is also targeted by a language/region annotation on the same page. Not an error — x-default is the fallback shown when no language matches — but the overlap is worth surfacing so the intent is deliberate
- **Fix:** No action required; confirm the overlap is intentional

#### i18n-hreflang-incoming-invalid
- **What it checks:** The incoming counterpart to i18n-hreflang's outgoing validation: other crawled pages pointing hreflang annotations AT this URL must use valid language/region codes (`xx` or `xx-YY`; x-default is always valid). An invalid code makes the annotation unusable, so this page loses the cluster membership the source page tried to declare. Crawl mode only
- **Fix:** Fix the annotations on the source pages to use valid ISO 639-1 language codes with optional ISO 3166-1 Alpha-2 region codes (e.g. "en", "en-GB")

---

## HTML Validation

Validates HTML document structure, DOCTYPE, charset, and common markup issues.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `htmlval-missing-doctype` | Missing DOCTYPE | warn | Checks for `<!DOCTYPE html>` declaration |
| `htmlval-missing-charset` | Missing Charset | warn | Checks for charset declaration |
| `htmlval-invalid-head` | Invalid Head | warn | Checks head contains only valid elements |
| `htmlval-noscript-in-head` | Noscript in Head | warn | Detects `<noscript>` in `<head>` |
| `htmlval-multiple-heads` | Multiple Heads | fail | Detects multiple `<head>` elements |
| `htmlval-size-limit` | Size Limit | warn/fail | Checks HTML document size |
| `htmlval-lorem-ipsum` | Lorem Ipsum | warn | Detects placeholder lorem ipsum text |
| `htmlval-multiple-titles` | Multiple Titles | fail | Detects multiple `<title>` tags |
| `htmlval-multiple-descriptions` | Multiple Descriptions | fail | Detects multiple meta description tags |
| `htmlval-title-outside-head` | Title Outside Head | fail | Detects `<title>` elements placed outside of `<head>` |
| `htmlval-base-url` | Valid Base URL | warn/fail | Checks the document has at most one `<base>` element with a valid href |

### Rule Details

#### htmlval-missing-doctype
- **Fix:** Add `<!DOCTYPE html>` as the first line of every HTML document.

#### htmlval-missing-charset
- **Fix:** Add `<meta charset="utf-8">` as the first element in `<head>`.

#### htmlval-invalid-head
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
- **What it checks:** `<title>` elements placed outside of `<head>` (e.g. in the `<body>`), which search engines may ignore entirely — leaving the page without a recognised title for indexing and search display
- **Fix:** Move the `<title>` element into the `<head>`

#### htmlval-base-url
- **What it checks:** The `<base>` element, which sets the base URL for every relative link on the page. Fails on an empty or malformed href, a non-HTTP(S) absolute href, or multiple `<base>` elements with different hrefs; warns on multiple identical `<base>` elements (only one is allowed per document)
- **Fix:** Keep at most one `<base>` element with a valid href so relative links resolve correctly for crawlers

---

## AI/GEO Readiness

Checks for Generative Engine Optimization: semantic HTML, content structure, and AI bot accessibility.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `geo-semantic-html` | Semantic HTML | warn | Checks for semantic HTML5 elements |
| `geo-content-structure` | Content Structure | warn | Checks content is well-structured for extraction |
| `geo-ai-bot-access` | AI Bot Access | warn | Checks AI crawlers are not blocked |
| `geo-llms-txt` | llms.txt | info | Checks for llms.txt file for AI guidance |
| `geo-schema-drift` | Schema Drift | warn | Checks schema markup matches actual content |

### Rule Details

#### geo-semantic-html
- **Fix:** Use semantic elements (`<article>`, `<section>`, `<aside>`, `<nav>`, `<main>`) instead of generic `<div>` wrappers.

#### geo-content-structure
- **Fix:** Organize content with clear headings, lists, tables, and paragraphs. Use definition lists for Q&A content.

#### geo-ai-bot-access
- **Fix:** Allow AI crawlers (GPTBot, Claude-Web, Anthropic, Google-Extended) in robots.txt unless you have specific reasons to block them.

#### geo-llms-txt
- **Fix:** Add a `/llms.txt` file describing your site's content and structure for AI systems. See llmstxt.org.

#### geo-schema-drift
- **Fix:** Ensure structured data (schema.org) accurately reflects the visible page content. Don't include schema for content that doesn't exist on the page.

---

## Legal Compliance

Privacy and legal compliance signals.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `legal-cookie-consent` | Cookie Consent | pass/warn | Checks for cookie consent mechanism |

### Rule Details

#### legal-cookie-consent
- **Detects:** Consent management platforms (CookieYes, OneTrust, Cookiebot, Termly, Quantcast).
- **Pass:** Cookie consent mechanism detected, or no tracking scripts present.
- **Warn:** Tracking scripts detected but no cookie consent mechanism found.
- **Fix:** Add a cookie consent banner using CookieYes, OneTrust, or Cookiebot.

---

## Disabling Rules

### Disable Specific Rule
```toml
[rules]
disable = ["core-nosnippet"]
```

### Disable by Category Prefix
```toml
[rules]
disable = ["core-*"]       # All Core SEO rules
disable = ["security-*"]   # All Security rules
disable = ["js-*"]         # All JS Rendering rules
```

### Enable Only Specific Categories
```toml
[rules]
enable = ["core-*", "perf-*", "links-*"]
disable = ["*"]
```

---

## Score Calculation

1. Each rule returns a score: **0** (fail), **50** (warn), or **100** (pass)
2. Category score = weighted average of rule scores within that category
3. Overall score = weighted sum of category scores (using category weights)

### Example
- Core SEO: 85/100 x 12% = 10.2
- Performance: 70/100 x 12% = 8.4
- Links: 90/100 x 8% = 7.2
- ...
- **Overall: Sum of all category contributions (0-100)**

### Score Ranges
| Range | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent - Minor optimizations only |
| 70-89 | B | Good - Address warnings |
| 50-69 | C | Needs Work - Priority fixes required |
| 0-49 | D/F | Poor - Critical issues present |

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
