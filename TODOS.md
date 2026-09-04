# TODOS

Deferred work, with the context needed to pick it up later. Items are added by review
passes; nothing here is lost scope, it is scope that was consciously not taken.

## From the design-system review (2026-09-03)

### P1 — must land before Release 2 of the design plan

- ~~**Two divergent in-repo `SKILL.md` copies, both claiming "Runs 261 audit rules"**
  while the tool has 332 … Resolve to one copy, extend the sync patterns, wire
  `check:docs` into CI.~~
  **Mostly fixed 2026-09-04.** `sync-docs.mjs` gained a `Runs N audit rules`
  pattern, `skill/SKILL.md` as a target (it was never one, which is how the
  second copy drifted freely), and a weight-table sync that rewrites the
  percentages *and* re-sorts the "fix in this order" list — it claimed
  12/12/4 against a registry saying 11/10/7, and with Accessibility at 7% the
  list was no longer in the order it promises. The two copies are now identical:
  the root one was additionally stale on 3.4.0, still telling agents to pass
  `--save` and never mentioning `seomator serve`.
  **Still open:** the copies are kept in step by `check:docs`, not by structure —
  resolving to genuinely one file (symlink, or generate one from the other) is a
  layout decision left to the maintainer. Wiring `check:docs` into CI is moot
  while the repo has no CI, which was a deliberate call.
- ~~**The installed skill clone** at `~/.claude/skills/seo-audit/SKILL.md` advertises 287
  rules. `check:docs` cannot reach it. Decide: sync it, or state that the clone is out
  of scope and stop it drifting silently.~~
  **Fixed 2026-09-03** (outside `/qa`, on request). The clone is a separate git checkout
  of this same repo (`~/.agents/skills/seo-audit`, symlinked from
  `~/.claude/skills/seo-audit`), 24 commits behind `origin/main` — `git pull --ff-only`
  brought it to `af5e851`, matching this repo's `main`. Both `SKILL.md` and
  `skill/SKILL.md` in that clone now say 332. `check:docs` still cannot reach it — this
  was a manual pull, not a mechanism, so it can drift again. The clone picks up the
  item above once this branch reaches `main` and it is pulled again.

### P2 — CLI correctness, outside the design blast radius

- **Nothing reads a crawl back out of `project.db`.** `db migrate` and `db stats` are
  its only readers/writers; `analyze` goes through `loadCrawl()`/`getLatestCrawl()` in
  `crawl-store.ts`, which read `.seomator/crawls/*.json` and nothing else. The SQLite
  crawl store is therefore write-only. /qa (2026-09-04) stopped the migration from
  moving the JSON aside by default, because that made the store the user was told to
  migrate to unreadable; finishing the job means a DB-backed `loadCrawl` that
  reconstructs `StoredCrawl` (pages, HTML, links, images) from `crawls`/`pages`, after
  which `--archive` can go back to being the default.

- **`--refresh` and `--resume` are accepted and ignored.** `cli.ts:144` exposes
  them; `runAudit` forwards neither. Either wire them or remove them. These are
  crawler semantics (cache bypass, interrupted-crawl resume), not config plumbing.
- ~~**`--config` is accepted and ignored**~~ **Fixed by /qa on main, 2026-09-04**
  (`ISSUE-007`). `loadConfig()` takes an explicit path that wins over the upward
  search, and a path that does not exist throws `AuditError('config')` instead of
  falling back to defaults — a typo used to audit with defaults and report nothing
  unusual. The audit command's error rendering moved into `reportAuditError()` so a
  config failure, which happens before the run starts, produces the same message,
  hint and exit 2 as every other error rather than a Node stack trace and exit 1.
- ~~**`output.format` / `output.path` in `seomator.toml` are documented and ignored**~~
  **Fixed by /qa on main, 2026-09-04** (`6d90f0d`). `resolveOutputTarget()` now
  resolves below `loadConfig` with flag > file > default, and maps the config-only
  `text` onto `console`. `format` and `path` resolve as one instruction: a `--format`
  override drops the config path, because inheriting it wrote a markdown report into
  a file named `audit.json` and left stdout empty. The wider `resolveAuditOptions()`
  layer is still worth doing for `--config`/`--refresh`/`--resume` above.
- ~~**`-o` cannot write into a directory that does not exist**~~ **Fixed by /qa on
  main, 2026-09-04** (`6d90f0d`). `audit <url> -o reports/out.json` died with a bare
  ENOENT with no config involved, and `--preset ci` ships that exact path. The four
  duplicated write sites are now one `writeReport()` that creates the parent first.
