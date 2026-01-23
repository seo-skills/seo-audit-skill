# Phase 2: Comprehensive Configuration System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a professional-grade configuration system matching industry standards (squirrelscan, lighthouse, etc.)

**Architecture:** Extend config schema with layered validation, add URL filtering, external link caching, rule options, and multiple output formats.

**Tech Stack:** TypeScript, TOML, SQLite (for caching), glob patterns

---

## Feature Analysis & Reasoning

### 1. Config Validation & Management

| Feature | squirrelscan | seomator | Reasoning |
|---------|--------------|----------|-----------|
| `config validate` | Yes | **Add** | Catches config errors before crawl starts, saving time |
| `config show` | Yes | **Add** | Shows effective merged config - essential for debugging |
| `config path` | Yes | **Add** | Helps users find which config file is being used |
| `config set --dry-run` | Yes | Skip | Nice-to-have, lower priority |

**Decision:** Add validate, show, path commands. Skip dry-run for now.

---

### 2. Crawler Configuration

| Feature | squirrelscan | seomator | Reasoning |
|---------|--------------|----------|-----------|
| `max_pages` | 500 | 100 | Keep our default, it's more conservative |
| `delay_ms` | 100 | 100 | Same - good default |
| `timeout_ms` | 30000 | 30000 | Same |
| `concurrency` | 5 | 3 | Keep ours - more polite |
| `per_host_concurrency` | 2 | **Add** | Important for multi-domain crawls |
| `per_host_delay_ms` | 200 | **Add** | Prevents hammering single host |
| `include` patterns | Yes | **Add** | Essential for focused crawls (`/blog/*`) |
| `exclude` patterns | Yes | **Add** | Essential for skipping admin, PDFs |
| `allow_query_params` | Yes | **Add** | Preserve pagination (`?page=2`) |
| `drop_query_prefixes` | `utm_,gclid,fbclid` | **Add** | Strip tracking params - better dedup |
| `user_agent` | Random | **Add** | Custom UA for testing |
| `follow_redirects` | true | **Add** | Option to disable for redirect audits |
| `respect_robots` | true | Exists | Already have this |
| `breadth_first` | true | **Add** | Better coverage strategy |
| `max_prefix_budget` | 0.25 | **Add** | Prevents trap in deep paths |

**Decision:** Add all crawler options except those we already have.

---

### 3. External Links Configuration

| Feature | squirrelscan | seomator | Reasoning |
|---------|--------------|----------|-----------|
| `enabled` | true | **Add** | Toggle external link checking |
| `cache_ttl_days` | 7 | **Add** | Huge time saver - don't re-check same URLs |
| `timeout_ms` | 10000 | **Add** | Separate timeout for external checks |
| `concurrency` | 5 | **Add** | Control parallel external checks |

**Decision:** Add full external link configuration with SQLite cache.

**Cache Location:** `~/.seomator/link-cache.db`

**Cache Schema:**
```sql
CREATE TABLE link_cache (
  url TEXT PRIMARY KEY,
  status INTEGER,
  checked_at INTEGER,
  error TEXT
);
```

---

### 4. Rules Configuration

| Feature | squirrelscan | seomator | Reasoning |
|---------|--------------|----------|-----------|
| `enable` array | `["*"]` | Exists | Already have |
| `disable` array | Yes | Exists | Already have |
| Wildcard patterns | `core/*`, `*` | **Add** | More flexible than exact IDs |
| Per-category enable | Yes | **Add** | `enable = ["meta-tags/*"]` |

**Decision:** Add wildcard pattern matching to enable/disable arrays.

**Pattern Examples:**
```toml
[rules]
enable = ["*"]                    # All rules
enable = ["meta-tags/*"]          # All meta-tags rules
enable = ["meta-tags/title-*"]    # Title-related rules only
disable = ["cwv/*"]               # Skip all Core Web Vitals
```

---

### 5. Rule Options (Per-Rule Configuration)

| Feature | squirrelscan | seomator | Reasoning |
|---------|--------------|----------|-----------|
| Title length | 30-60 | **Add** | Sites have different needs |
| Description length | 120-160 | **Add** | Some prefer shorter |
| Word count minimum | 300 | **Add** | Blogs vs landing pages differ |
| Image size limit | varies | **Add** | Different performance budgets |

**Decision:** Add rule_options section for customizable thresholds.

