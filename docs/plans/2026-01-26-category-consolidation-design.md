# Category Consolidation Design

**Date:** 2026-01-26
**Status:** Approved
**Goal:** Align SEOmator categories with SquirrelScan structure

## Overview

Consolidate 19 categories into 14 categories to match SquirrelScan's organization:
- Merge `core-seo` + `meta-tags` + `headings`(H1) → `core`
- Merge `core-web-vitals` + `performance` → `perf`
- Rename `structured-data` → `schema`
- Rename `accessibility` → `a11y`
- Rename `crawlability` → `crawl`
- Rename `url-structure` → `url`

Also fix config inconsistencies and add missing crawler options.

## Category Mapping

| Current Category | Action | Target Category |
|------------------|--------|-----------------|
| `core-seo` (4 rules) | Merge | `core` |
| `meta-tags` (8 rules) | Merge | `core` |
| `headings` (5 rules) | Split | H1 → `core`, hierarchy → `content` |
| `core-web-vitals` (5 rules) | Merge | `perf` |
| `performance` (7 rules) | Merge | `perf` |
| `structured-data` (13 rules) | Rename | `schema` |
| `accessibility` (12 rules) | Rename | `a11y` |
| `crawlability` (6 rules) | Rename | `crawl` |
| `url-structure` (2 rules) | Rename | `url` |

## New Category Weights

| Category | Weight | Rule Count | Description |
|----------|--------|------------|-------------|
| `core` | 12% | 17 | Meta tags, canonical, H1, indexing |
| `perf` | 12% | 12 | Core Web Vitals + performance hints |
| `links` | 9% | 13 | Internal/external links |
| `images` | 9% | 12 | Image optimization |
| `security` | 9% | 12 | HTTPS, headers, mixed content |
| `crawl` | 6% | 6 | Sitemap, robots, indexability |
| `schema` | 5% | 13 | JSON-LD, structured data |
| `a11y` | 5% | 12 | WCAG, ARIA, accessibility |
| `content` | 5% | 9 | Text quality, readability |
| `social` | 4% | 9 | Open Graph, Twitter Cards |
| `eeat` | 4% | 14 | E-E-A-T trust signals |
| `mobile` | 3% | 3 | Mobile-friendliness |
| `url` | 3% | 2 | URL structure |
| `i18n` | 1% | 2 | Language, hreflang |
| `legal` | 1% | 1 | Cookie consent |
| **Total** | **100%** | **148** | |

## Rule ID Changes

Rule IDs change to reflect new categories:

```
meta-tags-title-present     → core-title-present
meta-tags-description-present → core-description-present
headings-h1-present         → core-h1-present
headings-h1-single          → core-h1-single
headings-hierarchy          → content-heading-hierarchy
headings-content-length     → content-heading-length
headings-content-unique     → content-heading-unique
core-web-vitals-lcp         → perf-lcp
core-web-vitals-cls         → perf-cls
core-web-vitals-inp         → perf-inp
core-web-vitals-fcp         → perf-fcp
core-web-vitals-ttfb        → perf-ttfb
structured-data-*           → schema-*
accessibility-*             → a11y-*
crawlability-*              → crawl-*
url-structure-*             → url-*
```

## Config Enhancements

### Output Format (fix inconsistency)

```typescript
// Before: schema missing llm and text
format: 'console' | 'json' | 'html' | 'markdown'

// After: all formats supported
format: 'console' | 'text' | 'json' | 'html' | 'markdown' | 'llm'
```

### New Crawler Options

```typescript
interface CrawlerConfig {
  // ... existing options
  user_agent: string;        // Empty = random browser UA per crawl
  max_prefix_budget: number; // 0-1, prevents over-crawling single paths (default: 0.25)
}
```

## File Changes

### Create Directories
- `src/rules/core/` - merged core-seo + meta-tags + H1 rules
- `src/rules/perf/` - merged core-web-vitals + performance
- `src/rules/schema/` - renamed from structured-data
- `src/rules/a11y/` - renamed from accessibility
- `src/rules/crawl/` - renamed from crawlability
- `src/rules/url/` - renamed from url-structure

### Delete Directories (after migration)
- `src/rules/core-seo/`
- `src/rules/meta-tags/`
- `src/rules/headings/`
- `src/rules/core-web-vitals/`
- `src/rules/performance/`
- `src/rules/structured-data/`
- `src/rules/accessibility/`
- `src/rules/crawlability/`
- `src/rules/url-structure/`

### Update Files
- `src/config/schema.ts` - add formats, crawler options
- `src/config/defaults.ts` - add default values
- `src/config/validator.ts` - add validation
- `src/categories/index.ts` - new category definitions
- `src/rules/loader.ts` - new imports
- `CLAUDE.md` - documentation

## Implementation Order

1. **Phase 1: Config** - Add formats and crawler options (non-breaking)
2. **Phase 2: Create** - Create new rule directories with moved rules
3. **Phase 3: Categories** - Update category definitions and loader
4. **Phase 4: Cleanup** - Delete old directories
5. **Phase 5: Docs** - Update documentation

## Testing

- Build must succeed after each phase
- All 366+ tests must pass
- Category weights must sum to 100%
- Rule count must remain 148
- Integration test: `./dist/cli.js audit https://example.com --no-cwv`
