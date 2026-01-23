# Phase 1: Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add professional CLI infrastructure with config files, multiple commands, and storage system.

**Architecture:** TOML config file searched up directory tree, SQLite for link cache, JSON files for crawl/report storage. Commander.js subcommands for `audit`, `init`, `crawl`, `analyze`, `report`, `config`.

**Tech Stack:** TypeScript, Commander.js, @iarna/toml, better-sqlite3, Cheerio, Playwright

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install TOML parser and SQLite**

Run:
```bash
npm install @iarna/toml better-sqlite3
npm install -D @types/better-sqlite3
```

**Step 2: Verify installation**

Run: `npm ls @iarna/toml better-sqlite3`
Expected: Both packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add toml and sqlite dependencies"
```

---

## Task 2: Config Schema & Types

**Files:**
- Create: `src/config/schema.ts`

**Step 1: Write the config type definitions**

```typescript
/**
 * Project configuration section
 */
export interface ProjectConfig {
  name: string;
  domains: string[];
}

/**
 * Crawler configuration section
 */
export interface CrawlerConfig {
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
}

/**
 * Rules configuration section
 */
export interface RulesConfig {
  enable: string[];
  disable: string[];
}

/**
 * External links configuration section
 */
export interface ExternalLinksConfig {
  enabled: boolean;
  cache_ttl_days: number;
  timeout_ms: number;
  concurrency: number;
}

/**
 * Output configuration section
 */
export interface OutputConfig {
  format: 'console' | 'json' | 'html';
  path: string;
}

/**
 * Complete SEOmator configuration
 */
export interface SeomatorConfig {
  project: ProjectConfig;
  crawler: CrawlerConfig;
  rules: RulesConfig;
  external_links: ExternalLinksConfig;
  output: OutputConfig;
  rule_options: Record<string, Record<string, unknown>>;
}

/**
 * Partial config for merging
 */
export type PartialSeomatorConfig = {
  project?: Partial<ProjectConfig>;
  crawler?: Partial<CrawlerConfig>;
  rules?: Partial<RulesConfig>;
  external_links?: Partial<ExternalLinksConfig>;
  output?: Partial<OutputConfig>;
  rule_options?: Record<string, Record<string, unknown>>;
};
```

**Step 2: Commit**

```bash
git add src/config/schema.ts
git commit -m "feat(config): add config type definitions"
```

---

## Task 3: Config Defaults

**Files:**
- Create: `src/config/defaults.ts`
- Test: `src/config/defaults.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from './defaults.js';

