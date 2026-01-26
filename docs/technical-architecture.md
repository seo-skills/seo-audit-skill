# Technical Architecture

> How SEOmator works under the hood

This document explains the internal architecture of SEOmator, covering data flow, components, and how different parts interact.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLI Entry                                   │
│                            (src/cli.ts)                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌─────────┐    ┌───────────┐    ┌──────────┐
              │  audit  │    │   crawl   │    │  report  │
              │ command │    │  command  │    │ command  │
              └────┬────┘    └─────┬─────┘    └────┬─────┘
                   │               │               │
                   ▼               ▼               │
         ┌─────────────────────────────────┐      │
         │           Crawler               │      │
         │    (src/crawler/crawler.ts)     │      │
         └─────────────┬───────────────────┘      │
                       │                          │
                       ▼                          │
         ┌─────────────────────────────────┐      │
         │           Fetcher               │      │
         │    (src/crawler/fetcher.ts)     │      │
         │    + Playwright (for CWV)       │      │
         └─────────────┬───────────────────┘      │
                       │                          │
                       ▼                          │
         ┌─────────────────────────────────┐      │
         │         Project DB              │      │
         │   (SQLite per domain)           │      │
         │   - Pages (HTML compressed)     │      │
         │   - Links                        │      │
         │   - Images                       │      │
         └─────────────┬───────────────────┘      │
                       │                          │
                       ▼                          │
         ┌─────────────────────────────────┐      │
         │           Auditor               │      │
         │     (src/auditor.ts)            │      │
         │     148 Rules × N Pages         │      │
         └─────────────┬───────────────────┘      │
                       │                          │
                       ▼                          │
         ┌─────────────────────────────────┐      │
         │          Audits DB              │◄─────┘
         │   (Centralized SQLite)          │
         │   - Audit results               │
         │   - Per-rule scores             │
         │   - Issues aggregation          │
         └─────────────┬───────────────────┘
                       │
                       ▼
         ┌─────────────────────────────────┐
         │          Reporters              │
         │   console │ json │ html │       │
         │   markdown │ llm                │
         └─────────────────────────────────┘
```

## Component Details

### 1. CLI Entry (`src/cli.ts`)

The main entry point using Commander.js. Registers all subcommands:

```
seomator
├── audit <url>      # Run SEO audit
├── crawl <url>      # Crawl without analysis
├── analyze [id]     # Analyze stored crawl
├── report [query]   # View past reports
├── init             # Create config file
├── config           # View/modify config
├── db               # Database management
└── self doctor      # System health check
```

**Key responsibilities:**
- Parse CLI arguments
- Load and merge configuration
- Route to appropriate command handler
- Handle exit codes (0=pass, 1=fail, 2=error)

### 2. Configuration System (`src/config/`)

```
src/config/
├── schema.ts      # TypeScript type definitions
├── defaults.ts    # Default values & presets
├── loader.ts      # Config file discovery & loading
├── writer.ts      # Config file generation (init)
└── validator.ts   # Config validation
```

**Config resolution order:**
1. CLI arguments (highest priority)
2. `./seomator.toml` (project config)
3. Parent directories (searches up tree)
4. `~/.seomator/config.toml` (global config)
5. Built-in defaults (lowest priority)

**Config format:** TOML (human-readable, supports comments)

### 3. Crawler (`src/crawler/`)

```
src/crawler/
├── crawler.ts      # Queue-based multi-page crawler
├── fetcher.ts      # HTTP fetching + Playwright for CWV
└── url-filter.ts   # URL normalization, include/exclude
```

#### Crawler Flow

```
                    ┌──────────────┐
                    │  Start URL   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  URL Queue   │◄────────────────┐
                    └──────┬───────┘                 │
                           │                         │
                           ▼                         │
                    ┌──────────────┐                 │
                    │ URL Filter   │                 │
                    │ (normalize,  │                 │
                    │  dedupe)     │                 │
                    └──────┬───────┘                 │
                           │                         │
                           ▼                         │
              ┌────────────────────────┐             │
              │       Fetcher          │             │
              │  ┌──────────────────┐  │             │
              │  │   HTTP Request   │  │             │
              │  │  (Node fetch)    │  │             │
              │  └────────┬─────────┘  │             │
              │           │            │             │
              │  ┌────────▼─────────┐  │             │
              │  │   Playwright     │  │             │
              │  │  (CWV metrics)   │  │             │
              │  └────────┬─────────┘  │             │
              └───────────┼────────────┘             │
                          │                          │
                          ▼                          │
              ┌────────────────────────┐             │
              │    Parse HTML          │             │
              │    (Cheerio)           │             │
              │    - Extract links ────┼─────────────┘
              │    - Extract images    │
              │    - Store in DB       │
              └────────────────────────┘
