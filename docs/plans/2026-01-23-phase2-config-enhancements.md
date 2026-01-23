# Phase 2: Configuration & Output Enhancements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add config validation, URL filtering, query param handling, and HTML/Markdown output formats.

**Architecture:** Extend existing config system with validation, add URL pattern matching to crawler, add new reporter formats.

**Tech Stack:** TypeScript, TOML, glob patterns (micromatch), HTML templates

---

## Task Overview (12 tasks)

### Config Enhancements (Tasks 1-4)
1. Add config validate command
2. Add config show command (effective merged config)
3. Add config path command
4. Update config command help

### Crawler Enhancements (Tasks 5-8)
5. Add exclude patterns to config schema
6. Add include patterns to config schema
7. Add query param handling to config schema
8. Implement URL filtering in crawler

### Output Formats (Tasks 9-11)
9. Add HTML reporter
10. Add Markdown reporter
11. Add format option to CLI

### Integration (Task 12)
12. Update documentation and tests

---

## Files to Create

```
src/
├── config/
│   └── validator.ts          # Config validation logic
├── reporters/
│   ├── html-reporter.ts      # HTML output
│   └── markdown-reporter.ts  # Markdown output
└── crawler/
    └── url-filter.ts         # URL pattern matching
```

## Files to Modify

```
src/config/schema.ts          # Add new config fields
src/config/defaults.ts        # Add defaults for new fields
src/commands/config.ts        # Add validate, show, path subcommands
src/crawler/crawler.ts        # Integrate URL filtering
src/commands/audit.ts         # Add --format option
src/cli.ts                    # Update CLI options
CLAUDE.md                     # Update documentation
```

---

## Task 1: Add Config Validate Command

**Files:**
- Modify: `src/commands/config.ts`
- Create: `src/config/validator.ts`

### Step 1: Create validator module

```typescript
// src/config/validator.ts
import type { PartialSeomatorConfig } from './schema.js';

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export function validateConfig(config: PartialSeomatorConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate crawler settings
  if (config.crawler) {
    if (config.crawler.max_pages !== undefined) {
      if (typeof config.crawler.max_pages !== 'number' || config.crawler.max_pages < 1) {
        errors.push({
          path: 'crawler.max_pages',
          message: 'Must be a positive number',
          value: config.crawler.max_pages,
        });
      }
      if (config.crawler.max_pages > 10000) {
        warnings.push({
          path: 'crawler.max_pages',
          message: 'Very high value may cause long crawl times',
          value: config.crawler.max_pages,
        });
      }
    }

    if (config.crawler.concurrency !== undefined) {
      if (typeof config.crawler.concurrency !== 'number' || config.crawler.concurrency < 1) {
        errors.push({
          path: 'crawler.concurrency',
          message: 'Must be a positive number',
          value: config.crawler.concurrency,
        });
      }
      if (config.crawler.concurrency > 20) {
        warnings.push({
          path: 'crawler.concurrency',
          message: 'High concurrency may overload target server',
          value: config.crawler.concurrency,
        });
      }
    }

    if (config.crawler.timeout !== undefined) {
      if (typeof config.crawler.timeout !== 'number' || config.crawler.timeout < 1000) {
        errors.push({
          path: 'crawler.timeout',
          message: 'Must be at least 1000ms',
          value: config.crawler.timeout,
        });
      }
    }

    if (config.crawler.delay_between_requests !== undefined) {
      if (typeof config.crawler.delay_between_requests !== 'number' || config.crawler.delay_between_requests < 0) {
        errors.push({
          path: 'crawler.delay_between_requests',
          message: 'Must be a non-negative number',
          value: config.crawler.delay_between_requests,
        });
      }
    }

    // Validate exclude patterns
    if (config.crawler.exclude !== undefined) {
      if (!Array.isArray(config.crawler.exclude)) {
        errors.push({
          path: 'crawler.exclude',
          message: 'Must be an array of strings',
          value: config.crawler.exclude,
        });
      } else {
        for (const pattern of config.crawler.exclude) {
          if (typeof pattern !== 'string') {
            errors.push({
              path: 'crawler.exclude',
              message: 'Each pattern must be a string',
              value: pattern,
            });
          }
        }
      }
    }

    // Validate include patterns
    if (config.crawler.include !== undefined) {
      if (!Array.isArray(config.crawler.include)) {
        errors.push({
          path: 'crawler.include',
          message: 'Must be an array of strings',
          value: config.crawler.include,
        });
      }
    }
  }

  // Validate rules settings
  if (config.rules) {
    if (config.rules.enable !== undefined && !Array.isArray(config.rules.enable)) {
      errors.push({
        path: 'rules.enable',
        message: 'Must be an array of strings',
        value: config.rules.enable,
      });
    }
    if (config.rules.disable !== undefined && !Array.isArray(config.rules.disable)) {
      errors.push({
        path: 'rules.disable',
        message: 'Must be an array of strings',
        value: config.rules.disable,
      });
    }
  }

  // Validate output settings
  if (config.output) {
    const validFormats = ['table', 'json', 'html', 'markdown', 'text'];
    if (config.output.format !== undefined && !validFormats.includes(config.output.format)) {
      errors.push({
        path: 'output.format',
        message: `Must be one of: ${validFormats.join(', ')}`,
        value: config.output.format,
      });
    }
  }

  // Validate external_links settings
  if (config.external_links) {
    if (config.external_links.enabled !== undefined && typeof config.external_links.enabled !== 'boolean') {
      errors.push({
        path: 'external_links.enabled',
        message: 'Must be a boolean',
        value: config.external_links.enabled,
      });
    }
    if (config.external_links.cache_ttl_days !== undefined) {
      if (typeof config.external_links.cache_ttl_days !== 'number' || config.external_links.cache_ttl_days < 0) {
        errors.push({
          path: 'external_links.cache_ttl_days',
          message: 'Must be a non-negative number',
          value: config.external_links.cache_ttl_days,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### Step 2: Update config command

Add to `src/commands/config.ts`:

```typescript
import { validateConfig, type ValidationResult } from '../config/validator.js';
import { findConfigFile, parseConfigFile, loadConfig } from '../config/index.js';

