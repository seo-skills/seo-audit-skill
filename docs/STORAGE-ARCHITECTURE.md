# Storage Architecture

Technical documentation for SEOmator's SQLite-based storage system.

## Overview

SEOmator uses a split-database architecture:
- **Per-project databases** for crawl data (isolates projects, enables easy cleanup)
- **Centralized audits database** for audit results (enables cross-project analytics)

This design balances data isolation with analytical capabilities.

## Database Locations

```
~/.seomator/
├── projects/
│   └── <domain>/
│       └── project.db      # Per-domain crawl data
├── audits.db               # Centralized audit results
└── link-cache.db           # External link validation cache
```

## Technology Stack

- **better-sqlite3**: Synchronous SQLite bindings for Node.js
- **zlib**: Native Node.js compression for HTML storage
- **crypto**: SHA-256 hashing for URL deduplication

## Project Database Schema

Located at `~/.seomator/projects/<domain>/project.db`

### Tables

#### `projects`
Represents a single domain/website.

```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    config_json TEXT
);
```

#### `crawls`
Represents a single crawl session.

```sql
CREATE TABLE crawls (
    id INTEGER PRIMARY KEY,
    crawl_id TEXT NOT NULL UNIQUE,      -- e.g., "2024-01-23-abc123"
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    start_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',  -- running|completed|failed|cancelled
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    config_json TEXT,
    stats_json TEXT,                    -- {totalPages, duration, errorCount}
    error_message TEXT
);
```

#### `pages`
Stores crawled page data with optional compressed HTML.

```sql
CREATE TABLE pages (
    id INTEGER PRIMARY KEY,
    crawl_id INTEGER NOT NULL REFERENCES crawls(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,             -- SHA-256 truncated to 16 chars
    status_code INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,
    content_type TEXT,
    html BLOB,                          -- Compressed if > 10KB
    html_compressed INTEGER DEFAULT 0,  -- 1 if compressed
    html_size INTEGER,                  -- Original size in bytes
    headers_json TEXT,
    load_time_ms INTEGER,
    ttfb_ms INTEGER,
    cwv_lcp REAL,                       -- Core Web Vitals
    cwv_cls REAL,
    cwv_inp REAL,
    cwv_fcp REAL,
    cwv_ttfb REAL,
    error_message TEXT,
    crawled_at TEXT DEFAULT (datetime('now')),
    UNIQUE(crawl_id, url_hash)
);
```

#### `links`
Stores links found on pages.

```sql
CREATE TABLE links (
    id INTEGER PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    href TEXT NOT NULL,
    href_hash TEXT NOT NULL,
    anchor_text TEXT,
    is_internal INTEGER DEFAULT 0,
    is_nofollow INTEGER DEFAULT 0,
    rel_value TEXT,
    target_status_code INTEGER,         -- Populated after link checking
    target_error TEXT
);
```

#### `images`
Stores images found on pages.

```sql
CREATE TABLE images (
    id INTEGER PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    src TEXT NOT NULL,
    src_hash TEXT NOT NULL,
    alt TEXT,
    has_alt INTEGER DEFAULT 0,
    width TEXT,
    height TEXT,
    is_lazy_loaded INTEGER DEFAULT 0,
    loading_attr TEXT,
    srcset TEXT,
    file_size INTEGER,
    format TEXT                         -- jpg, png, webp, etc.
);
```

#### `frontier`
Queue for resumable crawling (future use).

```sql
CREATE TABLE frontier (
    id INTEGER PRIMARY KEY,
    crawl_id INTEGER NOT NULL REFERENCES crawls(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,
    depth INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',      -- pending|processing|completed|skipped
    discovered_at TEXT DEFAULT (datetime('now')),
    UNIQUE(crawl_id, url_hash)
);
```

## Audits Database Schema

Located at `~/.seomator/audits.db`

### Tables

#### `audits`
Main audit records.

```sql
CREATE TABLE audits (
    id INTEGER PRIMARY KEY,
    audit_id TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    project_name TEXT,
    crawl_id TEXT,                      -- Links to project DB crawl
    start_url TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    total_rules INTEGER DEFAULT 0,
    passed_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    pages_audited INTEGER DEFAULT 1,
    config_json TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT DEFAULT 'running'       -- running|completed|failed
);
```

#### `audit_categories`
Category-level results.

