# SEOmator - SEO Audit CLI & Claude Code Skill

A comprehensive SEO audit tool with **55 rules** across **9 categories**.

**Version:** 2.1.0

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

---

## Commands

### `seomator audit <url>`
Run SEO audit on a URL.

```bash
seomator audit https://example.com              # Single page audit
seomator audit https://example.com --json       # JSON output
seomator audit https://example.com --crawl      # Multi-page crawl
seomator audit https://example.com --no-cwv     # Skip Core Web Vitals
seomator audit https://example.com --save       # Save report
seomator audit https://example.com --format html -o report.html  # HTML report
seomator audit https://example.com --format markdown             # Markdown report
```

**Options:**
| Option | Description |
|--------|-------------|
| `-f, --format <type>` | Output format: console, json, html, markdown |
| `-o, --output <path>` | Output file path (for html/markdown/json) |
| `-j, --json` | Output as JSON (deprecated, use --format json) |
| `-v, --verbose` | Show progress |
| `--crawl` | Crawl multiple pages |
| `--max-pages <n>` | Max pages to crawl (default: 10) |
| `--concurrency <n>` | Concurrent requests (default: 3) |
| `--timeout <ms>` | Request timeout (default: 30000) |
| `--no-cwv` | Skip Core Web Vitals |
| `-c, --categories <list>` | Comma-separated categories |
| `--config <path>` | Config file path |
| `--save` | Save report to `.seomator/reports/` |

### `seomator init`
Create a `seomator.toml` config file.

```bash
seomator init                    # Interactive setup
seomator init -y                 # Use defaults
seomator init --preset blog      # Use blog preset
seomator init --preset ecommerce # Use e-commerce preset
seomator init --preset ci        # Minimal CI config
```

### `seomator crawl <url>`
Crawl website without running analysis.

```bash
seomator crawl https://example.com --max-pages 20
```

Saves crawl data to `.seomator/crawls/` for later analysis.

### `seomator analyze [crawl-id]`
Run SEO rules on stored crawl data.

```bash
seomator analyze                           # Analyze latest crawl
seomator analyze 2026-01-23-abc123         # Analyze specific crawl
seomator analyze --latest --save           # Analyze latest, save report
```

### `seomator report [query]`
View and query past reports.

```bash
seomator report --list                     # List all reports
seomator report 2026-01-23-abc123          # View specific report
seomator report --project mysite           # Filter by project
```

### `seomator config [key] [value]`
View or modify configuration.

```bash
seomator config --list                     # Show all config
seomator config crawler.max_pages          # Get value
seomator config crawler.max_pages 50       # Set value
seomator config --global                   # Modify global config
seomator config validate                   # Validate current config
seomator config show                       # Show merged config with sources
seomator config path                       # Show config file paths
```

**Subcommands:**
| Subcommand | Description |
|------------|-------------|
| `validate` | Validate config and show errors/warnings |
| `show` | Show merged config with source information |
| `path` | Show paths to all config files |

---

## Configuration

### Config File (`seomator.toml`)

Create with `seomator init` or manually:

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
# URL filtering (glob patterns)
include = []                    # Empty = crawl all
exclude = ["/admin/**", "/api/**"]
# Query param handling
drop_query_prefixes = ["utm_", "gclid", "fbclid"]
allow_query_params = []         # Empty = keep all except dropped

[rules]
enable = ["*"]
disable = ["core-web-vitals-inp"]  # Supports wildcards: "meta-tags-*"

[external_links]
enabled = true
cache_ttl_days = 7
timeout_ms = 10000
concurrency = 5

[output]
format = "console"              # console, json, html, markdown
path = ""
```

### Config Priority (highest to lowest)
1. CLI arguments (`--max-pages 50`)
2. Local config (`./seomator.toml`)
3. Parent directory configs (searches up tree)
4. Global config (`~/.seomator/config.toml`)
5. Built-in defaults

### Presets
| Preset | Description |
|--------|-------------|
| `default` | Standard configuration |
| `blog` | Optimized for content sites |
| `ecommerce` | Optimized for e-commerce |
| `ci` | Minimal config for CI/CD |

---

## Storage

SEOmator stores data in `.seomator/` directories:

```
.seomator/
├── crawls/           # Saved crawl data
│   └── 2026-01-23-abc123.json
└── reports/          # Saved audit reports
    └── 2026-01-23-xyz789.json
```

**Locations:**
- **Project:** `./.seomator/` (current directory)
- **Global:** `~/.seomator/` (home directory)

---

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
"Crawl my site and save the results"
"Show me my past SEO reports"
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
├── src/                  # CLI source code
│   ├── cli.ts            # Main CLI entry (subcommands)
│   ├── auditor.ts        # Audit orchestration
│   ├── scoring.ts        # Score calculation
│   ├── types.ts          # TypeScript types
│   ├── config/           # Configuration system
│   │   ├── schema.ts     # Config type definitions
│   │   ├── defaults.ts   # Default values & presets
│   │   ├── loader.ts     # Config file loading
│   │   ├── writer.ts     # Config file generation
│   │   └── validator.ts  # Config validation
│   ├── storage/          # Data persistence
│   │   ├── paths.ts      # Directory utilities
│   │   ├── crawl-store.ts# Crawl data storage
│   │   ├── report-store.ts# Report storage
│   │   └── link-cache.ts # SQLite cache for external links
│   ├── commands/         # CLI commands
│   │   ├── audit.ts      # seomator audit
│   │   ├── init.ts       # seomator init
│   │   ├── crawl.ts      # seomator crawl
│   │   ├── analyze.ts    # seomator analyze
│   │   ├── report.ts     # seomator report
│   │   └── config.ts     # seomator config (validate/show/path)
│   ├── categories/       # Category definitions
│   ├── crawler/          # Fetcher & crawler
│   │   ├── crawler.ts    # Queue-based crawler
│   │   ├── fetcher.ts    # HTTP fetcher
│   │   └── url-filter.ts # URL include/exclude & normalization
│   ├── reporters/        # Output formatters
│   │   ├── terminal.ts   # Console output
│   │   ├── json.ts       # JSON output
│   │   ├── html-reporter.ts    # Self-contained HTML
│   │   └── markdown-reporter.ts # GitHub-flavored Markdown
│   └── rules/            # 55 audit rules
│       ├── pattern-matcher.ts  # Wildcard rule matching
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
npm run test:run  # Single run (no watch)
```

### Run locally
```bash
./dist/cli.js audit https://example.com
./dist/cli.js init -y
./dist/cli.js crawl https://example.com
./dist/cli.js report --list
```

### Publish
```bash
npm publish --access public
```