export async function runConfigValidate(): Promise<void> {
  const configPath = findConfigFile(process.cwd());

  if (!configPath) {
    console.log(chalk.yellow('No config file found.'));
    console.log('Run `seomator init` to create one.');
    return;
  }

  console.log(`Validating: ${configPath}\n`);

  try {
    const config = parseConfigFile(configPath);
    const result = validateConfig(config);

    if (result.valid && result.warnings.length === 0) {
      console.log(chalk.green('✓ Config valid'));
      return;
    }

    if (result.errors.length > 0) {
      console.log(chalk.red(`✗ ${result.errors.length} error(s):\n`));
      for (const error of result.errors) {
        console.log(chalk.red(`  ${error.path}: ${error.message}`));
        if (error.value !== undefined) {
          console.log(chalk.gray(`    Value: ${JSON.stringify(error.value)}`));
        }
      }
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠ ${result.warnings.length} warning(s):\n`));
      for (const warning of result.warnings) {
        console.log(chalk.yellow(`  ${warning.path}: ${warning.message}`));
      }
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.log(chalk.red(`✗ Failed to parse config: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export async function runConfigShow(): Promise<void> {
  const { config, configPath } = loadConfig(process.cwd());

  if (configPath) {
    console.log(chalk.gray(`Config file: ${configPath}\n`));
  } else {
    console.log(chalk.gray('Using defaults (no config file found)\n'));
  }

  console.log(chalk.bold('Effective Configuration:\n'));
  console.log(JSON.stringify(config, null, 2));
}

export async function runConfigPath(): Promise<void> {
  const configPath = findConfigFile(process.cwd());

  if (configPath) {
    console.log(configPath);
  } else {
    console.log(chalk.yellow('No config file found.'));
    process.exit(1);
  }
}
```

### Step 3: Update CLI

Add subcommands to config in `src/cli.ts`:

```typescript
// Config command with subcommands
const configCmd = program
  .command('config')
  .description('View or modify configuration');

configCmd
  .command('show')
  .description('Show effective merged configuration')
  .action(runConfigShow);

configCmd
  .command('validate')
  .description('Validate config file syntax and values')
  .action(runConfigValidate);

configCmd
  .command('path')
  .description('Show config file path')
  .action(runConfigPath);

configCmd
  .command('get [key]')
  .description('Get config value')
  .action(runConfigGet);

configCmd
  .command('set <key> <value>')
  .description('Set config value')
  .option('--global', 'Modify global settings', false)
  .option('--local', 'Modify local settings', false)
  .action(runConfigSet);
```

### Step 4: Commit

```bash
git add src/config/validator.ts src/commands/config.ts src/cli.ts
git commit -m "feat: add config validate, show, and path commands

- Add validateConfig() with error and warning detection
- Add 'seomator config validate' command
- Add 'seomator config show' for effective merged config
- Add 'seomator config path' to show config file location

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add URL Exclude/Include Patterns to Schema

**Files:**
- Modify: `src/config/schema.ts`
- Modify: `src/config/defaults.ts`

### Step 1: Update schema types

Add to `CrawlerConfig` in `src/config/schema.ts`:

```typescript
export interface CrawlerConfig {
  max_pages: number;
  concurrency: number;
  timeout: number;
  respect_robots_txt: boolean;
  delay_between_requests: number;
  // New fields
  include: string[];           // URL patterns to include (glob)
  exclude: string[];           // URL patterns to exclude (glob)
  drop_query_prefixes: string[]; // Query param prefixes to strip
  allow_query_params: string[];  // Query params to preserve
  user_agent: string;          // Custom user agent (empty = default)
}

export interface PartialCrawlerConfig {
  max_pages?: number;
  concurrency?: number;
  timeout?: number;
  respect_robots_txt?: boolean;
  delay_between_requests?: number;
  include?: string[];
  exclude?: string[];
  drop_query_prefixes?: string[];
  allow_query_params?: string[];
  user_agent?: string;
}
```

### Step 2: Update defaults

Add to `src/config/defaults.ts`:

```typescript
export function getDefaultConfig(): SeomatorConfig {
  return {
    // ... existing fields
    crawler: {
      max_pages: 100,
      concurrency: 3,
      timeout: 30000,
      respect_robots_txt: true,
      delay_between_requests: 100,
      include: [],
      exclude: [],
      drop_query_prefixes: ['utm_', 'gclid', 'fbclid', 'mc_', '_ga'],
      allow_query_params: [],
      user_agent: '',
    },
    // ... rest
  };
}
```

### Step 3: Commit

```bash
git add src/config/schema.ts src/config/defaults.ts
git commit -m "feat: add URL filtering and query param options to config

- Add include/exclude URL patterns (glob syntax)
- Add drop_query_prefixes for stripping tracking params
- Add allow_query_params for preserving specific params
- Add user_agent option

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Implement URL Filter Module

**Files:**
- Create: `src/crawler/url-filter.ts`
- Create: `src/crawler/url-filter.test.ts`

### Step 1: Write failing tests

```typescript
// src/crawler/url-filter.test.ts
import { describe, it, expect } from 'vitest';
import { UrlFilter } from './url-filter.js';

describe('UrlFilter', () => {
  describe('exclude patterns', () => {
    it('should exclude URLs matching pattern', () => {
      const filter = new UrlFilter({
        exclude: ['/admin/*', '*.pdf'],
      });

      expect(filter.shouldCrawl('https://example.com/admin/users')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/docs/guide.pdf')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/about')).toBe(true);
    });

    it('should handle multiple exclude patterns', () => {
      const filter = new UrlFilter({
        exclude: ['/admin/*', '/api/*', '/private/*'],
      });

      expect(filter.shouldCrawl('https://example.com/admin/login')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/api/users')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/private/data')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/public/page')).toBe(true);
    });
  });

  describe('include patterns', () => {
    it('should only include URLs matching pattern when set', () => {
      const filter = new UrlFilter({
        include: ['/blog/*'],
      });

      expect(filter.shouldCrawl('https://example.com/blog/post-1')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/about')).toBe(false);
    });

    it('should allow all when include is empty', () => {
      const filter = new UrlFilter({
        include: [],
        exclude: [],
      });

      expect(filter.shouldCrawl('https://example.com/anything')).toBe(true);
    });
  });

  describe('query param handling', () => {
    it('should strip tracking params by default', () => {
      const filter = new UrlFilter({
        drop_query_prefixes: ['utm_', 'gclid', 'fbclid'],
      });

      const url = 'https://example.com/page?id=123&utm_source=google&utm_medium=cpc&gclid=abc';
      expect(filter.normalizeUrl(url)).toBe('https://example.com/page?id=123');
    });

    it('should preserve allowed query params', () => {
      const filter = new UrlFilter({
        drop_query_prefixes: ['utm_'],
        allow_query_params: ['page', 'id'],
      });

      const url = 'https://example.com/search?page=2&id=5&sort=date&utm_source=test';
      expect(filter.normalizeUrl(url)).toBe('https://example.com/search?page=2&id=5');
    });

    it('should handle URLs without query params', () => {
      const filter = new UrlFilter({});
      expect(filter.normalizeUrl('https://example.com/page')).toBe('https://example.com/page');
    });
  });

  describe('combined filtering', () => {
    it('should apply exclude after include', () => {
      const filter = new UrlFilter({
        include: ['/docs/*'],
        exclude: ['/docs/internal/*'],
      });

      expect(filter.shouldCrawl('https://example.com/docs/guide')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/docs/internal/secret')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/blog')).toBe(false);
    });
  });
});
```

### Step 2: Run test to verify failure

```bash
npm test src/crawler/url-filter.test.ts
```

Expected: FAIL (module not found)

### Step 3: Implement URL filter

```typescript
// src/crawler/url-filter.ts

export interface UrlFilterOptions {
  include?: string[];
  exclude?: string[];
  drop_query_prefixes?: string[];
  allow_query_params?: string[];
}

/**
 * Simple glob pattern matching
 * Supports: * (any chars except /), ** (any chars including /), ? (single char)
 */
function globToRegex(pattern: string): RegExp {
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*\*/g, '<<<GLOBSTAR>>>') // Temp placeholder for **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/<<<GLOBSTAR>>>/g, '.*') // ** matches anything
    .replace(/\?/g, '.'); // ? matches single char

  return new RegExp(`^${regex}$`);
}

export class UrlFilter {
  private includePatterns: RegExp[];
  private excludePatterns: RegExp[];
  private dropPrefixes: string[];
  private allowParams: string[];

  constructor(options: UrlFilterOptions = {}) {
    this.includePatterns = (options.include || []).map(globToRegex);
    this.excludePatterns = (options.exclude || []).map(globToRegex);
    this.dropPrefixes = options.drop_query_prefixes || [];
    this.allowParams = options.allow_query_params || [];
  }

  /**
   * Check if a URL should be crawled based on include/exclude patterns
   */
  shouldCrawl(url: string): boolean {
    const pathname = this.getPathname(url);

    // If include patterns exist, URL must match at least one
    if (this.includePatterns.length > 0) {
      const included = this.includePatterns.some(pattern => pattern.test(pathname));
      if (!included) return false;
    }

    // Check exclude patterns
    if (this.excludePatterns.length > 0) {
      const excluded = this.excludePatterns.some(pattern => pattern.test(pathname));
      if (excluded) return false;
    }

    return true;
  }

  /**
   * Normalize URL by stripping/filtering query params
   */
  normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const params = new URLSearchParams();

      for (const [key, value] of parsed.searchParams) {
        // Check if should drop (matches prefix)
        const shouldDrop = this.dropPrefixes.some(prefix => key.startsWith(prefix));
        if (shouldDrop) continue;

        // If allow list exists, only keep allowed params
        if (this.allowParams.length > 0) {
          if (!this.allowParams.includes(key)) continue;
        }

        params.set(key, value);
      }

      const search = params.toString();
      return `${parsed.origin}${parsed.pathname}${search ? '?' + search : ''}`;
    } catch {
      return url;
    }
  }

  private getPathname(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
}
```

### Step 4: Run tests

```bash
npm test src/crawler/url-filter.test.ts
```

Expected: PASS

### Step 5: Commit

```bash
git add src/crawler/url-filter.ts src/crawler/url-filter.test.ts
git commit -m "feat: add URL filter for include/exclude patterns and query params

