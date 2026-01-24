# SEOmator - SEO Audit CLI & Claude Code Skill

A comprehensive SEO audit tool with **134 rules** across **18 categories**.

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
seomator audit https://example.com --format llm                  # AI agent format
```

**Options:**
| Option | Description |
|--------|-------------|
| `-f, --format <type>` | Output format: console, json, html, markdown, llm |
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
format = "console"              # console, json, html, markdown, llm
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

SEOmator uses SQLite databases for efficient storage and querying:

```
~/.seomator/                              # Global directory
├── projects/                             # Per-domain project databases
│   ├── example.com/
│   │   └── project.db                    # Crawls, pages, links, images
│   └── mysite.org/
│       └── project.db
├── audits.db                             # Centralized audit results
├── link-cache.db                         # External link check cache
└── config.toml                           # Global configuration

./.seomator/                              # Legacy project directory
├── crawls/                               # (Legacy) JSON crawl files
└── reports/                              # (Legacy) JSON report files
```

**Database Architecture:**
- **Project Databases** (`~/.seomator/projects/<domain>/project.db`): Per-domain SQLite databases storing crawl data, pages (with compressed HTML), links, and images
- **Audits Database** (`~/.seomator/audits.db`): Centralized storage for all audit results, enabling cross-project analytics and trend tracking
- **Link Cache** (`~/.seomator/link-cache.db`): SQLite cache for external link validation results

**Key Features:**
- WAL mode for concurrent reads during writes
- HTML compression (zlib) for pages >10KB
- Per-rule, per-page audit result granularity
- Issue aggregation with priority scoring
- Audit comparisons and score trends

### `seomator db`
Database management commands.

```bash
seomator db migrate              # Migrate JSON files to SQLite
seomator db migrate --dry-run    # Preview migration
seomator db stats                # Show database statistics
seomator db stats -v             # Verbose statistics
seomator db restore              # Rollback migration (restore from backup)
```

**Migration:** Existing JSON files in `.seomator/crawls/` and `.seomator/reports/` can be migrated to SQLite using `seomator db migrate`. Original files are backed up to `.bak` directories.

---

## AI Agent Integration

### LLM Format

The `--format llm` option produces token-optimized XML output for AI agents:
- **50-70% smaller** than JSON output
- **Issues sorted by severity** (critical first)
- **Fix suggestions included** for each issue
- **Clean stdout** for piping to Claude/LLMs

### Output Formats

| Format | Flag | Best For |
|--------|------|----------|
| console | `--format console` | Human terminal output (default) |
| json | `--format json` | CI/CD, programmatic processing |
| html | `--format html` | Standalone reports, sharing |
| markdown | `--format markdown` | Documentation, GitHub |
| llm | `--format llm` | AI agents, piping to Claude |

### Usage Examples

**Pipe to Claude:**
```bash
seomator audit https://example.com --format llm --no-cwv | claude "analyze and prioritize fixes"
```

**Save for later analysis:**
```bash
seomator audit https://example.com --format llm -o audit.xml --no-cwv
```

**Audit and fix workflow:**
```bash
seomator audit https://mysite.com --format llm | claude "fix all critical issues in my codebase"
```

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
| Core SEO | 3% | 4 |
| Meta Tags | 8% | 8 |
| Headings | 5% | 5 |
| Technical SEO | 8% | 8 |
| Core Web Vitals | 11% | 5 |
| Links | 9% | 13 |
| Images | 9% | 12 |
| Security | 9% | 12 |
| Structured Data | 5% | 13 |
| Social | 4% | 9 |
| Content | 5% | 10 |
| Accessibility | 5% | 12 |
| Internationalization | 2% | 2 |
| Performance | 5% | 7 |
| Crawlability | 4% | 6 |
| URL Structure | 3% | 2 |
| Mobile | 3% | 3 |
| Legal Compliance | 2% | 3 |

---

## Evaluating Results

### Score Ranges
- **90-100**: Excellent - Minor optimizations
- **70-89**: Good - Address warnings
- **50-69**: Needs Work - Priority fixes
- **0-49**: Poor - Critical issues

### Priority Order (by impact)
1. Core Web Vitals (11%) - UX + ranking
2. Links (9%) - Internal structure
3. Images (9%) - Performance
4. Security (9%) - Trust signals
5. Meta Tags (8%) - Search visibility
6. Technical SEO (8%) - Crawling foundation
7. Headings (5%) - Content structure
8. Structured Data (5%) - Rich snippets
9. Accessibility (5%) - WCAG compliance
10. Performance (5%) - Static optimization hints
11. Content (5%) - Text quality + readability
12. Crawlability (4%) - Indexability signals & sitemap conflicts
13. Social (4%) - Social sharing
14. Core SEO (3%) - Canonical & indexing validation
15. URL Structure (3%) - Slug keywords & stop words
16. Mobile (3%) - Font size, horizontal scroll, interstitials
17. Internationalization (2%) - Language & hreflang
18. Legal Compliance (2%) - Privacy policy, cookie consent, terms of service

---

## Common Fixes

### Core SEO
| Issue | Fix |
|-------|-----|
| Canonical mismatch | Use HTML canonical only; reserve Link header for PDFs |
| Nosnippet directive | Remove unless needed for sensitive content |
| Noindex/nofollow | Remove unless intentionally blocking search |
| Duplicate titles | Create unique titles: "Page Topic \| Brand Name" |

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
| External link security | Add `rel="noopener noreferrer"` to external `target="_blank"` links |
| Form HTTPS | Update form actions to use HTTPS URLs |
| Mixed content | Replace HTTP resource URLs with HTTPS |
| No Permissions-Policy | Add `Permissions-Policy` header to control browser features |
| No Referrer-Policy | Add `Referrer-Policy: strict-origin-when-cross-origin` header |
| Leaked secrets | Remove exposed secrets and rotate compromised credentials |

### Links
| Issue | Fix |
|-------|-----|
| Dead-end pages | Add navigation links, breadcrumbs, or related content |
| HTTPS downgrade | Update HTTP links to HTTPS |
| Too many external links | Reduce to essential, high-quality resources |
| Invalid links | Replace javascript: with buttons, fix malformed URLs |
| Invalid tel/mailto | Use E.164 phone format, valid email addresses |
| Redirect chains | Update links to final destination URLs |
| Orphan pages | Add internal links from other pages (crawl mode) |

### Images
| Issue | Fix |
|-------|-----|
| Missing alt | Add descriptive `alt` attribute |
| No dimensions | Add `width` and `height` |
| Old formats | Convert to WebP/AVIF |
| Broken images | Fix or remove 404 image references |
| Missing figcaption | Add figcaption to describe figures |
| Non-descriptive filenames | Rename `IMG_001.jpg` to descriptive names |
| Large inline SVGs | Move >5KB SVGs to external files |
| Invalid picture element | Add `<img>` fallback inside `<picture>` |

### Structured Data
| Issue | Fix |
|-------|-----|
| Missing Article schema | Add headline, author, datePublished, image |
| Missing Breadcrumb | Add BreadcrumbList on non-homepage pages |
| Invalid FAQPage | Ensure mainEntity has Question items with acceptedAnswer |
| Missing LocalBusiness | Add name, address, telephone, geo for local SEO |
| Missing Organization | Add name, logo, sameAs for brand presence |
| Invalid Product | Add offers with price, priceCurrency, availability |
| Invalid Review | Add itemReviewed, author, reviewRating |
| Missing VideoObject | Add name, thumbnailUrl, uploadDate |
| No sitelinks searchbox | Add WebSite with SearchAction on homepage |

### Social
| Issue | Fix |
|-------|-----|
| Missing og:title | Add `<meta property="og:title">` for social sharing |
| Missing og:description | Add `<meta property="og:description">` for social sharing |
| Missing og:image | Add `<meta property="og:image">` with 1200x630px image |
| Missing og:image dimensions | Add `og:image:width` (1200) and `og:image:height` (630) meta tags |
| og:url mismatch | Ensure og:url matches canonical URL exactly |
| Missing Twitter card | Add `<meta name="twitter:card" content="summary_large_image">` |
| No share buttons | Add social share buttons for Facebook, Twitter/X, LinkedIn |
| No social profiles | Add profile links in header/footer; include sameAs in Organization schema |

### Content
| Issue | Fix |
|-------|-----|
| Thin content | Expand to 300+ words, 500+ for standard pages |
| Poor readability | Use shorter sentences, simpler vocabulary |
| Keyword stuffing | Write naturally, use synonyms |
| No author info | Add Person schema with author attribution |
| No date signals | Add datePublished/dateModified to Article schema |
| Meta in body | Move all `<meta>` tags to `<head>` |

### Accessibility
| Issue | Fix |
|-------|-----|
| Missing ARIA labels | Add aria-label or visible text to interactive elements |
| Low color contrast | Ensure 4.5:1 contrast ratio for text |
| No focus indicators | Keep visible focus styles; use :focus-visible |
| Unlabeled form inputs | Add `<label for="id">` or aria-label to inputs |
| Skipped heading levels | Use proper hierarchy (H1→H2→H3) |
| Missing landmarks | Add `<main>`, `<nav>`, `<header>`, `<footer>` |
| Generic link text | Use descriptive text instead of "click here" |
| No skip link | Add skip-to-content link for keyboard users |
| Table without headers | Add `<th scope="col/row">` to data tables |
| Small touch targets | Ensure 44x44px minimum for interactive elements |
| No video captions | Add `<track kind="captions">` or transcript |
| Zoom disabled | Remove user-scalable=no from viewport |

### Internationalization
| Issue | Fix |
|-------|-----|
| Missing lang attribute | Add `<html lang="en">` with valid BCP 47 code |
| Missing hreflang | Add `<link rel="alternate" hreflang="xx">` for each language version |

### Performance
| Issue | Fix |
|-------|-----|
| Large DOM | Reduce nodes, use virtualization for long lists |
| Many CSS files | Bundle and minify CSS; inline critical CSS |
| Poor font loading | Add font-display: swap; preload critical fonts |
| Missing preconnect | Add `<link rel="preconnect">` for third-party origins |
| Render-blocking scripts | Add async/defer to scripts in head |
| Lazy above fold | Remove loading="lazy" from hero images |
| LCP not optimized | Preload LCP image; add fetchpriority="high" |

### Crawlability
| Issue | Fix |
|-------|-----|
| Schema + noindex conflict | Remove noindex to allow rich results, or remove schema if page should stay hidden |
| Pagination canonical error | Each paginated page should have self-referencing canonical; never canonicalize all to page 1 |
| Cross-domain sitemap URLs | Remove external URLs from sitemap; all URLs must match sitemap host domain |
| Noindexed page in sitemap | Either remove noindexed page from sitemap or remove the noindex directive |
| Indexability conflict | Choose one blocking method: robots.txt disallow OR noindex meta, not both |
| Canonical redirect chain | Update canonical to point directly to final destination URL; avoid redirect chains |

### URL Structure
| Issue | Fix |
|-------|-----|
| Generic URL slug | Use descriptive keywords (e.g., `/blue-running-shoes` instead of `/product-12345`) |
| Stop words in URL | Remove stop words (a, the, of); prefer `/best-running-shoes` over `/the-best-running-shoes-for-you` |

### Mobile
| Issue | Fix |
|-------|-----|
| Small font size | Use minimum 16px for body text, 12px absolute minimum; prefer rem/em units |
| Horizontal scroll | Add `max-width: 100%` to images, `overflow-x: auto` to tables, responsive iframes |
| Intrusive interstitials | Remove popups covering main content; use compact banners instead of full-screen overlays |

### Legal Compliance
| Issue | Fix |
|-------|-----|
| No cookie consent | Add consent banner using CookieYes, OneTrust, or Cookiebot |
| Missing privacy policy | Add a privacy policy link in the footer of every page |
| Missing terms of service | Add a terms of service link in the footer (especially for e-commerce, SaaS) |

---

## Project Structure

```
seo-audit-skill/
├── SKILL.md              # Claude Code skill (root for skills.sh)
├── docs/
│   ├── SEO-AUDIT-RULES.md      # 134 rules reference
│   └── STORAGE-ARCHITECTURE.md # SQLite storage technical docs
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
│   ├── storage/          # Data persistence (SQLite-based)
│   │   ├── index.ts      # Main exports
│   │   ├── types.ts      # Database record types
│   │   ├── paths.ts      # Directory & path utilities
│   │   ├── utils/        # Utility functions
│   │   │   ├── hash.ts   # URL hashing (SHA-256)
│   │   │   └── compression.ts # HTML compression (zlib)
│   │   ├── project-db/   # Per-domain project database
│   │   │   ├── index.ts  # ProjectDatabase class
│   │   │   ├── schema.ts # Table definitions
│   │   │   ├── projects.ts # Project CRUD
│   │   │   ├── crawls.ts # Crawl operations
│   │   │   ├── pages.ts  # Page storage with compression
│   │   │   ├── links.ts  # Link operations
│   │   │   └── images.ts # Image operations
│   │   ├── audits-db/    # Centralized audits database
│   │   │   ├── index.ts  # AuditsDatabase singleton
│   │   │   ├── schema.ts # Table definitions
│   │   │   ├── audits.ts # Audit CRUD
│   │   │   ├── results.ts # Per-rule results
│   │   │   ├── issues.ts # Issue aggregation
│   │   │   └── comparisons.ts # Audit comparisons
│   │   ├── migrations/   # Database migrations
│   │   │   ├── index.ts  # Migration runner
│   │   │   └── json-to-sqlite.ts # Legacy JSON migration
│   │   ├── crawl-store.ts  # (Legacy) JSON crawl storage
│   │   ├── report-store.ts # (Legacy) JSON report storage
│   │   └── link-cache.ts   # External link cache
│   ├── commands/         # CLI commands
│   │   ├── audit.ts      # seomator audit
│   │   ├── init.ts       # seomator init
│   │   ├── crawl.ts      # seomator crawl
│   │   ├── analyze.ts    # seomator analyze
│   │   ├── report.ts     # seomator report
│   │   ├── config.ts     # seomator config
│   │   └── db.ts         # seomator db (migrate/stats/restore)
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
│   └── rules/            # 134 audit rules
│       ├── pattern-matcher.ts  # Wildcard rule matching
│       ├── core-seo/     # Canonical, indexing, title uniqueness
│       ├── meta-tags/
│       ├── headings/
│       ├── technical/
│       ├── core-web-vitals/
│       ├── links/
│       ├── images/
│       ├── security/
│       ├── structured-data/
│       ├── social/
│       ├── content/      # Text quality, readability, keyword density
│       ├── accessibility/ # WCAG, ARIA, keyboard navigation
│       ├── i18n/         # Language declarations, hreflang
│       ├── performance/  # Static optimization hints
│       ├── crawlability/ # Sitemap conflicts, indexability signals
│       ├── url-structure/ # Slug keywords, stop words
│       ├── mobile/       # Font size, horizontal scroll, interstitials
│       └── legal/        # Cookie consent, privacy policy, terms of service
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
