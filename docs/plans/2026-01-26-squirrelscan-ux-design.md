# SquirrelScan UX Improvements - Design Document

**Date:** 2026-01-26
**Scope:** Visual polish and issue grouping (Phase 1)

## Overview

Improve SEOmator CLI terminal output to match SquirrelScan's polished UX, focusing on:
1. ASCII banner with branding
2. Letter grades (A-F) for scores
3. Compact category progress bars
4. Issue grouping across pages
5. Clean summary footer

## 1. ASCII Banner & Header

### New Banner
```
 ███████╗███████╗ ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ██████╗
 ██╔════╝██╔════╝██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗
 ███████╗█████╗  ██║   ██║██╔████╔██║███████║   ██║   ██║   ██║██████╔╝
 ╚════██║██╔══╝  ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║██╔══██╗
 ███████║███████╗╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██║  ██║
 ╚══════╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝

  v2.1.0  •  https://seomator.com
────────────────────────────────────────────────
Config: seomator.toml (or "none, using defaults")
Auditing: example.com
Max pages: 10
```

### Implementation
- Create `src/reporters/banner.ts`
- Export `renderBanner(options)` function
- Skip in JSON/LLM modes

## 2. Letter Grades

### Grade Mapping
| Score | Grade | Color |
|-------|-------|-------|
| 90-100 | A | Green |
| 80-89 | B | Green |
| 70-79 | C | Yellow |
| 50-69 | D | Orange |
| 0-49 | F | Red |

### Helper Function
```typescript
function getLetterGrade(score: number): { grade: string; color: ChalkFunction }
```

## 3. Compact Category Progress Bars

### Format
```
Category Breakdown:
--------------------------------------------------
Structured Data      █████░░░░░ 52%
  Passed: 11 | Warnings: 1 | Failed: 16
Performance          ███████░░░ 72%
  Passed: 109 | Warnings: 55 | Failed: 14
```

### Details
- 10-character bar width
- `█` for filled, `░` for empty
- Percentage display (not /100)
- Pass/warn/fail on second line
- Sort by score ascending (worst first)

## 4. Issue Grouping

### Format
```
ISSUES

Core SEO (7 errors, 34 warnings)
  core/meta-description Meta Description (error)
    ✗ meta-description: Missing meta description (7 pages)
      → /about
      → /signup
      → /projects
      ... +2 more
```

### Grouping Logic
1. Group by: `categoryId` → `ruleId` → normalized `message`
2. Collect affected pages from `details.pageUrl`
3. Show first 5 items, then `... +N more`
4. Category header shows totals: `(X errors, Y warnings)`
5. Errors displayed before warnings

## 5. Summary Footer

### Format
```
──────────────────────────────────────────────────
966 passed • 203 warnings • 62 failed
──────────────────────────────────────────────────
```

## Files to Change

### New Files
- `src/reporters/banner.ts` - ASCII art, `getLetterGrade()`, `renderBanner()`

### Modified Files
- `src/reporters/terminal.ts` - Major refactor
- `src/commands/audit.ts` - Show banner at start
- `src/reporters/progress.ts` - Use banner for header

## Implementation Order

1. Create `banner.ts` with ASCII art and helpers
2. Update `audit.ts` to display banner
3. Refactor `terminal.ts`:
   - Compact report header with letter grade
   - Replace table with progress bars
   - Add `groupIssuesByCategory()` function
   - Update issue display format
   - Add compact summary footer
