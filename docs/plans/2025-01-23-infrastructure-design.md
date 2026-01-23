# SEOmator Infrastructure Design - Phase 1

**Date:** 2025-01-23
**Goal:** Add professional CLI infrastructure (config files, CLI commands, storage system)

---

## Overview

Phase 1 adds professional CLI infrastructure:
- TOML config file (`seomator.toml`)
- Multiple CLI commands (`init`, `crawl`, `analyze`, `report`, `config`)
- Project-based storage for crawls and reports
- Shared external link cache

---

## File & Directory Structure

### New Source Files

```
src/
├── cli.ts                    # Update: add subcommands
├── commands/
│   ├── audit.ts              # Extract current audit logic
│   ├── init.ts               # Create seomator.toml
│   ├── crawl.ts              # Crawl-only command
│   ├── analyze.ts            # Analyze stored crawl
│   ├── report.ts             # View past reports
│   └── config.ts             # View/modify config
├── config/
│   ├── loader.ts             # Find & parse seomator.toml
│   ├── schema.ts             # Config type definitions
│   ├── defaults.ts           # Default config values
│   └── writer.ts             # Write config files
├── storage/
│   ├── paths.ts              # Resolve .seomator/ paths
│   ├── crawl-store.ts        # Save/load crawl data
│   ├── report-store.ts       # Save/load audit reports
│   └── link-cache.ts         # External link cache (SQLite)
├── reporters/
│   └── html.ts               # NEW: HTML report output
```

### Runtime Directories

```
~/.seomator/
├── settings.json             # Global user settings
└── link-cache.db             # Shared external link cache

.seomator/                    # Per-project (gitignore recommended)
├── settings.json             # Local project settings
├── crawls/
│   └── 2025-01-23-abc123.json
└── reports/
    └── 2025-01-23-abc123.json
```

### New Dependencies

- `@iarna/toml` - TOML parsing
- `better-sqlite3` - Link cache database

---

## Config System

### Config File (`seomator.toml`)

```toml
[project]
name = "my-site"
domains = []

[crawler]
max_pages = 100
delay_ms = 100
timeout_ms = 30000
concurrency = 3
per_host_concurrency = 2
per_host_delay_ms = 200
include = []
exclude = ["/admin/**", "*.pdf"]
allow_query_params = ["page"]
drop_query_prefixes = ["utm_", "gclid", "fbclid"]
respect_robots = true
breadth_first = true
follow_redirects = true

[rules]
enable = ["*"]
disable = []

[external_links]
enabled = true
cache_ttl_days = 7
timeout_ms = 10000
concurrency = 5

[output]
format = "console"
path = ""

[rule_options."meta-tags/title-length"]
min_length = 30
max_length = 60

[rule_options."meta-tags/description-length"]
min_length = 120
max_length = 160
```

### Config Loading Priority

1. Built-in defaults (lowest)
2. `~/.seomator/settings.json` (global)
3. `seomator.toml` (searched up directory tree)
4. `.seomator/settings.json` (local project)
5. CLI flags (highest)

### Config Schema

```typescript
interface SeomatorConfig {
  project: {
    name: string;
    domains: string[];
  };
  crawler: {
    max_pages: number;
    delay_ms: number;
    timeout_ms: number;
    concurrency: number;
    per_host_concurrency: number;
    per_host_delay_ms: number;
    include: string[];
    exclude: string[];
    allow_query_params: string[];
    drop_query_prefixes: string[];
    respect_robots: boolean;
    breadth_first: boolean;
    follow_redirects: boolean;
  };
  rules: {
    enable: string[];
    disable: string[];
  };
  external_links: {
    enabled: boolean;
    cache_ttl_days: number;
    timeout_ms: number;
    concurrency: number;
  };
  output: {
    format: 'console' | 'json' | 'html';
    path: string;
  };
  rule_options: Record<string, Record<string, unknown>>;
}
```

---

## CLI Commands

### Command Structure