describe('getDefaultConfig', () => {
  it('should return complete default config', () => {
    const config = getDefaultConfig();

    expect(config.project.name).toBe('');
    expect(config.project.domains).toEqual([]);
    expect(config.crawler.max_pages).toBe(100);
    expect(config.crawler.concurrency).toBe(3);
    expect(config.rules.enable).toEqual(['*']);
    expect(config.rules.disable).toEqual([]);
    expect(config.external_links.enabled).toBe(true);
    expect(config.output.format).toBe('console');
  });

  it('should return a new object each time', () => {
    const config1 = getDefaultConfig();
    const config2 = getDefaultConfig();
    expect(config1).not.toBe(config2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/config/defaults.test.ts`
Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
import type { SeomatorConfig } from './schema.js';

/**
 * Get default configuration values
 */
export function getDefaultConfig(): SeomatorConfig {
  return {
    project: {
      name: '',
      domains: [],
    },
    crawler: {
      max_pages: 100,
      delay_ms: 100,
      timeout_ms: 30000,
      concurrency: 3,
      per_host_concurrency: 2,
      per_host_delay_ms: 200,
      include: [],
      exclude: [],
      allow_query_params: [],
      drop_query_prefixes: ['utm_', 'gclid', 'fbclid', 'mc_', '_ga'],
      respect_robots: true,
      breadth_first: true,
      follow_redirects: true,
    },
    rules: {
      enable: ['*'],
      disable: [],
    },
    external_links: {
      enabled: true,
      cache_ttl_days: 7,
      timeout_ms: 10000,
      concurrency: 5,
    },
    output: {
      format: 'console',
      path: '',
    },
    rule_options: {},
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/config/defaults.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/defaults.ts src/config/defaults.test.ts
git commit -m "feat(config): add default config values"
```

---

## Task 4: Storage Paths

**Files:**
- Create: `src/storage/paths.ts`
- Test: `src/storage/paths.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGlobalDir, getProjectDir, getCrawlsDir, getReportsDir } from './paths.js';
import * as os from 'os';
import * as path from 'path';

describe('paths', () => {
  describe('getGlobalDir', () => {
    it('should return ~/.seomator on Unix', () => {
      const globalDir = getGlobalDir();
      expect(globalDir).toBe(path.join(os.homedir(), '.seomator'));
    });
  });

  describe('getProjectDir', () => {
    it('should return .seomator in given directory', () => {
      const projectDir = getProjectDir('/some/project');
      expect(projectDir).toBe('/some/project/.seomator');
    });
  });

  describe('getCrawlsDir', () => {
    it('should return crawls subdirectory', () => {
      const crawlsDir = getCrawlsDir('/some/project');
      expect(crawlsDir).toBe('/some/project/.seomator/crawls');
    });
  });

  describe('getReportsDir', () => {
    it('should return reports subdirectory', () => {
      const reportsDir = getReportsDir('/some/project');
      expect(reportsDir).toBe('/some/project/.seomator/reports');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/storage/paths.test.ts`
Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
import * as os from 'os';
import * as path from 'path';

/**
 * Get global seomator directory (~/.seomator)
 */
export function getGlobalDir(): string {
  return path.join(os.homedir(), '.seomator');
}

/**
 * Get global settings file path
 */
export function getGlobalSettingsPath(): string {
  return path.join(getGlobalDir(), 'settings.json');
}

/**
 * Get global link cache database path
 */
export function getLinkCachePath(): string {
  return path.join(getGlobalDir(), 'link-cache.db');
}

/**
 * Get project seomator directory (.seomator)
 */
export function getProjectDir(baseDir: string): string {
  return path.join(baseDir, '.seomator');
}

/**
 * Get project settings file path
 */
export function getProjectSettingsPath(baseDir: string): string {
  return path.join(getProjectDir(baseDir), 'settings.json');
}

/**
 * Get crawls directory
 */
export function getCrawlsDir(baseDir: string): string {
  return path.join(getProjectDir(baseDir), 'crawls');
}

/**
 * Get reports directory
 */
export function getReportsDir(baseDir: string): string {
  return path.join(getProjectDir(baseDir), 'reports');
}

/**
 * Generate a unique ID for crawls/reports
 * Format: YYYY-MM-DD-xxxxxx
 */
export function generateId(): string {
  const date = new Date().toISOString().split('T')[0];
  const hash = Math.random().toString(36).substring(2, 8);
  return `${date}-${hash}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/storage/paths.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/storage/paths.ts src/storage/paths.test.ts
git commit -m "feat(storage): add path resolution utilities"
```

---

## Task 5: Config Loader

**Files:**
- Create: `src/config/loader.ts`
- Test: `src/config/loader.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findConfigFile, loadConfig, mergeConfigs } from './loader.js';
import { getDefaultConfig } from './defaults.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('mergeConfigs', () => {
  it('should merge partial config with defaults', () => {
    const defaults = getDefaultConfig();
    const partial = {
      project: { name: 'my-site' },
      crawler: { max_pages: 50 },
    };

    const merged = mergeConfigs(defaults, partial);

    expect(merged.project.name).toBe('my-site');
    expect(merged.project.domains).toEqual([]);
    expect(merged.crawler.max_pages).toBe(50);
    expect(merged.crawler.concurrency).toBe(3);
  });
});

describe('findConfigFile', () => {
  const testDir = path.join(os.tmpdir(), 'seomator-test-' + Date.now());
  const subDir = path.join(testDir, 'sub', 'dir');

  beforeEach(() => {
    fs.mkdirSync(subDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should find seomator.toml in current directory', () => {
    fs.writeFileSync(path.join(testDir, 'seomator.toml'), '[project]\nname = "test"');

    const found = findConfigFile(testDir);
    expect(found).toBe(path.join(testDir, 'seomator.toml'));
  });

  it('should find seomator.toml in parent directory', () => {
    fs.writeFileSync(path.join(testDir, 'seomator.toml'), '[project]\nname = "test"');

    const found = findConfigFile(subDir);
    expect(found).toBe(path.join(testDir, 'seomator.toml'));
  });

  it('should return null if no config found', () => {
    const found = findConfigFile(subDir);
    expect(found).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/config/loader.test.ts`
Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as TOML from '@iarna/toml';
import type { SeomatorConfig, PartialSeomatorConfig } from './schema.js';
import { getDefaultConfig } from './defaults.js';
import { getGlobalSettingsPath, getProjectSettingsPath } from '../storage/paths.js';

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Merge partial config with base config
 */
export function mergeConfigs(
  base: SeomatorConfig,
  partial: PartialSeomatorConfig
): SeomatorConfig {
  return deepMerge(base, partial as Partial<SeomatorConfig>);
}

/**
 * Find seomator.toml by searching up directory tree
 */
export function findConfigFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const homeDir = os.homedir();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const configPath = path.join(currentDir, 'seomator.toml');

    if (fs.existsSync(configPath)) {
      return configPath;
    }

    // Stop at home directory
    if (currentDir === homeDir) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Parse TOML config file
 */
export function parseConfigFile(filePath: string): PartialSeomatorConfig {
  const content = fs.readFileSync(filePath, 'utf-8');
  return TOML.parse(content) as PartialSeomatorConfig;
}

/**
 * Load JSON settings file
 */
function loadJsonSettings(filePath: string): PartialSeomatorConfig {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Load complete config with priority:
 * 1. Built-in defaults
 * 2. Global settings (~/.seomator/settings.json)
 * 3. TOML config file (searched up directory tree)
 * 4. Local settings (.seomator/settings.json)
 * 5. CLI overrides (passed as parameter)
 */
export function loadConfig(
  startDir: string = process.cwd(),
  cliOverrides: PartialSeomatorConfig = {}
): { config: SeomatorConfig; configPath: string | null } {
  // Start with defaults
  let config = getDefaultConfig();

  // Merge global settings
  const globalSettings = loadJsonSettings(getGlobalSettingsPath());
  config = mergeConfigs(config, globalSettings);

  // Find and merge TOML config
  const configPath = findConfigFile(startDir);
  if (configPath) {
    const tomlConfig = parseConfigFile(configPath);
    config = mergeConfigs(config, tomlConfig);
  }

  // Merge local project settings
  const projectSettings = loadJsonSettings(getProjectSettingsPath(startDir));
  config = mergeConfigs(config, projectSettings);

  // Merge CLI overrides
  config = mergeConfigs(config, cliOverrides);

  return { config, configPath };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/config/loader.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/loader.ts src/config/loader.test.ts
git commit -m "feat(config): add config file loader with directory traversal"
```

---

## Task 6: Config Writer

**Files:**
- Create: `src/config/writer.ts`

**Step 1: Write the implementation**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import type { SeomatorConfig, PartialSeomatorConfig } from './schema.js';

/**
 * Config presets for different use cases
 */
export type ConfigPreset = 'default' | 'blog' | 'ecommerce' | 'ci';

/**
 * Get preset configuration
 */
export function getPresetConfig(preset: ConfigPreset): PartialSeomatorConfig {
  switch (preset) {
    case 'blog':
      return {
        crawler: {
          max_pages: 500,
          exclude: ['/wp-admin/**', '/wp-content/uploads/**', '*.pdf'],
        },
        rule_options: {
          'meta-tags/description-length': { min_length: 120, max_length: 160 },
        },
      };

    case 'ecommerce':
      return {
        crawler: {
          max_pages: 1000,
          include: ['/products/**', '/categories/**', '/collections/**'],
          exclude: ['/cart/**', '/checkout/**', '/account/**', '*.pdf'],
          allow_query_params: ['category', 'sort', 'filter', 'page'],
        },
      };

    case 'ci':
      return {
        crawler: {
          max_pages: 100,
          delay_ms: 0,
          respect_robots: false,
        },
        rules: {
          enable: ['meta-tags/*', 'security/*', 'links/*'],
          disable: [],
        },
        external_links: {
          enabled: false,
          cache_ttl_days: 7,
          timeout_ms: 10000,
          concurrency: 5,
        },
        output: {
          format: 'json',
          path: 'reports/audit.json',
        },
      };

    default:
      return {};
  }
}

/**
 * Generate TOML config string
 */
export function generateTomlConfig(config: PartialSeomatorConfig): string {
  // TOML.stringify expects JsonMap, cast appropriately
  return TOML.stringify(config as TOML.JsonMap);
}

/**
 * Write config to file
 */
export function writeConfigFile(filePath: string, config: PartialSeomatorConfig): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = generateTomlConfig(config);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Write JSON settings file
 */
export function writeSettingsFile(filePath: string, settings: PartialSeomatorConfig): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}
```

**Step 2: Commit**

```bash
git add src/config/writer.ts
git commit -m "feat(config): add config writer with presets"
```

---

## Task 7: Config Index

**Files:**
- Create: `src/config/index.ts`

**Step 1: Write barrel export**

```typescript
export * from './schema.js';
export * from './defaults.js';
export * from './loader.js';
export * from './writer.js';
```

**Step 2: Commit**

```bash
git add src/config/index.ts
git commit -m "feat(config): add barrel export"
```

---

## Task 8: Crawl Store

**Files:**
- Create: `src/storage/crawl-store.ts`
- Test: `src/storage/crawl-store.test.ts`

**Step 1: Write the types and failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveCrawl, loadCrawl, listCrawls, getLatestCrawl } from './crawl-store.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('crawl-store', () => {
  const testDir = path.join(os.tmpdir(), 'seomator-crawl-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should save and load a crawl', () => {
    const crawl = {
      id: '2025-01-23-abc123',
      url: 'https://example.com',
      project: 'test',
      timestamp: new Date().toISOString(),
      config: {},
      pages: [],
      stats: { totalPages: 0, duration: 0, errorCount: 0 },
    };

    saveCrawl(testDir, crawl);
    const loaded = loadCrawl(testDir, crawl.id);

    expect(loaded).toEqual(crawl);
  });

  it('should list all crawls', () => {
    const crawl1 = {
      id: '2025-01-23-aaa111',
      url: 'https://example.com',
      project: 'test',
      timestamp: '2025-01-23T10:00:00Z',
      config: {},
      pages: [],
      stats: { totalPages: 0, duration: 0, errorCount: 0 },
    };
    const crawl2 = {
      id: '2025-01-23-bbb222',
      url: 'https://example.com',
      project: 'test',
      timestamp: '2025-01-23T11:00:00Z',
      config: {},
      pages: [],
      stats: { totalPages: 0, duration: 0, errorCount: 0 },
    };

    saveCrawl(testDir, crawl1);
    saveCrawl(testDir, crawl2);

    const list = listCrawls(testDir);
    expect(list).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/storage/crawl-store.test.ts`
Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { PartialSeomatorConfig } from '../config/schema.js';
import type { CoreWebVitals } from '../types.js';
import { getCrawlsDir, generateId } from './paths.js';

/**
 * Stored page data from a crawl
 */
export interface StoredPage {
  url: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  depth: number;
  loadTime: number;
  cwv?: CoreWebVitals;
}

/**
 * Stored crawl data
 */
export interface StoredCrawl {
  id: string;
  url: string;
  project: string;
  timestamp: string;
  config: PartialSeomatorConfig;
  pages: StoredPage[];
  stats: {
    totalPages: number;
    duration: number;
    errorCount: number;
  };
}

/**
 * Crawl summary for listing
 */
export interface CrawlSummary {
  id: string;
  url: string;
  project: string;
  timestamp: string;
  totalPages: number;
}

/**
 * Ensure crawls directory exists
 */
function ensureCrawlsDir(baseDir: string): string {
  const crawlsDir = getCrawlsDir(baseDir);
  if (!fs.existsSync(crawlsDir)) {
    fs.mkdirSync(crawlsDir, { recursive: true });
  }
  return crawlsDir;
}

/**
 * Save a crawl to disk
 */
export function saveCrawl(baseDir: string, crawl: StoredCrawl): string {
  const crawlsDir = ensureCrawlsDir(baseDir);
  const filePath = path.join(crawlsDir, `${crawl.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(crawl, null, 2), 'utf-8');
  return crawl.id;
}

/**
 * Load a crawl from disk
 */
export function loadCrawl(baseDir: string, id: string): StoredCrawl | null {
  const crawlsDir = getCrawlsDir(baseDir);
  const filePath = path.join(crawlsDir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * List all crawls
 */
export function listCrawls(baseDir: string): CrawlSummary[] {
  const crawlsDir = getCrawlsDir(baseDir);

  if (!fs.existsSync(crawlsDir)) {
    return [];
  }

  const files = fs.readdirSync(crawlsDir).filter(f => f.endsWith('.json'));
  const summaries: CrawlSummary[] = [];

  for (const file of files) {
    const filePath = path.join(crawlsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const crawl: StoredCrawl = JSON.parse(content);

    summaries.push({
      id: crawl.id,
      url: crawl.url,
      project: crawl.project,
      timestamp: crawl.timestamp,
      totalPages: crawl.stats.totalPages,
    });
  }

  // Sort by timestamp descending
  return summaries.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Get the most recent crawl
 */
export function getLatestCrawl(baseDir: string): StoredCrawl | null {
  const list = listCrawls(baseDir);
  if (list.length === 0) {
    return null;
  }
  return loadCrawl(baseDir, list[0].id);
}

/**
 * Create a new crawl record
 */
export function createCrawl(
  url: string,
  project: string,
  config: PartialSeomatorConfig
): StoredCrawl {
  return {
    id: generateId(),
    url,
    project,
    timestamp: new Date().toISOString(),
    config,
    pages: [],
    stats: {
      totalPages: 0,
      duration: 0,
      errorCount: 0,
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/storage/crawl-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/storage/crawl-store.ts src/storage/crawl-store.test.ts
git commit -m "feat(storage): add crawl data persistence"
```

---

## Task 9: Report Store

**Files:**
- Create: `src/storage/report-store.ts`

**Step 1: Write the implementation**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { PartialSeomatorConfig } from '../config/schema.js';
import type { CategoryResult } from '../types.js';
import { getReportsDir, generateId } from './paths.js';

/**
 * Stored report data
 */
export interface StoredReport {
  id: string;
  crawlId: string;
  url: string;
  project: string;
  timestamp: string;
  config: PartialSeomatorConfig;
  overallScore: number;
  categoryResults: CategoryResult[];
  stats: {
    totalRules: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

/**
 * Report summary for listing
 */
export interface ReportSummary {
  id: string;
  crawlId: string;
  url: string;
  project: string;
  timestamp: string;
  overallScore: number;
}

/**
 * Ensure reports directory exists
 */
function ensureReportsDir(baseDir: string): string {
  const reportsDir = getReportsDir(baseDir);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

/**
 * Save a report to disk
 */
export function saveReport(baseDir: string, report: StoredReport): string {
  const reportsDir = ensureReportsDir(baseDir);
  const filePath = path.join(reportsDir, `${report.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return report.id;
}

/**
 * Load a report from disk
 */
export function loadReport(baseDir: string, id: string): StoredReport | null {
  const reportsDir = getReportsDir(baseDir);
  const filePath = path.join(reportsDir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * List all reports with optional filtering
 */
export function listReports(
  baseDir: string,
  options: {
    project?: string;
    since?: Date;
  } = {}
): ReportSummary[] {
  const reportsDir = getReportsDir(baseDir);

  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
  const summaries: ReportSummary[] = [];

  for (const file of files) {
    const filePath = path.join(reportsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const report: StoredReport = JSON.parse(content);

    // Apply filters
    if (options.project && report.project !== options.project) {
      continue;
    }
    if (options.since && new Date(report.timestamp) < options.since) {
      continue;
    }

    summaries.push({
      id: report.id,
      crawlId: report.crawlId,
      url: report.url,
      project: report.project,
      timestamp: report.timestamp,
      overallScore: report.overallScore,
    });
  }

  // Sort by timestamp descending
  return summaries.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Get the most recent report
 */
export function getLatestReport(baseDir: string): StoredReport | null {
  const list = listReports(baseDir);
  if (list.length === 0) {
    return null;
  }
  return loadReport(baseDir, list[0].id);
}

/**
 * Create a new report from audit results
 */
export function createReport(
  crawlId: string,
  url: string,
  project: string,
  config: PartialSeomatorConfig,
  overallScore: number,
  categoryResults: CategoryResult[]
): StoredReport {
  // Calculate stats
  let passed = 0;
  let warnings = 0;
  let failed = 0;

  for (const cat of categoryResults) {
    passed += cat.passCount;
    warnings += cat.warnCount;
    failed += cat.failCount;
  }

  return {
    id: generateId(),
    crawlId,
    url,
    project,
    timestamp: new Date().toISOString(),
    config,
    overallScore,
    categoryResults,
    stats: {
      totalRules: passed + warnings + failed,
      passed,
      warnings,
      failed,
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/storage/report-store.ts
git commit -m "feat(storage): add report data persistence"
```

---

## Task 10: Storage Index

**Files:**
- Create: `src/storage/index.ts`

**Step 1: Write barrel export**

```typescript
export * from './paths.js';
export * from './crawl-store.js';
export * from './report-store.js';
```

**Step 2: Commit**

```bash
git add src/storage/index.ts
git commit -m "feat(storage): add barrel export"
```

---

## Task 11: Extract Audit Command

**Files:**
- Create: `src/commands/audit.ts`

**Step 1: Extract audit logic from cli.ts**

```typescript
import chalk from 'chalk';
import type { Command } from 'commander';
import { Auditor } from '../auditor.js';
import { categories } from '../categories/index.js';
import { ProgressReporter, renderTerminalReport, outputJsonReport } from '../reporters/index.js';
import { loadConfig } from '../config/index.js';
import { saveReport, createReport } from '../storage/index.js';

export interface AuditOptions {
  categories?: string[];
  json: boolean;
  crawl: boolean;
  maxPages: number;
  concurrency: number;
  timeout: number;
  verbose: boolean;
  cwv: boolean;
  config?: string;
  save: boolean;
}

export async function runAudit(url: string, options: AuditOptions): Promise<void> {
  const isJsonMode = options.json;
  const isCrawlMode = options.crawl;
  const isVerbose = options.verbose;
  const measureCwv = options.cwv !== false;
  const selectedCategories: string[] = options.categories ?? [];
  const maxPages: number = options.maxPages;
  const concurrency: number = options.concurrency;
  const shouldSave = options.save;

  // Load config
  const { config, configPath } = loadConfig(process.cwd(), {
    crawler: {
      max_pages: maxPages,
      concurrency,
      timeout_ms: options.timeout,
    },
  });

  // Create progress reporter
  const progress = new ProgressReporter({
    json: isJsonMode,
    crawl: isCrawlMode,
    verbose: isVerbose,
  });

  try {
    // Start progress display
    progress.start(url);

    // Create auditor with options and callbacks
    const auditor = new Auditor({
      categories: selectedCategories,
      timeout: config.crawler.timeout_ms,
      measureCwv,
      onCategoryStart: (categoryId, categoryName) => {
        progress.onCategoryStart(categoryId, categoryName);
      },
      onCategoryComplete: (categoryId, categoryName, result) => {
        progress.onCategoryComplete(categoryId, categoryName, result);
      },
      onRuleComplete: (ruleId, ruleName, result) => {
        progress.onRuleComplete(ruleId, ruleName, result);
      },
      onPageComplete: (pageUrl, pageNumber, totalPages) => {
        progress.onPageComplete(pageUrl, pageNumber, totalPages);
      },
    });

    let result;

    if (isCrawlMode) {
      progress.startCrawlProgress(config.crawler.max_pages);
      result = await auditor.auditWithCrawl(url, config.crawler.max_pages, config.crawler.concurrency);
    } else {
      result = await auditor.audit(url);
    }

    // Stop any progress indicators
    progress.stop();

    // Save report if requested
    if (shouldSave) {
      const report = createReport(
        '', // No crawl ID for inline audits
        url,
        config.project.name || 'default',
        config,
        result.overallScore,
        result.categoryResults
      );
      saveReport(process.cwd(), report);
    }

    // Output results
    if (isJsonMode) {
      outputJsonReport(result);
    } else {
      renderTerminalReport(result);
    }

    // Exit with appropriate code
    const exitCode = result.overallScore >= 70 ? 0 : 1;
    process.exit(exitCode);
  } catch (error) {
    progress.stop();

    if (!isJsonMode) {
      console.error();
      console.error(chalk.red('Error: ') + (error instanceof Error ? error.message : 'Unknown error'));
      console.error();
    } else {
      const errorOutput = {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(errorOutput, null, 2));
    }

    process.exit(2);
  }
}
```

**Step 2: Commit**

```bash
git add src/commands/audit.ts
git commit -m "feat(commands): extract audit command logic"
```

---

## Task 12: Init Command

**Files:**
- Create: `src/commands/init.ts`

**Step 1: Write the implementation**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { getDefaultConfig, getPresetConfig, writeConfigFile, type ConfigPreset } from '../config/index.js';

export interface InitOptions {
  name?: string;
  preset?: ConfigPreset;
  yes: boolean;
}

async function prompt(question: string, defaultValue: string = ''): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const displayDefault = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`${question}${displayDefault}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function selectPreset(): Promise<ConfigPreset> {
  console.log('\nSelect a preset:');
  console.log('  1. default - Standard configuration');
  console.log('  2. blog - Optimized for blog/content sites');
  console.log('  3. ecommerce - Optimized for e-commerce sites');
  console.log('  4. ci - Minimal config for CI/CD pipelines');

  const choice = await prompt('Enter choice', '1');

  switch (choice) {
    case '2': return 'blog';
    case '3': return 'ecommerce';
    case '4': return 'ci';
    default: return 'default';
  }
}

export async function runInit(options: InitOptions): Promise<void> {
  const configPath = path.join(process.cwd(), 'seomator.toml');

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow('seomator.toml already exists in this directory.'));
    const overwrite = await prompt('Overwrite?', 'n');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }
  }

  let projectName = options.name || '';
  let preset: ConfigPreset = options.preset || 'default';

  if (!options.yes) {
    // Interactive mode
    projectName = await prompt('Project name', path.basename(process.cwd()));
    preset = await selectPreset();
  } else {
    // Use directory name as default project name
    projectName = projectName || path.basename(process.cwd());
  }

  // Build config
  const config = {
    ...getPresetConfig(preset),
    project: {
      name: projectName,
      domains: [],
    },
  };

  // Write config file
  writeConfigFile(configPath, config);

  console.log();
  console.log(chalk.green('Created seomator.toml'));
  console.log();
  console.log('Next steps:');
  console.log('  1. Edit seomator.toml to customize settings');
  console.log('  2. Run: seomator audit <url>');
  console.log();
}
```

**Step 2: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat(commands): add init command"
```

---

## Task 13: Crawl Command

**Files:**
- Create: `src/commands/crawl.ts`

**Step 1: Write the implementation**

```typescript
import chalk from 'chalk';
import { Crawler, fetchPageWithPlaywright, closeBrowser } from '../crawler/index.js';
import { loadConfig } from '../config/index.js';
import { saveCrawl, createCrawl, type StoredPage } from '../storage/index.js';
import { ProgressReporter } from '../reporters/index.js';

export interface CrawlOptions {
  maxPages?: number;
  output?: string;
  verbose: boolean;
}

export async function runCrawl(url: string, options: CrawlOptions): Promise<void> {
  // Load config
  const { config } = loadConfig(process.cwd());

  const maxPages = options.maxPages ?? config.crawler.max_pages;
  const baseDir = options.output ?? process.cwd();

  // Create crawl record
  const crawl = createCrawl(url, config.project.name || 'default', config);

  console.log(chalk.blue('Starting crawl...'));
  console.log(`  URL: ${url}`);
  console.log(`  Max pages: ${maxPages}`);
  console.log();

  const startTime = Date.now();
  let errorCount = 0;

  // Create crawler
  const crawler = new Crawler({
    maxPages,
    concurrency: config.crawler.concurrency,
    timeout: config.crawler.timeout_ms,
    onProgress: (progress) => {
      if (options.verbose) {
        process.stderr.write(`\r  Crawled: ${progress.crawled}/${progress.total} | Current: ${progress.currentUrl.slice(0, 50)}...`);
      }
    },
  });

  try {
    const crawledPages = await crawler.crawl(url, maxPages, config.crawler.concurrency);

    if (options.verbose) {
      process.stderr.write('\n');
    }

    // Convert to stored pages
    for (const page of crawledPages) {
      if (page.error) {
        errorCount++;
        continue;
      }

      const storedPage: StoredPage = {
        url: page.url,
        status: page.context.statusCode,
        html: page.context.html,
        headers: page.context.headers,
        depth: 0, // TODO: Track depth in crawler
        loadTime: page.context.responseTime,
        cwv: page.context.cwv,
      };

      crawl.pages.push(storedPage);
    }

    // Update stats
    crawl.stats = {
      totalPages: crawl.pages.length,
      duration: Date.now() - startTime,
      errorCount,
    };

    // Save crawl
    const crawlId = saveCrawl(baseDir, crawl);

    console.log();
    console.log(chalk.green('Crawl complete!'));
    console.log(`  Pages crawled: ${crawl.pages.length}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Duration: ${(crawl.stats.duration / 1000).toFixed(1)}s`);
    console.log(`  Crawl ID: ${crawlId}`);
    console.log();
    console.log('Run analysis with:');
    console.log(`  seomator analyze ${crawlId}`);
    console.log();
  } catch (error) {
    console.error(chalk.red('Crawl failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(2);
  }
}
```

**Step 2: Commit**

```bash
git add src/commands/crawl.ts
git commit -m "feat(commands): add crawl command"
```

---

## Task 14: Analyze Command

**Files:**
- Create: `src/commands/analyze.ts`

**Step 1: Write the implementation**

```typescript
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { Auditor } from '../auditor.js';
import { loadConfig } from '../config/index.js';
import { loadCrawl, getLatestCrawl, saveReport, createReport, type StoredCrawl } from '../storage/index.js';
import { ProgressReporter, renderTerminalReport, outputJsonReport } from '../reporters/index.js';
import type { AuditContext } from '../types.js';

export interface AnalyzeOptions {
  categories?: string[];
  latest: boolean;
  save: boolean;
  json: boolean;
  verbose: boolean;
}

function createContextFromStoredPage(page: { url: string; html: string; headers: Record<string, string>; status: number; loadTime: number; cwv?: Record<string, number> }): AuditContext {
  const $ = cheerio.load(page.html);

  // Extract links
  const links: AuditContext['links'] = [];
  const baseUrl = new URL(page.url);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    try {
      const linkUrl = new URL(href, page.url);
      const isInternal = linkUrl.hostname === baseUrl.hostname;
      const rel = $(el).attr('rel') || '';
      const isNoFollow = rel.includes('nofollow');

      links.push({ href: linkUrl.href, text, isInternal, isNoFollow });
    } catch {
      // Invalid URL, skip
    }
  });

  // Extract images
  const images: AuditContext['images'] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';

    images.push({
      src,
      alt,
      hasAlt: $(el).attr('alt') !== undefined,
      width: $(el).attr('width'),
      height: $(el).attr('height'),
      isLazyLoaded: $(el).attr('loading') === 'lazy',
    });
  });

  return {
    url: page.url,
    html: page.html,
    $,
    headers: page.headers,
    statusCode: page.status,
    responseTime: page.loadTime,
    cwv: page.cwv || {},
    links,
    images,
  };
}

export async function runAnalyze(crawlId: string | undefined, options: AnalyzeOptions): Promise<void> {
  const { config } = loadConfig(process.cwd());
  const baseDir = process.cwd();

  // Load crawl data
  let crawl: StoredCrawl | null = null;

  if (options.latest || !crawlId) {
    crawl = getLatestCrawl(baseDir);
    if (!crawl) {
      console.error(chalk.red('No crawls found. Run `seomator crawl <url>` first.'));
      process.exit(1);
    }
  } else {
    crawl = loadCrawl(baseDir, crawlId);
    if (!crawl) {
      console.error(chalk.red(`Crawl not found: ${crawlId}`));
      process.exit(1);
    }
  }

  console.log(chalk.blue('Analyzing crawl...'));
  console.log(`  Crawl ID: ${crawl.id}`);
  console.log(`  URL: ${crawl.url}`);
  console.log(`  Pages: ${crawl.pages.length}`);
  console.log();

  const progress = new ProgressReporter({
    json: options.json,
    crawl: true,
    verbose: options.verbose,
  });

  const auditor = new Auditor({
    categories: options.categories,
    measureCwv: false, // CWV already measured during crawl
    onCategoryStart: (id, name) => progress.onCategoryStart(id, name),
    onCategoryComplete: (id, name, result) => progress.onCategoryComplete(id, name, result),
    onRuleComplete: (id, name, result) => progress.onRuleComplete(id, name, result),
  });

  try {
    progress.start(crawl.url);

    // Analyze each page
    const allResults = [];

    for (const page of crawl.pages) {
      const context = createContextFromStoredPage(page);
      const categoryResults = await auditor.runAllCategories(context);
      allResults.push(...categoryResults);
    }

    progress.stop();

    // Build combined result
    const result = {
      url: crawl.url,
      overallScore: 0,
      categoryResults: allResults,
      timestamp: new Date().toISOString(),
      crawledPages: crawl.pages.length,
    };

    // Calculate overall score (simplified)
    if (allResults.length > 0) {
      const totalScore = allResults.reduce((sum, r) => sum + r.score, 0);
      result.overallScore = Math.round(totalScore / allResults.length);
    }

    // Save report if requested
    if (options.save) {
      const report = createReport(
        crawl.id,
        crawl.url,
        crawl.project,
        config,
        result.overallScore,
        allResults
      );
      saveReport(baseDir, report);
      console.log(chalk.green(`Report saved: ${report.id}`));
    }

    // Output results
    if (options.json) {
      outputJsonReport(result);
    } else {
      renderTerminalReport(result);
    }

    const exitCode = result.overallScore >= 70 ? 0 : 1;
    process.exit(exitCode);
  } catch (error) {
    progress.stop();
    console.error(chalk.red('Analysis failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(2);
  }
}
```

**Step 2: Commit**

```bash
git add src/commands/analyze.ts
git commit -m "feat(commands): add analyze command"
```

---

## Task 15: Report Command

**Files:**
- Create: `src/commands/report.ts`

**Step 1: Write the implementation**

```typescript
import chalk from 'chalk';
import Table from 'cli-table3';
import { listReports, loadReport } from '../storage/index.js';
import { renderTerminalReport, outputJsonReport } from '../reporters/index.js';

export interface ReportOptions {
  list: boolean;
  project?: string;
  since?: string;
  format: 'table' | 'json';
}

export async function runReport(query: string | undefined, options: ReportOptions): Promise<void> {
  const baseDir = process.cwd();

  if (options.list || !query) {
    // List reports
    const since = options.since ? new Date(options.since) : undefined;
    const reports = listReports(baseDir, {
      project: options.project,
      since,
    });

    if (reports.length === 0) {
      console.log(chalk.yellow('No reports found.'));
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(reports, null, 2));
      return;
    }

    // Table format
    const table = new Table({
      head: ['ID', 'URL', 'Project', 'Score', 'Date'],
      colWidths: [20, 40, 15, 8, 22],
    });

    for (const report of reports) {
      const scoreColor = report.overallScore >= 70 ? chalk.green : chalk.red;
      table.push([
        report.id,
        report.url.slice(0, 38),
        report.project || '-',
        scoreColor(report.overallScore.toString()),
        new Date(report.timestamp).toLocaleString(),
      ]);
    }

    console.log(table.toString());
  } else {
    // Show specific report
    const report = loadReport(baseDir, query);

    if (!report) {
      console.error(chalk.red(`Report not found: ${query}`));
      process.exit(1);
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      // Convert to AuditResult format
      const result = {
        url: report.url,
        overallScore: report.overallScore,
        categoryResults: report.categoryResults,
        timestamp: report.timestamp,
        crawledPages: 1,
      };
      renderTerminalReport(result);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/commands/report.ts
git commit -m "feat(commands): add report command"
```

---

## Task 16: Config Command

**Files:**
- Create: `src/commands/config.ts`

**Step 1: Write the implementation**

```typescript
import chalk from 'chalk';
import { loadConfig, findConfigFile, writeSettingsFile } from '../config/index.js';
import { getGlobalSettingsPath, getProjectSettingsPath } from '../storage/index.js';

export interface ConfigOptions {
  global: boolean;
  local: boolean;
  list: boolean;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

function parseValue(value: string): unknown {
  // Try to parse as JSON
  try {
    return JSON.parse(value);
  } catch {
    // Return as string
    return value;
  }
}

export async function runConfig(key: string | undefined, value: string | undefined, options: ConfigOptions): Promise<void> {
  const baseDir = process.cwd();
  const { config, configPath } = loadConfig(baseDir);

  if (options.list || (!key && !value)) {
    // Show all config
    console.log(chalk.blue('Current configuration:'));
    console.log();

    if (configPath) {
      console.log(`Config file: ${configPath}`);
    } else {
      console.log('Config file: (using defaults)');
    }
    console.log();
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (key && !value) {
    // Get specific value
    const currentValue = getNestedValue(config as unknown as Record<string, unknown>, key);

    if (currentValue === undefined) {
      console.error(chalk.red(`Key not found: ${key}`));
      process.exit(1);
    }

    console.log(JSON.stringify(currentValue, null, 2));
    return;
  }

  if (key && value) {
    // Set value
    const settingsPath = options.global
      ? getGlobalSettingsPath()
      : getProjectSettingsPath(baseDir);

    // Load existing settings
    let settings: Record<string, unknown> = {};
    try {
      const fs = await import('fs');
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
    } catch {
      // Start fresh
    }

    // Set the value
    const parsedValue = parseValue(value);
    setNestedValue(settings, key, parsedValue);

    // Write settings
    writeSettingsFile(settingsPath, settings);

    const scope = options.global ? 'global' : 'local';
    console.log(chalk.green(`Set ${key} = ${JSON.stringify(parsedValue)} (${scope})`));
  }
}
```

**Step 2: Commit**

```bash
git add src/commands/config.ts
git commit -m "feat(commands): add config command"
```

---

## Task 17: Commands Index

**Files:**
- Create: `src/commands/index.ts`

**Step 1: Write barrel export**

```typescript
export { runAudit, type AuditOptions } from './audit.js';
export { runInit, type InitOptions } from './init.js';
export { runCrawl, type CrawlOptions } from './crawl.js';
export { runAnalyze, type AnalyzeOptions } from './analyze.js';
export { runReport, type ReportOptions } from './report.js';
export { runConfig, type ConfigOptions } from './config.js';
```

**Step 2: Commit**

```bash
git add src/commands/index.ts
git commit -m "feat(commands): add barrel export"
```

---

## Task 18: Refactor CLI to Subcommands

**Files:**
- Modify: `src/cli.ts`

**Step 1: Rewrite cli.ts with subcommands**

```typescript
import { Command, InvalidArgumentError } from 'commander';
import { getCategoryIds } from './categories/index.js';
import {
  runAudit,
  runInit,
  runCrawl,
  runAnalyze,
  runReport,
  runConfig,
} from './commands/index.js';

/**
 * Validate that a string is a valid URL
 */
function validateUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new InvalidArgumentError('URL must use http or https protocol');
    }
    return value;
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      throw error;
    }
    throw new InvalidArgumentError('Invalid URL format');
  }
}

/**
 * Parse and validate category list
 */
function parseCategories(value: string): string[] {
  const validCategories = getCategoryIds();
  const requested = value.split(',').map((c) => c.trim().toLowerCase());

  for (const cat of requested) {
    if (!validCategories.includes(cat)) {
      throw new InvalidArgumentError(
        `Invalid category: "${cat}". Valid: ${validCategories.join(', ')}`
      );
    }
  }

  return requested;
}

/**
 * Parse integer value with validation
 */
function parseIntValue(value: string, name: string, min: number, max: number): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new InvalidArgumentError(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

const program = new Command();

program
  .name('seomator')
  .description('SEOmator - Comprehensive SEO audit CLI with 55 rules across 9 categories')
  .version('2.0.0');

// Audit command (default)
const auditCmd = program
  .command('audit <url>', { isDefault: true })
  .description('Crawl and analyze a website')
  .argument('<url>', 'URL to audit', validateUrl)
  .option('-c, --categories <list>', 'Categories to audit', parseCategories)
  .option('-j, --json', 'Output as JSON', false)
  .option('--crawl', 'Enable multi-page crawl', false)
  .option('--max-pages <n>', 'Max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000), 10)
  .option('--concurrency <n>', 'Concurrent requests', (v) => parseIntValue(v, 'concurrency', 1, 20), 3)
  .option('--timeout <ms>', 'Request timeout', (v) => parseIntValue(v, 'timeout', 1000, 120000), 30000)
  .option('-v, --verbose', 'Show progress', false)
  .option('--no-cwv', 'Skip Core Web Vitals')
  .option('--config <path>', 'Config file path')
  .option('--save', 'Save report to .seomator/reports/', false)
  .action(runAudit);

// Init command
program
  .command('init')
  .description('Create seomator.toml config file')
  .option('--name <name>', 'Project name')
  .option('--preset <type>', 'Use preset (default, blog, ecommerce, ci)')
  .option('-y, --yes', 'Use defaults without prompts', false)
  .action(runInit);

// Crawl command
program
  .command('crawl <url>')
  .description('Crawl website without analysis')
  .argument('<url>', 'URL to crawl', validateUrl)
  .option('--max-pages <n>', 'Max pages to crawl', (v) => parseIntValue(v, 'max-pages', 1, 1000))
  .option('--output <path>', 'Output directory')
  .option('-v, --verbose', 'Show progress', false)
  .action(runCrawl);

// Analyze command
program
  .command('analyze [crawl-id]')
  .description('Run rules on stored crawl data')
  .option('-c, --categories <list>', 'Categories to analyze', parseCategories)
  .option('--latest', 'Use most recent crawl', false)
  .option('--save', 'Save report', false)
  .option('-j, --json', 'Output as JSON', false)
  .option('-v, --verbose', 'Show progress', false)
  .action(runAnalyze);

// Report command
program
  .command('report [query]')
  .description('View and query past reports')
  .option('--list', 'List all reports', false)
  .option('--project <name>', 'Filter by project')
  .option('--since <date>', 'Filter by date (ISO format)')
  .option('--format <type>', 'Output format (table, json)', 'table')
  .action(runReport);

// Config command
program
  .command('config [key] [value]')
  .description('View or modify configuration')
  .option('--global', 'Modify global settings', false)
  .option('--local', 'Modify local settings', false)
  .option('--list', 'Show all config values', false)
  .action(runConfig);

program.parse();
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Test commands work**

Run: `./dist/cli.js --help`
Expected: Shows all subcommands

Run: `./dist/cli.js init --help`
Expected: Shows init options

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "refactor(cli): convert to subcommands architecture"
```

---

## Task 19: Update Package Version

**Files:**
- Modify: `package.json`

**Step 1: Update version to 2.0.0**

Change `"version": "1.3.0"` to `"version": "2.0.0"`

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 2.0.0"
```

---

## Task 20: Integration Test

**Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds

**Step 2: Test init command**

Run: `./dist/cli.js init -y --name test-project`
Expected: Creates seomator.toml

**Step 3: Test audit command**

Run: `./dist/cli.js audit https://example.com --no-cwv`
Expected: Runs audit and shows results

**Step 4: Test with save**

Run: `./dist/cli.js audit https://example.com --no-cwv --save`
Expected: Saves report to .seomator/reports/

**Step 5: Test report list**

Run: `./dist/cli.js report --list`
Expected: Shows saved reports

**Step 6: Clean up test files**

Run: `rm -rf seomator.toml .seomator`

**Step 7: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete Phase 1 infrastructure implementation"
```

---

## Summary

**Files created:**
- `src/config/schema.ts` - Config type definitions
- `src/config/defaults.ts` - Default config values
- `src/config/loader.ts` - Config file loader
- `src/config/writer.ts` - Config file writer
- `src/config/index.ts` - Barrel export
- `src/storage/paths.ts` - Path resolution
- `src/storage/crawl-store.ts` - Crawl persistence
- `src/storage/report-store.ts` - Report persistence
- `src/storage/index.ts` - Barrel export
- `src/commands/audit.ts` - Audit command
- `src/commands/init.ts` - Init command
- `src/commands/crawl.ts` - Crawl command
- `src/commands/analyze.ts` - Analyze command
- `src/commands/report.ts` - Report command
- `src/commands/config.ts` - Config command
- `src/commands/index.ts` - Barrel export

**Files modified:**
- `package.json` - Added dependencies, version bump
- `src/cli.ts` - Converted to subcommands

**Tests created:**
- `src/config/defaults.test.ts`
- `src/config/loader.test.ts`
- `src/storage/paths.test.ts`
- `src/storage/crawl-store.test.ts`