```

#### URL Filtering (`url-filter.ts`)

- **Normalization:** Strips tracking params (utm_*, gclid, fbclid)
- **Deduplication:** Hash-based URL tracking
- **Include/Exclude:** Glob pattern matching
- **Domain restriction:** Stays within configured domains
- **Budget control:** `max_prefix_budget` prevents over-crawling single paths

#### Fetcher (`fetcher.ts`)

Two modes:
1. **HTTP-only** (fast): Node.js fetch for HTML
2. **Playwright** (CWV): Launches browser for Core Web Vitals

```typescript
// Playwright metrics collected:
interface CoreWebVitals {
  lcp: number;   // Largest Contentful Paint
  fcp: number;   // First Contentful Paint
  cls: number;   // Cumulative Layout Shift
  ttfb: number;  // Time to First Byte
  inp: number;   // Interaction to Next Paint
}
```

### 4. Storage System (`src/storage/`)

```
src/storage/
├── index.ts              # Main exports
├── types.ts              # Database record types
├── paths.ts              # Directory & path utilities
├── utils/
│   ├── hash.ts           # URL hashing (SHA-256)
│   └── compression.ts    # HTML compression (zlib)
├── project-db/           # Per-domain database
│   ├── index.ts          # ProjectDatabase class
│   ├── schema.ts         # Table definitions
│   ├── projects.ts       # Project CRUD
│   ├── crawls.ts         # Crawl operations
│   ├── pages.ts          # Page storage
│   ├── links.ts          # Link operations
│   └── images.ts         # Image operations
├── audits-db/            # Centralized audits
│   ├── index.ts          # AuditsDatabase singleton
│   ├── schema.ts         # Table definitions
│   ├── audits.ts         # Audit CRUD
│   ├── results.ts        # Per-rule results
│   ├── issues.ts         # Issue aggregation
│   └── comparisons.ts    # Audit comparisons
└── link-cache.ts         # External link cache
```

#### Database Architecture

```
~/.seomator/
├── projects/
│   ├── example.com/
│   │   └── project.db        # Per-domain SQLite
│   └── mysite.org/
│       └── project.db
├── audits.db                 # Centralized audits
└── link-cache.db             # External link cache
```

#### Project Database Schema

```sql
-- Crawls table
CREATE TABLE crawls (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  status TEXT,
  pages_crawled INTEGER,
  config TEXT  -- JSON
);

-- Pages table (HTML compressed with zlib)
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  crawl_id TEXT,
  url TEXT,
  url_hash TEXT,
  status_code INTEGER,
  content_type TEXT,
  html BLOB,           -- Compressed if >10KB
  html_compressed INTEGER,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  cwv TEXT,            -- JSON: {lcp, fcp, cls, ttfb, inp}
  fetched_at TEXT
);

-- Links table
CREATE TABLE links (
  id INTEGER PRIMARY KEY,
  page_id TEXT,
  href TEXT,
  text TEXT,
  rel TEXT,
  is_internal INTEGER,
  status_code INTEGER
);

-- Images table
CREATE TABLE images (
  id INTEGER PRIMARY KEY,
  page_id TEXT,
  src TEXT,
  alt TEXT,
  width INTEGER,
  height INTEGER,
  loading TEXT
);
```

#### Audits Database Schema

```sql
-- Audits table
CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  crawl_id TEXT,
  domain TEXT,
  started_at TEXT,
  completed_at TEXT,
  overall_score REAL,
  grade TEXT,
  pages_audited INTEGER,
  config TEXT  -- JSON
);

-- Results table (per-rule, per-page)
CREATE TABLE results (
  id INTEGER PRIMARY KEY,
  audit_id TEXT,
  page_url TEXT,
  rule_id TEXT,
  category TEXT,
  status TEXT,      -- pass, warn, fail
  score REAL,
  message TEXT,
  details TEXT      -- JSON
);

