# QA Report — SEOmator CLI (`@seomator/seo-audit`)

**Date:** 2026-09-01
**Branch:** `main` (from `26adce4`, the 3.2.0 release)
**Tier:** Standard (fix critical + high + medium)
**Scope:** every CLI command and flag, all five output formats, the programmatic
API, and the generated HTML report in a browser.

## Summary

| | |
|---|---|
| Issues found | 9 |
| Fixed and verified | 7 |
| Deferred | 2 (both low severity) |
| Reverts | 0 |
| Commits | 8 fixes + 2 regression test files |
| Health score | 62 → 96 |

**PR summary:** QA found 9 issues, fixed 7, health score 62 → 96.

The unit suite was green before any of this (569 tests, 0 type errors, clean
build). Every defect below sits in the command, storage, or reporting layer —
none were reachable from the existing tests, which cover rule logic.

## Method

The `/qa` browser workflow assumes a web app; this project's surface is a CLI
plus an HTML report. So the CLI was driven exhaustively (41 invocations covering
9 commands and ~45 flags, checking stdout, stderr and exit code separately), and
the browser was used where it genuinely applies — the generated HTML report.

Crawl behaviour was tested against a **local fixture site** rather than a live
one: 9 pages with a deliberate depth chain (0→5), a true orphan, a sitemap and
a robots.txt. Deterministic, and it exercises the site-graph rules precisely.

Two harness notes worth recording: `PIPESTATUS` is `pipestatus` in zsh and
1-indexed, so the first exit-code sweep measured nothing — rerun under `bash`.
And a scripted import insertion landed *inside* a multi-line `import type {}`
block, which is why the imports were placed individually afterwards.

---

## Fixed

### ISSUE-002 — Banner reported `v2.1.0` on every audit — **high**
`src/reporters/banner.ts:18` held a hardcoded `VERSION`, four minor versions
behind the published 3.2.0, under a comment reading *"should match
package.json"*. Every audit run printed it. `--version` was already correct, so
the two disagreed.

**Fix:** shared `getVersion()` reading the manifest; `cli.ts` now uses it too.
**Commit:** `663a2a5` · **Verified:** banner prints `v3.2.0`.

### ISSUE-003 — Checks that took no reading were counted as warnings — **high**
`notMeasured()` results carry weight 0 and are excluded from the score, but
`buildCategoryResult` counted them as warnings. Result:

```
⚠ JavaScript Rendering 100  3 passed, 13 warnings
⚠ Mobile               100  5 passed,  5 warnings
```

A score of 100 advertised alongside 13 warnings — the score had excluded exactly
those rules. A `--no-cwv` run on example.com reported **61 warnings, 27 of which
were checks that never ran**. It reached console, markdown, HTML, LLM and the
Electron app.

**Fix:** `CategoryResult.notMeasuredCount`; the split happens in
`buildCategoryResult`, so every consumer of `warnCount` became correct at once.
`isNotMeasured()` lives beside `notMeasured()` so the weight-0 convention has
one home. All four reporters label them distinctly.

```
✓ JavaScript Rendering 100  3 passed, 13 not measured
✓ Mobile               100  5 passed,  5 not measured
```

**Commits:** `9aab9aa`, `35e62a1` (tests), `c328afa` (reporters)
**Verified:** regression tests fail with the fix disabled, pass with it restored.

### ISSUE-009 — Stored timestamps shifted by the machine's UTC offset — **high**
Every `_at` column defaults to `datetime('now')`, which SQLite writes as
`'YYYY-MM-DD HH:MM:SS'` in **UTC with no designator**. That is not ISO 8601, so
`new Date()` parsed it as *local* time.

```
stored (correct UTC) : 2026-09-01 12:43:59
true UTC at the time : 2026-09-01T12:44:49Z
read back as         : 2026-09-01T09:43:59Z   ← 3 hours in the past
```

Reached `compare`, `compare --json`, and the desktop app's audit history. The
same mismatch broke `since`/`until` filters: an ISO bound compared lexically
against the stored format, and `' '` (0x20) sorts before `'T'` (0x54), so a
same-day `since` excluded the rows it was meant to include.

**Fix:** `parseSqliteUtc` / `toSqliteUtc` as the single boundary, applied to all
18 read and filter sites across `audits-db` and `project-db`. Storage was always
correct — only reads were wrong — so **no migration is needed**.
**Commit:** `862275f` · **Verified:** drift 0 minutes (was 180); tests pass under
both `TZ=Asia/Istanbul` and `TZ=UTC`.