**Implementation:**
```toml
[rule_options]
# Meta tags
"meta-tags/title-length".min = 30
"meta-tags/title-length".max = 60
"meta-tags/description-length".min = 120
"meta-tags/description-length".max = 160

# Content
"headings/content-length".min = 10
"headings/content-length".max = 70

# Images
"images/size".max_kb = 200
```

---

### 6. Output Configuration

| Format | squirrelscan | seomator | Reasoning |
|--------|--------------|----------|-----------|
| `console` | Yes | `table` | Same concept, different name |
| `text` | Yes | Skip | Low value - just remove colors |
| `json` | Yes | Exists | Already have |
| `html` | Yes | **Add** | Essential for sharing with clients |
| `markdown` | Yes | **Add** | Great for documentation/PRs |
| `llm` | Yes | Skip | Niche use case |
| `xml` | Yes | Skip | Enterprise-focused |

**Decision:** Add html and markdown formats. Skip text, llm, xml.

**Output Options:**
```toml
[output]
format = "table"        # Default output format
path = ""               # Optional default output path
verbose = false         # Show progress
save_reports = true     # Auto-save to .seomator/reports/
```

---

## Implementation Plan

### Phase 2A: Config Commands (Tasks 1-4)

| Task | Description | Files |
|------|-------------|-------|
| 1 | Config validator module | `src/config/validator.ts` |
| 2 | Config validate command | `src/commands/config.ts` |
| 3 | Config show command | `src/commands/config.ts` |
| 4 | Config path command | `src/commands/config.ts` |

### Phase 2B: Crawler Enhancements (Tasks 5-9)

| Task | Description | Files |
|------|-------------|-------|
| 5 | Update schema with new crawler fields | `src/config/schema.ts` |
| 6 | URL filter module with glob patterns | `src/crawler/url-filter.ts` |
| 7 | Query param normalizer | `src/crawler/url-filter.ts` |
| 8 | Integrate URL filter into crawler | `src/crawler/crawler.ts` |
| 9 | Add breadth-first and prefix budget | `src/crawler/crawler.ts` |

### Phase 2C: External Links (Tasks 10-12)

| Task | Description | Files |
|------|-------------|-------|
| 10 | External links schema | `src/config/schema.ts` |
| 11 | Link cache with SQLite | `src/storage/link-cache.ts` |
| 12 | External link checker | `src/crawler/external-checker.ts` |

### Phase 2D: Rules System (Tasks 13-15)

| Task | Description | Files |
|------|-------------|-------|
| 13 | Rule pattern matcher (wildcards) | `src/rules/pattern-matcher.ts` |
| 14 | Rule options schema | `src/config/schema.ts` |
| 15 | Apply rule options to rules | `src/rules/*.ts` |

### Phase 2E: Output Formats (Tasks 16-18)

| Task | Description | Files |
|------|-------------|-------|
| 16 | HTML reporter | `src/reporters/html-reporter.ts` |
| 17 | Markdown reporter | `src/reporters/markdown-reporter.ts` |
| 18 | Integrate formats into CLI | `src/commands/audit.ts` |

### Phase 2F: Integration (Tasks 19-20)

| Task | Description | Files |
|------|-------------|-------|
| 19 | Update documentation | `CLAUDE.md` |
| 20 | Integration tests | Manual testing |

---

## Detailed Task Specifications

### Task 1: Config Validator Module

**File:** `src/config/validator.ts`

**Purpose:** Validate config values before use, catching errors early.

**Validation Rules:**
- `crawler.max_pages`: 1-10000, warn if >5000
- `crawler.concurrency`: 1-20, warn if >10
- `crawler.per_host_concurrency`: 1-5
- `crawler.timeout`: 1000-120000ms
- `crawler.delay_between_requests`: >=0
- `crawler.per_host_delay_ms`: >=0
- `crawler.max_prefix_budget`: 0-1
- `crawler.include/exclude`: arrays of strings
- `external_links.cache_ttl_days`: 0-365
- `external_links.timeout_ms`: 1000-60000
- `external_links.concurrency`: 1-20
- `output.format`: table|json|html|markdown

**Return Type:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
```

---

### Task 5: Updated Config Schema

**File:** `src/config/schema.ts`

**New CrawlerConfig fields:**
```typescript
interface CrawlerConfig {
  // Existing
  max_pages: number;
  concurrency: number;
  timeout: number;
  respect_robots_txt: boolean;
  delay_between_requests: number;

  // New - Rate limiting
  per_host_concurrency: number;
  per_host_delay_ms: number;

