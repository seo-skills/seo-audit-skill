---
name: seo-audit
description: Run comprehensive SEO audits on websites using SEOmator CLI. Analyzes 55 rules across 9 categories including meta tags, Core Web Vitals, security headers, and structured data.
---

# SEO Audit Skill

Run comprehensive SEO audits on any website using the SEOmator CLI tool.

## Installation

Before first use, install the CLI globally:

```bash
npm install -g @seomator/seo-audit
npx playwright install chromium
```

Verify installation:
```bash
seomator --version
```

## Usage

### Basic Audit (Single Page)

```bash
seomator <url> --json
```

Example:
```bash
seomator https://example.com --json
```

### Audit Specific Categories

```bash
seomator <url> --categories meta-tags,security --json
```

Available categories:
- `meta-tags` - Title, description, canonical, viewport, favicon
- `headings` - H1 presence, hierarchy, uniqueness
- `technical` - robots.txt, sitemap, URL structure, 404 pages
- `core-web-vitals` - LCP, CLS, INP, TTFB, FCP
- `links` - Broken links, anchor text, internal linking
- `images` - Alt text, dimensions, lazy loading, modern formats
- `security` - HTTPS, HSTS, CSP, X-Frame-Options
- `structured-data` - JSON-LD validation
- `social` - Open Graph, Twitter cards

### Crawl Multiple Pages

```bash
seomator <url> --crawl --max-pages 20 --json
```

Options:
- `--max-pages <n>` - Maximum pages to crawl (default: 10)
- `--concurrency <n>` - Concurrent requests (default: 3)
- `--timeout <ms>` - Request timeout (default: 30000)

## Output Format

The `--json` flag returns structured JSON output optimized for parsing:

```json
{
  "url": "https://example.com",
  "overallScore": 88,
  "categoryResults": [
    {
      "categoryId": "meta-tags",
      "categoryName": "Meta Tags",
      "score": 97,
      "passCount": 7,
      "warnCount": 1,
      "failCount": 0,
      "results": [
        {
          "ruleId": "meta-tags-title-present",
          "ruleName": "Title Tag Present",
          "status": "pass",
          "message": "Title tag is present",
          "details": { "title": "Example Domain" }
        }
      ]
    }
  ],
  "timestamp": "2026-01-23T16:00:00.000Z",
  "crawledPages": 1
}
```

## Exit Codes

- `0` - Audit passed (score >= 70)
- `1` - Audit failed (score < 70)
- `2` - Error occurred

## Workflow

1. **Run audit** with `--json` flag for parseable output
2. **Parse results** to identify failed rules and warnings
3. **Prioritize fixes** by category weight and severity
4. **Re-run audit** after fixes to verify improvements

## Category Weights

| Category | Weight | Rules |
|----------|--------|-------|
| Meta Tags | 15% | 8 |
| Technical SEO | 15% | 8 |
| Core Web Vitals | 15% | 5 |
| Headings | 10% | 6 |
| Links | 10% | 6 |
| Images | 10% | 7 |
| Security | 10% | 6 |
| Structured Data | 8% | 4 |
| Social | 7% | 5 |

## Resources

- npm: https://www.npmjs.com/package/@seomator/seo-audit
- GitHub: https://github.com/seo-skills/seo-audit-skill
- Web UI: https://seomator.com/free-seo-audit-tool
