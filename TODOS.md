# TODOS

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