  // New - URL filtering
  include: string[];
  exclude: string[];

  // New - Query params
  allow_query_params: string[];
  drop_query_prefixes: string[];

  // New - Request config
  user_agent: string;
  follow_redirects: boolean;

  // New - Strategy
  breadth_first: boolean;
  max_prefix_budget: number;
}
```

**New ExternalLinksConfig:**
```typescript
interface ExternalLinksConfig {
  enabled: boolean;
  cache_ttl_days: number;
  timeout_ms: number;
  concurrency: number;
}
```

---

### Task 6: URL Filter Module

**File:** `src/crawler/url-filter.ts`

**Features:**
- Glob pattern matching for include/exclude
- Query param stripping by prefix
- Query param allow-list
- URL normalization for deduplication

**Pattern Syntax:**
- `*` matches any characters except `/`
- `**` matches any characters including `/`
- `?` matches single character
- `/admin/*` matches `/admin/users`, `/admin/settings`
- `*.pdf` matches any PDF file

---

### Task 11: Link Cache Module

**File:** `src/storage/link-cache.ts`

**Features:**
- SQLite-based cache at `~/.seomator/link-cache.db`
- TTL-based expiration
- Batch get/set operations
- Cache cleanup command

**Methods:**
```typescript
class LinkCache {
  get(url: string): CachedLinkResult | null;
  set(url: string, status: number, error?: string): void;
  getMany(urls: string[]): Map<string, CachedLinkResult>;
  cleanup(): number; // Returns deleted count
  stats(): { total: number; expired: number };
}
```

---

### Task 13: Rule Pattern Matcher

**File:** `src/rules/pattern-matcher.ts`

**Features:**
- Wildcard matching for rule IDs
- Category-level enable/disable
- Disable takes precedence over enable

**Examples:**
```typescript
matchesPattern('meta-tags/title-length', '*') // true
matchesPattern('meta-tags/title-length', 'meta-tags/*') // true
matchesPattern('meta-tags/title-length', 'security/*') // false
matchesPattern('cwv/lcp', 'cwv/*') // true
```

---

### Task 16: HTML Reporter

**File:** `src/reporters/html-reporter.ts`

**Features:**
- Self-contained HTML (no external dependencies)
- Color-coded score card
- Category breakdown grid
- Expandable failures/warnings sections
- Responsive design
- Print-friendly styles

---

### Task 17: Markdown Reporter

**File:** `src/reporters/markdown-reporter.ts`

**Features:**
- Clean markdown tables
- Summary statistics
- Category breakdown
- Failures/warnings sections
- Compatible with GitHub/GitLab rendering

---

## Full Config Example

```toml
# seomator.toml - Full configuration example

[project]
name = "my-website"
domains = ["example.com"]

[crawler]
max_pages = 200
timeout = 30000
concurrency = 5
per_host_concurrency = 2
delay_between_requests = 100
per_host_delay_ms = 200
include = []
exclude = ["/admin/*", "/api/*", "*.pdf"]
drop_query_prefixes = ["utm_", "gclid", "fbclid"]
allow_query_params = ["page", "id"]
user_agent = ""
follow_redirects = true
respect_robots_txt = true
breadth_first = true
max_prefix_budget = 0.25

[external_links]
enabled = true
cache_ttl_days = 7
timeout_ms = 10000
concurrency = 5

[rules]
enable = ["*"]
disable = ["cwv/*"]

[output]
format = "table"
verbose = false
save_reports = true

[rule_options]
"meta-tags/title-length" = { min = 30, max = 60 }
"meta-tags/description-length" = { min = 120, max = 160 }
```

---

## Verification Commands

```bash
# Build and test
npm run build
npm run test:run

# Config commands
seomator config validate
seomator config show
seomator config path

# Output formats
seomator audit https://example.com --format html -o report.html
seomator audit https://example.com --format markdown -o report.md

# Help
seomator --help
seomator config --help
```

---

## Summary

| Category | Features Added |
|----------|----------------|
| Config Commands | validate, show, path |
| Crawler | include/exclude patterns, query param handling, per-host limits, breadth-first, prefix budget |
| External Links | caching, configurable timeout/concurrency |
| Rules | wildcard patterns, per-rule options |
| Output | HTML, Markdown formats |

**Total Tasks:** 20
**New Files:** 8
**Modified Files:** 10

---

## Execution Options

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task with review
2. **Parallel Session (separate)** - Open new session with executing-plans skill
