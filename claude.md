# SEOmator - SEO Audit CLI & Claude Code Skill

A comprehensive SEO audit tool with **55 rules** across **9 categories**.

## Quick Links

- **npm**: https://www.npmjs.com/package/@seomator/seo-audit
- **GitHub**: https://github.com/seo-skills/seo-audit-skill
- **Web UI**: https://seomator.com/free-seo-audit-tool
- **skills.sh**: `npx skills add seo-skills/seo-audit-skill`

---

## CLI Installation

```bash
npm install -g @seomator/seo-audit
```

> **Note:** The CLI automatically uses your system Chrome, Chromium, or Edge for Core Web Vitals. No additional browser installation needed.

## CLI Usage

### Single Page Audit
```bash
seomator https://example.com
```

### JSON Output (for parsing)
```bash
seomator https://example.com --json
```

### Multi-Page Crawl
```bash
seomator https://example.com --crawl --max-pages 20
```

### With Progress (verbose)
```bash
seomator https://example.com --json --verbose
```

### Fast Mode (skip Core Web Vitals)
```bash
seomator https://example.com --no-cwv
```

### Specific Categories
```bash
seomator https://example.com --categories meta-tags,security
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--json`, `-j` | Output as JSON |
| `--verbose`, `-v` | Show progress to stderr |
| `--crawl` | Crawl multiple pages |
| `--max-pages <n>` | Max pages to crawl (default: 10) |
| `--concurrency <n>` | Concurrent requests (default: 3) |
| `--timeout <ms>` | Request timeout (default: 30000) |
| `--no-cwv` | Skip Core Web Vitals measurement |
| `--categories <list>` | Comma-separated categories |

## Exit Codes

- `0` - Passed (score >= 70)
- `1` - Failed (score < 70)
- `2` - Error

---

## Claude Code Skill

### Install Skill
```bash
npx skills add seo-skills/seo-audit-skill
```

Or manually copy to `~/.claude/skills/seo-audit/`

### Example Prompts
```
"Run an SEO audit on https://example.com"
"Audit https://mysite.com and tell me what to fix first"
"Check SEO health of https://example.com with 20-page crawl"
```

---

## Categories & Weights

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

---

## Evaluating Results

### Score Ranges
- **90-100**: Excellent - Minor optimizations
- **70-89**: Good - Address warnings
- **50-69**: Needs Work - Priority fixes
- **0-49**: Poor - Critical issues

### Priority Order (by impact)
1. Meta Tags (15%) - Search visibility
2. Technical SEO (15%) - Crawling foundation
3. Core Web Vitals (15%) - UX + ranking
4. Security (10%) - Trust signals
5. Links (10%) - Internal structure
6. Images (10%) - Performance
7. Headings (10%) - Content structure
8. Structured Data (8%) - Rich snippets
9. Social (7%) - Social sharing

---

## Common Fixes

### Meta Tags
| Issue | Fix |
|-------|-----|
| Missing title | Add `<title>` in `<head>` |
| Title too long/short | Keep 30-60 characters |
| Missing description | Add `<meta name="description">` |
| Missing canonical | Add `<link rel="canonical">` |

### Core Web Vitals
| Metric | Good | Fix |
|--------|------|-----|
| LCP | <2.5s | Optimize images, use CDN |
| CLS | <0.1 | Set image dimensions |
| FCP | <1.8s | Reduce render-blocking |
| TTFB | <800ms | Use CDN, caching |

### Security
| Issue | Fix |
|-------|-----|
| No HTTPS | Install SSL certificate |
| No HSTS | Add `Strict-Transport-Security` header |
| No CSP | Add `Content-Security-Policy` header |

### Images
| Issue | Fix |
|-------|-----|
| Missing alt | Add descriptive `alt` attribute |
| No dimensions | Add `width` and `height` |
| Old formats | Convert to WebP/AVIF |

---

## Project Structure

```
seo-audit-skill/
├── SKILL.md              # Claude Code skill (root for skills.sh)
├── references/
│   └── rules.md          # 55 rules reference
├── skill/                # Skill folder (legacy)
├── src/                  # CLI source code
│   ├── cli.ts            # Main CLI entry
│   ├── auditor.ts        # Audit orchestration
│   ├── scoring.ts        # Score calculation
│   ├── types.ts          # TypeScript types
│   ├── categories/       # Category definitions
│   ├── crawler/          # Fetcher & crawler
│   ├── reporters/        # Output formatters
│   └── rules/            # 55 audit rules
│       ├── meta-tags/
│       ├── headings/
│       ├── technical/
│       ├── core-web-vitals/
│       ├── links/
│       ├── images/
│       ├── security/
│       ├── structured-data/
│       └── social/
├── dist/                 # Built CLI
├── README.md             # Full documentation
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## Development

### Build
```bash
npm run build
```

### Test
```bash
npm test
```

### Run locally
```bash
./dist/cli.js https://example.com
```

### Publish
```bash
npm publish --access public
```
