# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SEOmator is a comprehensive SEO audit CLI tool (`@seomator/seo-audit`) with 251 rules across 20 categories. It fetches web pages, parses HTML with Cheerio, optionally measures Core Web Vitals via Playwright, and scores pages against SEO best practices.

## Build & Development Commands

```bash
npm run build          # Build with tsup (ESM, single entry: src/cli.ts)
npm run dev            # Build in watch mode
npm run test:run       # Run all tests once (vitest)
npm test               # Run tests in watch mode
```

Run locally after building:
```bash
./dist/cli.js audit https://example.com --no-cwv
```

Run a single test file:
```bash
npx vitest run src/rules/core/core.test.ts
```

## Architecture

### Rule System (the core abstraction)

The entire audit engine is built on a **self-registering rule pattern**:

1. **`defineRule()`** (`src/rules/define-rule.ts`) - Creates and validates an `AuditRule` object with `id`, `name`, `description`, `category`, `weight`, and `run(context)` function.

2. **`registerRule()`** (`src/rules/registry.ts`) - Stores rules in a global `Map<string, AuditRule>`. Throws on duplicate IDs.

3. **Category `index.ts` files** (e.g., `src/rules/core/index.ts`) - Import individual rule files and call `registerRule()` for each. This is the registration point.

4. **`src/rules/loader.ts`** - Static-imports all 20 category `index.ts` files. The act of importing triggers side-effect registration. `loadAllRules()` exists for API compat but rules load at import time.

5. **Result helpers**: `pass(ruleId, message, details?)`, `warn(...)`, `fail(...)` return `RuleResult` with scores 100/50/0 respectively.

### Adding a New Rule

1. Create `src/rules/<category>/<rule-name>.ts` exporting a const created via `defineRule()`
2. Rule ID convention: `<category>-<descriptive-name>` (e.g., `core-canonical-conflicting`)
3. Import and `registerRule()` in `src/rules/<category>/index.ts`
4. The `run` function receives `AuditContext` and returns `RuleResult` (or Promise)

### AuditContext

Defined in `src/types.ts`. Every rule receives the same context object containing:
- **Always available**: `url`, `html`, `$` (CheerioAPI), `headers`, `statusCode`, `responseTime`, `cwv`, `links`, `images`, `invalidLinks`, `specialLinks`, `figures`, `inlineSvgs`, `pictureElements`
- **Tier 2 (network-fetched, optional)**: `robotsTxtContent`, `sitemapContent`, `sitemapUrls`, `redirectChain`
- **Tier 4 (Playwright, optional)**: `renderedHtml`, `rendered$` (CheerioAPI of rendered DOM)

### Scoring Model

- **Rule level**: `pass`=100, `warn`=50, `fail`=0 (`src/scoring.ts`)
- **Category score**: Weighted average of rule scores within the category
- **Overall score**: Weighted average of category scores using category weights
- **Category weights must sum to exactly 100** (validated by `validateCategoryWeights()` in `src/categories/index.ts`)

### 20 Categories & Weights

core(12%), perf(12%), links(8%), images(8%), security(8%), technical(7%), crawl(5%), schema(5%), content(5%), js(5%), a11y(4%), social(3%), eeat(3%), url(3%), redirect(3%), mobile(2%), i18n(2%), htmlval(2%), geo(2%), legal(1%)

### Audit Flow

`Auditor` class (`src/auditor.ts`) orchestrates:
1. `loadAllRules()` → triggers static imports
2. `fetchPage()` → HTTP fetch + Cheerio parse → `AuditContext`
3. (Optional) `fetchPageWithPlaywright()` → CWV metrics + rendered DOM
4. `enrichContext()` → fetches robots.txt + sitemap once per audit
5. `runAllCategories()` → iterates categories → `getRulesByCategory()` → runs each rule
6. `buildAuditResult()` → weighted scoring

### Key Directories

- `src/rules/` - 251 audit rules in 20 category subdirectories
- `src/categories/` - Category definitions with weights
- `src/commands/` - CLI command handlers (audit, crawl, init, config, db, etc.)
- `src/crawler/` - HTTP fetcher, queue-based crawler, URL normalization
- `src/reporters/` - Output formatters (console, json, html, markdown, llm)
- `src/storage/` - SQLite persistence (project-db, audits-db, link-cache)
- `src/config/` - TOML config loading, validation, presets

## Testing Conventions

- Test files: `src/rules/<category>/<category>.test.ts`
- Tests create a minimal `AuditContext` using `cheerio.load(html)` for `$`, with stub values for other fields
- Use `null as any` for context fields not relevant to the rule under test
- Import rules directly from their individual files, not via the category index

## Tech Stack

- **TypeScript** (ES2022 target, ESM modules, bundler resolution)
- **tsup** for building (single ESM entry, `#!/usr/bin/env node` banner)
- **vitest** for testing
- **Cheerio** for HTML parsing
- **Playwright** for CWV measurement and rendered DOM capture
- **better-sqlite3** for storage
- **Commander** for CLI parsing
- **chalk/ora/cli-table3/log-update** for terminal UI