```sql
CREATE TABLE audit_categories (
    id INTEGER PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    weight INTEGER NOT NULL,
    pass_count INTEGER DEFAULT 0,
    warn_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    UNIQUE(audit_id, category_id)
);
```

#### `audit_results`
Per-rule, per-page audit results.

```sql
CREATE TABLE audit_results (
    id INTEGER PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    page_url TEXT NOT NULL,
    page_url_hash TEXT NOT NULL,
    status TEXT NOT NULL,               -- pass|warn|fail
    score INTEGER NOT NULL,
    message TEXT NOT NULL,
    details_json TEXT,
    executed_at TEXT DEFAULT (datetime('now'))
);
```

#### `issues`
Aggregated issues for reporting.

```sql
CREATE TABLE issues (
    id INTEGER PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    severity TEXT NOT NULL,             -- critical|warning|info
    title TEXT NOT NULL,
    description TEXT,
    affected_pages_count INTEGER DEFAULT 1,
    affected_pages_json TEXT,           -- JSON array of URLs
    fix_suggestion TEXT,
    priority_score INTEGER DEFAULT 0    -- Calculated score for sorting
);
```

#### `audit_comparisons`
Stores audit-to-audit comparisons.

```sql
CREATE TABLE audit_comparisons (
    id INTEGER PRIMARY KEY,
    current_audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
    previous_audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    score_delta INTEGER NOT NULL,
    category_deltas_json TEXT,          -- Array of {categoryId, delta}
    new_issues_count INTEGER DEFAULT 0,
    fixed_issues_count INTEGER DEFAULT 0,
    compared_at TEXT DEFAULT (datetime('now'))
);
```

## Key Algorithms

### URL Hashing

Uses SHA-256 truncated to 16 characters (64 bits) for compact, deterministic hashing.

```typescript
import * as crypto from 'crypto';

function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}
```

### HTML Compression

Compresses HTML pages larger than 10KB using zlib deflate (level 6).

```typescript
import * as zlib from 'zlib';

const THRESHOLD = 10 * 1024; // 10KB

function compressHtml(html: string): { data: Buffer; compressed: boolean } {
  const buf = Buffer.from(html, 'utf-8');

  if (buf.length < THRESHOLD) {
    return { data: buf, compressed: false };
  }

  const compressed = zlib.deflateSync(buf, { level: 6 });

  // Only use compressed if smaller
  if (compressed.length >= buf.length) {
    return { data: buf, compressed: false };
  }

  return { data: compressed, compressed: true };
}
```

Typical compression ratios: 70-80% reduction for HTML.

### Issue Priority Scoring

Prioritizes issues based on severity and affected page count.

```typescript
function calculatePriorityScore(severity: string, affectedPages: number): number {
  const severityScore = { critical: 100, warning: 50, info: 10 }[severity] || 0;
  return severityScore * Math.log10(affectedPages + 1);
}
```

## Usage Examples

### Opening a Project Database

```typescript
import { ProjectDatabase } from '../storage/project-db/index.js';

// Open/create database for a domain
const db = new ProjectDatabase('example.com');

// Or from a full URL (domain is extracted)
const db2 = new ProjectDatabase('https://www.example.com/path');

// Get or create project
const project = db.getOrCreateProject('My Website');

// Create a crawl
const crawl = db.createCrawl({
  crawlId: '2024-01-23-abc123',
  startUrl: 'https://example.com',
  config: { /* ... */ },
});

// Insert pages with automatic HTML compression
db.insertPage(crawl.id, {
  url: 'https://example.com/page',
  statusCode: 200,
  depth: 1,
  html: '<html>...</html>',  // Auto-compressed if > 10KB
  headers: { 'content-type': 'text/html' },
  loadTimeMs: 250,
});

// Complete the crawl
db.completeCrawl(crawl.crawlId, {
  totalPages: 10,
  duration: 5000,
  errorCount: 0,
});

// Close when done
db.close();
```

### Using the Audits Database