- Glob pattern matching for URL paths
- Support for ** (any), * (segment), ? (char)
- Query param stripping by prefix
- Query param allow-list filtering

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Integrate URL Filter into Crawler

**Files:**
- Modify: `src/crawler/crawler.ts`

### Step 1: Import and use URL filter

Add to crawler:

```typescript
import { UrlFilter } from './url-filter.js';

// In Crawler class constructor or crawl method:
const urlFilter = new UrlFilter({
  include: config.crawler.include,
  exclude: config.crawler.exclude,
  drop_query_prefixes: config.crawler.drop_query_prefixes,
  allow_query_params: config.crawler.allow_query_params,
});

// When adding URLs to queue:
if (!urlFilter.shouldCrawl(url)) {
  continue; // Skip this URL
}

// When normalizing URLs for deduplication:
const normalizedUrl = urlFilter.normalizeUrl(url);
```

### Step 2: Commit

```bash
git add src/crawler/crawler.ts
git commit -m "feat: integrate URL filter into crawler

- Apply include/exclude patterns when discovering URLs
- Normalize URLs with query param filtering
- Strip tracking params (utm_, gclid, fbclid) by default

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add HTML Reporter

**Files:**
- Create: `src/reporters/html-reporter.ts`

### Step 1: Create HTML reporter

```typescript
// src/reporters/html-reporter.ts
import type { AuditReport, RuleResult } from '../types.js';

