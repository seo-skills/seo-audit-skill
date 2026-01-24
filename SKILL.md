---
name: seo-audit
description: Run comprehensive SEO audits on websites using SEOmator CLI. Analyzes 59 rules across 10 categories including Core SEO, meta tags, Core Web Vitals, security headers, and structured data. Supports HTML/Markdown reports, URL filtering, and config validation.
---

# SEO Audit Skill

Run comprehensive SEO audits and provide actionable recommendations based on results.

## Installation

Before first use, install the CLI globally:

```bash
npm install -g @seomator/seo-audit
```

> **Note:** The CLI automatically uses your system Chrome, Chromium, or Edge for Core Web Vitals measurement. No additional browser installation needed.

## Running an Audit

### Single Page Audit
```bash
seomator audit <url> --json
```

### Multi-Page Crawl
```bash
seomator audit <url> --crawl --max-pages 20 --json
```

### Fast Audit (Skip CWV)
```bash
seomator audit <url> --json --no-cwv
```

### HTML Report Output
```bash
seomator audit <url> --format html -o report.html --no-cwv
```

### Markdown Report Output
```bash
seomator audit <url> --format markdown -o report.md --no-cwv
```

## Output Formats

| Format | Flag | Description |
|--------|------|-------------|
| Console | `--format console` | Terminal output with colors (default) |
| JSON | `--format json` or `--json` | Machine-readable JSON |
| HTML | `--format html -o file.html` | Self-contained HTML report |
| Markdown | `--format markdown -o file.md` | GitHub-flavored Markdown |

## Configuration

### Validate Config
```bash
seomator config validate    # Check for errors/warnings
seomator config show        # Show merged config with sources
seomator config path        # Show config file locations
```

### Config File (seomator.toml)
```toml
[project]
name = "my-website"

[crawler]
max_pages = 100
exclude = ["/admin/**", "/api/**"]  # Glob patterns
drop_query_prefixes = ["utm_", "gclid", "fbclid"]

[rules]
enable = ["*"]
disable = ["core-web-vitals-*"]  # Wildcards supported

[output]
format = "console"  # console, json, html, markdown
```

## Evaluating Results

After running the audit, parse the JSON output and evaluate as follows:

### 1. Check Overall Score
- **90-100**: Excellent - Minor optimizations only
- **70-89**: Good - Address warnings and failures
- **50-69**: Needs Work - Priority fixes required
- **0-49**: Poor - Critical issues to resolve

### 2. Prioritize by Category Weight
Fix issues in this order (highest impact first):

| Priority | Category | Weight | Impact |
|----------|----------|--------|--------|
| 1 | Core Web Vitals | 15% | User experience + ranking |
| 2 | Meta Tags | 13% | Critical for search visibility |
| 3 | Technical SEO | 13% | Foundation for crawling |
| 4 | Security | 10% | Trust signals |
| 5 | Links | 10% | Internal linking structure |
| 6 | Images | 10% | Performance + accessibility |
| 7 | Headings | 10% | Content structure |
| 8 | Structured Data | 7% | Rich snippets |
| 9 | Core SEO | 6% | Canonical & indexing validation |
| 10 | Social | 6% | Social sharing |

### 3. Fix by Severity
1. **Failures (status: "fail")** - Must fix immediately
2. **Warnings (status: "warn")** - Should fix soon
3. **Passes (status: "pass")** - No action needed

## Common Issues and Fixes

### Core SEO

| Rule | Issue | Fix |
|------|-------|-----|
| `core-seo-canonical-header` | Canonical mismatch | Use HTML canonical only; reserve Link header for PDFs |
| `core-seo-nosnippet` | Blocks snippets | Remove nosnippet unless needed for sensitive content |
| `core-seo-robots-meta` | Noindex/nofollow | Remove unless intentionally blocking search engines |
| `core-seo-title-unique` | Duplicate titles | Create unique titles: "Page Topic \| Brand Name" |

### Meta Tags