```
seomator <command> [options]

Commands:
  audit <url>              Crawl and analyze a website (default)
  init                     Create seomator.toml config file
  crawl <url>              Crawl website without analysis
  analyze [crawl-id]       Run rules on stored crawl data
  report [query]           View and query past reports
  config [key] [value]     View or modify configuration
```

### `seomator audit <url>`

```
Options:
  -c, --categories <list>  Categories to audit
  -j, --json               Output as JSON
  -v, --verbose            Show progress
  --crawl                  Enable multi-page crawl
  --max-pages <n>          Max pages (overrides config)
  --no-cwv                 Skip Core Web Vitals
  --config <path>          Use specific config file
  --save                   Save report to .seomator/reports/
```

### `seomator init`

```
Options:
  --name <name>            Project name
  --preset <type>          Use preset (blog, ecommerce, ci)
  -y, --yes                Use defaults, no prompts
```

### `seomator crawl <url>`

```
Options:
  --max-pages <n>          Max pages to crawl
  --output <path>          Custom output path
  -v, --verbose            Show progress
```

### `seomator analyze [crawl-id]`

```
Options:
  -c, --categories <list>  Categories to analyze
  --latest                 Use most recent crawl
  --save                   Save report
```

### `seomator report [query]`

```
Options:
  --list                   List all reports
  --project <name>         Filter by project
  --since <date>           Filter by date
  --format <type>          Output format (table, json)
```

### `seomator config [key] [value]`

```
Options:
  --global                 Modify global settings
  --local                  Modify local settings
  --list                   Show all config values
```

---

## Storage System

### Crawl Data Format

```typescript
interface StoredCrawl {
  id: string;                    // e.g., "2025-01-23-abc123"
  url: string;                   // Starting URL
  project: string;               // Project name from config
  timestamp: string;             // ISO date
  config: Partial<SeomatorConfig>;
  pages: Array<{
    url: string;
    status: number;
    html: string;
    headers: Record<string, string>;
    depth: number;
    loadTime: number;
    cwv?: CoreWebVitals;
  }>;
  stats: {
    totalPages: number;
    duration: number;
    errorCount: number;
  };
}
```

### Report Data Format

```typescript
interface StoredReport {
  id: string;
  crawlId: string;
  url: string;
  project: string;
  timestamp: string;
  config: Partial<SeomatorConfig>;
  overallScore: number;
  categoryResults: CategoryResult[];
  stats: {
    totalRules: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}
```

### Link Cache Schema

```sql
CREATE TABLE link_cache (
  url TEXT PRIMARY KEY,
  status INTEGER,
  redirect_url TEXT,
  checked_at INTEGER,
  ttl_days INTEGER
);
```

### ID Generation

- Format: `YYYY-MM-DD-<6-char-hash>`
- Hash from URL + timestamp

---

## Refactoring Plan

### Files to Modify

| File | Change |
|------|--------|
| `src/cli.ts` | Convert to Commander subcommands |
| `src/auditor.ts` | Accept config object instead of CLI options |
| `src/crawler/crawler.ts` | Use config, support include/exclude patterns |
| `src/crawler/fetcher.ts` | Add external link caching |
| `src/rules/registry.ts` | Add enable/disable filtering |

### Rule Pattern Matching

- `*` matches all rules
- `meta-tags/*` matches category
- `meta-tags/title-length` matches specific rule
- Disable takes precedence over enable

### Backward Compatibility

- `seomator <url>` maps to `seomator audit <url>`
- All existing CLI flags continue to work
- Config file is optional

---

## Phase 2 & 3 (Future)

**Phase 2 - Strategic Categories:**
- Accessibility (ARIA, contrast, focus, landmarks)
- E-E-A-T Signals (about pages, author info, trust badges)
- Content (word count, reading level, freshness)
- Mobile (viewport, tap targets, font sizes)

**Phase 3 - Full Parity:**
- Remaining categories to reach 149 rules
- Internationalization, Local SEO, Legal Compliance
- Video, Analytics, Adblock Detection