export function generateHtmlReport(report: AuditReport): string {
  const { url, timestamp, score, categoryResults, ruleResults } = report;

  const failures = ruleResults.filter(r => r.status === 'fail');
  const warnings = ruleResults.filter(r => r.status === 'warn');
  const passed = ruleResults.filter(r => r.status === 'pass');

  const scoreClass = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'needs-work' : 'poor';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit Report - ${url}</title>
  <style>
    :root {
      --color-pass: #22c55e;
      --color-warn: #eab308;
      --color-fail: #ef4444;
      --color-bg: #f8fafc;
      --color-card: #ffffff;
      --color-text: #1e293b;
      --color-muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .meta { color: var(--color-muted); margin-bottom: 2rem; }
    .score-card {
      background: var(--color-card);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      text-align: center;
    }
    .score {
      font-size: 4rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .score.excellent { color: var(--color-pass); }
    .score.good { color: #22c55e; }
    .score.needs-work { color: var(--color-warn); }
    .score.poor { color: var(--color-fail); }
    .score-label { font-size: 1.25rem; color: var(--color-muted); }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-item {
      background: var(--color-card);
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary-number { font-size: 2rem; font-weight: 700; }
    .summary-label { color: var(--color-muted); }
    .pass .summary-number { color: var(--color-pass); }
    .warn .summary-number { color: var(--color-warn); }
    .fail .summary-number { color: var(--color-fail); }
    .section {
      background: var(--color-card);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .rule {
      padding: 1rem;
      margin-bottom: 0.5rem;
      border-radius: 8px;
      background: #f8fafc;
    }
    .rule-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .rule-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .rule-status.pass { background: var(--color-pass); }
    .rule-status.warn { background: var(--color-warn); }
    .rule-status.fail { background: var(--color-fail); }
    .rule-name { font-weight: 600; }
    .rule-category { color: var(--color-muted); font-size: 0.875rem; }
    .rule-message { color: var(--color-muted); }
    .categories {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
    }
    .category {
      background: #f8fafc;
      border-radius: 8px;
      padding: 1rem;
    }
    .category-name { font-weight: 600; margin-bottom: 0.25rem; }
    .category-score { color: var(--color-muted); }
    footer {
      text-align: center;
      color: var(--color-muted);
      margin-top: 2rem;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>SEO Audit Report</h1>
    <p class="meta">${url} &bull; ${new Date(timestamp).toLocaleString()}</p>

    <div class="score-card">
      <div class="score ${scoreClass}">${score}</div>
      <div class="score-label">${scoreClass === 'excellent' ? 'Excellent' : scoreClass === 'good' ? 'Good' : scoreClass === 'needs-work' ? 'Needs Work' : 'Poor'}</div>
    </div>

    <div class="summary">
      <div class="summary-item pass">
        <div class="summary-number">${passed.length}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-item warn">
        <div class="summary-number">${warnings.length}</div>
        <div class="summary-label">Warnings</div>
      </div>
      <div class="summary-item fail">
        <div class="summary-number">${failures.length}</div>
        <div class="summary-label">Failed</div>
      </div>
    </div>

    <div class="section">
      <h2>Categories</h2>
      <div class="categories">
        ${categoryResults.map(cat => `
          <div class="category">
            <div class="category-name">${cat.name}</div>
            <div class="category-score">${cat.score}/100 &bull; ${cat.passed} passed, ${cat.warnings} warnings, ${cat.failures} failed</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${failures.length > 0 ? `
    <div class="section">
      <h2>Failures (${failures.length})</h2>
      ${failures.map(r => renderRule(r, 'fail')).join('')}
    </div>
    ` : ''}

    ${warnings.length > 0 ? `
    <div class="section">
      <h2>Warnings (${warnings.length})</h2>
      ${warnings.map(r => renderRule(r, 'warn')).join('')}
    </div>
    ` : ''}

    <footer>
      Generated by SEOmator v2.0 &bull; ${new Date().toISOString().split('T')[0]}
    </footer>
  </div>
</body>
</html>`;
}

function renderRule(rule: RuleResult, status: string): string {
  return `
    <div class="rule">
      <div class="rule-header">
        <div class="rule-status ${status}"></div>
        <span class="rule-name">${rule.ruleId}</span>
        <span class="rule-category">${rule.category}</span>
      </div>
      <div class="rule-message">${rule.message}</div>
    </div>
  `;
}
```

### Step 2: Commit

```bash
git add src/reporters/html-reporter.ts
git commit -m "feat: add HTML reporter for visual audit reports

- Score card with color-coded status
- Summary stats (passed, warnings, failures)
- Category breakdown grid
- Detailed failures and warnings sections
- Responsive design, no external dependencies

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Markdown Reporter

**Files:**
- Create: `src/reporters/markdown-reporter.ts`

### Step 1: Create Markdown reporter

```typescript
// src/reporters/markdown-reporter.ts
import type { AuditReport, RuleResult } from '../types.js';

export function generateMarkdownReport(report: AuditReport): string {
  const { url, timestamp, score, categoryResults, ruleResults } = report;

  const failures = ruleResults.filter(r => r.status === 'fail');
  const warnings = ruleResults.filter(r => r.status === 'warn');
  const passed = ruleResults.filter(r => r.status === 'pass');

  const scoreLabel = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Poor';

  let md = `# SEO Audit Report

**URL:** ${url}
**Date:** ${new Date(timestamp).toLocaleString()}
**Score:** ${score}/100 (${scoreLabel})

---

## Summary

| Metric | Count |
|--------|-------|
| Passed | ${passed.length} |
| Warnings | ${warnings.length} |
| Failures | ${failures.length} |
| Total | ${ruleResults.length} |

---

## Categories

| Category | Score | Passed | Warnings | Failures |
|----------|-------|--------|----------|----------|
${categoryResults.map(cat =>
  `| ${cat.name} | ${cat.score} | ${cat.passed} | ${cat.warnings} | ${cat.failures} |`
).join('\n')}

`;

  if (failures.length > 0) {
    md += `---

## Failures

${failures.map(r => `### ${r.ruleId}

**Category:** ${r.category}

${r.message}

`).join('')}`;
  }

  if (warnings.length > 0) {
    md += `---

## Warnings

${warnings.map(r => `### ${r.ruleId}

**Category:** ${r.category}

${r.message}

`).join('')}`;
  }

  md += `---

*Generated by SEOmator v2.0*
`;

  return md;
}
```

### Step 2: Commit

```bash
git add src/reporters/markdown-reporter.ts
git commit -m "feat: add Markdown reporter for documentation-friendly output

- Summary table with counts
- Category breakdown table
- Failures and warnings sections
- Clean Markdown formatting

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Integrate New Reporters into CLI

**Files:**
- Modify: `src/reporters/index.ts`
- Modify: `src/commands/audit.ts`
- Modify: `src/cli.ts`

### Step 1: Export new reporters

```typescript
// src/reporters/index.ts
export * from './console-reporter.js';
export * from './json-reporter.js';
export * from './html-reporter.js';
export * from './markdown-reporter.js';
```

### Step 2: Update audit command

Add format handling in `src/commands/audit.ts`:

```typescript
import { generateHtmlReport } from '../reporters/html-reporter.js';
import { generateMarkdownReport } from '../reporters/markdown-reporter.js';

// In runAudit function, after generating report:
switch (options.format) {
  case 'json':
    console.log(JSON.stringify(report, null, 2));
    break;
  case 'html':
    const html = generateHtmlReport(report);
    if (options.output) {
      fs.writeFileSync(options.output, html);
      console.log(`Report saved to ${options.output}`);
    } else {
      console.log(html);
    }
    break;
  case 'markdown':
  case 'md':
    const md = generateMarkdownReport(report);
    if (options.output) {
      fs.writeFileSync(options.output, md);
      console.log(`Report saved to ${options.output}`);
    } else {
      console.log(md);
    }
    break;
  default:
    // table format (default)
    printTableReport(report);
}
```

### Step 3: Update CLI options

Add `--format` and `--output` to audit command in `src/cli.ts`:

```typescript
.option('--format <type>', 'Output format (table, json, html, markdown)', 'table')
.option('-o, --output <path>', 'Output file path')
```

### Step 4: Commit

```bash
git add src/reporters/index.ts src/commands/audit.ts src/cli.ts
git commit -m "feat: integrate HTML and Markdown reporters into CLI

- Add --format option (table, json, html, markdown)
- Add --output option for file output
- Export new reporters from index

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Update Documentation

**Files:**
- Modify: `CLAUDE.md`

### Step 1: Update CLAUDE.md

Add new config options and commands to documentation:

- Document `config validate`, `config show`, `config path` commands
- Document `--format` option with all formats
- Document `--output` option
- Document crawler.exclude, crawler.include patterns
- Document query param handling options

### Step 2: Commit

```bash
git add CLAUDE.md
git commit -m "docs: update documentation for Phase 2 features

- Config validation and show commands
- URL filtering (include/exclude patterns)
- Query param handling
- HTML and Markdown output formats

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Update Package Version

**Files:**
- Modify: `package.json`

### Step 1: Bump version to 2.1.0

```bash
npm version minor --no-git-tag-version
```

### Step 2: Commit

```bash
git add package.json
git commit -m "chore: bump version to 2.1.0

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Integration Testing

### Step 1: Build and test

```bash
npm run build
npm run test:run
```

### Step 2: Test config commands

```bash
./dist/cli.js config validate
./dist/cli.js config show
./dist/cli.js config path
```

### Step 3: Test output formats

```bash
./dist/cli.js audit https://example.com --no-cwv --format html -o report.html
./dist/cli.js audit https://example.com --no-cwv --format markdown -o report.md
./dist/cli.js audit https://example.com --no-cwv --format json
```

### Step 4: Test URL filtering

Create test config with exclude patterns:

```toml
[crawler]
exclude = ["/admin/*", "*.pdf"]
```

Run crawl and verify excluded URLs are skipped.

---

## Verification Checklist

```bash
# Build
npm run build

# All tests pass
npm run test:run

# Config commands work
./dist/cli.js config validate
./dist/cli.js config show
./dist/cli.js config path

# Output formats work
./dist/cli.js audit https://example.com --no-cwv --format html -o test.html
./dist/cli.js audit https://example.com --no-cwv --format markdown -o test.md
./dist/cli.js audit https://example.com --no-cwv --format json

# Help shows new options
./dist/cli.js audit --help
./dist/cli.js config --help
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Config validate command |
| 2 | URL exclude/include patterns in schema |
| 3 | URL filter module with tests |
| 4 | Integrate URL filter into crawler |
| 5 | HTML reporter |
| 6 | Markdown reporter |
| 7 | Integrate reporters into CLI |
| 8 | Update documentation |
| 9 | Bump version to 2.1.0 |
| 10 | Integration testing |

**New commands:**
- `seomator config validate`
- `seomator config show`
- `seomator config path`

**New options:**
- `--format <table|json|html|markdown>`
- `--output <path>`

**New config fields:**
- `crawler.include` - URL patterns to include
- `crawler.exclude` - URL patterns to exclude
- `crawler.drop_query_prefixes` - Query params to strip
- `crawler.allow_query_params` - Query params to preserve
- `crawler.user_agent` - Custom user agent
