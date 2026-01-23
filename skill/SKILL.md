---
name: seo-audit
description: Run comprehensive SEO audits on websites using SEOmator CLI. Analyzes 55 rules across 9 categories including meta tags, Core Web Vitals, security headers, and structured data. Provides actionable recommendations based on results.
---

# SEO Audit Skill

Run comprehensive SEO audits and provide actionable recommendations based on results.

## Installation

Before first use, install the CLI globally:

```bash
npm install -g @seomator/seo-audit
npx playwright install chromium
```

## Running an Audit

### Single Page Audit
```bash
seomator <url> --json --verbose
```

### Multi-Page Crawl
```bash
seomator <url> --crawl --max-pages 20 --json --verbose
```

### Fast Audit (Skip CWV)
```bash
seomator <url> --json --no-cwv
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
| 1 | Meta Tags | 15% | Critical for search visibility |
| 2 | Technical SEO | 15% | Foundation for crawling |
| 3 | Core Web Vitals | 15% | User experience + ranking |
| 4 | Security | 10% | Trust signals |
| 5 | Links | 10% | Internal linking structure |
| 6 | Images | 10% | Performance + accessibility |
| 7 | Headings | 10% | Content structure |
| 8 | Structured Data | 8% | Rich snippets |
| 9 | Social | 7% | Social sharing |

### 3. Fix by Severity
1. **Failures (status: "fail")** - Must fix immediately
2. **Warnings (status: "warn")** - Should fix soon
3. **Passes (status: "pass")** - No action needed

## Common Issues and Fixes

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
   seomator https://example.com --json --verbose 2>/dev/null
   ```

2. **Parse the JSON output** and identify:
   - Overall score
   - Categories with lowest scores
   - All failures (status: "fail")
   - All warnings (status: "warn")

3. **Generate recommendations** in priority order:
   - Group by category
   - Sort by severity (failures first)
   - Provide specific fix instructions

4. **Summarize**:
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
- Rules Reference: See `references/rules.md` for all 55 rules