- **`[rules] enable` / `disable` are documented and do nothing.** `docs/configuration.md`
  gives them a table and worked examples; `isRuleEnabled()` and `filterRules()` in
  `src/rules/pattern-matcher.ts` are exported, tested, and have no caller outside
  their own tests. Every rule runs whatever the file says. /qa (2026-09-04) made this
  loud rather than silent — `seomator config validate` and every affected audit run
  now warn — and dropped the inert block from the `ci` preset, whose patterns
  (`meta-tags/*`) used the wrong separator against a category that does not exist,
  so they matched zero rules even in principle.

  Wiring it is a **scoring change, not a config change**, which is why /qa stopped at
  the warning: a 40-rule audit scoring 78 is not comparable to a 332-rule audit
  scoring 78. Doing it properly means filtering in `runAllCategories`, deciding what
  a category with every rule filtered out scores, and adding the filter to
  `AuditRunOptions` + `LABELS`/`MATERIAL` in `storage/audits-db/run-profile.ts` so
  `compare` reports the runs as not like-for-like — which is exactly what that module
  already does for `categories`. Also fix `getRuleCategory()` in `pattern-matcher.ts`,
  whose hardcoded list (`meta-tags`, `core-web-vitals`, `structured-data`, `headings`)
  describes a taxonomy this codebase does not have.
- ~~**`http-error` is declared, hinted, and never thrown.**~~ **Fixed by /qa on
  main, 2026-09-04** (`568dd44`). A 404 scored 87/100 in practice. The guard sits
  beside the `non-html` one and reports the final URL after redirects;
  regression test covers 400/404/410/500/503.
- **`--fail-under <n>`** instead of the hardcoded `score >= 70` exit code
  (`audit.ts:274`). Lighthouse CI separates collection from assertion; every team whose
  site scores 68 currently has to wrap the CLI in `jq`.
- ~~**`html` and `markdown` write a file even without `-o`**~~ **Fixed by /qa on
  main, 2026-09-04** (`91bd17f`). Worse than recorded: the pipe was not empty, it
  carried the terminal progress summary, so `--format markdown > report.md`
  produced a file of coloured category lines. All four document formats now
  stream, `-o` is the only thing that writes a file, and save confirmations go to
  stderr. **Behaviour change** — anything globbing `seo-report-*.html` must pass
  `-o`; version call still open.
- **Exit code 130 is undocumented.** The README table lists 0/1/2; SIGINT also emits 130.
- **Deprecation notices have no removal version**, and `--save`'s notice is suppressed in
  JSON mode — the only users affected are the ones scripting it.

### P3 — deferred design work

- **Hand-tuned impact values per rule.** `rule.weight × category.weight` ranks well
  enough to ship; bespoke per-rule impact is a separate exercise.
- **Visual regression / screenshot diffing.** New infrastructure; the contrast and
  token lint tests cover the drift that actually happened.
- **Print / PDF stylesheet for the HTML report.** Consultants print these. Downstream of
  ordering and collapsing.
- **Deleting a reporter.** The markdown reporter (215 lines) and JSON (33) may have
  near-zero usage; six surfaces at this team size is the root cause of drift. Needs
  usage data nobody has.
- **Close the fix loop.** Nothing marks a finding handled, and nothing answers "did my
  fix land" except a manual compare. A "since last audit" strip on the detail page is
  composition over `getScoreTrend` + `compare`, not new plumbing.
- **Per-status page counts on `RuleSummary`.** It carries the worst measured
  status plus a total affected-page count, so a rule that fails on one page and
  warns on 999 ranks as if all 1,000 were failures. `rulePriority()`'s
  affected-share is a reasonable approximation of urgency today; splitting into
  `failPages` / `warnPages` / `passPages` / `notMeasuredPages` would make it
  exact and let the evaluation ledger be derived from the summaries alone
  instead of a second query.
- **Persist one `audit_rule_summaries` row per rule at save time**, so dashboard reads
  and exports stop rescanning raw history.

## Dashboard

### Publish the Electron app as a GitHub Release

**What:** Build, sign, notarize, and attach the dmg/zip/nsis/AppImage artifacts that `electron-builder.yml` already targets.

**Why:** The desktop app is the only visual surface today and nobody can install it. Once 3.4.0 makes it persist its own audits and cancel for real, publishing it is the cheapest way to make the existing UI reachable.

