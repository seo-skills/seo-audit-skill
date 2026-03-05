# SEO Audit Rules Reference

> Complete reference of all 251 SEO audit rules across 20 categories (v3.0.0)

## Overview

SEOmator audits websites using 251 rules organized into 20 categories. Each rule returns one of three statuses:
- **Pass** (score: 100) - Meets best practices
- **Warn** (score: 50) - Potential issue, should address
- **Fail** (score: 0) - Critical issue, must fix

---

## Categories & Weights

| Category | Weight | Rules | Description |
|----------|--------|-------|-------------|
| [Core SEO](#core-seo) | 12% | 19 | Meta tags, canonical, H1, indexing directives |
| [Performance](#performance) | 12% | 22 | Core Web Vitals + performance optimization hints |
| [Links](#links) | 8% | 19 | Internal/external links, anchor text, validation |
| [Images](#images) | 8% | 14 | Alt text, dimensions, lazy loading, optimization |
| [Security](#security) | 8% | 16 | HTTPS, security headers, mixed content, SSL |
| [Technical SEO](#technical-seo) | 7% | 13 | Robots.txt, sitemap, status codes, URL structure |
| [Crawlability](#crawlability) | 5% | 18 | Indexability signals, sitemap conflicts, pagination |
| [Structured Data](#structured-data) | 5% | 13 | JSON-LD, Schema.org markup |
| [Content](#content) | 5% | 17 | Text quality, readability, headings, duplicates |
| [JavaScript Rendering](#javascript-rendering) | 5% | 13 | SSR validation, JS-dependent SEO elements |
| [Accessibility](#accessibility) | 4% | 12 | WCAG compliance, ARIA, keyboard navigation |
| [Social](#social) | 3% | 9 | Open Graph, Twitter Cards, social profiles |
| [E-E-A-T](#e-e-a-t) | 3% | 14 | Experience, Expertise, Authority, Trust signals |
| [URL Structure](#url-structure) | 3% | 14 | Slug keywords, formatting, parameters |
| [Redirects](#redirects) | 3% | 8 | Redirect types, chains, loops |
| [Mobile](#mobile) | 2% | 5 | Font size, viewport, responsive layout |
| [Internationalization](#internationalization) | 2% | 10 | Language declarations, hreflang validation |
| [HTML Validation](#html-validation) | 2% | 9 | DOCTYPE, charset, head structure |
| [AI/GEO Readiness](#aigeo-readiness) | 2% | 5 | Semantic HTML, AI bot access, llms.txt |
| [Legal Compliance](#legal-compliance) | 1% | 1 | Cookie consent |

**Total: 100% weight, 251 rules**

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
| `perf-minify-css` | Minify CSS | warn | Checks CSS files are minified |
| `perf-minify-js` | Minify JS | warn | Checks JavaScript files are minified |
| `perf-response-time` | Response Time | warn/fail | Measures server response time for the page |
| `perf-http2` | HTTP/2 | warn | Checks site is served over HTTP/2 or HTTP/3 |
| `perf-page-weight` | Page Weight | warn/fail | Total page size including all resources |
| `perf-js-file-size` | JS File Size | warn/fail | Checks individual JavaScript file sizes |
| `perf-video-for-animations` | Video for Animations | warn | Suggests `<video>` over animated GIFs |

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
- **Fix:** Use build tools (esbuild, terser, cssnano) to minify CSS and JavaScript

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
| `links-depth` | Link Depth | warn | Validates pages reachable in 3 clicks or fewer |
| `links-dead-end-pages` | Dead-End Pages | warn | Checks page has outgoing internal links |
| `links-https-downgrade` | HTTPS Downgrade | warn | Checks HTTPS pages don't link to HTTP |
| `links-external-count` | External Count | warn | Warns if >100 external links |
| `links-invalid` | Invalid Links | warn | Detects empty, javascript:, or malformed hrefs |
| `links-tel-mailto` | Tel & Mailto | warn | Validates tel: and mailto: link formats |
| `links-redirect-chains` | Redirect Chains | warn/fail | Detects links through multiple redirects |
| `links-orphan-pages` | Orphan Pages | info | Pages with no incoming links (crawl mode) |
| `links-localhost` | Localhost Links | fail | Detects links to localhost or 127.0.0.1 |
| `links-local-file` | Local File Links | fail | Detects file:// protocol links |
| `links-broken-fragment` | Broken Fragments | warn | Detects #anchor links with no matching ID |
| `links-excessive` | Excessive Links | warn | Warns when page has too many total links |
| `links-onclick` | OnClick Navigation | warn | Detects onclick-based navigation instead of hrefs |
| `links-whitespace-href` | Whitespace Href | warn | Detects href values with leading/trailing whitespace |

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
| `security-leaked-secrets` | Leaked Secrets | fail | Detects exposed API keys, credentials in HTML/JS |
| `security-password-http` | Password over HTTP | fail | Detects password fields on non-HTTPS pages |
| `security-protocol-relative` | Protocol-Relative URLs | warn | Detects `//example.com` URLs |
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

---

## Crawlability

Validates indexability signals, sitemap conflicts, canonical chains, and pagination.

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
| `crawl-crawl-delay` | Crawl Delay | info | Detects crawl-delay directive in robots.txt |
| `crawl-sitemap-in-robotstxt` | Sitemap in Robots.txt | warn | Sitemap not referenced in robots.txt |
| `crawl-pagination-broken` | Pagination Broken | fail | Paginated page links are broken (404) |
| `crawl-pagination-loop` | Pagination Loop | fail | Pagination creates circular links |
| `crawl-pagination-sequence` | Pagination Sequence | warn | Pagination sequence has gaps or inconsistencies |
| `crawl-pagination-noindex` | Pagination Noindex | warn | Paginated pages have noindex |
| `crawl-pagination-orphaned` | Pagination Orphaned | warn | Paginated pages not linked from main navigation |

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

#### crawl-sitemap-in-robotstxt
- **Fix:** Add `Sitemap: https://example.com/sitemap.xml` to robots.txt.

#### crawl-pagination-broken / crawl-pagination-loop / crawl-pagination-sequence
- **Fix:** Ensure pagination links are valid, non-circular, and sequential.

#### crawl-pagination-noindex / crawl-pagination-orphaned
- **Fix:** Allow paginated pages to be indexed. Link to them from the main content or navigation.

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
| `js-noindex-mismatch` | JS Noindex Mismatch | fail | Noindex status differs between source and rendered |
| `js-title-modified` | JS Title Modified | warn | JavaScript modifies title after initial load |
| `js-description-modified` | JS Description Modified | warn | JavaScript modifies description after initial load |
| `js-h1-modified` | JS H1 Modified | warn | JavaScript modifies H1 after initial load |
| `js-rendered-content` | JS Rendered Content | warn | Main content relies on JavaScript to render |
| `js-rendered-links` | JS Rendered Links | warn | Internal links are generated by JavaScript |
| `js-blocked-resources` | JS Blocked Resources | warn | JavaScript or CSS files blocked by robots.txt |
| `js-ssr-check` | SSR Check | warn/fail | Checks if server-side rendering is implemented |

### Rule Details

#### js-rendered-title / js-rendered-description / js-rendered-h1 / js-rendered-canonical
- **Fix:** Implement SSR (server-side rendering) so critical SEO elements are in the initial HTML response, not injected by JavaScript.

#### js-canonical-mismatch / js-noindex-mismatch
- **Fix:** Ensure the rendered DOM matches the initial HTML for canonical and indexing directives. Avoid JavaScript that modifies these elements.

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
- **Fix:** Minimize query parameters. Use clean URL paths instead.

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
| `i18n-hreflang-to-broken` | Hreflang to Broken | fail | Hreflang target returns 4xx/5xx |
| `i18n-hreflang-to-redirect` | Hreflang to Redirect | warn | Hreflang target redirects |
| `i18n-hreflang-conflicting` | Hreflang Conflicting | fail | Conflicting hreflang declarations |
| `i18n-hreflang-lang-mismatch` | Hreflang Lang Mismatch | warn | Hreflang language doesn't match page content |
| `i18n-hreflang-multiple-methods` | Hreflang Multiple Methods | warn | Hreflang declared in multiple locations |

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
- **Fix:** Update hreflang targets to valid, non-redirecting URLs. All hreflang targets should return 200.

#### i18n-hreflang-conflicting
- **Fix:** Resolve conflicting hreflang declarations. Each language/region pair should map to exactly one URL.

#### i18n-hreflang-lang-mismatch
- **Fix:** Ensure the hreflang language code matches the actual content language of the target page.

#### i18n-hreflang-multiple-methods
- **Fix:** Use a single method for hreflang: HTML link tags, HTTP headers, or sitemap. Don't mix methods.

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
- **Threshold:** HTML documents should be under 5MB.
- **Fix:** Reduce HTML size by removing inline data, externalizing scripts/styles, paginating content.

#### htmlval-lorem-ipsum
- **Fix:** Replace placeholder "Lorem ipsum" text with real content before publishing.

#### htmlval-multiple-titles / htmlval-multiple-descriptions
- **Fix:** Ensure only one `<title>` tag and one `<meta name="description">` exist per page.

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