-- Issues table (aggregated)
CREATE TABLE issues (
  id INTEGER PRIMARY KEY,
  audit_id TEXT,
  rule_id TEXT,
  category TEXT,
  severity TEXT,
  count INTEGER,
  affected_urls TEXT,  -- JSON array
  recommendation TEXT
);
```

### 5. Rules Engine (`src/rules/`)

```
src/rules/
├── define-rule.ts         # Rule definition helper
├── pattern-matcher.ts     # Wildcard rule matching
├── core/                  # 14 rules
├── perf/                  # 12 rules
├── links/                 # 13 rules
├── images/                # 12 rules
├── security/              # 12 rules
├── technical/             # 8 rules
├── crawl/                 # 6 rules
├── schema/                # 13 rules
├── a11y/                  # 12 rules
├── content/               # 11 rules
├── social/                # 9 rules
├── eeat/                  # 14 rules
├── url/                   # 2 rules
├── mobile/                # 3 rules
├── i18n/                  # 2 rules
└── legal/                 # 1 rule
```

#### Rule Structure

```typescript
interface Rule {
  id: string;           // e.g., 'core-meta-title'
  name: string;         // e.g., 'Meta Title'
  description: string;
  category: string;     // e.g., 'core'
  weight: number;       // 1-10, affects category score

  run(context: AuditContext): RuleResult;
}

interface AuditContext {
  url: string;
  html: string;
  $: CheerioAPI;        // Parsed DOM
  headers: Headers;
  statusCode: number;
  cwv?: CoreWebVitals;
  config: Config;
}

interface RuleResult {
  status: 'pass' | 'warn' | 'fail';
  score: number;        // 0-100
  message: string;
  details?: Record<string, unknown>;
}
```

#### Rule Execution Flow

```
┌─────────────────┐
│   Page Data     │
│  (from crawl)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parse HTML     │
│   (Cheerio)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Context   │
│  {url, $, cwv}  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         For each enabled rule:      │
│  ┌─────────────────────────────┐    │
│  │     rule.run(context)       │    │
│  │     → RuleResult            │    │
│  └─────────────────────────────┘    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│         Store Results               │
│    - Per-rule scores                │
│    - Aggregate by category          │
│    - Calculate overall score        │
└─────────────────────────────────────┘
```

### 6. Auditor (`src/auditor.ts`)

Orchestrates the audit process:

```typescript
class Auditor {
  async audit(url: string, options: AuditOptions): Promise<AuditReport> {
    // 1. Load or run crawl
    const crawl = await this.getCrawl(url, options);

    // 2. Load rules (filtered by config)
    const rules = this.loadRules(options.config);

    // 3. Run rules against each page
    const results = [];
    for (const page of crawl.pages) {
      const context = this.buildContext(page);
      for (const rule of rules) {
        results.push(await rule.run(context));
      }
    }

    // 4. Calculate scores
    const scores = this.calculateScores(results);

    // 5. Store in audits DB
    await this.storeAudit(scores);

    return scores;
  }
}
```

### 7. Scoring System (`src/scoring.ts`)

```typescript
// Status to score mapping
const STATUS_SCORES = {
  pass: 100,
  warn: 50,
  fail: 0,
};

// Category weights (total = 100%)
const CATEGORY_WEIGHTS = {
  core: 14,
  perf: 14,
  links: 9,
  images: 9,
  security: 9,
  technical: 8,
  crawl: 6,
  schema: 5,
  a11y: 5,
  content: 5,
  social: 4,
  eeat: 4,
  url: 3,
  mobile: 3,
  i18n: 1,
  legal: 1,
};
```

**Scoring algorithm:**

1. **Rule score:** Based on status (pass=100, warn=50, fail=0)
2. **Category score:** Weighted average of rule scores within category
3. **Overall score:** Weighted average of category scores
4. **Grade:** A (90+), B (80+), C (70+), D (60+), F (<60)

### 8. Reporters (`src/reporters/`)

```
src/reporters/
├── banner.ts              # ASCII art, grades, progress bars
├── terminal.ts            # Console output with colors
├── progress.ts            # Real-time progress indicators
├── json.ts                # JSON output
├── html-reporter.ts       # Self-contained HTML report
├── markdown-reporter.ts   # GitHub-flavored Markdown
└── llm-reporter.ts        # Token-optimized LLM output
```

#### Output Format Comparison

| Format | Size | Use Case |
|--------|------|----------|
| `console` | - | Human terminal output |
| `json` | 100% | CI/CD, programmatic |
| `html` | 150% | Visual reports |
| `markdown` | 80% | Documentation |
| `llm` | 30-50% | AI agents (token-optimized) |

#### LLM Reporter

Designed for minimal token usage:

```xml
<audit url="example.com" score="85" grade="B" pages="5">
  <issues>
    <issue rule="core-meta-description" severity="error" count="2">
      <msg>Missing meta description</msg>
      <fix>Add meta description tag</fix>
      <urls>/about,/contact</urls>
    </issue>
  </issues>