**Context:** `npm run electron:dist` works from source. Missing: an Apple Developer ID + notarization step, a Windows signing decision (or unsigned with a warning), a release workflow, and a README download section. Deferred by the local-web-dashboard PRD (E12); independent of `seomator serve`.

**Effort:** M
**Priority:** P2
**Depends on:** 3.4.0 foundations (Phase 1 of `docs/PRD-local-web-dashboard.md`)

### Static history + diff page (`seomator report --history` / `compare --format html`)

**What:** Render a self-contained HTML page from SQLite: per-domain trend, audit list, and a two-run diff, reusing the HTML reporter's design tokens.

**Why:** Both outside voices in the CEO review preferred this as the first read-only surface: no server, no security model, no bundle growth, lands in the skill as "open this file". Surfaced as UC-1 at the autoplan gate.

**Context:** `renderHtmlReport()` (`src/reporters/html-reporter.ts`) is a 2,352-line self-contained page; a history page can share its CSS. Data comes from `src/dashboard/queries.ts` once Phase 1 ships. Deferred by the PRD (E13).

**Effort:** M
**Priority:** P3
**Depends on:** Phase 1 (`queries.ts`, pure comparison)

### Commit SHA per audit for attributed deploy comparisons

**What:** When the CLI runs inside a git repository, record `git rev-parse HEAD` (and branch) on the `audits` row so compare can say "between commit A and commit B".

**Why:** The "did my deploy regress SEO?" job becomes attributable; CI summaries can link the diff to the PR.