| Rule | Issue | Fix |
|------|-------|-----|
| `meta-tags-title-present` | Missing title | Add `<title>` tag in `<head>` |
| `meta-tags-title-length` | Title too short/long | Keep between 30-60 characters |
| `meta-tags-description-present` | Missing description | Add `<meta name="description">` |
| `meta-tags-description-length` | Description length | Keep between 120-160 characters |
| `meta-tags-canonical-present` | Missing canonical | Add `<link rel="canonical" href="...">` |
| `meta-tags-viewport-present` | Missing viewport | Add `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| `meta-tags-favicon-present` | Missing favicon | Add `<link rel="icon" href="/favicon.ico">` |

### Core Web Vitals

| Rule | Threshold | Fix |
|------|-----------|-----|
| `cwv-lcp` | >2.5s poor | Optimize largest image, use CDN, preload critical assets |
| `cwv-cls` | >0.1 poor | Set explicit width/height on images, avoid inserting content above existing |
| `cwv-fcp` | >1.8s poor | Reduce server response time, eliminate render-blocking resources |
| `cwv-ttfb` | >800ms poor | Use CDN, optimize server, enable caching |
| `cwv-inp` | >200ms poor | Optimize JavaScript, break up long tasks |

### Technical SEO

| Rule | Issue | Fix |
|------|-------|-----|
| `technical-robots-txt-exists` | Missing robots.txt | Create `/robots.txt` with crawl rules |
| `technical-sitemap-exists` | Missing sitemap | Create `/sitemap.xml` with all URLs |
| `technical-url-structure` | Bad URL format | Use lowercase, hyphens, no special chars |
| `technical-404-page` | Generic 404 | Create custom 404 page with navigation |

### Security

| Rule | Issue | Fix |
|------|-------|-----|
| `security-https` | Not using HTTPS | Install SSL certificate, redirect HTTP to HTTPS |
| `security-hsts` | Missing HSTS | Add header: `Strict-Transport-Security: max-age=31536000` |
| `security-csp` | Missing CSP | Add Content-Security-Policy header |
| `security-x-frame-options` | Clickjacking risk | Add header: `X-Frame-Options: DENY` |

### Images

| Rule | Issue | Fix |
|------|-------|-----|
| `images-alt-present` | Missing alt text | Add descriptive `alt` attribute to all `<img>` |
| `images-dimensions` | No width/height | Add `width` and `height` attributes |
| `images-lazy-loading` | No lazy loading | Add `loading="lazy"` to below-fold images |
| `images-modern-format` | Old formats | Convert to WebP or AVIF |
| `images-responsive` | Not responsive | Use `srcset` for different screen sizes |

### Links

| Rule | Issue | Fix |
|------|-------|-----|
| `links-broken-internal` | 404 links | Fix or remove broken internal links |
| `links-anchor-text` | Generic anchors | Use descriptive text instead of "click here" |
| `links-depth` | Too deep | Restructure navigation, max 3 clicks from home |

### Structured Data

| Rule | Issue | Fix |
|------|-------|-----|
| `structured-data-present` | No schema | Add JSON-LD structured data |
| `structured-data-valid` | Invalid JSON | Fix JSON syntax errors |
| `structured-data-type` | Missing @type | Add `"@type": "WebPage"` or appropriate type |

### Social (Open Graph)

| Rule | Issue | Fix |
|------|-------|-----|
| `social-og-title` | Missing | Add `<meta property="og:title" content="...">` |
| `social-og-description` | Missing | Add `<meta property="og:description" content="...">` |
| `social-og-image` | Missing/invalid | Add `<meta property="og:image" content="https://...">` |
| `social-twitter-card` | Missing | Add `<meta name="twitter:card" content="summary_large_image">` |

## Example Analysis Workflow

When asked to audit a website:

1. **Run the audit**:
   ```bash
   seomator audit https://example.com --json --no-cwv 2>/dev/null
   ```

2. **Or generate HTML report**:
   ```bash
   seomator audit https://example.com --format html -o audit-report.html --no-cwv
   ```

3. **Parse the JSON output** and identify:
   - Overall score
   - Categories with lowest scores
   - All failures (status: "fail")
   - All warnings (status: "warn")

4. **Generate recommendations** in priority order:
   - Group by category
   - Sort by severity (failures first)
   - Provide specific fix instructions

5. **Summarize**:
   - Total issues found
   - Top 3-5 priority fixes
   - Expected score improvement if fixed

## Output Structure Reference

```json
{
  "url": "https://example.com",
  "overallScore": 85,
  "crawledPages": 10,
  "categoryResults": [
    {
      "categoryId": "meta-tags",
      "score": 97,
      "passCount": 7,
      "warnCount": 1,
      "failCount": 0,
      "results": [
        {
          "ruleId": "meta-tags-title-present",
          "status": "pass|warn|fail",
          "message": "Human-readable result",
          "score": 100,
          "details": { /* rule-specific data */ }
        }
      ]
    }
  ]
}
```

## Resources

- npm: https://www.npmjs.com/package/@seomator/seo-audit
- GitHub: https://github.com/seo-skills/seo-audit-skill
- Web UI: https://seomator.com/free-seo-audit-tool
- Rules Reference: See `docs/SEO-AUDIT-RULES.md` for all 59 rules