</audit>
```

## Data Flow: Complete Audit

```
User runs: seomator audit https://example.com --crawl -m 10

1. CLI PARSING
   ├── Parse arguments
   ├── Load config (seomator.toml + defaults)
   └── Merge options

2. CRAWLING
   ├── Initialize URL queue with start URL
   ├── For each URL (up to max_pages):
   │   ├── Check URL filter (include/exclude)
   │   ├── Fetch HTML (HTTP request)
   │   ├── Optionally run Playwright for CWV
   │   ├── Parse with Cheerio
   │   ├── Extract links → add to queue
   │   ├── Extract images
   │   └── Store in project.db
   └── Mark crawl complete

3. AUDITING
   ├── Load enabled rules (148 total, filtered by config)
   ├── For each page:
   │   ├── Build AuditContext {url, $, headers, cwv}
   │   ├── Run each rule → RuleResult
   │   └── Store results in audits.db
   └── Calculate scores

4. SCORING
   ├── Aggregate rule results by category
   ├── Calculate weighted category scores
   ├── Calculate overall score
   └── Determine grade (A-F)

5. REPORTING
   ├── Select reporter based on --format
   ├── Generate output
   └── Write to file or stdout

6. EXIT
   └── Return exit code (0=pass, 1=fail, 2=error)
```

## External Dependencies

| Dependency | Purpose |
|------------|---------|
| `commander` | CLI argument parsing |
| `cheerio` | HTML parsing (jQuery-like) |
| `playwright` | Browser automation for CWV |
| `better-sqlite3` | SQLite database |
| `chalk` | Terminal colors |
| `cli-progress` | Progress bars |
| `ora` | Spinners |
| `@iarna/toml` | TOML config parsing |

## Performance Considerations

### Concurrency
- **Crawler:** Configurable concurrent requests (default: 3)
- **External links:** Separate concurrency (default: 5)
- **Rules:** Run sequentially per page (DOM access)

### Caching
- **Pages:** Stored in SQLite with content hashing
- **External links:** Cached with configurable TTL
- **Crawls:** Can be resumed if interrupted

### Memory
- **HTML compression:** zlib for pages >10KB
- **Streaming:** Large crawls process pages incrementally
- **SQLite WAL:** Enables concurrent reads during writes

## Extending SEOmator

### Adding a New Rule

```typescript
// src/rules/core/my-rule.ts
import { defineRule } from '../define-rule.js';

export const myRule = defineRule({
  id: 'core-my-rule',
  name: 'My Rule',
  description: 'Checks for something important',
  category: 'core',
  weight: 5,

  run(context) {
    const { $ } = context;

    // Check something
    const hasFeature = $('meta[name="feature"]').length > 0;

    if (hasFeature) {
      return {
        status: 'pass',
        score: 100,
        message: 'Feature found',
      };
    }

    return {
      status: 'fail',
      score: 0,
      message: 'Feature missing',
      details: {
        recommendation: 'Add <meta name="feature"> tag',
      },
    };
  },
});
```

### Adding a New Reporter

```typescript
// src/reporters/my-reporter.ts
import type { AuditReport } from '../types.js';

export function generateMyReport(report: AuditReport): string {
  // Transform report to your format
  return myFormat;
}
```

## Next Steps

- [Configuration](./configuration.md) - Config options reference
- [SEO Audit Rules](./SEO-AUDIT-RULES.md) - All 148 rules
- [Storage Architecture](./STORAGE-ARCHITECTURE.md) - Database details
