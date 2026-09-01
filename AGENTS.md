# AGENTS.md

Guidance for AI agents working in this repository. `claude.md` covers the same
ground in more depth — read it for anything not spelled out here.

## Project Overview

SEOmator (`@seomator/seo-audit`) is an SEO audit engine: **332 rules across 20
weighted categories**, shipped as (a) an npm CLI, (b) an Electron desktop app,
(c) a Claude Code skill. It fetches pages, parses HTML with Cheerio, optionally
renders with Playwright (Core Web Vitals + rendered DOM), and produces weighted
scores and reports.

- `src/` — the shared audit engine (CLI + Electron both import it)
- `electron/` — desktop app, purely additive, **never modifies `src/`**
- `docs/` — documentation, including `SEO-AUDIT-RULES.md` (rule reference) and
  PRDs
- `skill/` + `SKILL.md` — the published agent skill wrapper

## Commands

```bash
npm run build        # tsup → dist/ (CLI)
npm run typecheck    # tsc --noEmit — runs on prepublish, must stay green
npm run test:run     # vitest, all tests once
npx vitest run src/rules/core/core.test.ts   # single test file
./dist/cli.js audit https://example.com --no-cwv   # smoke-run after build
```

Electron: `npm run electron:dev` etc. — but **rebuild the native module first
when switching sides**: `npx electron-rebuild -f -w better-sqlite3` before
Electron, `npm rebuild better-sqlite3` before CLI/tests. Mismatch →
`NODE_MODULE_VERSION` error.

## Hard Constraints (breaking these ships broken software)

1. **`package.json` is dual-purpose.** `main` = Electron entry
   (`./dist-electron/main/index.js`), `exports`/`bin` = CLI (`./dist/cli.js`),
   `files: ["dist"]` = only the CLI ships to npm. Do not repoint `main`.
2. **Dependency split.** `dependencies` = CLI only. React/zustand/recharts/
   electron stay in `devDependencies` or npm users download ~15MB of UI code.
3. **`src/` stays Electron-free.** Electron reaches `src/` via the `@core`
   alias; never the reverse.
4. **Category weights sum to exactly 100** (`validateCategoryWeights()` in
   `src/categories/index.ts`). Adding rules to an existing category does not
   touch this; adding/changing a category does.
5. **Registry throws on duplicate rule IDs** (`src/rules/registry.ts`). An
   accidental re-registration crashes rule loading at import time.

## Rule System in Brief

- Rules are `defineRule({ id, name, description, category, weight, run })`
  objects, self-registered via `registerRule()` in each
  `src/rules/<category>/index.ts`, pulled in by static imports in
  `src/rules/loader.ts`.
- `run(context: AuditContext)` returns `pass()` (100), `warn()` (50),
  `fail()` (0), or `notMeasured()` (warn-status, **weight 0, excluded from
  scoring**).
- `AuditContext` (`src/types.ts`): page data always present; Tier 2
  (`robotsTxtContent`, `sitemapContent`, `sitemapUrls`, `sitemapEntries`,
  `redirectChain`) fetched once per audit; Tier 4 (`rendered$`,
  `renderDiagnostics`, `mobile$`) only with Playwright; `site` (SiteContext
  link graph) only in crawl mode. **All of these are optional — check for
  `undefined`.**
- Category score = weighted average of rule scores; overall = weighted average
  of category scores.

## Adding a Rule Without Breaking the Stable Audit

This is the checklist for the hint-coverage-expansion rules (see
`docs/PRD-hint-coverage-expansion.md`):

1. **File**: `src/rules/<category>/<rule-name>.ts`, ID `<category>-<name>`
   (e.g. `crawl-canonical-outside-of-head`). Register it in the category's
   `index.ts`. No loader/config wiring needed — rules are enabled by default
   (`src/rules/pattern-matcher.ts`), so **a new rule is live in every audit
   immediately**.
2. **Never throw.** The Auditor catches rule exceptions and records them as
   `fail` with score 0 (`src/auditor.ts` ~L499) — a crashy rule silently
   tanks every user's score. Guard every optional context field; if the data
   a rule needs wasn't collected, return `notMeasured()`, never `fail()`.
3. **Cross-page state**: if the rule accumulates module-level state (duplicate
   detection etc.), register a reset via `registerResettable()` or consecutive
   audits contaminate each other.
4. **No new dependencies without checking.** Use what `src/` already imports
   (cheerio, etc.). New runtime deps land on every npm user.
5. **Tests**: extend `src/rules/<category>/<category>.test.ts`. Build a
   minimal `AuditContext` with `cheerio.load(html)`, `null as any` for
   irrelevant fields, import the rule file directly (not the index). Cover at
   minimum: pass case, fail case, and the missing-data → `notMeasured` case.
6. **Score impact is expected but must be visible**: each new rule dilutes its
   category average, so existing sites' scores will shift. Note this in
   `CHANGELOG.md`. Do not "compensate" by changing category weights.
7. **Update the hardcoded rule count** (currently "332 rules"; was 287 before the
   hint-coverage expansion) everywhere when rules
   ship: `README.md`, `SKILL.md`, `skill/SKILL.md`, `skill/references/rules.md`,
   `references/rules.md`, `docs/introduction.md`, `docs/SEO-AUDIT-RULES.md`
   (add the rule entries themselves), `claude.md`, `package.json` description.
8. **Verify before done**: `npm run typecheck && npm run test:run` green, plus
   one real smoke run (`./dist/cli.js audit <url> --no-cwv`) confirming the
   new rule appears and scores sanely. If you ran Electron since the last CLI
   use, `npm rebuild better-sqlite3` first.
9. **Electron needs no changes** — the renderer receives rule metadata from
   the registry at runtime — but the audit flow there must still work, so
   don't change shared types (`AuditContext`, `RuleResult`, `AuditResult`) in
   ways that break `electron/shared` IPC contracts. Additive optional fields
   only.

## Reference Material for the Hint-Coverage Work

- `docs/PRD-hint-coverage-expansion.md` — the PRD: 240 reference-catalog hints
  mapped, 47 missing / 44 partial, phased P0/P1/P2
- `reports/hints-catalog.json` — extracted hint inventory
- `reports/hints-mapping.json` — per-hint COVERED/PARTIAL/MISSING
  verdict with our rule IDs
- `scripts/map-hints.mjs` — re-runnable validation (fails on unmapped
  slug) if the reference catalog changes

## Style

TypeScript ESM, ES2022, `.js` suffix on relative imports. Match the
surrounding rule files: JSDoc on exports, terse rule bodies, thresholds as
named constants. Comments describe what the code actually does — update them
when behavior changes.