**Context:** Needs a decision on which repo counts (cwd may not be the audited site's repo). Add `commit_sha TEXT` / `git_branch TEXT` columns (additive) and an `--commit <sha>` override for CI. Deferred by the PRD (E14).

**Effort:** S
**Priority:** P3
**Depends on:** Phase 1 provenance columns

### CI / PR annotation guide and GitHub Action job summary

**What:** Document `compare --fail-on-regression --json` in a GitHub Actions workflow that posts a job summary (score delta, regressed rules) and fails the check on regression.

**Why:** The agent-native regression story is the moat; a copy-paste workflow makes it real for teams without the dashboard.

**Context:** README has GitHub Actions and GitLab CI sections for `audit`; nothing for `compare`. Deferred by the PRD (E16).

**Effort:** M
**Priority:** P3
**Depends on:** persistence default-on (Phase 1)

### Remove the legacy JSON report store

**What:** After one release where `report` reads SQLite with a JSON fallback, delete `src/storage/report-store.ts`, the `--save` JSON write, and the `.seomator/reports/` path.

**Why:** Two stores caused two histories; keeping the fallback forever keeps the confusion.

**Context:** `seomator db migrate` imports JSON into SQLite. The deprecation is announced in the 3.4.0 CHANGELOG (`--save` → `--json-report`); remove `--json-report`, `report-store.ts`, and `.seomator/reports/` in 3.6.0.

**Effort:** S
**Priority:** P3
**Depends on:** 3.5.0 shipped

### `docs/technical-architecture.md` diagram sweep

**What:** Re-verify the 64 diagram lines in `docs/technical-architecture.md` against the engine after the `AuditSession` / provenance changes.

**Why:** Stale diagrams are worse than none; this file was not in the PRD's blast radius but describes the flow the PRD changes.

**Context:** Found by the stale-diagram audit in the CEO review.

**Effort:** S
**Priority:** P3
**Depends on:** Phase 1

### Run queue in `AuditSession`

**What:** FIFO queue so a second `POST /api/runs` waits instead of returning 409.

**Why:** Agents that fire several audits would not need to retry.

**Context:** ~40 lines in `src/dashboard/audit-session.ts`; needs a queue view in the UI. Deferred by the PRD (E10) because it invites "why is my audit waiting".

**Effort:** S
**Priority:** P4
**Depends on:** Phase 3

### LAN exposure for `serve` (`--host`) with a query-param token for SSE

**What:** Allow binding a non-loopback interface with a per-launch token that the HTTP adapter sends as a header and that `EventSource` carries in a cookie set by `/` (never in the query string, which lands in access logs).

**Why:** Consultants may want to show a client the dashboard on a shared network.

**Context:** Removed from v1 because native `EventSource` cannot send headers and a `Host` allow-list breaks on `0.0.0.0`. Design: `HttpOnly; SameSite=Strict` cookie for `/api/events`, header elsewhere, TLS or an explicit "plaintext LAN" acknowledgement, `Host` check relaxed to "matches the bound interface or its hostname". Deferred by the PRD (E11).

**Effort:** M
**Priority:** P4
**Depends on:** Phase 3

### Optional `@seomator/dashboard` package

**What:** Move `dist/web` into a separate npm package fetched on first `seomator serve`.

**Why:** Only if the packed tarball exceeds the 900 kB budget; every `npm i -g` and CI install pays for the web bundle otherwise.

**Context:** Taste decision T-4 in the PRD kept the bundle in the main package. Revisit with real size numbers after Phase 2.

**Effort:** M
**Priority:** P4
**Depends on:** Phase 2 size measurement

### Keyboard shortcuts and "view in dashboard" CLI link

**What:** `/` focuses the URL input, `r` re-runs; the CLI prints `View: http://localhost:7360/audits/<id>` after an audit when a `serve` process is running (pid/port file in `~/.seomator/`).

**Why:** Small delights that make the CLI and the dashboard feel like one product.

**Context:** Delight items 7 and 9 in the CEO review; the pid/port file is the only new mechanism.

**Effort:** S
**Priority:** P4
**Depends on:** Phase 3

### Scheduled audits

**What:** Recurring audits with a schedule stored in `~/.seomator`.

**Why:** Consultants want weekly trend points without remembering to run the CLI.

**Context:** Already listed under "Future Enhancements" in `docs/STORAGE-ARCHITECTURE.md`. Needs a daemon or OS scheduler integration; separate PRD.

**Effort:** L
**Priority:** P4
**Depends on:** persistence default-on

### Write DESIGN.md from the dashboard tokens

**What:** Promote the tokens in `electron/renderer/styles/globals.css` plus the dashboard PRD's DD-9 (type scale, contrast-safe text tokens, shadows only on overlays) into a `DESIGN.md` at the repo root.

**Why:** Every design review calibrates against `DESIGN.md`; without it each review re-derives the system from CSS, and the HTML report, desktop app, and web dashboard can drift.

**Context:** A `/design-consultation` ran on 2026-09-01 but left no file in the repo. Note the mockup generator's setup requirement in the doc.

**Effort:** S
**Priority:** P3
**Depends on:** Phase 2 of `docs/PRD-local-web-dashboard.md` (final token values)

### Automate the better-sqlite3 ABI switch

**What:** `npm run native:cli` / `npm run native:electron` wrappers plus a `self doctor` check that reports which ABI the compiled addon targets.

**Why:** Switching between the CLI/tests and Electron still needs a manual `electron-rebuild` / `npm rebuild` dance; a wrong state fails with a cryptic `NODE_MODULE_VERSION` error. The DX review flagged it as contributor friction; the web dashboard reduces how often it happens but does not remove it.

**Context:** Commands exist as one-liners in `CLAUDE.md`. The doctor check can read `process.versions.modules` and compare with the addon's compiled ABI.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Engine SSRF hardening for redirects and link checks

**What:** When the start URL is public, refuse redirect hops and link/image checks that resolve to loopback, RFC1918, link-local, or cloud-metadata addresses unless `--allow-private` is passed; validate each DNS resolution, not just the first URL.

**Why:** A malicious audited page can point the engine's redirect following and link checking (`src/crawler/fetcher.ts`) at internal services. This is pre-existing CLI behaviour; the dashboard makes it reachable from a browser tab (origin-checked) and an unauthenticated loopback API, so the adversarial review asked for the engine to close it.

**Context:** Auditing `localhost:3000` and intranet sites is a stated use, so the rule must key on the start URL being public, with an explicit opt-in. Touches `fetcher.ts`, the `fetchUrl` helper the nine network rules use, and the crawler's redirect tracking.

**Effort:** M
**Priority:** P2
**Depends on:** None (independent of the dashboard)

### `seomator db prune --older-than <duration>`

**What:** Delete audits (and their cascaded rows) older than a duration, with `--dry-run` and a per-domain `--keep-latest <n>`.

**Why:** Persistence is on by default from 3.4.0, so `~/.seomator/audits.db` grows without a retention control; the adversarial review asked for a retention decision to go with the default flip.

**Context:** `AuditsDatabase.deleteAudit()` exists; `ON DELETE CASCADE` covers the child tables. Announce alongside the persistence default in the 3.4.0 CHANGELOG.

**Effort:** S
**Priority:** P2
**Depends on:** 3.4.0 persistence default

## Completed
