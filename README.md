# SEOmator Audit CLI

A comprehensive SEO audit command-line tool with **81 audit rules** across **11 categories**. Analyze any website for SEO best practices, Core Web Vitals, security headers, structured data, and more.

> **Prefer a web interface?** Try our [Free SEO Audit Tool](https://seomator.com/free-seo-audit-tool) for a visual, browser-based SEO analysis.

## Features

- **81 SEO Audit Rules** across 11 categories
- **Single Page & Crawl Mode** - Audit one page or crawl entire sites
- **Core Web Vitals** - LCP, CLS, FCP, TTFB, INP measurement
- **JSON & Terminal Output** - Machine-readable or human-friendly reports
- **Concurrent Crawling** - Fast multi-page audits with configurable concurrency
- **Exit Codes** - CI/CD friendly with pass/fail exit codes

## Installation

### From npm (recommended)

```bash
# Install globally
npm install -g @seomator/seo-audit

# Run audit (uses your system Chrome/Chromium automatically)
seomator https://example.com
```

> **Note:** The CLI automatically uses your system Chrome, Chromium, or Edge browser for Core Web Vitals measurement. No additional browser installation is required if you have Chrome installed.

### From source

```bash
git clone https://github.com/seo-skills/seo-audit-skill.git
cd seo-audit-skill
npm install
npm run build

# Run directly
./dist/cli.js https://example.com

# Or link globally
npm link
seomator https://example.com
```

## Quick Start

```bash
# Basic audit
seomator https://example.com

# Audit specific categories
seomator https://example.com --categories meta-tags,security

# JSON output (for CI/CD or parsing)
seomator https://example.com --json

# Crawl multiple pages
seomator https://example.com --crawl --max-pages 20

# Full options
seomator https://example.com --crawl --max-pages 50 --concurrency 5 --timeout 60000
```

## CLI Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `<url>` | - | URL to audit (required) | - |
| `--categories <list>` | `-c` | Comma-separated categories to audit | All |
| `--json` | `-j` | Output results as JSON | false |
| `--crawl` | - | Enable crawl mode for multiple pages | false |
| `--max-pages <n>` | - | Maximum pages to crawl | 10 |
| `--concurrency <n>` | - | Concurrent requests | 3 |
| `--timeout <ms>` | - | Request timeout in milliseconds | 30000 |
| `--version` | `-V` | Show version number | - |
| `--help` | `-h` | Show help | - |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Audit passed (score >= 70) |
| 1 | Audit failed (score < 70) |
| 2 | Error occurred |

## Categories & Rules

### Meta Tags (8 rules) - 12% weight
| Rule | Description |
|------|-------------|
| `meta-tags-title-present` | Check `<title>` tag exists |
| `meta-tags-title-length` | Title should be 30-60 characters |
| `meta-tags-description-present` | Check meta description exists |
| `meta-tags-description-length` | Description should be 120-160 characters |
| `meta-tags-canonical-present` | Check canonical URL exists |
| `meta-tags-canonical-valid` | Canonical URL should be valid absolute URL |
| `meta-tags-viewport-present` | Check viewport meta tag exists |
| `meta-tags-favicon-present` | Check favicon link exists |

### Core SEO (4 rules) - 5% weight
| Rule | Description |
|------|-------------|
| `core-seo-canonical-header` | HTML canonical and Link header should match |
| `core-seo-nosnippet` | Detects nosnippet/max-snippet:0 directives |
| `core-seo-robots-meta` | Checks for noindex/nofollow directives |
| `core-seo-title-unique` | Page titles should be unique site-wide |

### Headings (6 rules) - 9% weight
| Rule | Description |
|------|-------------|
| `headings-h1-present` | At least one H1 should exist |
| `headings-h1-single` | Only one H1 should exist |
| `headings-hierarchy` | Proper heading hierarchy (no skipped levels) |
| `headings-content-length` | Headings should be 10-70 characters |
| `headings-content-unique` | Headings should be unique |
| `headings-lang-attribute` | HTML lang attribute should exist |

### Technical SEO (8 rules) - 12% weight
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

### Core Web Vitals (5 rules) - 14% weight
| Rule | Threshold |
|------|-----------|
| `cwv-lcp` | Pass: <2.5s, Warn: 2.5-4s, Fail: >4s |
| `cwv-cls` | Pass: <0.1, Warn: 0.1-0.25, Fail: >0.25 |
| `cwv-inp` | Pass: <200ms, Warn: 200-500ms, Fail: >500ms |
| `cwv-ttfb` | Pass: <800ms, Warn: 800-1800ms, Fail: >1800ms |
| `cwv-fcp` | Pass: <1.8s, Warn: 1.8-3s, Fail: >3s |

### Links (13 rules) - 10% weight
| Rule | Description |
|------|-------------|
| `links-broken-internal` | Internal links should return 200 |
| `links-external-valid` | External links should be reachable |
| `links-internal-present` | Page should have internal links |
| `links-nofollow-appropriate` | nofollow used appropriately |
| `links-anchor-text` | Anchor text should be descriptive |
| `links-depth` | Page depth should be ≤3 from homepage |
| `links-dead-end-pages` | Page should have outgoing internal links |
| `links-https-downgrade` | HTTPS pages should not link to HTTP |
| `links-external-count` | Warn if >100 external links |
| `links-invalid` | No empty, javascript:, or malformed hrefs |
| `links-tel-mailto` | Valid tel: and mailto: link formats |
| `links-redirect-chains` | Links should not go through redirects |
| `links-orphan-pages` | Pages should have incoming links |

### Images (12 rules) - 10% weight
| Rule | Description |
|------|-------------|
| `images-alt-present` | All images should have alt attribute |
| `images-alt-quality` | Alt text should be descriptive |
| `images-dimensions` | Images should have width/height |
| `images-lazy-loading` | Below-fold images should use lazy loading |
| `images-modern-format` | Use WebP/AVIF formats |
| `images-size` | Images should be <200KB |
| `images-responsive` | Use srcset for responsive images |
| `images-broken` | Images should not return 404 errors |
| `images-figure-captions` | Figure elements should have figcaption |
| `images-filename-quality` | Use descriptive filenames (not IMG_001.jpg) |
| `images-inline-svg-size` | Inline SVGs should be <5KB |
| `images-picture-element` | Picture elements must have img fallback |

### Security (6 rules) - 10% weight
| Rule | Description |
|------|-------------|
| `security-https` | Site should use HTTPS |
| `security-https-redirect` | HTTP should redirect to HTTPS |
| `security-hsts` | Strict-Transport-Security header |
| `security-csp` | Content-Security-Policy header |
| `security-x-frame-options` | X-Frame-Options header |
| `security-x-content-type-options` | X-Content-Type-Options: nosniff |

### Structured Data (4 rules) - 6% weight
| Rule | Description |
|------|-------------|
| `structured-data-present` | JSON-LD or microdata should exist |
| `structured-data-valid` | JSON-LD should be valid JSON |
| `structured-data-type` | @type field should be present |
| `structured-data-required-fields` | Required fields for schema type |

### Social (5 rules) - 5% weight
| Rule | Description |
|------|-------------|
| `social-og-title` | og:title meta tag |
| `social-og-description` | og:description meta tag |
| `social-og-image` | og:image with valid URL |
| `social-twitter-card` | twitter:card meta tag |
| `social-og-url` | og:url meta tag |

### Content (10 rules) - 7% weight
| Rule | Description |
|------|-------------|
| `content-word-count` | Page should have 300+ words |
| `content-reading-level` | Flesch-Kincaid reading level check |
| `content-keyword-stuffing` | Detects excessive keyword repetition |
| `content-article-links` | Checks link-to-content ratio |
| `content-author-info` | Author attribution for E-E-A-T |
| `content-freshness` | Date signals (datePublished/Modified) |
| `content-broken-html` | Detects malformed HTML structure |
| `content-meta-in-body` | Meta tags should be in head |
| `content-mime-type` | Validates Content-Type header |
| `content-duplicate-description` | Meta descriptions should be unique |

## Output Examples

### Terminal Output
```
============================================================
  SEO AUDIT REPORT
============================================================

URL:       https://example.com
Timestamp: 1/23/2026, 4:00:00 PM

OVERALL SCORE

  ███████████████████████████████████░░░░░ 88/100
  Good

CATEGORY BREAKDOWN

┌──────────────────────┬────────────┬──────────┬────────────┬──────────┐
│ Category             │ Score      │ Passed   │ Warnings   │ Failed   │
├──────────────────────┼────────────┼──────────┼────────────┼──────────┤
│ Meta Tags            │ 97         │ 7        │ 1          │ 0        │
│ Headings             │ 100        │ 6        │ 0          │ 0        │
│ Technical SEO        │ 100        │ 7        │ 0          │ 1        │
...
```

### JSON Output
```json
{
  "url": "https://example.com",
  "overallScore": 88,
  "categoryResults": [
    {
      "categoryId": "meta-tags",
      "score": 97,
      "passCount": 7,
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
        run: seomator https://your-staging-url.com --json > seo-report.json

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
    - seomator https://your-staging-url.com --json > seo-report.json
  artifacts:
    paths:
      - seo-report.json
```

## Programmatic Usage

```typescript
import { Auditor, createAuditor } from '@seomator/seo-audit';

const auditor = createAuditor({
  categories: ['meta-tags', 'security'],
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

Add to your Claude Code settings (`.claude/settings.json`):

```json
{
  "skills": [
    "https://github.com/seo-skills/seo-audit-skill/tree/main/skill"
  ]
}
```

### Usage

Once configured, simply ask Claude to audit any website:

```
"Run an SEO audit on https://example.com"
"Check the SEO health of my site https://mysite.com"
"Audit https://example.com focusing on security and meta tags"
```

Claude will install the CLI (if needed), run the audit, and provide actionable recommendations based on the results.

### Skill Contents

- **[SKILL.md](skill/SKILL.md)** - Main skill definition with installation and usage instructions
- **[references/rules.md](skill/references/rules.md)** - Complete reference of all 81 audit rules

## Requirements

- **Node.js 18+** (uses native fetch API)
- **Playwright** (for Core Web Vitals measurement)

After installing, run `npx playwright install chromium` to install the browser for CWV measurement.

## License

MIT
