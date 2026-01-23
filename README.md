# SEOmator Audit CLI

A comprehensive SEO audit command-line tool with **55 audit rules** across **9 categories**. Analyze any website for SEO best practices, Core Web Vitals, security headers, structured data, and more.

## Features

- **55 SEO Audit Rules** across 9 categories
- **Single Page & Crawl Mode** - Audit one page or crawl entire sites
- **Core Web Vitals** - LCP, CLS, FCP, TTFB, INP measurement
- **JSON & Terminal Output** - Machine-readable or human-friendly reports
- **Concurrent Crawling** - Fast multi-page audits with configurable concurrency
- **Exit Codes** - CI/CD friendly with pass/fail exit codes

## Installation

### From npm (recommended)

```bash
# Install globally
npm install -g @seomator/audit-cli

# Or use npx without installing
npx @seomator/audit-cli https://example.com
```

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

### Meta Tags (8 rules) - 15% weight
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

### Headings (6 rules) - 10% weight
| Rule | Description |
|------|-------------|
| `headings-h1-present` | At least one H1 should exist |
| `headings-h1-single` | Only one H1 should exist |
| `headings-hierarchy` | Proper heading hierarchy (no skipped levels) |
| `headings-content-length` | Headings should be 10-70 characters |
| `headings-content-unique` | Headings should be unique |
| `headings-lang-attribute` | HTML lang attribute should exist |

### Technical SEO (8 rules) - 15% weight
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

### Core Web Vitals (5 rules) - 15% weight
| Rule | Threshold |
|------|-----------|
| `cwv-lcp` | Pass: <2.5s, Warn: 2.5-4s, Fail: >4s |
| `cwv-cls` | Pass: <0.1, Warn: 0.1-0.25, Fail: >0.25 |
| `cwv-inp` | Pass: <200ms, Warn: 200-500ms, Fail: >500ms |
| `cwv-ttfb` | Pass: <800ms, Warn: 800-1800ms, Fail: >1800ms |
| `cwv-fcp` | Pass: <1.8s, Warn: 1.8-3s, Fail: >3s |

### Links (6 rules) - 10% weight
| Rule | Description |
|------|-------------|
| `links-broken-internal` | Internal links should return 200 |
| `links-external-valid` | External links should be reachable |
| `links-internal-present` | Page should have internal links |
| `links-nofollow-appropriate` | nofollow used appropriately |
| `links-anchor-text` | Anchor text should be descriptive |
| `links-depth` | Page depth should be ≤3 from homepage |

### Images (7 rules) - 10% weight
| Rule | Description |
|------|-------------|
| `images-alt-present` | All images should have alt attribute |
| `images-alt-quality` | Alt text should be descriptive |
| `images-dimensions` | Images should have width/height |
| `images-lazy-loading` | Below-fold images should use lazy loading |
| `images-modern-format` | Use WebP/AVIF formats |
| `images-size` | Images should be <200KB |
| `images-responsive` | Use srcset for responsive images |

### Security (6 rules) - 10% weight
| Rule | Description |
|------|-------------|
| `security-https` | Site should use HTTPS |
| `security-https-redirect` | HTTP should redirect to HTTPS |
| `security-hsts` | Strict-Transport-Security header |
| `security-csp` | Content-Security-Policy header |
| `security-x-frame-options` | X-Frame-Options header |
| `security-x-content-type-options` | X-Content-Type-Options: nosniff |

### Structured Data (4 rules) - 8% weight
| Rule | Description |
|------|-------------|
| `structured-data-present` | JSON-LD or microdata should exist |
| `structured-data-valid` | JSON-LD should be valid JSON |
| `structured-data-type` | @type field should be present |
| `structured-data-required-fields` | Required fields for schema type |

### Social (5 rules) - 7% weight
| Rule | Description |
|------|-------------|
| `social-og-title` | og:title meta tag |
| `social-og-description` | og:description meta tag |
| `social-og-image` | og:image with valid URL |
| `social-twitter-card` | twitter:card meta tag |
| `social-og-url` | og:url meta tag |

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
        run: npm install -g @seomator/audit-cli

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
    - npm install -g @seomator/audit-cli
    - npx playwright install chromium
    - seomator https://your-staging-url.com --json > seo-report.json
  artifacts:
    paths:
      - seo-report.json
```

## Programmatic Usage

```typescript
import { Auditor, createAuditor } from '@seomator/audit-cli';

const auditor = createAuditor({
  categories: ['meta-tags', 'security'],
  onCategoryComplete: (categoryId, name, result) => {
    console.log(`${name}: ${result.score}/100`);
  }
});

const result = await auditor.audit('https://example.com');
console.log(`Overall Score: ${result.overallScore}`);
```

## Requirements

- **Node.js 18+** (uses native fetch API)
- **Playwright** (for Core Web Vitals measurement)

After installing, run `npx playwright install chromium` to install the browser for CWV measurement.

## License

MIT
