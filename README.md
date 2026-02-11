# SEOmator Audit CLI

A comprehensive SEO audit command-line tool with **251 audit rules** across **20 categories**. Analyze any website for SEO best practices, Core Web Vitals, security headers, structured data, accessibility, JavaScript rendering, redirect chains, and more.

> **Prefer a web interface?** Try our [Free SEO Audit Tool](https://seomator.com/free-seo-audit-tool) for a visual, browser-based SEO analysis.

## Features

- **251 SEO Audit Rules** across 20 categories
- **Single Page & Crawl Mode** - Audit one page or crawl entire sites
- **Core Web Vitals** - LCP, CLS, FCP, TTFB, INP measurement via Playwright
- **JavaScript Rendering Analysis** - Compare raw vs rendered DOM for SPA/CSR sites
- **5 Output Formats** - Console, JSON, HTML, Markdown, and LLM-optimized XML
- **AI/GEO Readiness** - Check semantic HTML, AI bot access, and llms.txt
- **Redirect Chain Detection** - Loops, broken redirects, meta/JS redirects
- **HTML Validation** - Doctype, charset, head structure, lorem ipsum detection
- **Cross-Page Analysis** - Duplicate content detection, orphan pages, pagination
- **Concurrent Crawling** - Fast multi-page audits with configurable concurrency
- **SQLite Storage** - Persistent crawl data with compression and audit history
- **CI/CD Ready** - Exit codes, JSON output, GitHub Actions & GitLab CI examples
- **TOML Configuration** - Project-level settings with presets and inheritance

## Installation

### From npm (recommended)

```bash
# Install globally
npm install -g @seomator/seo-audit

# Run audit
seomator audit https://example.com
```

> **Note:** The CLI automatically uses your system Chrome, Chromium, or Edge browser for Core Web Vitals measurement. No additional browser installation is required if you have Chrome installed.

### From source

```bash
git clone https://github.com/seo-skills/seo-audit-skill.git
cd seo-audit-skill
npm install
npm run build

# Run directly
./dist/cli.js audit https://example.com

# Or link globally
npm link
seomator audit https://example.com
```

## Quick Start

```bash
# Basic audit
seomator audit https://example.com

# Skip Core Web Vitals (faster)
seomator audit https://example.com --no-cwv

# Audit specific categories
seomator audit https://example.com -c core,security,perf

# JSON output (for CI/CD or parsing)
seomator audit https://example.com --format json

# HTML report
seomator audit https://example.com --format html -o report.html

# LLM-optimized output (pipe to Claude)
seomator audit https://example.com --format llm --no-cwv | claude "analyze and prioritize fixes"

# Crawl multiple pages
seomator audit https://example.com --crawl --max-pages 20

# Full options
seomator audit https://example.com --crawl -m 50 --concurrency 5 --timeout 60000 --format json -o results.json
```

## Commands

### `seomator audit <url>`

Run SEO audit on a URL.

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--format <type>` | `-f` | Output format: console, json, html, markdown, llm | console |
| `--output <path>` | `-o` | Output file path | - |
| `--categories <list>` | `-c` | Comma-separated categories to audit | All |
| `--json` | `-j` | Output as JSON (deprecated, use --format json) | false |
| `--crawl` | - | Enable crawl mode for multiple pages | false |
| `--max-pages <n>` | `-m` | Maximum pages to crawl | 10 |
| `--concurrency <n>` | - | Concurrent requests | 3 |
| `--timeout <ms>` | - | Request timeout in milliseconds | 30000 |
| `--no-cwv` | - | Skip Core Web Vitals measurement | false |
| `--verbose` | `-v` | Show progress | false |
| `--refresh` | `-r` | Ignore cache, fetch fresh | false |
| `--resume` | - | Resume interrupted crawl | false |
| `--config <path>` | - | Config file path | - |
| `--save` | - | Save report to .seomator/reports/ | false |

### `seomator init`

Create a `seomator.toml` config file.

```bash
seomator init                    # Interactive setup
seomator init -y                 # Use defaults
seomator init --preset blog      # Blog preset
seomator init --preset ecommerce # E-commerce preset
seomator init --preset ci        # Minimal CI config
```

### `seomator crawl <url>`

Crawl website without running analysis. Saves data for later analysis with `seomator analyze`.

```bash
seomator crawl https://example.com -m 20
seomator crawl https://example.com --refresh
seomator crawl https://example.com --resume
```

### `seomator analyze [crawl-id]`

Run rules on stored crawl data.

```bash
seomator analyze                           # Analyze latest crawl
seomator analyze --latest --save           # Analyze and save
seomator analyze 2026-01-23-abc123         # Specific crawl
```

### `seomator report [query]`

View and query past reports.

```bash
seomator report --list                     # List all reports
seomator report --project mysite           # Filter by project
```

### `seomator config [key] [value]`

View or modify configuration.

```bash
seomator config --list                     # Show all config
seomator config crawler.max_pages 50       # Set value
seomator config validate                   # Validate config
```

### `seomator db`

Database management.

```bash
seomator db migrate              # Migrate JSON to SQLite
seomator db migrate --dry-run    # Preview migration
seomator db stats -v             # Database statistics
seomator db restore              # Rollback migration
```

### `seomator self doctor`

Check system setup and dependencies.

```bash
seomator self doctor -v          # Verbose diagnostics
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Audit passed (score >= 70) |
| 1 | Audit failed (score < 70) |
| 2 | Error occurred |

## Categories & Rules (251 total)

### Core (19 rules) - 12% weight

| Rule | Description |
|------|-------------|
| `core-title-present` | `<title>` tag exists |
| `core-title-length` | Title should be 30-60 characters |
| `core-description-present` | Meta description exists |
| `core-description-length` | Description should be 120-160 characters |
| `core-canonical-present` | Canonical URL exists |
| `core-canonical-valid` | Canonical URL is valid absolute URL |
| `core-viewport-present` | Viewport meta tag exists |
| `core-favicon-present` | Favicon link exists |
| `core-h1-present` | At least one H1 exists |
| `core-h1-single` | Only one H1 exists |
| `core-canonical-header` | HTML canonical and Link header match |
| `core-nosnippet` | Detects nosnippet/max-snippet:0 directives |
| `core-robots-meta` | Checks noindex/nofollow directives |
| `core-title-unique` | Titles should be unique site-wide |
| `core-canonical-conflicting` | HTML and header canonicals should not conflict |
| `core-canonical-to-homepage` | Canonical should not always point to homepage |
| `core-canonical-http-mismatch` | Canonical protocol should match page protocol |
| `core-canonical-loop` | Detects circular canonical chains |
| `core-canonical-to-noindex` | Canonical should not point to noindexed page |

### Performance (22 rules) - 12% weight

| Rule | Description |
|------|-------------|
| `cwv-lcp` | Largest Contentful Paint (<2.5s pass, >4s fail) |
| `cwv-cls` | Cumulative Layout Shift (<0.1 pass, >0.25 fail) |
| `cwv-inp` | Interaction to Next Paint (<200ms pass, >500ms fail) |
| `cwv-ttfb` | Time to First Byte (<800ms pass, >1800ms fail) |
| `cwv-fcp` | First Contentful Paint (<1.8s pass, >3s fail) |
| `perf-dom-size` | DOM should have <1500 nodes |
| `perf-css-file-size` | CSS files should be reasonably sized |
| `perf-font-loading` | Font-display: swap should be used |
| `perf-preconnect` | Preconnect hints for third-party origins |
| `perf-render-blocking` | Scripts should use async/defer |
| `perf-lazy-above-fold` | Above-fold images should not be lazy-loaded |
| `perf-lcp-hints` | LCP element should be preloaded |
| `perf-text-compression` | Responses should use gzip/Brotli compression |
| `perf-brotli` | Prefer Brotli over gzip for better compression |
| `perf-cache-policy` | Static assets should have cache headers |
| `perf-minify-css` | CSS should be minified |
| `perf-minify-js` | JavaScript should be minified |
| `perf-response-time` | Server response time should be <200ms |
| `perf-http2` | Site should serve over HTTP/2 |
| `perf-page-weight` | Total page size should be <3MB |
| `perf-js-file-size` | Individual JS files should be <500KB |
| `perf-video-for-animations` | Use `<video>` instead of animated GIFs |

### Links (19 rules) - 8% weight

| Rule | Description |
|------|-------------|
| `links-broken-internal` | Internal links should return 200 |
| `links-external-valid` | External links should be reachable |
| `links-internal-present` | Page should have internal links |
| `links-nofollow-appropriate` | nofollow used appropriately |
| `links-anchor-text` | Anchor text should be descriptive |
| `links-depth` | Page depth should be ≤3 from homepage |
| `links-dead-end-pages` | Pages should have outgoing internal links |
| `links-https-downgrade` | HTTPS pages should not link to HTTP |
| `links-external-count` | Warn if >100 external links |
| `links-invalid-links` | No empty, javascript:, or malformed hrefs |
| `links-tel-mailto` | Valid tel: and mailto: link formats |
| `links-redirect-chains` | Links should not go through redirects |
| `links-orphan-pages` | Pages should have incoming links |
| `links-localhost` | No localhost/127.0.0.1 URLs in production |
| `links-local-file` | No file:// protocol links |
| `links-broken-fragment` | Fragment links should match element IDs |
| `links-excessive` | Limit internal links per page |
| `links-onclick` | No onclick-based navigation instead of `<a>` tags |
| `links-whitespace-href` | No whitespace in href attributes |

### Images (14 rules) - 8% weight

| Rule | Description |
|------|-------------|
| `images-alt-present` | All images should have alt attribute |
| `images-alt-quality` | Alt text should be descriptive |
| `images-dimensions` | Images should have width/height |
| `images-lazy-loading` | Below-fold images should use lazy loading |
| `images-modern-format` | Use WebP/AVIF formats |
| `images-size` | Images should be <200KB |
| `images-responsive` | Use srcset for responsive images |
| `images-broken` | Images should not return 404 |
| `images-figure-captions` | Figure elements should have figcaption |
| `images-filename-quality` | Use descriptive filenames |
| `images-inline-svg-size` | Inline SVGs should be <5KB |
| `images-picture-element` | Picture elements must have img fallback |
| `images-alt-length` | Alt text should be under 125 characters |
| `images-background-seo` | Content images should use `<img>`, not CSS background |

### Security (16 rules) - 8% weight

| Rule | Description |
|------|-------------|
| `security-https` | Site should use HTTPS |
| `security-https-redirect` | HTTP should redirect to HTTPS |
| `security-hsts` | Strict-Transport-Security header |
| `security-csp` | Content-Security-Policy header |
| `security-x-frame` | X-Frame-Options header |
| `security-x-content-type` | X-Content-Type-Options: nosniff |
| `security-external-links` | External target="_blank" links have noopener/noreferrer |
| `security-form-https` | Form actions use HTTPS |
| `security-mixed-content` | No HTTP resources on HTTPS pages |
| `security-permissions-policy` | Permissions-Policy header present |
| `security-referrer-policy` | Referrer-Policy header present |
| `security-leaked-secrets` | No exposed API keys or credentials |
| `security-password-http` | Login forms served over HTTPS only |
| `security-protocol-relative` | No protocol-relative URLs (//example.com) |
| `security-ssl-expiry` | SSL certificate not near expiration |
| `security-ssl-protocol` | TLS 1.2+ required; no TLS 1.0/1.1 |

### Technical SEO (13 rules) - 7% weight

| Rule | Description |
|------|-------------|
| `technical-robots-txt-exists` | robots.txt should return 200 |
| `technical-robots-txt-valid` | robots.txt should have valid syntax |
| `technical-sitemap-exists` | sitemap.xml should exist |
| `technical-sitemap-valid` | Sitemap should have valid XML structure |
| `technical-url-structure` | URL should use hyphens, lowercase |
| `technical-trailing-slash` | Consistent trailing slash usage |
| `technical-www-redirect` | www/non-www should redirect to one version |
| `technical-404-page` | Custom 404 page should exist |
| `technical-soft-404` | Soft 404 pages should return proper 404 status |
| `technical-server-error` | No 5xx server errors |
| `technical-4xx-non-404` | No 400, 403, 410 client errors |
| `technical-timeout` | Pages should respond within timeout |
| `technical-bad-content-type` | Content-Type header matches actual content |

### Crawlability (18 rules) - 5% weight

| Rule | Description |
|------|-------------|
| `crawl-schema-noindex-conflict` | Schema.org and noindex should not conflict |
| `crawl-pagination-canonical` | Paginated pages should self-canonicalize |
| `crawl-sitemap-domain` | Sitemap URLs should match host domain |
| `crawl-noindex-in-sitemap` | Noindexed pages should not be in sitemap |
| `crawl-indexability-conflict` | robots.txt and noindex should not both block |
| `crawl-canonical-redirect` | Canonical should not point through redirects |
| `crawl-sitemap-url-limit` | Sitemap should have <50,000 URLs |
| `crawl-sitemap-size-limit` | Sitemap should be <50MB |
| `crawl-sitemap-duplicate-urls` | No duplicate URLs in sitemap |
| `crawl-sitemap-orphan-urls` | Sitemap URLs should be linked internally |
| `crawl-blocked-resources` | Critical resources not blocked by robots.txt |
| `crawl-crawl-delay` | Excessive Crawl-delay slows indexing |
| `crawl-sitemap-in-robotstxt` | robots.txt should reference sitemap |
| `crawl-pagination-broken` | Pagination links should not be broken |
| `crawl-pagination-loop` | No circular pagination chains |
| `crawl-pagination-sequence` | No gaps in pagination sequence |
| `crawl-pagination-noindex` | Paginated pages should not be noindexed |
| `crawl-pagination-orphaned` | Paginated pages should be linked from content |

### Structured Data (13 rules) - 5% weight

| Rule | Description |
|------|-------------|
| `schema-present` | JSON-LD or microdata should exist |
| `schema-valid` | JSON-LD should be valid JSON |
| `schema-type` | @type field should be present |
| `schema-required-fields` | Required fields for schema type |
| `schema-article` | Validates Article schema properties |
| `schema-breadcrumb` | Checks BreadcrumbList on non-homepage |
| `schema-faq` | Validates FAQPage schema structure |
| `schema-local-business` | Validates LocalBusiness for local SEO |
| `schema-organization` | Validates Organization schema |
| `schema-product` | Validates Product schema for e-commerce |
| `schema-review` | Validates Review/AggregateRating schema |
| `schema-video` | Validates VideoObject schema |
| `schema-website-search` | Checks WebSite sitelinks searchbox |

### JavaScript Rendering (13 rules) - 5% weight

| Rule | Description |
|------|-------------|
| `js-rendered-title` | Title present in rendered DOM |
| `js-rendered-description` | Meta description present in rendered DOM |
| `js-rendered-h1` | H1 present in rendered DOM |
| `js-rendered-canonical` | Canonical present in rendered DOM |
| `js-canonical-mismatch` | Canonical matches between raw and rendered HTML |
| `js-noindex-mismatch` | Noindex consistent between raw and rendered HTML |
| `js-title-modified` | Title not changed by JavaScript |
| `js-description-modified` | Description not changed by JavaScript |
| `js-h1-modified` | H1 not changed by JavaScript |
| `js-rendered-content` | Main content present without JavaScript dependency |
| `js-rendered-links` | Navigation links present without JavaScript |
| `js-blocked-resources` | Critical JS not blocked by robots.txt |
| `js-ssr-check` | Server-side rendering detected |

### Accessibility (12 rules) - 4% weight

| Rule | Description |
|------|-------------|
| `a11y-aria-labels` | Interactive elements have accessible names |
| `a11y-color-contrast` | Color contrast issues detected |
| `a11y-focus-visible` | Focus indicator styles present |
| `a11y-form-labels` | Form inputs have associated labels |
| `a11y-heading-order` | Heading levels don't skip |
| `a11y-landmark-regions` | Proper landmark regions (main, nav, footer) |
| `a11y-link-text` | Descriptive link text (no "click here") |
| `a11y-skip-link` | Skip-to-content link for keyboard navigation |
| `a11y-table-headers` | Data tables have proper headers |
| `a11y-touch-targets` | Minimum 44x44px touch target sizing |
| `a11y-video-captions` | Videos have captions or transcripts |
| `a11y-zoom-disabled` | Viewport doesn't disable user zoom |

### Content (17 rules) - 5% weight

| Rule | Description |
|------|-------------|
| `content-word-count` | Page should have 300+ words |
| `content-reading-level` | Flesch-Kincaid reading level check |
| `content-keyword-stuffing` | Detects excessive keyword repetition |
| `content-article-links` | Checks link-to-content ratio |
| `content-broken-html` | Detects malformed HTML structure |
| `content-meta-in-body` | Meta tags should be in head |
| `content-mime-type` | Validates Content-Type header |
| `content-duplicate-description` | Descriptions should be unique site-wide |
| `content-heading-hierarchy` | Proper heading hierarchy (H1>H2>H3) |
| `content-heading-length` | Headings should be 10-70 characters |
| `content-heading-unique` | Headings should be unique |
| `content-text-html-ratio` | Text-to-HTML ratio should be >10% |
| `content-title-same-as-h1` | Title and H1 should differ |
| `content-title-pixel-width` | Title pixel width for SERP display (<580px) |
| `content-description-pixel-width` | Description pixel width for SERP (<920px) |
| `content-duplicate-exact` | Detects exact duplicate content across pages |
| `content-duplicate-near` | Detects near-duplicate content via simhash |

### Social (9 rules) - 3% weight

| Rule | Description |
|------|-------------|
| `social-og-title` | og:title meta tag |
| `social-og-description` | og:description meta tag |
| `social-og-image` | og:image with valid URL |
| `social-og-image-size` | og:image dimensions (1200x630) |
| `social-twitter-card` | twitter:card meta tag |
| `social-og-url` | og:url meta tag |
| `social-og-url-canonical` | og:url matches canonical |
| `social-share-buttons` | Social share buttons present |
| `social-social-profiles` | Social profile links present |

### E-E-A-T (14 rules) - 3% weight

| Rule | Description |
|------|-------------|
| `eeat-about-page` | About page exists |
| `eeat-affiliate-disclosure` | Affiliate links have disclosure |
| `eeat-author-byline` | Author attribution present |
| `eeat-author-expertise` | Author credentials/bio present |
| `eeat-citations` | Links to authoritative sources |
| `eeat-contact-page` | Contact page exists |
| `eeat-content-dates` | Publication/modification dates present |
| `eeat-disclaimers` | YMYL content has disclaimers |
| `eeat-editorial-policy` | Editorial policy page exists |
| `eeat-physical-address` | Business address present |
| `eeat-privacy-policy` | Privacy policy link present |
| `eeat-terms-of-service` | Terms of service link present |
| `eeat-trust-signals` | Trust badges, reviews, certifications |
| `eeat-ymyl-detection` | YMYL content detection |

### URL Structure (14 rules) - 3% weight

| Rule | Description |
|------|-------------|
| `url-slug-keywords` | URL slug contains keywords |
| `url-stop-words` | URL should not have stop words |
| `url-uppercase` | URLs should be lowercase |
| `url-underscores` | Use hyphens, not underscores |
| `url-double-slash` | No consecutive slashes in path |
| `url-spaces` | No spaces in URL |
| `url-non-ascii` | No non-ASCII characters in URL |
| `url-length` | URL should be under 2048 characters |
| `url-repetitive-path` | No repetitive path segments |
| `url-parameters` | Excessive query parameters |
| `url-session-ids` | No session IDs in URL |
| `url-tracking-params` | Tracking parameters should use canonical |
| `url-internal-search` | Internal search URLs should be noindexed |
| `url-http-https-duplicate` | HTTP/HTTPS versions should canonicalize |

### Redirects (8 rules) - 3% weight

| Rule | Description |
|------|-------------|
| `redirect-meta-refresh` | No `<meta http-equiv="refresh">` redirects |
| `redirect-javascript` | No JavaScript-based redirects |
| `redirect-http-refresh` | No HTTP Refresh header redirects |
| `redirect-loop` | No circular redirect chains |
| `redirect-type` | Prefer 301 over 302 for permanent moves |
| `redirect-broken` | Redirects should not lead to errors |
| `redirect-resource` | No redirects on CSS/JS/image resources |
| `redirect-case-normalization` | Redirect uppercase URLs to lowercase |

### Mobile (5 rules) - 2% weight

| Rule | Description |
|------|-------------|
| `mobile-font-size` | Minimum 16px body text |
| `mobile-horizontal-scroll` | No horizontal scrolling |
| `mobile-interstitials` | No intrusive interstitials |
| `mobile-viewport-width` | No fixed viewport width |
| `mobile-multiple-viewports` | Single viewport meta tag |

### Internationalization (10 rules) - 2% weight

| Rule | Description |
|------|-------------|
| `i18n-lang-attribute` | HTML lang attribute present |
| `i18n-hreflang` | Hreflang tags for multilingual sites |
| `i18n-hreflang-return-links` | Hreflang targets link back to source |
| `i18n-hreflang-to-noindex` | Hreflang should not point to noindexed pages |
| `i18n-hreflang-to-non-canonical` | Hreflang should point to canonical URLs |
| `i18n-hreflang-to-broken` | Hreflang should not point to broken URLs |
| `i18n-hreflang-to-redirect` | Hreflang should not point through redirects |
| `i18n-hreflang-conflicting` | No duplicate hreflang for same language |
| `i18n-hreflang-lang-mismatch` | Page language matches hreflang code |
| `i18n-hreflang-multiple-methods` | Use single hreflang method |

### HTML Validation (9 rules) - 2% weight

| Rule | Description |
|------|-------------|
| `htmlval-missing-doctype` | `<!DOCTYPE html>` must be present |
| `htmlval-missing-charset` | `<meta charset>` must be in head |
| `htmlval-invalid-head` | Only metadata elements in `<head>` |
| `htmlval-noscript-in-head` | `<noscript>` should be in body |
| `htmlval-multiple-heads` | Single `<head>` element only |
| `htmlval-size-limit` | HTML should be under 5MB |
| `htmlval-lorem-ipsum` | No placeholder lorem ipsum text |
| `htmlval-multiple-titles` | Single `<title>` tag only |
| `htmlval-multiple-descriptions` | Single meta description only |

### AI/GEO Readiness (5 rules) - 2% weight

| Rule | Description |
|------|-------------|
| `geo-semantic-html` | Uses semantic HTML elements |
| `geo-content-structure` | Proper heading hierarchy and lists |
| `geo-ai-bot-access` | AI crawlers (GPTBot, ClaudeBot) not blocked |
| `geo-llms-txt` | /llms.txt file for AI discovery |
| `geo-schema-drift` | JSON-LD matches visible content |

### Legal Compliance (1 rule) - 1% weight

| Rule | Description |
|------|-------------|
| `legal-cookie-consent` | Cookie consent banner present |

## Configuration

Create a `seomator.toml` config file with `seomator init`:

```toml
[project]
name = "my-website"
domains = ["example.com", "www.example.com"]

[crawler]
max_pages = 100
concurrency = 3
timeout_ms = 30000
respect_robots = true
delay_ms = 100
include = []
exclude = ["/admin/**", "/api/**"]
drop_query_prefixes = ["utm_", "gclid", "fbclid"]

[rules]
enable = ["*"]
disable = ["perf-inp"]  # Supports wildcards: "core-*"

[output]
format = "console"  # console, json, html, markdown, llm
```

Config priority (highest to lowest):
1. CLI arguments
2. Local `./seomator.toml`
3. Parent directory configs
4. Global `~/.seomator/config.toml`
5. Built-in defaults

## Output Formats

| Format | Flag | Best For |
|--------|------|----------|
| Console | `--format console` | Human terminal output (default) |
| JSON | `--format json` | CI/CD, programmatic processing |
| HTML | `--format html` | Standalone reports, sharing |
| Markdown | `--format markdown` | Documentation, GitHub |
| LLM | `--format llm` | AI agents, piping to Claude |

### Terminal Output

```
╔══════════════════════════════════════════════════════════════╗
║  SEOmator Audit Report                                      ║
╚══════════════════════════════════════════════════════════════╝

URL:       https://example.com
Score:     88/100  [A]

┌──────────────────────────┬───────┬────────┬──────────┬────────┐
│ Category                 │ Score │ Passed │ Warnings │ Failed │
├──────────────────────────┼───────┼────────┼──────────┼────────┤
│ Core                     │ 97    │ 18     │ 1        │ 0      │
│ Performance              │ 85    │ 18     │ 3        │ 1      │
│ JavaScript Rendering     │ 100   │ 13     │ 0        │ 0      │
│ ...                      │       │        │          │        │
└──────────────────────────┴───────┴────────┴──────────┴────────┘
```

### JSON Output

```json
{
  "url": "https://example.com",
  "overallScore": 88,
  "categoryResults": [
    {
      "categoryId": "core",
      "score": 97,
      "passCount": 18,
      "warnCount": 1,
      "failCount": 0,
      "results": [...]
    }
  ],
  "timestamp": "2026-01-23T16:00:00.000Z",
  "crawledPages": 1
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: SEO Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install SEOmator
        run: npm install -g @seomator/seo-audit

      - name: Install Playwright browsers
        run: npx playwright install chromium

      - name: Run SEO Audit
        run: seomator audit https://your-staging-url.com --format json -o seo-report.json

      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: seo-report
          path: seo-report.json
```

### GitLab CI

```yaml
seo-audit:
  image: node:20
  script:
    - npm install -g @seomator/seo-audit
    - npx playwright install chromium
    - seomator audit https://your-staging-url.com --format json -o seo-report.json
  artifacts:
    paths:
      - seo-report.json
```

## Programmatic Usage

```typescript
import { Auditor, createAuditor } from '@seomator/seo-audit';

const auditor = createAuditor({
  categories: ['core', 'security', 'perf'],
  measureCwv: true,
  onCategoryComplete: (categoryId, name, result) => {
    console.log(`${name}: ${result.score}/100`);
  }
});

const result = await auditor.audit('https://example.com');
console.log(`Overall Score: ${result.overallScore}`);
```

## Claude Code Skill

Use SEOmator directly in [Claude Code](https://claude.ai/claude-code) as an AI skill for automated SEO auditing.

### Setup

```bash
npx skills add seo-skills/seo-audit-skill
```

### Usage

```
"Run an SEO audit on https://example.com"
"Audit https://mysite.com and tell me what to fix first"
"Check SEO health of https://example.com with 20-page crawl"
```

## Requirements

- **Node.js 18+** (uses native fetch API)
- **Playwright** (for Core Web Vitals and JS rendering analysis)

After installing, run `npx playwright install chromium` to install the browser for CWV measurement.

## License

MIT