```typescript
import { getAuditsDatabase, closeAuditsDatabase } from '../storage/audits-db/index.js';

// Get singleton instance
const auditsDb = getAuditsDatabase();

// Create an audit
const audit = auditsDb.createAudit({
  auditId: '2024-01-23-xyz789',
  domain: 'example.com',
  projectName: 'My Website',
  startUrl: 'https://example.com',
});

// Insert results
auditsDb.insertResults(audit.id, [
  {
    categoryId: 'meta-tags',
    ruleId: 'title-present',
    ruleName: 'Page Title Present',
    pageUrl: 'https://example.com',
    status: 'pass',
    score: 100,
    message: 'Title tag found',
  },
  // ... more results
]);

// Complete audit
auditsDb.completeAudit(audit.auditId, {
  overallScore: 85,
  totalRules: 55,
  passedCount: 45,
  warningCount: 7,
  failedCount: 3,
  pagesAudited: 10,
});

// Generate issues from failed results
auditsDb.generateIssuesFromResults(audit.id);

// Get top priority issues
const issues = auditsDb.getTopPriorityIssues(audit.id, 10);

// Compare with previous audit
const previousAudit = auditsDb.getPreviousAudit('example.com', audit.auditId);
if (previousAudit) {
  const comparison = auditsDb.compareAudits(audit.id, previousAudit.id);
  console.log(`Score delta: ${comparison.scoreDelta}`);
}

// Close when app exits
closeAuditsDatabase();
```

### Querying Results

```typescript
// Get all failed results
const failures = auditsDb.getResultsByStatus(audit.id, 'fail');

// Get results for a specific rule
const titleResults = auditsDb.getResultsByRule(audit.id, 'title-present');

// Get results for a specific page
const pageResults = auditsDb.getResultsByPage(audit.id, 'https://example.com/contact');

// Get issues by severity
const criticalIssues = auditsDb.getIssuesBySeverity(audit.id, 'critical');

// Get score trend for a domain
const trend = auditsDb.getScoreTrend('example.com', 10);
```

## Performance Considerations

### WAL Mode

All databases use WAL (Write-Ahead Logging) mode for:
- Concurrent reads during writes
- Better performance for write-heavy workloads
- Crash recovery

```sql
PRAGMA journal_mode = WAL;
```

### Foreign Keys

Foreign keys are enabled with cascade deletes for data integrity:

```sql
PRAGMA foreign_keys = ON;
```

Deleting a crawl automatically deletes all associated pages, links, and images.

### Indexes

Strategic indexes are created for common query patterns:

```sql
-- Project database
CREATE INDEX idx_pages_crawl ON pages(crawl_id);
CREATE INDEX idx_pages_url_hash ON pages(url_hash);
CREATE INDEX idx_links_page ON links(page_id);

-- Audits database
CREATE INDEX idx_audits_domain ON audits(domain);
CREATE INDEX idx_results_rule ON audit_results(audit_id, rule_id);
CREATE INDEX idx_issues_priority ON issues(audit_id, priority_score DESC);
```

### Batch Operations

Use transactions for bulk inserts:

```typescript
// Insert multiple pages efficiently
db.insertPages(crawlId, pagesArray);  // Uses single transaction

// Insert multiple results
auditsDb.insertResults(auditId, resultsArray);  // Uses single transaction
```

## Migration from JSON

Existing JSON files can be migrated using the CLI:

```bash
# Preview migration
seomator db migrate --dry-run

# Run migration (creates backups)
seomator db migrate

# Rollback if needed
seomator db restore
```

The migration process:
1. Detects `.seomator/crawls/*.json` and `.seomator/reports/*.json`
2. Creates appropriate project databases and audits entries
3. Backs up original files to `.bak` directories
4. Reports statistics on migrated files

## Type System

All database records have corresponding TypeScript types in `src/storage/types.ts`:

- **Db*** prefix: Raw database records (match SQLite column names)
- **Hydrated***: Enriched records with parsed JSON fields and Date objects
- ***Options**: Query/filter options for list operations
- **Insert*Input**: Input types for creating records

Example:

```typescript
// Raw database record
interface DbPage {
  id: number;
  crawl_id: number;
  url: string;
  html_compressed: number;  // 0 or 1
  // ...
}

// Hydrated for application use
interface HydratedPage {
  id: number;
  crawlId: number;         // camelCase
  url: string;
  htmlCompressed: boolean; // boolean, not 0/1
  crawledAt: Date;         // Date, not string
  // ...
}
```

## Future Enhancements

Planned improvements:

1. **Resumable Crawling**: Use `frontier` table to resume interrupted crawls
2. **Full-Text Search**: Add FTS5 virtual tables for content search
3. **Scheduled Audits**: Store scheduling metadata for recurring audits
4. **Data Retention**: Automatic cleanup of old crawls/audits based on policy
5. **Export/Import**: Database backup and restoration utilities