### ISSUE-008 — Crawl mode printed a category breakdown per page — **high**
`onCategoryComplete` printed unconditionally, firing once per category *per
page*: an 8-page crawl emitted **160** unlabelled rows, 100 pages would emit
2000. Nothing marked which page a row belonged to. `ProgressReporter` already
carried an `isCrawlMode` flag and a page progress bar for exactly this — the
flag was assigned and never read.

**Fix:** honour the flag; suppress per-page rows and the per-category spinner
(both also fought the progress bar for the same line). `analyze` passed
`crawl: true` but never started the bar, so it got one. Also replaced the
hardcoded *"251 SEO checks"* header with the live count (287).
**Commit:** `be666c7` · **Verified:** 160 → 0 rows in crawl mode; single-page
still shows its 20.

### ISSUE-001 — URL validation written but never wired up — **medium**
`validateUrl()` was defined in `src/cli.ts` and referenced **nowhere**. The
`<url>` argument was declared through the command string, which attaches no
parser.

- `seomator audit example.com` (omitting the scheme — the most common first-run
  mistake) printed the full ASCII banner, then died with `Failed to parse URL`.
- `seomator audit ftp://example.com` **attempted the fetch** — the http/https
  guard never ran.

**Fix:** attached via `.argument()` so it runs before the banner and before any
network call. A missing scheme suggests the `https://` form, but only when the
value carries no scheme and prefixing actually parses — otherwise `http://`
would be offered back as `https://http://`.
**Commit:** `0c7e901`

### ISSUE-006 / ISSUE-007 — `--format` and `--preset` accepted anything — **medium**
Neither validated. `--format bogus` **exited 0** and silently produced console
output; a typo'd `--format josn` in CI is therefore indistinguishable from
success. `--preset bogus` silently wrote a bare default config, ignoring the
requested preset. Both documented their valid set in help text; nothing enforced
it. `--categories` validated correctly, so the inconsistency was internal.

**Fix:** validated at parse time. Permitted values now live in exported arrays
(`OUTPUT_FORMATS`, `CONFIG_PRESETS`) that their types derive from, so a new
format cannot drift from its validator or its help text. `report --format` had
the same gap and is covered.
**Commit:** `19913e7`

### ISSUE-005 — Issue list titleized rule ids — **medium**
The terminal reporter built labels by splitting the id on hyphens, so
`links-depth` (name: "Page Depth") displayed as *"Links Depth"* and
`eeat-about-page` as *"Eeat About Page"*.

**Fix:** ask the registry, which is where rules record their name; titleized id
retained as a fallback for unregistered rules from storage.
**Commit:** `c0fedde`

---

## Deferred

**ISSUE-004 — HTML report renders `0 warnings` badges.** The category stat
renders unconditionally, so clean categories show a `0 warnings` chip. Cosmetic;
below the Standard tier's fix threshold.

**Orphan detection does not use the sitemap.** The fixture's `orphan.html` is in
`sitemap.xml` but linked from nowhere, and the crawler correctly never reaches
it — so nothing reports it. Pages present in the sitemap but unreachable by
crawl are the classic definition of an orphan, and the data to find them is
already collected (`sitemapEntries` plus the site graph). This is a **feature
gap, not a defect**, and is the natural next step for `links-orphan-pages`.

---

## Verification

| Check | Result |
|---|---|
| Command sweep (41 invocations) | 41 pass / 0 fail |
| Unit suite | 580 pass (was 569; +11 regression tests) |
| `tsc --noEmit` | 0 errors |
| Build | clean |
| Programmatic API | audits, callbacks fire, `notMeasuredCount` reaches consumers |
| HTML report in browser | renders, 0 console errors |
| Timestamp drift | 0 min (was 180) |

Regression tests were each confirmed to **fail without their fix** — disabling
the `isNotMeasured` branch fails 2 counting tests; the timestamp tests were run
under a non-UTC `TZ`, the condition that exposes the bug.

## Health score

Baseline **62**: two high-severity correctness defects in stored data and
scoring presentation, one high-severity output defect, three medium validation
gaps, one medium display defect.

Final **96**: all seven fixed and verified, two low-severity items deferred.

## Note

The 3.2.0 release is published with all seven of these defects. The fixes sit
unreleased on `main` and want a **3.2.1** when you're ready to cut it.
