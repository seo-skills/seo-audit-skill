# PRD — Local Web Dashboard: `seomator serve`

| | |
|---|---|
| **Product** | `@seomator/seo-audit` (audit-cli) |
| **Current version** | 3.3.0 — 332 rules / 20 categories |
| **Target versions** | 3.4.0 (foundations) → 3.5.0 (dashboard) |
| **Status** | **APPROVED as-is on 2026-09-02** at the `/autoplan` final gate after CEO, Design, DX, and Eng phases (Codex + Claude outside voices in each). The user's direction stands (UC-1, UC-2 declined); the recommended option was taken on T-1…T-6 |
| **Date** | 2026-09-02 |
| **Inputs** | `src/storage/audits-db/*`, `src/commands/{audit,compare,report}.ts`, `src/auditor.ts`, `src/crawler/*`, `electron/main/*`, `electron/preload/index.ts`, `electron/shared/ipc-types.ts`, `electron/renderer/**`, `docs/ELECTRON-APP.md`, `docs/STORAGE-ARCHITECTURE.md`, live `~/.seomator/audits.db` (18 audits, 5 domains, largest audit 40 pages / 11,480 result rows), `npm pack --dry-run` (453.6 kB packed, 2.2 MB unpacked, 11 files) |
| **Document type** | Product requirements + project plan (phases, tasks, estimates, acceptance criteria) |

---

## 0. Revision note (v1 → v2)

The CEO review (two independent voices, both verified against the code) found
that v1 understated the work and built a history UI on a store most users never
write to. v2 keeps the user's direction — a localhost interface that lists past
audits and starts new ones — and changes four things:

1. **Foundations ship first as 3.4.0 (a minor: the persistence default changes).** Persistence becomes default-on, the
   stored path gets the same fidelity as the live path (row cap, not-measured,
   provenance), comparison becomes pure and correct, cancel becomes real. These
   are worth shipping even if the dashboard never did.
2. **Read-only history lands before run-from-browser.** Phase 2 is the
   dashboard without audit execution; Phase 3 adds execution and live progress.
   Same scope as v1, sequenced by value and risk.
3. **Estimates are honest.** v1 said 9.5 human-days / 5 CC-hours. v2 says
   ~27 human-days / ~13 CC-hours. The renderer is desktop-specific today
   (fixed sidebar, traffic-light padding, mouse-only rows) and cancel touches
   six modules, not three.
4. **Non-loopback exposure is out of v1.** The token design could not work with
   `EventSource`; loopback-only removes the whole class of problem.

Two premise challenges (the vehicle, and execution in v1) were put to the final
approval gate on 2026-09-02 and declined; the user's direction stands, and the
six taste decisions were taken as recommended (§16).

---

## 1. Background

### 1.1 The three surfaces today

SEOmator ships as a CLI (npm), an Electron desktop app (source only; release
plumbing exists in `electron-builder.yml` but no release has been published),
and a Claude Code skill. The engine is strong: 332 rules, weighted scoring,
crawl mode, Playwright rendering, fix suggestions for every rule, and a SQLite
history at `~/.seomator/audits.db` that already powers `seomator compare`.

The human-facing side is weak in a specific way:

| Surface | Runs audits | Shows history | Reachable by npm users | Cost to start |
|---|---|---|---|---|
| CLI reports (`--format html/markdown/json/llm`) | yes | no — one file per run, no links between runs | yes | none |
| `seomator compare` / `report --list` | no | text only, and from **two different stores** | yes | none |
| Electron app | yes | yes (trend chart, past audits) — but only audits the CLI saved | **no** — never published | clone, `npm install`, `electron-rebuild`, `electron:dev` |
| Claude Code skill | yes (via CLI) | via `compare`, only with `--save` | yes | none |

An npm user (`npm i -g @seomator/seo-audit`) has no visual surface at all.

### 1.2 What already exists (leverage map)

| Sub-problem | Existing code | Reused? | Gap found in review |
|---|---|---|---|
| Run an audit with streaming progress | `Auditor` (`src/auditor.ts`) callbacks `onCategoryStart/Complete`, `onRuleComplete`, `onPageComplete` | yes | In crawl mode the callbacks fire **per page** (`runAllCategories` at `auditor.ts:491`), and nothing fires during the crawl phase itself: `Crawler.onProgress` (`crawler.ts:58`) is never wired by the Auditor |
| Persist a completed audit | `saveAuditToDatabase()` (`src/storage/save-audit.ts`) | yes | Only called under `--save` (`audit.ts:162`), which defaults to `false` (`cli.ts:145`). Not one transaction; no `busy_timeout` |
| List / filter history | `AuditsDatabase.listAudits()`, `getAuditedDomains()` | yes | — |
| Audit detail | `getAudit()`, `getCategories()`, `getResults()`; reconstruction in `electron/main/db-bridge.ts` | lifted into `src/` | `getResults()` defaults to `LIMIT 1000` (`results.ts:301`); the 40-page audit in the live DB has 11,480 rows, so the Electron detail view shows under 9% of it |
| Score trend | `getScoreTrend()` | yes | Storage returns oldest-first (`comparisons.ts:236`); `ScoreTrend.tsx:34` reverses again → chart runs backwards |
| Compare two audits | `compareAudits()` + rule diff in `src/commands/compare.ts` | lifted | `compareAudits()` **inserts** an `audit_comparisons` row on every call (`comparisons.ts:138`); `getPreviousAudit()` returns the newest audit with a different id, not the one before the selected run (`audits.ts:159`); the rule diff skips rules absent from either side (`compare.ts:90`), so an engine upgrade moves the score with no explanation |
| Delete an audit | `deleteAudit()` | yes | — |
| Rule metadata | `getRuleById()`, `getFixSuggestion()` | yes | — |
| Export a stored audit | `renderHtmlReport()`, `renderMarkdownReport()`, `renderLlmReport()`, `renderJsonReport()` | yes | Stored audits have no `page` snapshot (optional field; report renders without previews) |
| A React UI | `electron/renderer/**` (2,376 LOC, 16 components, Zustand, Tailwind v4 tokens, themes) | yes, with a responsive pass | Desktop-specific: fixed 260 px sidebar (`Sidebar.tsx:27`), traffic-light padding in the header (`Header.tsx:25`), mouse-only clickable rows (`AuditList.tsx:48`), no router. Realistic reuse ≈ 50–60% |
| A typed API contract | `ElectronAPI` (`electron/preload/index.ts`) + `electron/shared/ipc-types.ts` | shape reused | The renderer imports the type from the preload module (`ipc-client.ts:6`); the contract must move to a transport-neutral module |
| URL validation | `validateUrl()` in `src/cli.ts` | moved to `src/crawler/validate-url.ts` | — |
| Version and counts | `getVersion()`, `getRuleCount()`, `categories` | yes | — |
| Programmatic API | `src/index.ts` (`createAuditor`) | — | Agents can already drive audits in-process; the HTTP API is for the browser, not a new capability |

**The seam:** the renderer only ever calls a typed API object. A second
implementation over `fetch` + `EventSource` lets the same UI run in a browser.
That part of v1 holds. What v1 missed is that the UI and the stored data both
need real work before that seam pays off.

### 1.3 Defects in the blast radius (fixed by this plan)

| # | Defect | Where | Effect today |
|---|---|---|---|
| 1 | Electron never saves its audits | `electron/main/audit-bridge.ts:97` | Desktop History tab only shows CLI `--save` runs |
| 2 | Persistence is opt-in | `src/cli.ts:145`, `src/commands/audit.ts:162` | `compare`, trend, and any history UI are empty for most users |
| 3 | Cancel is cosmetic | `audit-bridge.ts:127`; `AuditorOptions` has no signal (`auditor.ts:99`) | Audit keeps running; a second audit can start and `resetCrossPageState()` wipes the first |
| 4 | Stored detail capped at 1,000 rows | `results.ts:301` | Crawl audits reconstruct incomplete; exports and compares from storage are truncated |
| 5 | Not-measured lost in storage | no `weight` column (`schema.ts`) | Stored audits count not-measured checks as warnings (ISSUE-008 for the stored path) |
| 6 | Comparison mutates on read | `comparisons.ts:138` | Every "compare" inserts a row; "previous" is wrong for historical audits |
| 7 | Trend plotted backwards | `comparisons.ts:236` + `ScoreTrend.tsx:34` | Newest audit drawn first |
| 8 | Two histories | `report.ts` reads `.seomator/reports/*.json`; `compare` reads SQLite | First-party commands disagree about what was audited |
| 9 | No crawl-phase progress | `Crawler.onProgress` unused in `auditor.ts:396` | A 40-page CWV crawl shows nothing for minutes |
| 10 | No provenance | `audits` stores no engine version, rule-set hash, or run options | Trends across engine upgrades look like regressions; "re-run" cannot know the options |

### 1.4 Landscape

- **Unlighthouse** (`npx unlighthouse --site`) is the incumbent "one command,
  localhost dashboard" for Lighthouse-based site scans. It proves the
  distribution pattern this plan adopts; it does not cover SEO rule depth.
- **Lighthouse CI server** owns "history + compare across commits" for
  Lighthouse metrics; it needs a hosted server.
- **Screaming Frog / Sitebulb** own the desktop crawler category (the sibling
  PRD `docs/PRD-hint-coverage-expansion.md` benchmarks against their hint
  catalog).
- **seomator.com** hosts a free audit; this dashboard is a local, private,
  agent-adjacent surface, not a replacement for the hosted funnel.

**Positioning.** Nobody owns *agent-native SEO regression testing*: 332
SEO-specific rules, `--format llm`, `compare --fail-on-regression`, a Claude
Code skill. The dashboard's job is to make that history and those diffs
visible to a human, not to out-dashboard Unlighthouse. That is why history and
compare come before run-from-browser in v2.

---

## 2. Problem statement

1. **No persistent, visual surface for npm users.** Yesterday's audit and
   today's are two HTML files with no relationship, no trend, no diff.
2. **History is empty by default.** Persistence is behind `--save`, so the
   compare and trend features that already exist rarely have data.
3. **The visual surface we do have is unreachable and lossy.** The Electron
   app is unpublished, needs a native rebuild, does not persist its own runs,
   and its history detail truncates at 1,000 rows.
4. **Agents run audits, humans cannot see them.** The skill drives the CLI
   from Claude Code; a human who wants to review the result has a terminal.
5. **Two UIs would be a mistake.** A separate web UI next to the Electron
   renderer doubles every future UI change.

## 3. Goals

- **G1 — Zero-install visual surface.** `npx @seomator/seo-audit serve` opens
  a browser tab on a local dashboard. No clone, no Electron, no native rebuild
  beyond what the CLI already needs.
- **G2 — History is a first-class, trustworthy view.** Every audit from every
  surface is stored by default. List, filter by domain, trend, full detail,
  compare any two (with engine-version awareness), export in the four report
  formats, delete.
- **G3 — Start audits from the browser with live progress**, including during
  the crawl phase, with a cancel that stops network activity.
- **G4 — One UI, one contract.** The renderer becomes the shared UI; Electron
  and the web server implement the same typed API.
- **G5 — Safe by default.** Loopback only; browser-origin checks so a
  malicious website cannot drive the local server.
- **G6 — Honest cost to npm users.** No new runtime dependencies. The packed
  tarball may grow by up to ~400 kB (web bundle) on top of an install already
  dominated by Playwright and `better-sqlite3`; `seomator audit` start-up time
  does not change.
- **G7 — Fix the ten blast-radius defects** (§1.3) and ship them as 3.4.0
  before the dashboard.

## 4. Non-goals

- Multi-user, auth, cloud hosting, or any non-loopback exposure (v1).
- Scheduled or recurring audits (`docs/STORAGE-ARCHITECTURE.md` future list;
  separate PRD).
- Replacing the HTML report; export keeps using `renderHtmlReport()`.
- A UI for the legacy JSON report store; `seomator db migrate` imports it and
  `report` gains a read-only fallback to it.
- Editing rules, weights, or config from the browser.
- Rewriting the renderer in another framework.
- Publishing the Electron app (TODOS.md; benefits from G7 regardless).

## 5. Users and jobs

| Persona | Job | Dashboard use |
|---|---|---|
| Solo developer shipping a site | "Did my deploy make SEO better or worse?" | audit `localhost:3000`, deploy, audit again, open Compare; or let CI/agent audit and just look |
| SEO consultant with several client domains | "Show the client the trend" | filter by domain, trend chart, export the latest audit as HTML |
| Agent operator (Claude Code + the skill) | "What did the agent actually change?" | the agent runs audits (now stored by default); the human keeps `seomator serve` open and watches audits appear |

---

## 6. Architecture

### 6.1 Options considered

| | A — `serve` + shared renderer *(recommended, user's direction)* | B — separate web app | C — server-rendered pages from the HTML reporter | C′ — static history + diff page (`compare --format html`) | E — publish the Electron app |
|---|---|---|---|---|---|
| Summary | Node `http` server in the CLI; renderer built for web; one contract | Next.js/Vite + Hono/Express with its own UI | `serve` renders list page + reuses `renderHtmlReport()` | No server. `report --history` writes a static page (trend + list + diff) from SQLite, opened in the browser | GitHub Release of the existing app (dmg/zip/nsis targets exist) |
| Meets G1 | yes | yes | yes | yes | no (download + Gatekeeper/notarization) |
| Meets G2 | yes | yes | partial | yes (no delete) | yes after G7 |
| Meets G3 | yes | yes | no | no | yes |
| Meets G4 | yes | no (two UIs) | n/a | n/a | yes |
| Runtime deps | 0 | ≥1 | 0 | 0 | 0 |
| Effort (human / CC) | ~27 d / ~13 h | ~30 d / ~14 h | ~4 d / ~2 h | ~3 d / ~1.5 h | ~2 d / ~1 h + notarization setup |
| Risk | medium | medium–high | low | low | low–medium (signing) |

**Recommendation: A, sequenced as foundations → read-only → execution.** A is
the only option that meets G1–G4 without a second UI. C′ is the cheapest way to
get G2 and is queued at the gate as the alternative both outside voices
preferred as a *first* step (§16, UC-1). E is deferred to TODOS.md; it is
independent of this plan.

### 6.2 System diagram

```
  Browser (http://127.0.0.1:7360)
  ┌──────────────────────────────────────────────────────────────┐
  │  Shared React renderer (ui/)                                  │
  │    useAudit(), useAuditHistory(), useAppInfo()                │
  │        │  getAPI() → window.electronAPI ?? createHttpAPI()    │
  │  ┌───────────────┐        ┌────────────────────────────┐     │
  │  │ IPC adapter   │        │ HTTP adapter               │     │
  │  │ (Electron)    │        │  fetch('/api/...')         │     │
  │  └───────┬───────┘        │  EventSource('/api/events')│     │
  └──────────┼────────────────┴──────────────┬─────────────┘     │
             │                               │                    │
             ▼                               ▼                    │
  ┌──────────────────┐            ┌───────────────────────────────┐
  │ electron/main    │            │ src/dashboard (Node http)     │
  │  audit-bridge.ts │            │  server.ts   routes + static  │
  │  db-bridge.ts    │            │  events.ts   SSE fan-out      │
  │  (thin adapters) │            └──────────────┬────────────────┘
  └────────┬─────────┘                           │
           │           both use                  │
           ▼                                     ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ src/dashboard/                                               │
  │   audit-session.ts  one run at a time, RunState (page-aware),│
  │                     real cancel (AbortSignal), persists       │
  │   queries.ts        DTOs over AuditsDatabase (all rows,       │
  │                     not-measured parity, pure compare)        │
  │   contract.ts       DashboardAPI + DTO types                  │
  └────────┬──────────────────────────────┬──────────────────────┘
           ▼                              ▼
  ┌──────────────────┐         ┌──────────────────────────┐
  │ Auditor + Crawler│         │ AuditsDatabase           │
  │ (signal-aware)   │         │ ~/.seomator/audits.db    │
  └──────────────────┘         └──────────────────────────┘
```

### 6.3 Where the code lives

| Path | Role | Change |
|---|---|---|
| `src/commands/serve.ts` | `seomator serve`: flags, start server, open browser, signals | new |
| `src/dashboard/contract.ts` | Transport-neutral `DashboardAPI` and DTOs | new; `electron/shared/ipc-types.ts` re-exports and keeps `IPC_CHANNELS` |
| `src/dashboard/audit-session.ts` | `AuditSession`: one run, page-aware `RunState`, sinks, cancel, persist | new |
| `src/dashboard/queries.ts` | DTO builders over `AuditsDatabase` | new (lifted from `db-bridge.ts`) |
| `src/dashboard/server.ts`, `api.ts`, `events.ts`, `static.ts` | HTTP server and router, endpoint handlers, SSE, static | new |
| `src/storage/persist-worker.ts` (only if the Phase 1 persistence benchmark fails its budget) | worker-thread persistence fallback | new |
| `scripts/{clean,check-bundle-size,check-contrast,bench-persist,measure-tthw}.mjs` | build/QA scripts named in §11 | new |
| `ui/tsconfig.json`, `vitest.workspace.ts` | typecheck and test projects for `ui/` | new |
| `src/storage/audits-db/rule-diff.ts` | Rule-level diff incl. added/removed rules | new (lifted from `compare.ts`) |
| `src/storage/audits-db/comparisons.ts` | `buildComparison()` (pure) + `recordComparison()` | changed |
| `src/storage/audits-db/audits.ts` | `getPreviousAudit()` by `started_at <` | changed |
| `src/storage/audits-db/schema.ts`, `results.ts`, `save-audit.ts`, `src/storage/types.ts` | new columns, transaction, `busy_timeout`, all-rows read | changed (additive) |
| `src/auditor.ts`, `src/crawler/crawler.ts`, `fetcher.ts`, `playwright-fetcher.ts`, `sitemap.ts`, `robots.ts` | `signal` threading, `AuditAbortedError`, `onCrawlProgress`, `finally` cleanup | changed (additive) |
| `src/commands/audit.ts`, `src/cli.ts` | persistence default-on (`--no-save`), `--save` keeps writing legacy JSON with a deprecation note, `validateUrl` moved | changed |
| `src/commands/report.ts` | reads SQLite; legacy JSON fallback read-only | changed |
| `src/crawler/validate-url.ts` | shared URL validation | new |
| `ui/` | shared renderer (today `electron/renderer/`) | moved (D-2, taste decision) |
| `ui/lib/api-client.ts`, `ui/lib/http-api.ts` | `getAPI()` picks IPC or HTTP adapter | changed / new |
| `ui/App.tsx`, `ui/pages/*`, `ui/components/*` | router, shell-aware header, responsive sidebar, keyboard rows, compare page, domain cards, action bar, SVG chart | changed |
| `electron/main/audit-bridge.ts`, `db-bridge.ts`, `electron-fetcher.ts` | thin adapters; fetcher accepts a signal | changed |
| `electron/electron-vite.config.ts`, `electron/tsconfig.json` | renderer root → `ui/` | changed |
| `vite.web.config.ts`, `package.json` | web build to `dist/web/`, scripts, `vite` devDependency | new / changed |
| Docs: `docs/WEB-DASHBOARD.md` (new), `README.md`, `SKILL.md`, `skill/SKILL.md`, `CLAUDE.md`, `AGENTS.md`, `docs/ELECTRON-APP.md`, `docs/STORAGE-ARCHITECTURE.md`, `CHANGELOG.md`, `TODOS.md` (new) | | changed |

### 6.4 Decisions

| # | Decision | Choice | Why | Status |
|---|---|---|---|---|
| D-1 | Server stack | Node built-in `http` | 18 API routes + static + SSE ≈ 400 lines; a framework would be the first runtime dependency added for a feature many installs never run | accepted |
| D-2 | Shared UI location | move `electron/renderer/` → `ui/` | the CLI serves a build of it; "Electron-only directory" stops being true either way. `git mv` keeps history. The Claude voice prefers leaving it in place (smaller diff, keeps the documented invariant literal) | accepted (T-1 at the gate, 2026-09-02) |
| D-3 | Progress transport | Server-Sent Events | one-way stream matches the callback shape; native reconnect; no dependency | accepted |
| D-4 | Routing | `react-router-dom` (installed, unused); `BrowserRouter` on web, `HashRouter` under Electron (`file://`) | deep links to `/audits/<id>` are the point of history | accepted |
| D-5 | Concurrency | one run per server; second `POST /api/runs` → `409` | matches engine's module-level cross-page state; queue in TODOS.md | accepted |
| D-6 | Network exposure | **loopback only** in v1; per-launch token (HttpOnly cookie for the browser, `X-SEOmator-Token` header for agents, `serve.json` 0600) plus `Host` + `Origin` + `Sec-Fetch-Site` checks; no `--host` | `EventSource` cannot send headers but does send cookies; `Host` checks break on `0.0.0.0`; loopback alone is not authentication (sandboxes and forwarded ports reach it) | accepted (token added at the ship review, 2026-09-02) |
| D-7 | Default port | `7360` | avoids 3000, 5173 (Electron dev renderer), 8080; `--port` overrides | accepted |
| D-8 | Provenance | additive columns on `audits`: `source`, `engine_version`, `run_json` | `config_json` is typed as `SeomatorConfig` and must not grow a foreign key; trends across engine upgrades need the version to explain themselves (a rule-set hash was cut at the ship review — nothing consumed it) | accepted |
| D-9 | Not-measured parity | `audit_results.weight INTEGER` (NULL = legacy = 1) | weight 0 is the marker everywhere else in the engine | accepted |
| D-10 | Detail after a run | `audit-complete` carries a summary; the UI navigates to `/audits/<id>` and fetches the aggregated detail; a finished run's result stays in session memory at `/api/runs/:runId/result` until the next run or 15 minutes, so Export and Retry save keep working after a failed save | one detail shape for live and stored audits; nothing large on the wire | accepted (revised in Phase 3 and the ship review) |
| D-11 | Persistence default | SQLite on by default; `--no-save` opts out; `--json-report` writes the legacy JSON file; `--save` stays accepted as a deprecated alias of `--json-report` (distinguished from the default with Commander's `getOptionValueSource('save') === 'cli'`) | both voices: a history product on an opt-in store is empty for most users | accepted (T-2 at the gate, 2026-09-02) |
| D-12 | Sequencing | foundations (3.4.0) → read-only dashboard → execution | value and risk ordering; both voices | accepted |
| D-13 | Comparison | reads never write: `GET /compare` and `seomator compare` both use the pure `buildComparison()`; only the save path records a row (`recordComparison()` inside the save transaction, against the domain's previous audit), so an ad-hoc `compare --against <old>` can never change what the domain strip shows | reads must not write; the strip needs stable counts | accepted (clarified in Phase 3 and the ship review) |
| D-14 | Trend chart | replace Recharts with an inline SVG line chart in the shared UI | one series with tooltips; removes the largest bundle chunk and a devDependency for both shells | accepted (T-3 at the gate, 2026-09-02) |
| D-15 | Idle exit | none: `Ctrl-C` ends a session; the skill never starts `serve`, only suggests it | an `--idle-timeout` flag had no scenario left once the skill never starts the server (cut at the ship review) | accepted |
| D-16 | API stability | no `/v1` prefix; `apiVersion` in `/api/info`; additive changes only | agents will script against it; a number in `info` is enough to detect drift | accepted |

---

## 7. Functional requirements

### 7.1 FR-1 — `seomator serve`

```
seomator serve [options]
  -p, --port <n>              Port on 127.0.0.1 (default: 7360; 0 picks a free port and prints it)
      --no-open               Do not open the browser (BROWSER=none is honoured too)
      --audit <url>           Start the server and immediately audit <url> (Phase 3); accepts the
                              audit command's --crawl, --max-pages, --no-cwv, --categories,
                              --mobile, --simulate-interaction
  -v, --verbose               Log one line per request

Environment: SEOMATOR_HOME overrides ~/.seomator (database, settings) for every command.
```

- Prints `SEOmator dashboard → http://127.0.0.1:7360` and opens the default
  browser (`open` / `start` / `xdg-open`); failure to open is a warning.
- Missing `dist/web/index.html`: in a source checkout (a `src/` directory next
  to `package.json`) print `Web assets not built — serving /api only (run npm
  run build, or use npm run web:dev)` and keep running so the Vite dev loop can
  proxy to it; in an installed package exit 1 with `Web assets are missing from
  this install (<path>). Reinstall: npm install -g @seomator/seo-audit@<version>`.
- Prints the per-launch token once and writes `$SEOMATOR_HOME/serve.json`
  (0600; `{ port, token, pid, startedAt }`), removed on shutdown.
- `EADDRINUSE` → exit 1: `Port 7360 is in use. Try: seomator serve --port 7361`.
- Every `serve` error ends with `See: https://github.com/seo-skills/seo-audit-skill/blob/main/docs/WEB-DASHBOARD.md#<anchor>`
  (problem + cause + fix + link, the same convention the API's `hint` uses).
- `SIGINT`/`SIGTERM`: stop accepting, abort the running audit, close the
  Playwright browser, close the database, exit 0. A second signal within 2 s
  exits immediately. Uses `process.exitCode`, never `process.exit()` on the
  success path.
- `--audit <url>` (Phase 3) posts to `/api/runs` once listening; the opened tab
  lands on `/run`.

### 7.2 FR-2 — HTTP API

All JSON under `/api`. One error shape everywhere:
`{ "error": { "code", "message", "hint", "details"? } }` — `hint` says what to
do (`Cancel it with DELETE /api/runs/current`), `details` carries structured
context (`currentRun`, `rejectedOrigin`, `allowedOrigins`, `option`,
`supported`). `409` also sets `Location: /api/runs/current`. `GET /api` returns the route
index (method, path, purpose), derived from the same table the router
dispatches on so it cannot drift, and is the machine-readable description of
the API (no separate OpenAPI file).
Audit ids match `^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]{1,12}$` (ids imported by
`db migrate` and short `Math.random` ids stay valid; the `Math.random` `generateId()` in `paths.ts` is replaced by the
`randomBytes`-based one that already exists in `src/storage/utils/hash.ts`); anything else is `400`, unknown ids `404`.

| Method | Path | Purpose | Backed by | Phase |
|---|---|---|---|---|
| `GET` | `/api/info` | `{ version, apiVersion, ruleCount, categoryCount, categories, dbPath (with `~`), capabilities: { playwright, mobileParity, simulateInteraction }, currentRunId, cli: 'npx' \| 'global', uptime }` | registry, `getVersion()` | 2 |
| `GET` | `/api/audits?domain=&limit=&offset=&status=` | `AuditSummaryDto[]` ordered `started_at DESC, id DESC` (second-resolution timestamps collide when agents fire back-to-back audits; the tie-break keeps the order stable); `limit` ≤ 200 | `listAudits()` | 2 |
| `GET` | `/api/audits/:id` | `AuditDetailDto = { audit, result, ruleMetadata }` — `result.categoryResults[].results` is **one `RuleSummary` per rule** (`ruleId`, worst `status`, `score`, the worst page's `message`, `affectedPages`, `measuredPages`, `totalPages`, `notMeasured` — true when every page row has `weight = 0`, ≤ 5 `samplePages`); a rule with mixed rows takes the worst *measured* status and counts only measured pages toward `affectedPages`; the category's `notMeasuredCount` counts rules that are `notMeasured`, matching `buildCategoryResult()`, aggregated in SQL (`GROUP BY rule_id`) so a 1,000-page audit stays ≈ 330 rows on the wire; `audit` carries `run`, `engineVersion` (`null` for pre-3.4.0 rows → shown as `unknown`), `source` | `queries.getAuditDetail()` | 2 |
| `GET` | `/api/audits/:id/rules/:ruleId/pages?limit=&offset=` | per-page results for one rule, same ordering rule | `getResultsByRule()` | 2 |
| `DELETE` | `/api/audits/:id` | `204`; `404` | `deleteAudit()` | 2 |
| `GET` | `/api/audits/:id/export?format=html\|markdown\|json\|llm` | download; `Content-Disposition: attachment; filename="seo-report-<id>.<ext>"` | reporters | 2 |
| `GET` | `/api/audits/:id/compare?against=<id>` | `{ current, previous, engineChanged, scoreDelta, categoryDeltas, ruleChanges: { regressed, improved, added, removed } }`; default `against` = previous completed audit of the same domain **before** this one | `buildComparison()`, `rule-diff.ts` | 2 |
| `GET` | `/api/domains` | `DomainSummaryDto[]`: `{ domain, auditCount, latestAuditId, latestScore, latestAt, deltaFromPrevious, sparkline: number[] (last 10 scores, oldest first), regressedCount, improvedCount, engineVersion }` — everything the domain strip renders, in **one** query (window functions over `audits` joined to the latest `audit_comparisons` row); no per-domain trend or compare calls | `queries.listDomains()` | 2 |
| `GET` | `/api/domains/:domain/trend?limit=` | `ScoreTrendPoint[]` oldest first, with `engineVersion` per point | `getScoreTrend()` | 2 |
| `POST` | `/api/runs` | body `AuditRunArgs` (≤ 64 kB); `202 { runId }`; `409` with `details.currentRun` + `Location`; `400` | `AuditSession.start()` | 3 |
| `GET` | `/api/runs/current` | `200 { run: RunState \| null }` — never `204`, so `.json()` always works | `AuditSession.state()` | 3 |
| `GET` | `/api/runs/:runId` | `RunState` of the current or most recent run; `404` otherwise | `AuditSession.get()` | 3 |
| `GET` | `/api/runs/:runId/result` | the aggregated detail of a finished run from memory (what the UI shows after a save failure) | `AuditSession.result()` | 3 |
| `GET` | `/api/runs/:runId/export?format=` | export of an unsaved run's result (the **Export HTML** action in the save-error banner) | reporters over the in-memory result | 3 |
| `POST` | `/api/runs/:runId/save` | retry persistence of an unsaved result → `200 { auditId }` or the same `saveError` (the **Retry save** action) | `AuditSession.persist()` | 3 |
| `GET` | `/api` | route index, derived from the router table | router | 2 |
| `DELETE` | `/api/runs/current` | cancel: `202`; `204` when idle | `AuditSession.cancel()` | 3 |
| `GET` | `/api/events` | SSE (7.3) | `AuditSession.subscribe()` | 3 |
| `GET` | `/*` | `dist/web/**`; SPA fallback to `index.html` for extension-less paths **outside `/api`** — an unmatched `/api/*` is `404` JSON (`{ code: 'unknown-route', hint: 'GET /api lists the routes' }`), never HTML | static | 2 |

`AuditRunArgs = { url, options: { measureCwv, crawl, maxPages, concurrency, categories, mobile, simulateInteraction, timeout, save } }` (`save` defaults to `true`),
validated with `validateUrl()`; out-of-range numbers and unknown keys are
rejected with `400 { code: 'invalid-option', details: { option, allowed } }` —
no silent clamping, so an agent's typo fails loudly; options the shell's
`capabilities` do not support → `400 { code: 'unsupported-option', details: { option, supported } }`.
`options.save: false` skips persistence for that run.

### 7.3 FR-3 — Live progress over SSE (Phase 3)

| event | data | when |
|---|---|---|
| `snapshot` | `RunState \| null` | on connect (reload mid-run resumes) |
| `crawl-progress` | `{ crawled, discovered, maxPages, currentUrl, done }` — monotonic: `crawled` never decreases, `discovered` only grows, a final event with `done: true` closes the phase | `Crawler.onProgress` (today it exposes `discovered`, fires before processing, and has no terminal event — extended), threaded through `AuditorOptions.onCrawlProgress` |
| `page-start` / `page-complete` | `{ url, pageNumber, totalPages }` | per page in crawl mode |
| `category-complete` | `{ pageNumber, categoryId }` | per page per category — no scores, no rule payload (a per-page score is not the category score) |
| `audit-complete` | `{ auditId, summary: { overallScore, categories: [{ id, score, pass, warn, fail }] } }` or `{ auditId: null, saveError, summary }` — the UI then fetches the aggregated detail (`/api/audits/:id`, or `/api/runs/:runId/result` when unsaved); the full result never travels over SSE (1,000 pages × 332 rules ≈ 100 MB) | after persistence |
| `audit-error` | `{ code: 'dns' \| 'timeout' \| 'non-html' \| 'http-error' \| 'playwright-missing' \| 'no-pages' \| 'aborted' \| 'unknown', message, hint }` | abort or throw (`error` is reserved for the `EventSource` transport) |
| `heartbeat` | `{}` | every 15 s |

`RunState = { runId, status, url, options, startedAt, phase: 'crawl' \| 'rules' \| 'saving', crawl: { crawled, total }, page: { current, total }, categories: Record<categoryId, { pagesDone }>, auditId?: string (set once persisted), saveError?, error? }`.
It is bounded: no per-page rule results are retained. The session keeps a
finished run's state and aggregated result **until the next run starts or 15
minutes pass, whichever comes first** — one rule for saved and unsaved results,
so Export and Retry save keep working after a failed save; expiry is tested.

**One stream per visible tab.** Node's `http` server is HTTP/1.1 and Chrome
allows six connections per host, so every tab holding an `EventSource` would
starve `/api` fetches at six tabs. On `visibilitychange` a hidden tab closes
its `EventSource`; a tab that becomes visible opens one and receives
`snapshot`. Six or more simultaneously visible dashboards on one origin remain
bounded by the server-side cap above.

Every event carries `runId`. There is no event replay: `EventSource`
reconnects on its own and the `snapshot` sent on every (re)connect is the
reduced form of every event — phase, crawl and page counters, per-category
progress, and the terminal `status` and `auditId` — so a reconnecting tab is
fully caught up by the snapshot alone.

**Server-side bounds** (the visibility rule below is client etiquette, not
enforcement): `/api/events` accepts at most 8 concurrent
connections per server (`429 { code: 'too-many-streams', hint: 'Close another
dashboard tab' }` beyond that); a consumer whose socket stays back-pressured
across three heartbeats is disconnected; on shutdown the server ends every SSE
response first and then calls `server.closeAllConnections()`, so an open stream
cannot hold `server.close()` open. Event names mirror the adapter method names
(`onAuditComplete` ↔ `audit-complete`) so the two adapters map 1:1.

### 7.4 FR-4 — Persistence

- Every audit from the CLI (default-on, D-11; `--no-save` opts out), the
  dashboard, and the Electron app is saved with `saveAuditToDatabase()` in
  **one transaction**; a failure leaves no partial `running` row. `busy_timeout`
  is 500 ms (better-sqlite3's busy wait blocks the event loop) with asynchronous
  retries 500 ms apart for up to 10 s on `SQLITE_BUSY` — longer than the 3 s save
  budget, so a CLI audit finishing while the server persists cannot lose a result
  to a yellow banner. `recordComparison()` runs inside the same transaction. The save path also
  records the comparison against the domain's previous audit
  (`recordComparison()`), so the domain strip's regression badge and
  `/api/domains` read `audit_comparisons` instead of diffing on every request.
- Persisting a 1,000-page audit (≈ 332k rows) is synchronous in better-sqlite3.
  `saveAuditToDatabase()` streams rows into the prepared statement instead of
  building a second array (`save-audit.ts:59`), and Phase 1 benchmarks save,
  export, and compare on the synthetic fixture with budgets **save < 3 s and
  event-loop stall < 3 s**; if the stall budget fails, persistence moves to a
  `worker_threads` worker with its own connection (`src/storage/persist-worker.ts`,
  design reserved) rather than lowering the page limit.
- A crawl in which every page errored produces `audit-error { code: 'no-pages' }`
  and saves nothing (today `auditPages` skips errored pages and a 0-score audit
  would be stored). An unwritable data directory makes `serve` exit at startup
  with `Cannot create <dir>: <reason>. Set SEOMATOR_HOME to a writable path`
  (today the constructor's `mkdirSync` throws uncaught).
- Saved with it: `source`, `engine_version` (`getVersion()`), and `run_json`
  (the resolved `AuditRunArgs.options`).
- Save failure: the CLI always prints the yellow line (today it is hidden
  without `-v`), naming the database path and `seomator self doctor -v`; the
  dashboard `audit-complete` event carries `saveError` with the same hint and
  the UI shows the banner with the live result still displayed.
- URLs are stored and displayed **without userinfo** (a URL carrying HTTP basic-auth userinfo,
  `https://<userinfo>@host/` → `https://host/`, applied in `saveAuditToDatabase()` and to `RunState.url`)
  so a credential typed into the run box never reaches the database, SSE, or an
  export; query strings are kept because they may identify the audited page, and
  `docs/WEB-DASHBOARD.md` says not to audit URLs that carry secrets.
  `/api/info.dbPath` is rendered with `~` for the home directory.
- `--no-save` has a config equivalent, `[output] save = false` in
  `seomator.toml`, so CI users do not edit every command; `SEOMATOR_HOME`
  relocates the database for read-only homes and multiple profiles.
- History refreshes on `complete` and on window focus (audits saved by a
  concurrent CLI process appear without reload).

### 7.5 FR-5 — Screens and design decisions

Classification: **App UI** (workspace, data-dense, task-focused). Rules that
apply: calm surface hierarchy, dense but readable, one accent, cards only when
the card *is* the interaction, no decorative shadows on content, utility copy.
Every decision below is numbered `DD-n`; the register at the end says which
were auto-fixed by the design review and which are taste calls for the gate.

**Routes** (`/history` redirects to `/`):

| Route | Screen | Phase |
|---|---|---|
| `/` | Home — the history view (`?domain=` selects a domain) | 2 |
| `/audits/:id` | Detail | 2 |
| `/compare/:id/:against` | Compare | 2 |
| `/run` | Live run (redirects to `/` when nothing is running or recently finished) | 3 |

#### DD-1 Home is the history view (one screen, not two)

```
┌ toolbar 52px ── SEOmator ▪ [ History | Run ] ▪ ☾ ─────────────────────────────┐
│ [ https://example.com                                     ] [ Run audit ]  Ph.3 │  48px row, not a card
├───────────────────────────────────────────────────────────────────────────────┤
│ Domains                                                                        │  16px/600 label
│ ▌ example.com          84 ▲3   ▁▂▃▅▆   2 hours ago                             │  44px rows, ≤ 6
│   shop.example.com     71 ▼6   ▆▅▃▂▁   yesterday            ▼ 4 regressed      │  regression badge
│   docs.example.com     92 =    ▅▅▅▅▅   Aug 30                                  │  + "n more" link
├───────────────────────────────────────────────────────────────────────────────┤
│ example.com                                                                    │  20px/600 page title
│   84   ▲3 since Sep 1                Score trend                               │
│  56px  mono                      100 ┤            ┆ engine 3.5.0              │  SVG, 200px tall,
│                                      │   ──────╱──┆────                        │  y fixed 0–100,
│  What changed: 2 rules regressed,  0 └────────────┴────────────────            │  dashed rule where
│  5 fixed  →  Compare                  Aug 12          Sep 2                    │  engine version changed
├───────────────────────────────────────────────────────────────────────────────┤
│ Audits                                                                         │
│ Sep 2, 18:34   https://example.com/            84   1 page    F 12 · W 30      │  row = link
│ Sep 1, 22:30   https://example.com/            81   10 pages  F 15 · W 28      │
│ Load more                                                                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **First, second, third:** the domain strip (which sites, which need
  attention), the selected domain's latest score with what changed, the
  audits list. If only three things fit, these three.
- The strip is rows, not cards: name, latest score, delta vs previous, a
  60×16 px inline sparkline (last 10 scores), relative time, and a
  regression badge (`▼ n regressed`) when the last compare has regressions.
  Sorted: domains with regressions first, then by last run. More than six →
  "n more" expands. **A single domain collapses the strip into the headline**
  (no one-row list).
- Selecting a row (click, Enter, arrow keys) updates `?domain=`, the anchor,
  and the list. The score numeral opens the latest audit; "Compare" opens
  `/compare/<latest>/<previous>`.
- The Phase 3 run row (DD-4) sits directly under the toolbar, one line, no
  card, so it never competes with the anchor.
- **Empty state (no audits at all)** replaces everything under the toolbar
  with one composition, not an empty table shell:
  ```
  No audits yet.
  Run one from your terminal and it will appear here:
  [ seomator audit https://example.com ]  [Copy]      ← `npx @seomator/seo-audit audit …` when
                                                        the server itself was launched via npx
                                                        (`/api/info.cli`, from `npm_command === 'exec'`)
  This page refreshes when you come back to it.
  Older reports in .seomator/reports? Import them → seomator db migrate
  History is stored in ~/.seomator/audits.db
  ```
  In Phase 3 the run row stays above it as the primary action.

#### DD-2 Detail is the audit, not the runner

- No URL form above a stored audit. The page opens on the `ScoreCircle`
  (140 px, existing) with the URL, date, source (`cli` / `dashboard` /
  `desktop`), engine version, and pages audited as one utility line under it.
- The action bar sits on the same row as the score, right-aligned: one
  primary button **Re-run** (Phase 3), then **Compare with previous**, then an
  overflow menu `⋯` with Export HTML / Markdown / JSON / LLM, Copy for LLM,
  Delete. The menu is a native `<details>`-style popover with roving focus.
- Sections below (categories, issues, rules) are **page regions separated by
  1 px dividers and 32 px vertical rhythm**, not elevated boxes. Elevation
  (`--shadow-*`) is reserved for popovers and dialogs. This restyles the
  existing result view for both shells (taste T-5).
- The category sidebar is detail-only navigation (not global); under 1024 px
  it becomes a horizontal chip row that scrolls, pinned under the toolbar.

#### DD-3 Compare

- Header: `Sep 2 → Sep 1` with the delta as a 32 px mono numeral (`▲3`),
  then the "what changed" sentence, then — only when the engine version
  differs — one muted 13 px line: `Engine changed 3.3.0 → 3.5.0; some
  differences are new rules, not your site.`
- Category deltas as a table (category, before, after, delta), sorted by
  absolute delta.
- Rule lists: **one row per rule** (never per page): worst status on each side,
  `on 3 of 40 pages` suffix in crawl audits, grouped by category, sorted by
  rule weight. Four lists in this order: Regressed, Added (new rules that
  fail), Improved, Removed. Each row links to the rule in the detail page.
- State: score delta 0 but rules moved → `No score change · 4 rules moved`.
- `against` picker: a select of the domain's other audits (date + score).

#### DD-4 Live run (Phase 3)

- The run row: 48 px, URL input with a visible label ("URL" as a 12 px caption
  above, not placeholder-as-label), options as toggles to the right
  (Crawl · max pages · Core Web Vitals · Mobile parity* · Interaction*;
  `*` shown only when `capabilities` allow), one **Run audit** button.
- Progress composition, fixed and updated in place, never a growing feed:
  ```
  Auditing https://example.com                 [Cancel]
  ██████████░░░░░░░░░░░░░░░░░░  crawl 10/10 · audit 4/10 pages
  Page 4 of 10 · https://example.com/pricing · Performance
  ●●●●●●●●○○○○○○○○○○○○   20-cell category row for the current page
  ```
  Percent = crawl phase `crawled / min(discovered, maxPages) × 30` (the session
  clamps it so it never regresses while discovery grows) + rules phase
  `(pagesDone × 20 + categoriesDoneOnPage) / (totalPages × 20) × 70`. The tab
  title mirrors it: `⏳ 42% · SEOmator`. Single-page audits skip the crawl
  segment. `RunState.categories` carries per-category `pagesDone` only; no
  per-page scores are shown (they are not the category score).
- On completion: 200 ms cross-fade to `/audits/:id`, then the existing 1 s
  score sweep — the climax of the flow. After a Re-run, the line
  `Comparing against Sep 1…` shows during the run and the redirect goes to
  `/compare`.
- **Cancelled is not an error:** a neutral state `Audit cancelled · [Run
  again]`, never the red failure box.
- Save failure keeps the live result and shows a yellow banner: `Not saved —
  this result exists only in this tab. [Export HTML] [Retry save]`; Export is
  the primary action.

#### DD-5 Interaction states (what the user sees)

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Home | fixed-height skeletons (row 44 px, chart 200 px, score 56 px line) — no text that reflows | DD-1 empty composition | `Dashboard server stopped. Run seomator serve, then [Reconnect]` | strip + anchor + list | filter with zero audits: `No audits for shop.example.com since Aug 1` |
| Detail | skeleton in the score slot | — | `Audit not found` + `Back to history` (also after a delete in another tab) | result | `saveError` banner (live result only) |
| Any error / 404 state | — | — | a muted `Report a problem` link opens a prefilled GitHub issue (version, route, error code) | — | — |
| Compare | skeleton header | `First audit for this domain — nothing to compare yet` | either side missing → same as detail | deltas | `No score change · n rules moved`; engine-changed line |
| Run | — | `/run` with nothing running → redirect `/` | `Audit failed: <engine message>` + `[Try again]` | redirect to detail/compare | `Audit cancelled · [Run again]`; second tab hitting `409` navigates to `/run` |
| Delete | button spinner | — | toast `Could not delete` | back to `/` + toast `Deleted example.com · Sep 2, 18:34` | — |
| Copy for LLM | — | — | toast `Copy failed` | toast `Copied 84 KB` | — |
| Export | menu item spinner | — | toast `Export failed` | browser download | — |

#### DD-6 Copy

Utility language only. The strings above are the strings; sentence case;
no exclamation marks; commands in `<code>`; relative times with the absolute
time on hover (`title`).

#### DD-7 Responsive (intentional per viewport)

| Viewport | Layout |
|---|---|
| ≥ 1280 px | as drawn: toolbar, run row, strip, anchor (score left 320 px, trend fills), list, detail with 260 px category sidebar |
| 768–1279 px | anchor stacks (score above trend); detail sidebar becomes the chip row; strip keeps one row per domain |
| < 768 px (375 px target) | strip rows drop the sparkline; audit rows become two-line records (`URL · score pill` / `date · pages · F/W`); compare tables become stacked before → after rows; the action bar is one primary button + overflow; the trend keeps its height with 3 x-axis labels; run options collapse into a `Options` disclosure |

The toolbar drops the traffic-light padding outside Electron (`shell` prop).
Nothing hides behind hover.

#### DD-8 Accessibility (acceptance criteria, WCAG 2.2 AA)

- Skip link to main content; landmarks `header`, `nav`, `main`.
- Rows are links: the first cell contains `<a href>` and a `::after`
  pseudo-element covers the row; no `tabIndex` on `<tr>`.
- Popover menu and confirm dialog use native `<dialog>` / `popover`; focus
  moves in on open and returns to the trigger on close; Escape closes.
- Form errors are associated with inputs via `aria-describedby`.
- The trend chart carries `<title>`/`<desc>` and a visually hidden table
  of points; sparklines are `aria-hidden` with the delta in text next to them.
- Progress region is `aria-live="polite"`; percent and phase are text.
- `prefers-reduced-motion` disables the cross-fade, draw-in, and score sweep.
- Touch/click targets ≥ 44 × 44 px (toolbar controls today are 28 px: hit
  area padded to 44).
- Contrast: body and secondary text ≥ 4.5:1, status text on status
  backgrounds ≥ 4.5:1 — see DD-9 token changes.

#### DD-9 Type scale and tokens

- Scale: 12 (captions) / 13 (table meta) / 14 (table cells, labels) / 16
  (section labels, rule descriptions, fix text — prose is never below 16) /
  20 (page title) / 32 (compare delta) / 56 (home score). Mono for numerals.
- Token changes (both themes re-checked): `--color-text-muted` moves from
  `#94a3b8` (2.5:1 on `#f8fafc`) to `#64748b` (4.6:1) wherever it is used for
  text; the old value stays for hairlines as `--color-line-muted`. Status
  text on status backgrounds uses new `--color-pass-text #047857`,
  `--color-warn-text #b45309`, `--color-fail-text #b91c1c` (all ≥ 4.5:1 on
  their `-bg` tokens). `--shadow-*` is used only by popovers, dialogs, and the
  toolbar.

#### DD-10 Motion

Three intentional motions, all 200–400 ms, all off under reduced motion:
the score sweep on detail (exists), the 200 ms cross-fade from `/run` to the
result, and a 400 ms draw-in of the trend line on first render. Nothing else
animates.

#### DD-11 Navigation

- Toolbar segments: `History | Run` (Phase 2 shows `History` only; the toggle
  appears in Phase 3). Detail and Compare are drill-ins: the toolbar's centre
  slot shows a back crumb `← example.com` instead of the segments.
- Current section is visually indicated; the trunk test passes with the
  toolbar alone (brand, section, back).

#### Design decision register

| # | Decision | Source | Status |
|---|---|---|---|
| DD-1 | Home = history; strip rows not cards; anchor = score + what changed + trend | both design voices (hard rejection: card grid; no anchor) | auto-fixed (structural) |
| DD-2 | Detail without runner; page regions not stacked cards; detail-only sidebar → chips | both voices (hard rejection: stacked cards) | auto-fixed; T-5 accepted at the gate (2026-09-02) |
| DD-3 | Compare per-rule rows, four lists, engine line placement | Claude voice | auto-fixed |
| DD-4 | Progress composition + percent formula; cancelled ≠ error; save-error copy | both voices | auto-fixed |
| DD-5/6 | State table with visible copy | both voices | auto-fixed |
| DD-7 | Per-viewport layouts | both voices | auto-fixed |
| DD-8 | WCAG 2.2 AA acceptance list | Codex voice | auto-fixed |
| DD-9 | Type scale; contrast token fixes; shadows only on overlays | Codex voice (contrast), Claude voice (scale) | auto-fixed; T-6 (14 px table text) accepted at the gate (2026-09-02) |
| DD-10 | Three motions | both (NOT SPEC'D) | auto-fixed |
| DD-11 | Segments + back crumb | Claude voice | auto-fixed |

Interaction edge cases still handled as before: double submit (button
disables; `409` toast then navigate to `/run`), reload mid-run (`snapshot`),
second tab, server stopped, back button (one history entry per route; the
run view is replaced on completion), long URLs (truncate + `title`), delete
of a domain's latest (strip recomputes), delete while open elsewhere (404
state on next fetch).

### 7.6 FR-6 — Security

- **Per-launch token.** `serve` generates a 32-byte random token at startup,
  prints it once, and writes `$SEOMATOR_HOME/serve.json` (mode 0600) with
  `{ port, token, pid, startedAt }`, deleted on shutdown. Every `/api` request
  must present it either as the `seomator_token` cookie — set `HttpOnly;
  SameSite=Strict; Path=/api` on every response that serves `index.html`, so
  the browser and its `EventSource` carry it automatically — or as an
  `X-SEOmator-Token` header (agents, curl). Otherwise
  `401 { code: 'unauthorized', hint: 'Read the token from ~/.seomator/serve.json or the serve output' }`.
  This closes the vector the adversarial review rated critical: a process that
  reaches loopback without home-directory access (sandbox, `ssh -L`,
  host-network container) could otherwise read, export, and delete history and
  start audits at internal URLs. The checks below stay as defence in depth.
- Bind `127.0.0.1` only. Every `/api` request must satisfy: `Host` ∈
  `{127.0.0.1:port, localhost:port, [::1]:port}`; if `Origin` is present it
  must be `http://` + one of those; if `Sec-Fetch-Site` is present it must be
  `same-origin` or `none`. Otherwise `403 { code: 'bad-origin' }`. Requests
  with no `Origin` (curl, agents) are allowed only with the token header.
- `POST /api/runs`: `Content-Type` must be `application/json` (`415`), JSON body
  ≤ 64 kB (`413`) parsed into a null-prototype object, URL via `validateUrl()`,
  length ≤ 2048, out-of-range numbers and unknown keys rejected with `400`.
- Every response whose body is `index.html` — `/`, and every SPA fallback such
  as `/audits/<id>`, `/compare/...`, `/run` — sends `X-Frame-Options: DENY` and
  `Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'`;
  a request with `Sec-Fetch-Dest: iframe|embed|object` gets `403` — otherwise
  any website could frame the dashboard and overlay Delete or Run (the SPA's
  own fetches are same-origin and would pass the `/api` checks).
- No cross-origin browser access (no CORS headers, no `OPTIONS`): the dev loop
  goes through the Vite proxy, which is same-origin from the browser's view, so
  an `--allow-origin` flag would have been a CORS contract nobody needs.
- Export filenames come from the validated audit id only.
- Static serving resolves inside `dist/web`; anything escaping → `404`;
  `%2e%2e` and NUL bytes are rejected before resolution; a path with a file
  extension that does not exist → `404`, never the SPA fallback (a stale hashed
  asset after an upgrade must fail loudly, not render `index.html` as JS);
  `Host` without a port is accepted only as `localhost` or `127.0.0.1`.
- Headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Cache-Control: no-store` on `/api` and `index.html`; hashed assets
  `max-age=31536000, immutable`.
- The renderer contains no `dangerouslySetInnerHTML` (verified: zero uses);
  rule messages render as text.

### 7.7 FR-7 — Cancel and progress (engine change, Phase 1)

`AuditorOptions` gains `signal?: AbortSignal` and `onCrawlProgress?`:

- `signal` is passed to `Crawler` (`CrawlerOptions.signal`) which stops
  dequeuing and aborts in-flight `fetchPage()` calls; to `fetchPage()`
  (`FetchPageOptions.signal`, combined with its own timeout controller); to
  `fetchPageWithPlaywright()` / `fetchPageWithBrowserWindow()` (closes the
  page/window on abort); to `fetchSitemap()` / robots fetch; and is checked
  between rules in `runAllCategories()`.
- On abort the `Auditor` throws `AuditAbortedError` (exported) after its
  cleanup, which moves to `finally` blocks in both `audit()` and
  `auditWithCrawl()`.
- `AuditSession.start()` refuses a new run until the previous promise has
  settled.
- `AuditorOptions.onPageStart` is added beside `onPageComplete` (the engine has
  no page-start callback today, `auditor.ts:125`), and the crawler's progress
  callback gains a terminal event; an engine → session → adapter test asserts
  the percent is monotonic and reaches 100 exactly once.
- `AuditContext.signal?: AbortSignal` (additive, optional) reaches every network
  call a rule makes: the shared `fetchUrl()` / `fetchUrlWithRedirects()` helpers
  (used by `links-broken-internal`, `links-external-valid`, `images-broken`,
  `links-redirect-chains`, `www-redirect`, `canonical-redirect`,
  `sitemap-exists`, `robots-txt-exists`) and the two direct `fetch()` calls that
  bypass them today — `security/https-redirect.ts:16` with its own controller and
  `crawl/canonical-redirect.ts:36,58` timeout-only — which are routed through the
  helper; each helper combines its own timeout with the caller's signal via
  `AbortSignal.any()`, so a cancel never waits for a rule's sequential HEAD
  requests with 10 s timeouts. The cancel test covers all ten call sites.
- Every `catch` on the crawl and render path re-throws when `signal.aborted`
  (`crawler.ts:287-293` records an aborted fetch as an errored page and
  continues; `:308` and `auditor.ts:330` swallow a render abort and audit the
  HTTP HTML instead), so an abort never degrades into "page errored, carry on".
- `AbortSignal.any()` combines the caller's signal with the fetchers' own
  timeout controllers (`fetcher.ts:180`, `crawler.ts:149`); it needs Node ≥ 20.3,
  so `engines` moves to `>=20.3.0`.
- The engine throws a typed `AuditError { code }` (the codes in FR-3) instead of
  plain `Error`s (`auditor.ts:286`), so classification never parses messages.
- The mobile-parity render uses the injected `browserFetcher` with a viewport
  option instead of calling `fetchPageWithPlaywright()` directly
  (`auditor.ts:313` bypasses the Electron fetcher today); until
  `electron-fetcher.ts` implements viewport and interaction options, Electron
  advertises `capabilities.mobileParity = false` and `simulateInteraction =
  false`, the bridge does not map them, and the session answers `400
  unsupported-option` — the UI never shows a toggle the shell cannot honour.
- `initBrowser()` clears its cached promise when the launch rejects and
  `closeBrowser()` tolerates a failed launch (`playwright-fetcher.ts:41-85`
  caches the rejection today), so one missing Chrome cannot poison a
  long-lived server; the capability probe uses the same path.
- `CrawlerOptions.fetchPage` is injectable (the crawler hard-imports `fetchPage`
  today) so abort tests need no module mocking.
- Engine failures are classified for the user: `AuditSession` maps the thrown
  error to `code` ∈ {`dns`, `timeout`, `non-html`, `http-error`,
  `playwright-missing`, `no-pages`, `aborted`, `unknown`} with a `hint` (`Install Chrome or
  untick Core Web Vitals`), reusing `unauditableReason()` from the crawler.

### 7.8 FR-8 — Build and packaging

- `npm run build` = `node scripts/clean.mjs && tsup && vite build -c vite.web.config.ts` (`fs.rmSync`, Windows-safe)
  → `dist/web/`. `tsup.config.ts` drops `clean: true` (it would wipe `dist/web`
  on every `npm run dev` watch rebuild).
- `npm run typecheck` also runs `tsc -p ui --noEmit` (`ui/tsconfig.json`);
  a `vitest.workspace.ts` (the installed vitest is 2.1.x; inline `test.projects`
  arrives in 3.2) defines two projects — `node` for `src/**/*.test.ts` and
  `jsdom` for `ui/**/*.test.{ts,tsx}` — and the `include` glob widens to `.tsx`;
  devDependencies add `jsdom`, `@testing-library/react`, and `axe-core` (today
  only `vite` was listed).
- `vite.web.config.ts`: root `ui/`, `base: '/'`, `react()` + `tailwindcss()`,
  `outDir: dist/web`, dev proxy `/api → 127.0.0.1:7360` with `changeOrigin: true`;
  the proxy rewrites `Origin` to the server's own origin **only when the
  incoming `Origin` is exactly `http://localhost:5173`** and drops nothing else
  — a cross-site page posting to the dev port still arrives with its foreign
  `Origin` and is rejected (tested both ways). `vite` pinned in
  `devDependencies`.
- `npm run web:dev` = `concurrently 'tsup --watch' 'node --watch dist/cli.js
  serve --no-open' 'vite dev -c vite.web.config.ts'` — `concurrently` is a
  devDependency (no runtime cost) and Node's `--watch` restarts the server when
  tsup rewrites `dist/cli.js`; without `dist/web` the server serves `/api` only
  and Vite serves the UI through the proxy.
- `src/cli.ts` lazy-imports `./commands/serve.js` inside the action so
  `seomator audit` start-up is unchanged (measured before/after).
- `files: ["dist"]` unchanged; budget: `dist/web` gzipped ≤ 400 kB, no
  Recharts (D-14).
- `electron-builder.yml` already excludes `dist/**`.

### 7.9 FR-9 — Data parity (schema, Phase 1)

```
audit_results  + weight INTEGER            -- NULL (legacy) reads as 1
audits         + source TEXT               -- 'cli' | 'dashboard' | 'desktop' | 'api'
               + engine_version TEXT
               + run_json TEXT             -- resolved AuditRunArgs.options
```

Idempotent `ALTER TABLE ... ADD COLUMN` guarded by `PRAGMA table_info`, in
`initializeAuditsSchema()`, and tolerant of the cross-process race (a CLI and
the dashboard opening a fresh file at the same time can both see the column
missing): a `duplicate column name` error is caught and ignored; tested with
two fresh processes initializing the same file concurrently. `queries.getAuditDetail()` reads all rows
(`getResults(auditId, { limit: Infinity })` becomes an explicit
`getAllResults()`), computes `notMeasuredCount` from `weight = 0`, and excludes
those from `warnCount` exactly as `buildCategoryResult()` does.

### 7.10 FR-10 — `report` reads SQLite (Phase 1)

`seomator report --list` and `report <id>` read the audits database; when the
id is not found there, they fall back to `.seomator/reports/<id>.json` and print
a one-line hint to run `seomator db migrate`. Output shapes are unchanged.
`seomator self doctor` gains "web assets present" and "`~/.seomator` (or
`SEOMATOR_HOME`) writable" checks, and its Node line says `20+` (it says `18+`
while `engines` requires 20).

### 7.11 FR-11 — Documentation and the skill

README "Web Dashboard" section with one copy-paste first-run block
(`npx @seomator/seo-audit serve --audit https://example.com`) and the `report`
behaviour change under its `report` section; `docs/WEB-DASHBOARD.md` (command,
API reference with every error code and hint, SSE reference, a poll-only agent
loop and an `EventSource` snippet, security model, dev loop, upgrade guide
3.3.0 → 3.4.0 → 3.5.0, QA checklist, runbook anchors the error `See:` links
point at);  `docs/README.md`
(still says 148 rules / 16 categories), `docs/quickstart.md` (v2.2.0 banner),
and `docs/ai-agent-integration.md` (`--save` recipe) brought current;
`scripts/sync-docs.mjs` extended to every public doc so counts cannot drift
again; `SKILL.md`/`skill/SKILL.md`: drop
`--save` from the recipes (now default) and add "suggest `seomator serve` when
the human wants to review history"; `CLAUDE.md`/`AGENTS.md`: `ui/`,
`src/dashboard/`, build order, `getAPI()` never returns `null` in a browser,
and the stale `exports` row (`package.json` says `./dist/index.js`);
`docs/ELECTRON-APP.md` and `docs/STORAGE-ARCHITECTURE.md` diagrams updated;
`CHANGELOG.md`; `TODOS.md` created.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Start-up | `serve` listening + browser open < 2 s warm |
| Query latency | `/api/audits` (50 rows) < 50 ms; aggregated `/api/audits/:id` for a 1,000-page audit (332k rows, one `GROUP BY` on the indexed `audit_id`) < 500 ms; `/api/domains` < 50 ms with 1,000 audits (reads `audit_comparisons`) |
| Memory | idle server < 120 MB RSS; `RunState` bounded (no per-page rule payloads) |
| Persistence | 1,000-page save < 3 s and event-loop stall < 3 s (benchmarked in Phase 1; worker-thread fallback if exceeded) |
| Bundle | `dist/web` gzipped ≤ 400 kB; packed tarball ≤ 900 kB (today 453.6 kB) |
| Dependencies | 0 new `dependencies`; `vite`, `concurrently`, `jsdom`, `@testing-library/react`, `axe-core` added to `devDependencies`; `recharts` removed |
| Node | ≥ 20.3 (`AbortSignal.any`); `engines` bumped from `>=20.0.0` |
| Browsers | last two versions of Chrome, Firefox, Safari, Edge |
| Accessibility | keyboard-operable rows and actions, visible focus, `aria-live="polite"` on the progress view, colour paired with text |
| Responsive | usable at 375 px, 768 px, 1280 px |
| Theme | existing `useTheme()`; respects `prefers-color-scheme` |

## 9. Data model changes

See §7.9. No table created, renamed, or dropped; older CLIs ignore the new
columns; `seomator db stats` unchanged.

## 10. Security threat model

| Threat | Vector | Mitigation | Residual |
|---|---|---|---|
| Malicious website drives the local server | cross-site `fetch`/form POST to `127.0.0.1:7360/api/runs` | `Origin` + `Sec-Fetch-Site` checks | none for browsers |
| DNS rebinding | attacker hostname resolves to `127.0.0.1` | `Host` allow-list | none |
| SSRF by design | `POST /api/runs` fetches any URL, including intranet | that is the product; the token and origin checks stop anything but a same-user process from choosing the URL; http/https only | a process running as the same user (it can read `serve.json`, as it could run the CLI) |
| Path traversal | `GET /../package.json` | resolve inside `dist/web` | none |
| Oversized body | `POST` with 100 MB | 64 kB cap → `413` | none |
| Stored XSS via audited page text | rule messages echo page content | React escaping; zero `dangerouslySetInnerHTML`; HTML export escapes in the reporter | verify in review |
| Denial of service | many `POST /api/runs` | single run (`409`); loopback | none |
| Stream exhaustion | many `/api/events` connections, slow consumers, streams holding shutdown open | 8-connection cap (`429`), slow-consumer disconnect after three heartbeats, SSE ended before `closeAllConnections()` | none |
| Server-side request forgery via the audited page | a malicious page redirects or links to loopback, RFC1918, or cloud-metadata addresses; the engine follows redirects and checks links today (`fetcher.ts`) | pre-existing engine behaviour shared with the CLI; the dashboard adds no new trigger beyond origin-checked local requests; hardening (refuse hops from a public start URL into private ranges unless `--allow-private`) is a TODOS.md item for the engine | present until the engine item lands |
| Credentials in audited URLs | basic-auth userinfo (`https://<userinfo>@host`) or a secret-bearing query string typed into the run box | userinfo stripped before storage and display; query strings documented as user responsibility | query-string secrets |
| Data at rest by default | with persistence default-on, every audited URL, rule `details` (cookie names, headers), and run options persist in `audits.db` without opt-in | `--no-save`, `[output] save = false`, `SEOMATOR_HOME`; userinfo stripped; the CHANGELOG `Changed` entry says so plainly; a `db prune --older-than` retention command is a TODOS.md item | same-machine readers, as with the CLI's report files today |
| Unattended server started by an agent | skill runs `serve` in the background | the skill never starts `serve`, only suggests it; `Ctrl-C` ends a session | operator's choice |
| Loopback reachable without home-directory access | sandboxed process, `ssh -L`, host-network container | per-launch token required on every `/api` request (cookie or header) | none |
| Secrets in exports | `details` may contain cookie names/headers | same as today's CLI reports | unchanged |

---

## 11. Work breakdown (project plan)

Estimates at both scales: a human team and Claude Code with gstack. Phases are
sequential; ∥ marks tasks that can run in parallel inside a phase. Each phase
ends with its acceptance criteria green and a CHANGELOG entry.

### Phase 1 — Foundations → release 3.4.0

Goal: make the stored history complete, trustworthy, and default-on; make
cancel real; give both shells one session and one contract. No dashboard yet.

| # | Task | Files | Human / CC |
|---|---|---|---|
| 1.1 | Persistence default-on: `--no-save` flag and `[output] save` config key; `--json-report` writes the legacy JSON; `--save` is a deprecated alias (`getOptionValueSource`) that prints a notice; `analyze` same; `SEOMATOR_HOME` honoured by `getGlobalDir()`; save failure always printed; `self doctor` gains the data-directory-writable check and says Node `20.3+` (3.4.0 raises the floor); SKILL/README recipes updated | `cli.ts`, `commands/audit.ts`, `commands/analyze.ts`, `SKILL.md`, `skill/SKILL.md`, `README.md` | 4 h / 15 min |
| 1.2 | Schema: `weight`, `source`, `engine_version`, `run_json`; `busy_timeout` 500 ms + async retries; `saveAuditToDatabase()` in one transaction, recording the comparison vs the previous audit; `save-audit.ts` and the crawl/report stores switch to the existing `randomBytes` `generateId()` in `utils/hash.ts` (the `paths.ts` copy is deleted); `ORDER BY started_at DESC, id DESC` (the list store dedupes by `auditId` if a CLI save lands between two Load-more clicks); `AuditsDatabase.open(path)` test seam; tests incl. legacy-NULL, concurrent-writer, and an older-CLI insert into the newer schema | `schema.ts`, `results.ts`, `audits.ts`, `save-audit.ts`, `storage/types.ts`, tests | 1 d / 25 min |
| 1.3 ∥ | `src/dashboard/queries.ts`: `getAuditDetail()` aggregated per rule in SQL (worst status, affected pages, sample pages, not-measured parity, category order), `getRulePages()` keyset, `listDomains()` from `audit_comparisons`, `getTrend()`; export and compare keep all-rows reads server-side; temp-DB tests incl. a 40-page fixture and a synthetic 1,000-page one | new + tests | 1 d / 25 min |
| 1.4 ∥ | Comparison: `buildComparison()` pure, `recordComparison()` explicit; `getPreviousAudit()` by `started_at <`; `rule-diff.ts` with `added`/`removed`; `compare.ts` uses them; `getScoreTrend` single reversal (the component side of the double reverse is fixed in 2.5, which rewrites `ScoreTrend`); `engineChanged` flag | `comparisons.ts`, `audits.ts`, new `rule-diff.ts`, `compare.ts`, tests | 1 d / 25 min |
| 1.5 | Cancel end-to-end (FR-7) with tests: abort before first fetch, mid-crawl (queue drains, in-flight aborts), during render, during a rule's own HEAD loop; every catch re-throws on abort; `AbortSignal.any` + `engines >=20.3`; typed `AuditError`; `initBrowser()` rejection reset; injectable `fetchPage`; cleanup in `finally`; `AuditAbortedError`; assertions use an injected fetcher's in-flight counter, not wall-clock | `auditor.ts`, `crawler.ts`, `fetcher.ts`, `playwright-fetcher.ts`, `sitemap.ts`, `robots.ts`, `electron-fetcher.ts`, tests | 2 d / 45 min |
| 1.6 ∥ | Crawl progress: `onCrawlProgress` on `AuditorOptions`, wired to `Crawler.onProgress`; CLI progress reporter shows it | `auditor.ts`, `reporters/progress.ts`, tests | 3 h / 15 min |
| 1.7 | `src/dashboard/audit-session.ts`: `AuditSession` (start/cancel/state/subscribe), page-aware bounded `RunState`, persistence with provenance, capability probe (`playwright` available?); fake-Auditor tests | new + tests | 1 d / 25 min |
| 1.8 | `src/dashboard/contract.ts`; `ipc-types.ts` re-exports; Electron bridges become thin adapters over 1.3/1.7; Electron persists and cancels; `AppInfoIpc` gains `capabilities`; the store's per-page `completedCategories` growth (`ProgressStream.tsx:37,101`) is fixed here, not in Phase 3, because Electron ships these bridges in 3.4.0 | `contract.ts`, `ipc-types.ts`, `audit-bridge.ts`, `db-bridge.ts`, `preload/index.ts` | 1 d / 25 min |
| 1.9 | `report` reads SQLite with JSON fallback (FR-10) | `commands/report.ts`, tests | 3 h / 15 min |
| 1.10 | Renderer move to `ui/` (D-2, accepted at the gate); electron-vite root, tsconfig, docs | ~35 files moved, 4 edited | 2 h / 10 min |
| 1.11 | Docs + CHANGELOG + release 3.4.0: STORAGE-ARCHITECTURE schema, ELECTRON-APP diagram (also fixes its stale "287 rules"), CLAUDE.md `exports` row | 6 docs | 4 h / 20 min |

**Acceptance:** `npm run typecheck && npm run test:run` green; `npm run
electron:build && npm run electron:pack` succeed; `seomator audit
<url> --no-cwv` with no flags appears in `seomator compare <domain> --trend`;
`report --list` and `compare` agree; `npm run electron:dev` runs an audit that
appears in History and cancel stops network activity within 2 s (verified with
`--verbose` request logging); a stored 40-page audit reconstructs all 11,480
rows with correct not-measured counts; `GET`-style compare called twice adds
zero rows to `audit_comparisons`.

### Phase 2 — Read-only dashboard (`serve` without execution)

| # | Task | Files | Human / CC |
|---|---|---|---|
| 2.1 | `server.ts`: `http.createServer`, table-driven router, the one error envelope with `hint`/`details`, `GET /api` index derived from the router table, token check (`401`), security checks (FR-6), `415`, null-prototype JSON, `X-Frame-Options`/CSP/`Sec-Fetch-Dest` on `/`, request logging; `static.ts` with SPA fallback only for extension-less paths, encoded-traversal and NUL rejection | new | 1.5 d / 35 min |
| 2.2 ∥ | Read endpoints: info, audits, detail, domains, trend, compare, export, delete | `api.ts` | 1 d / 25 min |
| 2.3 ∥ | `commands/serve.ts` + Commander wiring (lazy import), browser open (`BROWSER=none`), signals, `--port 0`, source-vs-package assets behaviour, port-in-use message, `See:` links; `validateUrl` moved; `self doctor` gains the web-assets check; token generation + `serve.json`; `web:dev` via `concurrently` + `node --watch` | `serve.ts`, `cli.ts`, `crawler/validate-url.ts`, `commands/doctor.ts`, `package.json` | 6 h / 30 min |
| 2.4 | Renderer web mode: `http-api.ts` (queries), `getAPI()` selection, router (D-4), toolbar segments + back crumb, shell-aware header, category chip row < 1024 px, row-as-link pattern, 404 page, server-stopped state (DD-7, DD-8, DD-11) | `ui/lib/*`, `App.tsx`, `Header.tsx`, `Sidebar.tsx`, `AuditList.tsx`, new pages | 2 d / 45 min |
| 2.5 ∥ | `vite.web.config.ts`, `package.json` scripts (`scripts/clean.mjs` before tsup; `clean: false`), `ui/tsconfig.json` in `typecheck`, `vitest.workspace.ts` (`node` + `jsdom` projects) with `jsdom`/`@testing-library/react`/`axe-core` devDependencies, SVG line chart replacing Recharts (D-14; absorbs the 1.4 component fix), bundle budget check script | 6 files | 6 h / 30 min |
| 2.9 (runs before 2.6; T-5 accepted) | Design system pass (DD-8, DD-9, DD-10): contrast-safe text tokens, type scale, shadows only on overlays, de-card the result view, three motions under a reduced-motion guard, skip link and landmarks, `axe-core` zero violations per page | `ui/styles/globals.css`, `CategorySection.tsx`, `RuleCard.tsx`, tests | 1 d / 25 min |
| 2.6 | Home per DD-1 (domain strip, score headline, what-changed line, SVG trend with engine rule, list with two-line mobile rows, empty composition), detail per DD-2 (score-first header, action bar + overflow menu, page regions), compare per DD-3 (per-rule rows, four lists, engine line) | `ui/pages/{HomePage,AuditDetailPage,ComparePage}.tsx`, `ui/components/{DomainStrip,ScoreHeadline,TrendChart,ActionMenu,RuleChangeList}.tsx` | 3 d / 1.25 h |
| 2.7 | Electron parity: same routes under `HashRouter`; export through IPC (`dialog.showSaveDialog`) — the one adapter difference | `db-bridge.ts`, `preload/index.ts`, `http-api.ts` | 3 h / 15 min |
| 2.8 | Tests: server on port 0 with `fetch` — every route's 200/204, 400, 403 (`Origin`, `Host`, `Sec-Fetch-Site` matrix), 404, 413; traversal; export headers; `TZ` variants for dates | `server.test.ts` | 1 d / 30 min |

**Acceptance:** `npm run build && ./dist/cli.js serve` opens the browser to a
populated history; detail of the 40-page audit renders fully; compare of two
audits across an engine upgrade shows the banner and the added/removed lists;
export opens in a browser; `npm pack --dry-run` lists `dist/web/**` and nothing
outside `dist/`, packed size ≤ 900 kB; `curl -H 'Origin: http://evil.test'
.../api/audits` → 403; the same `ui/` build still works in `npm run electron:dev`.

### Phase 3 — Run from the browser

| # | Task | Files | Human / CC |
|---|---|---|---|
| 3.1 | Run endpoints (`POST`, `current` as `200 { run }`, `/api/runs/:runId`, `save: false`, strict option validation) + SSE fan-out (`events.ts`): snapshot on connect, heartbeat, retention, error classification with hints, `--audit` with the audit flags | `api.ts`, `events.ts`, `serve.ts`, `audit-session.ts` | 1.25 d / 35 min |
| 3.2 | `http-api.ts` events: one `EventSource` per visible tab (closed on hidden, reopened on visible), native reconnect, `snapshot` replay into the store; `audit-complete` → fetch the aggregated detail (or `/api/runs/:runId/result` when unsaved) | `http-api.ts`, `audit-store.ts` | 1.25 d / 30 min |
| 3.3 | `AuditRunner`: category chips from `/api/info`, mobile/interaction toggles gated by `capabilities`, concurrency when crawl is on, options persisted in `localStorage`; Re-run pre-fill; auto-navigate to compare after a Re-run | `AuditRunner.tsx`, `AuditDetailPage.tsx` | 4 h / 20 min |
| 3.4 | Run screen per DD-4: two-segment progress, percent formula, 20-cell category row, cancelled state, save-error banner with Export primary, `409` → navigate to `/run`, tab-title progress, `aria-live`, cross-fade to the result | `ProgressStream.tsx`, `ui/pages/RunPage.tsx` | 6 h / 25 min |
| 3.5 | Tests: SSE snapshot/replay/reconnect (fake timers), `409`, cancel via `DELETE`, adapter ↔ store mapping (jsdom) | `events.test.ts`, `http-api.test.ts` | 1 d / 30 min |

**Acceptance:** start a 10-page crawl from the browser, watch crawl-phase
progress, reload mid-run and see it resume, cancel and see network stop, run to
completion and land on `/audits/:id` with the audit in history; two tabs both
stream; `seomator serve --audit https://example.com` runs without touching the
UI.

### Phase 4 — Hardening, docs, release 3.5.0

| # | Task | Human / CC |
|---|---|---|
| 4.1 | Security tests for every row of §10; grep for `dangerouslySetInnerHTML`; body-cap and id-regex tests | 4 h / 20 min |
| 4.2 | gstack `/qa` pass: four screens, both themes, 375/768/1280 px, keyboard only | 4 h / 30 min |
| 4.3 | Docs (FR-11) + screenshots: README first-run block, `docs/WEB-DASHBOARD.md` with API/error/SSE reference, the token workflow for agents, and upgrade guide, `docs/README.md` / `quickstart.md` / `ai-agent-integration.md` brought current | 1 d / 30 min |
| 4.4 | `npm run sync:docs` (`scripts/sync-docs.mjs`) covers every public doc (README, SKILL, docs/*.md) so counts and versions cannot drift; `check:docs` fails on drift | 2 h / 10 min |

**Totals:** Phase 1 ≈ 9.0 d / 4.1 h · Phase 2 ≈ 11.4 d / 5.1 h · Phase 3 ≈ 4.8 d / 2.3 h · Phase 4 ≈ 2.2 d / 1.8 h → **≈ 27 human-days / ≈ 13 CC-hours.**

### Milestones

| Milestone | Definition of done |
|---|---|
| M1 — 3.4.0 foundations | Phase 1 acceptance; every surface persists; cancel real; stored = live |
| M2 — read-only dashboard | Phase 2 acceptance; `npx @seomator/seo-audit serve` from a clean install |
| M3 — execution | Phase 3 acceptance |
| M4 — 3.5.0 published | Phase 4 acceptance |

---

## 12. Test plan

| Layer | What | How |
|---|---|---|
| Engine | abort before first fetch, mid-crawl, during render, during a rule's own HEAD loop (all ten call sites); every catch re-throws on abort (no "errored page" after cancel); cleanup runs; `AuditAbortedError`; `initBrowser()` recovers after a failed launch; zero audited pages → `no-pages`; crawl progress fires and is monotonic; a **scoring baseline** (all 20 categories, stubbed fetch, `measureCwv` false, exact overall and per-category scores) is recorded on the current engine and committed before 1.5, then asserted equal after the signal changes — today's `auditor.test.ts` only checks shape | `auditor.test.ts`, `crawler.test.ts` with an injected `fetchPage` whose in-flight counter is asserted (no wall-clock waits) |
| Storage | new columns round-trip; legacy NULL weight reads as 1; not-measured parity vs `buildCategoryResult()` incl. mixed rows; aggregated detail on the 40-page fixture and a synthetic 1,000-page one (row counts derived as pages × rules run, never a literal — the live 40-page audit was produced by a 287-rule engine); single-transaction rollback on injected failure; `SQLITE_BUSY` retry with a second connection holding a write lock; pure compare adds no rows; `getPreviousAudit` picks the run before; trend order; migration race made deterministic (two connections on one temp file with the column-exists check injected; a two-process spawn only as smoke) | `save-audit.test.ts`, `queries.test.ts`, `comparisons.test.ts` on a temp DB passed explicitly — `saveAuditToDatabase()` and `buildComparison()` take a `db` parameter, so tests never touch the process-wide singleton (the server opens its own instance too) |
| Session | `start()` reserves the running slot synchronously before its first `await` (50 concurrent `POST`s construct exactly one fake `Auditor`; the 49 `409`s carry the same `runId`); cancel settles before next start; bounded `RunState` on a 100-page fake; `audit-complete` carries a summary only; finished run's result kept until the next run or 15 min; persistence failure surfaces on `audit-complete`; capability probe after a failed launch; `createShutdown({ server, session, db, exit, clock })` unit-tested with fakes — call order, `serve.json` removed, no `process.exit()` on the graceful path, the 2 s double-signal window | `audit-session.test.ts`, `shutdown.test.ts` |
| Server | every route × {200, 400, 401 (missing/wrong token; cookie and header paths), 403 matrix incl. `Host` without port, 404 (incl. unknown `/api/*` as JSON), 409 + `Location`, 413, 415, 429 stream cap}; a same-origin dev-proxy request passes and a foreign-`Origin` one through the proxy is rejected; `Sec-Fetch-Dest: iframe` on `/` and on a deep link → 403; CSP/XFO on every `index.html` response; stale hashed asset → 404 not SPA; `%2e%2e` and NUL; SSE snapshot on (re)connect, heartbeat, retention, slow-consumer disconnect, stream cap, shutdown ends streams; export headers; request log line. One rule for timers: every timer in `events.ts`, `audit-session.ts`, and `serve.ts` (heartbeat, the 15-minute retention) takes an injected clock; fake timers only in socket-free unit tests | `server.test.ts`, `events.test.ts` (port 0, Node `fetch`, hand-rolled SSE reader, injected clock) |
| Renderer | adapter → store mapping; visibility handling modelled with an injected `createEventSource` fake and a stubbed `document.visibilityState` (jsdom has no `EventSource`); reconnect replays snapshot; router selection; compare lists; domain strip; keyboard row activation; `axe-core` zero violations per page (structure and ARIA — contrast is proven by the token script); percent formula reaches 100 at completion | vitest workspace `jsdom` project |
| Time zones | instant assertions (ISO output identical under both zones) in the storage and DTO suites; wall-clock rendering assertions (list dates, trend labels, relative times) in the `ui` project; a `test:tz` script runs both under `TZ=Asia/Istanbul` and `TZ=UTC` — the existing `sqlite-time` tests are deliberately TZ-invariant, so no TZ run exists today | `npm run test:tz` (sets `TZ` for the whole suite; Node re-reads `TZ` at start) |
| End to end | serve → history → detail → compare → export → run → cancel → re-run, both themes, three widths | gstack `/qa` checklist in `docs/WEB-DASHBOARD.md` |
| Packaging | tarball contains `dist/web/index.html`, no `ui/`/`electron/`; packed size gate; `time seomator --version` unchanged | release checklist |

## 13. Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| Renderer move breaks the packaged Electron app | M | M | 1.10 is its own commit; `electron:build` + `electron:pack` in Phase 1 acceptance |
| Signal threading changes engine behaviour | L | H | early-return checks only; full rule suite + score snapshot test |
| Persistence default-on surprises CI users (writes to `~/.seomator`) | M | L | documented; `--no-save`, `[output] save`, `SEOMATOR_HOME`; the write is a few hundred kB per run |
| `AbortSignal.any` raises the Node floor to 20.3 | L | L | `engines` bump; `self doctor` names the version; Node 20.3 shipped 2023-06 |
| tsup pulls the server into the CLI bundle and slows start-up | M | L | lazy `import()`; measured; second entry if needed |
| Bundle over budget | M | L | no Recharts; lazy routes; budget script fails the build |
| Long-lived process leaks browsers | L | M | `finally` cleanup; session test asserts `closeBrowser()` after abort |
| Users expect `.seomator/reports` in the dashboard | M | L | empty state links `db migrate`; `report` fallback |
| Scope drift before 3.4.0 ships | M | M | Phase 1 is its own PR and release |
| `better-sqlite3` compiles from source when no prebuilt binary matches the Node version, and TTHW becomes minutes plus a toolchain | M | M | document supported Node versions (prebuilt for 20/22/24); `self doctor` reports the mismatch; the TTHW metric is measured on a supported version |

## 14. Rollout

1. Phase 1 → PR `feat: history foundations` → **3.4.0**. A minor, not a patch:
   the persistence default and the `--save` semantics change user-visible
   behaviour, which semver reserves for minors (three reviewers flagged the
   original 3.3.1). The CHANGELOG `Changed` section names: persistence on by
   default (`--no-save`, `[output] save = false`); `--save` deprecated in
   favour of `--json-report` (warns from 3.4.0, JSON write removed in 3.6.0);
   `compare`'s "previous" now means the run before the selected one, so CI
   `--fail-on-regression` baselines may shift once; new schema columns.
2. Phase 2 → PR `feat: seomator serve (read-only)`; Phase 3 → PR `feat: run
   audits from the dashboard`; Phase 4 → release PR → **3.5.0**.
3. Rollback: each PR is additive; reverting leaves harmless columns.
   `npm install -g @seomator/seo-audit@3.3.0` restores the previous CLI.

## 15. Success metrics

| Metric | Target |
|---|---|
| Time to hello world: `npx @seomator/seo-audit serve --audit <url>` to a dashboard showing a **completed audit**, clean npm cache, on a Node version with a prebuilt `better-sqlite3`; measured for the Chrome-present and the `--no-cwv` paths | < 3 min incl. install; < 45 s warm |
| Audits in history / audits run (CLI, serve, Electron) | 100% |
| Stored detail rows / live result rows for the largest audit | 100% |
| New `dependencies` | 0 |
| Packed tarball | ≤ 900 kB |
| Tests added | ≥ 80 |
| Usage signals (opt-in, from the skill's telemetry-free logs): share of `serve` sessions that open Compare; share of runs started from the browser vs CLI | reviewed after 3.5.0 to decide Phase 3 follow-ups (queue, LAN) |
| Open QA issues at release | 0 blocking, ≤ 3 cosmetic in TODOS.md |

## 16. Decisions resolved at the final approval gate

**Outcome (2026-09-02): approved as-is.** UC-1 and UC-2 were declined — the
full plan ships in the user's direction. T-1 (`ui/`), T-2 (persistence
default-on), T-3 (SVG chart), T-4 (bundle in the main package), T-5 (page
regions), T-6 (14 px table text) were taken as recommended. The original
framing is kept below for the record.

**User challenges (both outside voices; your direction stands unless you change it):**

- **UC-1 — Vehicle.** You asked for a localhost interface that shows past
  audits and starts new ones. Both voices recommend shipping Phase 1
  (foundations, 3.4.0) and a read-only surface first, and validating demand
  before building a long-lived server with execution and SSE. The cheapest
  read-only surface is C′ (a static history + diff page from SQLite, ~3 days
  human / ~1.5 h CC, no server, no security model, no bundle growth). Options:
  keep the full plan (default), or ship 3.4.0 + C′ first and revisit `serve`.
- **UC-2 — Execution in v1.** Even with `serve`, both voices would hold
  run-from-browser (Phase 3) until history usage shows people want it. The plan
  as written builds it; you can defer Phase 3 to a later minor.

**Taste decisions (recommendation applied; override at the gate):**

- **T-1** D-2: move the renderer to `ui/` (recommended) vs keep it in
  `electron/renderer/` and point the web build at it.
- **T-2** D-11: persistence default-on with `--no-save` (recommended) vs keep
  opt-in `--save`.
- **T-3** D-14: replace Recharts with an inline SVG chart in the shared UI
  (recommended) vs keep Recharts and lazy-load it.
- **T-4** G6/D-1: ship the web bundle inside the main package (recommended,
  ≤ ~400 kB gzipped) vs a separate `@seomator/dashboard` package fetched on
  first `serve`.
- **T-5** DD-2: restyle the shipped result view from stacked elevated cards
  to page regions with dividers (recommended; both design voices flagged the
  cards as a hard rejection) vs keep the current Electron look.
- **T-6** DD-9: 14 px table text with 16 px prose (recommended for a dense
  app UI) vs 16 px everywhere per the universal design rule.

Auto-decided (see the Decision Audit Trail): D-3, D-4, D-5, D-6, D-7, D-8,
D-9, D-10, D-12, D-13, D-15, D-16, and every defect fix in §1.3.

---

## Appendix A — API examples

```bash
TOKEN=$(jq -r .token ~/.seomator/serve.json)   # printed by `seomator serve` too
curl -s -X POST http://localhost:7360/api/runs \
  -H "X-SEOmator-Token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","options":{"crawl":true,"maxPages":10,"measureCwv":false}}'
# → 202 {"runId":"run-2026-09-02-k3j9x"}

curl -N -H "X-SEOmator-Token: $TOKEN" http://localhost:7360/api/events
# event: snapshot        data: {"runId":"run-2026-09-02-k3j9x","status":"running","phase":"crawl",...}
# event: crawl-progress  data: {"runId":"run-2026-09-02-k3j9x","crawled":3,"discovered":12,"maxPages":10,"currentUrl":"https://example.com/about","done":false}
# event: page-complete   data: {"url":"https://example.com/","pageNumber":1,"totalPages":10}
# event: audit-complete  data: {"runId":"run-2026-09-02-k3j9x","auditId":"2026-09-02-a1b2c3","summary":{"overallScore":84,"categories":[...]}}
# then: GET /api/audits/2026-09-02-a1b2c3 for the aggregated detail

# Poll-only loop for shells that cannot hold an SSE stream
# POST /api/runs → GET /api/runs/current until run.status != 'running' → GET /api/audits/<auditId>

curl -s -H "X-SEOmator-Token: $TOKEN" 'http://localhost:7360/api/audits?domain=example.com&limit=10'
curl -s -H "X-SEOmator-Token: $TOKEN" http://localhost:7360/api/audits/2026-09-02-a1b2c3/compare
curl -sO -J -H "X-SEOmator-Token: $TOKEN" 'http://localhost:7360/api/audits/2026-09-02-a1b2c3/export?format=html'
```

## Appendix B — `DashboardAPI` (the shared contract)

```ts
export interface DashboardAPI {
  // actions (Phase 3)
  runAudit(args: AuditRunArgs): Promise<{ runId: string }>;   // rejects with { code: 'run-in-progress', details: { currentRun } }
  cancelAudit(): Promise<void>;
  retrySave(runId: string): Promise<{ auditId: string }>;    // POST /api/runs/:runId/save
  exportRun(runId: string, format: ExportFormat): Promise<void>; // unsaved result; web: download, electron: save dialog
  // streams (Phase 3) — each returns an unsubscribe function
  onSnapshot(cb: (state: RunState | null) => void): () => void;
  onCrawlProgress(cb: (d: CrawlProgressEvent) => void): () => void;
  onPageStart(cb: (d: PageEvent) => void): () => void;
  onPageComplete(cb: (d: PageEvent) => void): () => void;
  onCategoryComplete(cb: (d: CategoryCompleteEvent) => void): () => void; // { runId, pageNumber, categoryId } — no scores
  onAuditComplete(cb: (d: AuditCompleteEvent) => void): () => void;      // { runId, auditId | null, summary, saveError? }
  onAuditError(cb: (d: AuditErrorEvent) => void): () => void;
  getCurrentRun(): Promise<RunState | null>;                             // GET /api/runs/current (follower polling)
  // queries (Phase 2)
  getAppInfo(): Promise<AppInfoDto>;                                      // incl. capabilities, cli, uptime
  listAudits(q?: ListAuditsQuery): Promise<AuditSummaryDto[]>;           // ListAuditsQuery = { domain?, limit?, offset?, status? }
  getAuditDetail(auditId: string): Promise<AuditDetailDto | null>;       // aggregated RuleSummary per rule
  getRulePages(auditId: string, ruleId: string, q?: { limit?, offset? }): Promise<RulePageDto[]>;
  listDomains(): Promise<DomainSummaryDto[]>;
  getScoreTrend(q: TrendQuery): Promise<ScoreTrendPoint[]>;
  compareAudits(auditId: string, against?: string): Promise<AuditComparisonDto | null>;
  deleteAudit(auditId: string): Promise<boolean>;
  exportAudit(auditId: string, format: ExportFormat): Promise<void>;     // web: download; electron: save dialog
}
```

The Electron preload grows the new methods and changes `runAudit` from
fire-and-forget to a promise; every existing method keeps its name.

---

# /autoplan Review Record

> Frozen record of the review that produced v2 of this PRD and of the ship-time
> review that followed. Where a value here differs from the plan body above
> (budgets, TTLs, route counts, task text), **the body is authoritative**; the
> record shows what each reviewer saw at the time.

## Phase 1 — CEO Review (mode: SELECTIVE EXPANSION, auto-decided)

### Pre-review system audit

- **Branch/state:** `main`, clean tree, no stash, no open PR. 79 commits in the
  last week (v3.3.0 release, a deep QA pass with 8 fixes, brand rollout); 1 in
  the prior seven. Releases cluster in bursts.
- **Recently touched:** `CHANGELOG.md` (20), `package.json` (17),
  `src/auditor.ts` (12), `src/types.ts` (11), `README.md` (11),
  `src/crawler/playwright-fetcher.ts` (8), `src/commands/audit.ts` (7),
  `src/cli.ts` (7). This plan touches five of the top eight.
- **TODO/FIXME:** only `src/rules/technical/duplicate-ga.ts` and
  `src/commands/crawl.ts`; neither in scope. `TODOS.md` does not exist (created
  by this review).
- **Retrospective check:** the QA commits (ISSUE-004, -007, -008) were all
  "a count on one surface drifted from the engine". The stored/DB path is the
  one surface that QA never covered; this review treats stored-vs-live parity
  as the recurring architectural smell and expands it into §1.3 items 4, 5, 6,
  7, 10.
- **Design doc:** none. `/office-hours` offer auto-skipped (autoplan one-gate
  rule); the premise challenge below covers the same ground.
- **Prior learnings applied:** `node-cli-process-exit-truncates-pipe` (FR-1
  uses `process.exitCode`); `sqlite-datetime-now-parsed-local` (test plan
  runs under two `TZ` values); `seomator-syncdocs-misses-electron` (counts in
  the UI come from `/api/info`, never literals); `electron-qa-via-cdp-remote-port`
  (Phase 1 acceptance uses it); `crawl-mode-drops-rendered-dom` (the
  `RunState` adapter must not narrow the result object).
- **Taste calibration.** Well-designed: `src/storage/sqlite-time.ts` (one
  documented pitfall, one function, tests under two zones);
  `src/reporters/fix-suggestions.ts` with its coverage test;
  `electron/main/db-bridge.ts`'s reconstruction (clear, lifts cleanly).
  Anti-patterns to avoid repeating: `audit-bridge.ts`'s cosmetic abort;
  `report.ts` reading a second store; literals that drift (rule counts).
- **Landscape check** (WebSearch, three queries): Layer 1 tried-and-true is
  "one `npx` command opens a localhost dashboard" (Unlighthouse) and "a server
  for history" (Lighthouse CI). Layer 2 results confirm those as the reference
  points and show the SEO-audit market is dominated by hosted/desktop
  products (Screaming Frog, Ahrefs, Sitebulb, SEOnaut). Layer 3
  first-principles: the moat is not the dashboard, it is agent-native
  regression testing; the dashboard should make history and diffs visible,
  not chase Unlighthouse's screenshots. Eureka logged: "history is empty by
  default" is the real blocker, not the missing UI.

### Step 0A — Premise challenge

| Premise (v1) | Verdict | Evidence |
|---|---|---|
| npm users need a visual surface | **assumed** — no usage data; personas are constructed | success metrics now include usage signals; UC-1 at the gate |
| History has data to show | **false today** | `--save` defaults to `false` (`cli.ts:145`); fixed by D-11 |
| The renderer is ~100% reusable | **false** (≈50–60%) | fixed sidebar, traffic-light padding, mouse-only rows, no router; Phase 2.4 |
| "Mostly wiring" | **false** | cancel spans six modules; storage has five defects; estimates ×2.5 |
| The Electron app is unreachable | **partially true** | never published, but `electron-builder.yml` has dmg/zip/nsis targets; publishing is a TODO, not a non-goal by necessity |
| One UI, one contract | **valid seam, not yet transport-neutral** | `ipc-client.ts:6` imports the preload type; `contract.ts` fixes it |
| Doing nothing is painful | **true for the defects, unproven for the dashboard** | §1.3 items 1–10 are user-visible today |

Right problem? Both outside voices say the differentiated job is regression
and compare, and that a server + SPA is the most expensive way to render it.
The user's direction is kept; the plan is re-sequenced so the regression/compare
value lands first and the server is the last thing built. The reframing is
queued as UC-1/UC-2.

### Step 0B — Existing code leverage

See §1.2. Nothing is rebuilt: the server wraps `AuditsDatabase` and `Auditor`;
the UI is the existing renderer; reporters serve exports; `compare.ts` logic
is lifted, not duplicated. The one "parallel flow" risk — a second UI — is
avoided by design (G4).

### Step 0C — Dream state

```
  CURRENT STATE                    THIS PLAN                         12-MONTH IDEAL
  ─────────────────                ─────────────                     ──────────────
  CLI writes one-shot files;       Every audit stored by default     SEOmator is the SEO regression
  history opt-in and lossy;        with provenance; stored = live;   system of record: CLI, agent,
  Electron unpublished and         `seomator serve` shows domains,   CI, and browser all write one
  non-persisting; compare in       trend, detail, diff, export;      history; diffs link to commits;
  a terminal; agents run           runs from the browser with real   the skill hands a human a URL
  audits nobody looks at.          progress and cancel; one UI for   for any audit; the same UI ships
                                   web and desktop.                  as the desktop app and, later,
                                                                     as a VS Code panel / CI summary.
```

The plan moves toward the ideal on every axis; the one thing it does not do
is capture the commit SHA per audit (TODOS.md, P3).

### Step 0C-bis — Implementation alternatives

```
APPROACH A: `seomator serve` + shared renderer (chosen)
  Effort: L (27 d / 13 h)   Risk: Med
  Pros: meets G1–G4; zero runtime deps; one UI; HTTP API doubles as agent surface
  Cons: largest scope; long-lived local process; responsive pass on a desktop UI
  Reuses: Auditor, AuditsDatabase, reporters, renderer, ElectronAPI shape

APPROACH C′: static history + diff page from SQLite (minimal viable)
  Effort: S (3 d / 1.5 h)   Risk: Low
  Pros: no server, no security model, no bundle growth; reuses html-reporter design
  Cons: no execution, no delete, refresh = re-run command; dead end for G3/G4
  Reuses: AuditsDatabase, html-reporter

APPROACH B: separate web app (ideal-architecture-for-hosting)
  Effort: XL   Risk: Med–High
  Pros: hostable later; conventional stack
  Cons: two UIs; framework dependency; hosting is a non-goal
  Reuses: Auditor, AuditsDatabase

APPROACH E: publish the Electron app
  Effort: S–M (signing/notarization)   Risk: Low–Med
  Pros: the visual surface already exists; benefits from Phase 1 regardless
  Cons: not zero-install; Gatekeeper; still no npm-user surface
  Reuses: everything
```

**RECOMMENDATION:** A, sequenced foundations → read-only → execution. Chosen
because it is the only approach that satisfies the user's stated direction
(list + initiate on localhost) while keeping one UI (DRY) and zero runtime
dependencies (explicit over clever). Completeness: A = 10/10, C′ = 5/10,
B = 9/10, E = 6/10. Auto-decided (P1 completeness); the C′-first sequencing
argument is preserved as UC-1.

### Step 0D — Mode analysis (SELECTIVE EXPANSION)

**Complexity check.** The plan touches > 8 files and adds three new
services (`server`, `AuditSession`, `queries`). Treated as a smell and
answered by phasing: Phase 1 alone is a coherent release; each later phase
adds one service.

**Minimum set for the stated goal.** Phase 1 + Phase 2 (read-only) satisfy
"display previous audits"; Phase 3 satisfies "initiate new audits". Nothing in
Phase 4 can be dropped without shipping untested security code.

**10x check.** SEOmator as the regression system of record: every audit from
every surface in one history with provenance (engine version, options, and
later the commit SHA), a diff that explains itself ("engine changed" vs "your
site changed"), and an agent that can hand a human a URL. The HTTP API is the
substrate for a VS Code panel, a GitHub Action job summary, and an importer
for seomator.com.

**Delight opportunities (auto-decided; ✔ accepted, → deferred):**

1. ✔ **Copy for LLM** button on the detail page (llm format to clipboard) — 20 lines over the export path.
2. ✔ **Re-run then auto-open Compare** — the moment a re-run finishes you see what changed.
3. ✔ **Tab title progress** (`⏳ 42% · SEOmator`) and `aria-live` — glance at the tab, know it's done.
4. ✔ **Sparkline per domain card** (inline SVG) — the trend before you click.
5. ✔ **`seomator serve --audit <url>`** — one command opens the dashboard already auditing; agent-friendly.
6. ✔ **Relative times** ("2 hours ago") with absolute on hover.
7. → **CLI prints a dashboard link** after an audit when `serve` is running (needs a pid/port file) — TODOS.md P4.
8. → **Commit SHA per audit** for attributed deploy comparisons — TODOS.md P3.
9. → **Keyboard shortcuts** (`/` focus URL, `r` re-run) — TODOS.md P4.

**Platform potential.** The typed `DashboardAPI` + SSE is infrastructure:
the same adapter pattern gives a VS Code webview or a CI summary page for
free. Accepted as a design constraint (D-16 additive-only API).

**Cherry-pick ceremony (auto-decided under the 6 principles):**

| # | Proposal | Effort | Decision | Principle / reason |
|---|---|---|---|---|
| E1 | Persistence default-on (`--no-save`) | S | ACCEPTED (taste T-2) | P1/P2 — 2 files; both voices; history is empty without it |
| E2 | Provenance columns (engine version, rule-set hash, run options, source) | S | ACCEPTED | P1 — trends must explain engine upgrades |
| E3 | `report` reads SQLite with JSON fallback | S | ACCEPTED | P4 — one history; both voices |
| E4 | Crawl-phase progress event | S | ACCEPTED | P1 — G3 is false without it |
| E5 | Capabilities in `/api/info`; UI hides unsupported toggles | S | ACCEPTED | P5 — Electron cannot launch Playwright |
| E6 | End-to-end cancel across crawler/fetchers/sitemap/electron fetcher | M | ACCEPTED | P1 — a partial cancel is the current bug |
| E7 | SVG chart replacing Recharts | S | ACCEPTED (taste T-3) | P3/P5 — one series; drops the largest chunk |
| E8 | `--audit <url>` on `serve` | S | ACCEPTED | P2 — 20 lines, agent-friendly |
| E9 | Delight 1, 2, 3, 4, 6 | S each | ACCEPTED | P2 — each < 1 h CC, in files already touched |
| E10 | Run queue (FIFO) | S | DEFERRED → TODOS.md | outside the stated need; invites "why is it waiting" |
| E11 | Non-loopback exposure with a query-param token for SSE | M | DEFERRED → TODOS.md | security surface; removed from v1 (D-6) |
| E12 | Publish the Electron app (GitHub Release, notarization) | M | DEFERRED → TODOS.md | independent of this plan; needs signing secrets |
| E13 | Static history + diff page (C′) | S | DEFERRED → TODOS.md; surfaced as UC-1 | alternative vehicle, user's call |
| E14 | Commit SHA per audit | S | DEFERRED → TODOS.md | needs a design for "which repo" |
| E15 | Optional `@seomator/dashboard` package | M | DEFERRED → TODOS.md; taste T-4 | only if the size budget is blown |
| E16 | CI / PR annotation docs and GitHub Action summary | M | DEFERRED → TODOS.md | separate deliverable |
| E17 | Scheduled audits | L | DEFERRED → TODOS.md | already listed as a future enhancement |
| E18 | Idle-exit default-on | S | SKIPPED (kept opt-in, D-15) | one voice; hurts the "leave it open" use |

### Step 0E — Temporal interrogation

```
  HOUR 1 (foundations):   Which columns, which defaults, which errors are named. Decided: §7.9, D-11, FR-7.
  HOUR 2-3 (core logic):  Where does the abort check go inside runAllCategories (between rules, not inside a rule)?
                          How is "previous" defined (started_at <, same domain, completed)? Decided.
                          What is RunState in crawl mode (page-aware counts, no payloads)? Decided.
  HOUR 4-5 (integration): The Electron fetcher has no signal param — add one; Electron export uses a save
                          dialog — the one adapter difference; HashRouter under file://. Decided.
                          Surprise to expect: tsup bundling the server into cli.js — measured, lazy import.
  HOUR 6+ (polish/tests): TZ tests, 40-page fixture, port-0 server tests, fake timers for SSE. Planned.
```
Human-team hours; with CC + gstack the same decisions land in ~30–60 minutes per phase.

### Step 0F — Mode

SELECTIVE EXPANSION (autoplan override; also the context default for an
enhancement of an existing system). Approach A under this mode, with the
accepted cherry-picks above folded into §7 and §11.

### Step 0.5 — Dual voices

**CODEX SAYS (CEO — strategy challenge), condensed and verified:**
premises PARTIAL; right problem NO; scope NO; alternatives NO; competitive NO;
6-month NO. Twelve findings, all checked against the code and all correct:
persistence opt-in; no engine version/rule-set fingerprint; rule diff ignores
added/removed rules; 1,000-row cap; `compareAudits()` inserts on read;
`getPreviousAudit()` wrong for historical; trend double-reversed; cancel spans
Crawler/sitemap/electron-fetcher/rules and cleanup lacks `finally`; per-page
callbacks make `RunState` unbounded; non-loopback token unusable with
`EventSource` and `Host` check breaks on `0.0.0.0`; save not one transaction,
no `busy_timeout`, `config.run` does not fit `SeomatorConfig`; two histories
get worse; alternatives were variants of the same answer; estimates not
credible and the UI is desktop-specific. Reframe: make SQLite canonical and
transactional, store provenance, fix reads, fix Electron persistence and
cancel, test a read-only surface before adding execution.

**CLAUDE SUBAGENT (CEO — strategic independence), condensed and verified:**
premises PARTIAL; right problem NO; scope NO; alternatives NO; competitive NO;
6-month PARTIAL. Nine findings: history empty by default (critical); 1,000-row
cap (the live 40-page audit shows < 9%); no crawl-phase progress; Electron does
not use Playwright so shared toggles would launch it; UI reuse ≈ 50%; tarball
growth contradicts G6; wrong file citations (`src/storage/types.ts`; missing
`TODOS.md`; stale `CLAUDE.md` `exports` row); a long-lived server in an
agent-installed CLI needs idle-exit and must never be auto-started by the
skill; the `ui/` move breaks a documented invariant. Reframe: persistence by
default + Phase 0 as 3.4.0 this week; then decide dashboard vs static page
with a design review. Competitive: Unlighthouse owns the localhost-dashboard
slot; the moat is agent-native regression testing.

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                             Claude   Codex    Consensus
  ────────────────────────────────────  ───────  ───────  ─────────
  1. Premises valid?                    PARTIAL  PARTIAL  CONFIRMED (partial) → v2 fixes the false ones
  2. Right problem to solve?            NO       NO       CONFIRMED (both challenge) → USER CHALLENGE UC-1
  3. Scope calibration correct?         NO       NO       CONFIRMED → re-estimated, re-sequenced, UC-2
  4. Alternatives sufficiently explored? NO      NO       CONFIRMED → C′ and E added to 6.1
  5. Competitive/market risks covered?  NO       NO       CONFIRMED → §1.4 added
  6. 6-month trajectory sound?          PARTIAL  NO       DISAGREE (degree) → Phase 1 first satisfies both
═══════════════════════════════════════════════════════════════
0/6 confirmed as "fine"; 5/6 confirmed as problems and addressed in v2; 1 disagreement in degree.
```

### Section 1 — Architecture

Examined: the dependency graph before/after, the `AuditSession` state
machine, coupling, scaling, single points of failure, security boundaries,
rollback.

```
  BEFORE                                   AFTER
  cli ──► src (engine, storage)            cli ──► src (engine, storage, dashboard) ──serves──► dist/web (built from ui/)
  electron/main ──► src                    electron/main ──► src/dashboard ──► src
  electron/renderer ──► preload types      ui ──► src/dashboard/contract (types only)
                                           electron/renderer = ui (moved)
```

```
  AuditSession state machine
  idle ──start()──► running ──result──► saving ──ok──► complete ──60s──► idle
    ▲                 │  │                 │                          
    │                 │  └──throw────────► error ──60s──► idle       
    │                 └──cancel()──► aborting ──AuditAbortedError──► error(code=aborted) ──60s──► idle
    └── start() while running/aborting/saving → rejected (run-in-progress); never a second Auditor
```

Findings and decisions:

- **F1.1 `RunState` unbounded in crawl mode** (Codex #7). Fixed by design:
  page-aware counts, no payloads, coalesced rule events (FR-3). Auto-decided,
  P1.
- **F1.2 Reads that write** (`compareAudits()` inserts). Fixed: pure
  `buildComparison()`; `recordComparison()` explicit (D-13). Auto-decided, P5.
- **F1.3 Build-time coupling CLI → `ui/`**: the CLI never imports UI code; it
  serves an artifact. Accepted; the location question is T-1.
- **F1.4 Single points of failure:** one process, one SQLite file. Acceptable
  for a local tool; `busy_timeout` handles the CLI writing concurrently.
- **F1.5 Scaling:** 10× pages → bounded by FR-3; 100× audits (1,800 rows in
  `audits`) → `/api/domains` is one indexed query; detail reads are per-audit.
- **F1.6 Rollback:** revert the PR; additive columns stay; `--no-save` exists.
- **Beautiful version:** the same `DashboardAPI` object drives the UI in a
  browser, in Electron, and in tests; a new shell is one adapter file.

### Section 2 — Error & Rescue Map

```
  METHOD/CODEPATH                    | WHAT CAN GO WRONG                          | EXCEPTION / CODE
  -----------------------------------|--------------------------------------------|---------------------------
  serve: listen()                    | port in use                                | EADDRINUSE
                                     | dist/web missing                           | WebAssetsMissingError
                                     | browser open fails                         | spawn error (warn only)
  POST /api/runs                     | invalid/oversized body                     | 400 invalid-body / 413
                                     | invalid URL / scheme                       | 400 invalid-url
                                     | unsupported option for shell               | 400 unsupported-option
                                     | run already active                         | 409 run-in-progress
  AuditSession.run → Auditor         | fetch timeout / DNS / non-HTML             | engine error → 'audit-failed'
                                     | abort                                      | AuditAbortedError → 'aborted'
                                     | Playwright missing/crash                   | engine error → 'audit-failed' (message names Playwright)
  AuditSession.persist               | SQLITE_BUSY after busy_timeout             | SqliteError → complete{saveError}
                                     | transaction throw                          | rolled back → complete{saveError}
  GET /api/audits/:id                | unknown id                                 | 404 not-found
                                     | malformed id                               | 400 invalid-id
  GET /api/audits/:id/export         | unknown format                             | 400 invalid-format
                                     | reporter throws on legacy row shape        | 500 export-failed (logged with auditId)
  GET /api/audits/:id/compare        | no previous audit                          | 200 { previous: null }
  DELETE /api/audits/:id             | id is the audit currently displayed        | 204 (client handles 404 on next fetch)
  SSE /api/events                    | client disconnects                         | socket close → unsubscribe
                                     | proxy/idle timeout                         | heartbeat 15 s
  static                             | traversal / missing file                   | 404
  Host/Origin/Sec-Fetch-Site check   | mismatch                                   | 403 bad-origin

  EXCEPTION / CODE       | RESCUED? | RESCUE ACTION                                  | USER SEES
  -----------------------|----------|------------------------------------------------|----------------------------------------
  EADDRINUSE             | Y        | exit 1                                         | "Port 7360 is in use. Try --port 7361"
  WebAssetsMissingError  | Y        | exit 1                                         | "Web assets not built. Run: npm run build"
  browser spawn error    | Y        | warn, continue                                 | URL printed to open manually
  400 / 413 / 409 / 403  | Y        | error envelope                                 | toast with the message; 409 switches to progress view
  audit-failed           | Y        | error event, session → error, cleanup          | red banner with the engine message; Retry button
  aborted                | Y        | error{code:aborted}, cleanup                   | "Audit cancelled"
  complete{saveError}    | Y        | keep live result                               | yellow banner "Result not saved: <reason>"
  404 not-found          | Y        | envelope                                       | "Audit not found" page with link to history
  500 export-failed      | Y        | envelope + log line with auditId               | toast "Export failed" (no silent download)
  SSE disconnect         | Y        | EventSource auto-reconnect + snapshot          | banner only after 3 failed reconnects
```

No GAP rows remain after design. Rule: route handlers catch only the named
error classes above; anything else is logged with method, path, and auditId
and returned as `500 internal` — never swallowed.

### Section 3 — Security & Threat Model

Attack surface expansion: 18 API routes on loopback, one long-lived process.
Findings (all folded into FR-6 / §10): body cap (`413`), id regex, `Host`
allow-list including `[::1]`, `Sec-Fetch-Site` as belt-and-braces, no token
in v1 (Codex #8 — the v1 design was unusable), agents never auto-start the
server, static traversal guard, no `dangerouslySetInnerHTML` (verified). No
new secrets, no new dependencies, no PII beyond what reports already hold.
Audit logging: request log line in `--verbose`; run start/complete/error
always logged with `runId`. Threats table in §10; every row Mitigated except
"local malicious process", which is out of scope for a CLI.

### Section 4 — Data Flow & Interaction Edge Cases

```
  POST /api/runs
  INPUT ──▶ VALIDATION ──▶ AuditSession.start ──▶ Auditor ──▶ persist ──▶ complete event
    │           │                 │                  │           │            │
  [empty body]  [bad url 400]   [409 if running]   [throw →    [SQLITE_BUSY  [no subscribers →
  [not JSON]    [>64kB 413]     [capability 400]    error evt]   → saveError] state kept 60 s]
  [>64kB]       [clamp ranges]  [signal wired]     [abort →                  [multi-tab fan-out]
                                                    aborted]

  GET /api/audits/:id
  id ──▶ regex ──▶ getAudit ──▶ all rows ──▶ reconstruct ──▶ DTO
          │           │            │              │
        [400]       [404]      [0 rows: legacy   [weight NULL → 1;
                                 running row →    not-measured from weight 0]
                                 status shown]
```

```
  INTERACTION            | EDGE CASE                     | HANDLED? | HOW
  -----------------------|-------------------------------|----------|---------------------------------
  Run form               | double-click                  | Y        | disabled on submit; 409 toast
                         | submit while server gone      | Y        | fetch error → banner + retry
                         | unsupported toggle            | Y        | hidden by capabilities; 400 fallback
  Live run               | reload mid-run                | Y        | snapshot on connect
                         | second tab                    | Y        | fan-out
                         | navigate away                 | Y        | run continues; /run shows it
                         | server killed mid-run         | Y        | EventSource error → banner
                         | cancel twice                  | Y        | 204 when idle
  History list           | zero results                  | Y        | empty state with next step
                         | 10,000 results                | Y        | paginated (limit ≤ 200, load more)
                         | results change mid-page       | Y        | refetch on focus; keyed rows
  Detail                 | deleted in another tab        | Y        | 404 state on next fetch
                         | legacy audit without weight   | Y        | NULL → 1
  Compare                | no previous                   | Y        | "first audit for this domain"
                         | engine changed                | Y        | banner + added/removed lists
  Export                 | reporter throws               | Y        | 500 toast, logged
  Delete                 | latest of a domain            | Y        | cards recompute
```

No unhandled edge cases remain; each row has a test in §12.

### Section 5 — Code Quality

- **DRY:** `db-bridge.ts` reconstruction and `compare.ts` rule diff each exist
  once after lifting into `src/`; `validateUrl` shared; the store is one
  module for both shells. Flagged and fixed: the Electron store's
  `completedCategories` duplicates across pages (same bug the bounded
  `RunState` fixes).
- **Naming:** `DashboardAPI`, `AuditSession`, `buildComparison`/`recordComparison`
  say what they do. `AuditAbortedError` is a named class.
- **Error patterns:** named errors mapped in one place; no catch-all swallow.
- **Over-engineering check:** router (justified by deep links), no queue, no
  framework, no API version prefix.
- **Under-engineering check:** `Host` check must include IPv6; SSE heartbeat;
  `busy_timeout`; `finally` cleanup — all in scope.
- **Complexity:** the route dispatcher is table-driven (method + regex →
  handler); no handler branches > 5 times.

### Section 6 — Test Review

```
  NEW UX FLOWS:          run from browser; live progress; cancel; history browse; detail; compare; export; delete; re-run
  NEW DATA FLOWS:        POST /runs → session → engine → persist → SSE; GET detail → all rows → DTO; GET compare → pure diff
  NEW CODEPATHS:         signal checks (crawler, fetchers, rules); crawl progress; provenance write; report fallback; router selection; capability gating
  NEW ASYNC WORK:        AuditSession run loop; SSE fan-out; heartbeat; idle timer
  NEW INTEGRATIONS:      browser open (open/start/xdg-open); EventSource; localStorage
  NEW ERROR PATHS:       every row of Section 2
```

Each has a unit or integration test in §12. The 2 a.m. test: the 40-page
fixture reconstructs to the same counts as the live result, and a cancel
mid-crawl leaves zero in-flight requests and a clean `resetCrossPageState()`.
The hostile-QA test: 50 concurrent `POST /api/runs` → one `202`, 49 `409`, one
Auditor; `Origin: http://127.0.0.1.evil.test` → 403. Chaos: kill the server
during a run → the tab shows the banner and the DB has no partial row; hold a
write lock from a second process → `busy_timeout` then `saveError`, never a
hang. Pyramid: many unit (storage, session, adapter), some integration (server
on port 0), one E2E checklist. Flakiness: SSE and idle timers use fake timers;
no real network; port 0. No LLM/prompt changes.

### Section 7 — Performance

- Detail of 11,480 rows: one `SELECT ... WHERE audit_id = ?` on the existing
  `idx_results_audit` index (~20 ms), JSON ≈ 2 MB; under the 400 ms budget.
- `/api/domains`: one query with a window function over `audits` (indexed by
  domain and `started_at`); no N+1.
- `RunState` bounded; SSE fan-out is O(tabs).
- Caching: hashed assets immutable; API `no-store`; no computation worth
  caching at this scale.
- Slowest paths: export HTML of a 40-page audit (reporter, ~100 ms),
  detail reconstruction, compare (two all-rows reads).
- No new connections beyond the one SQLite handle.

### Section 8 — Observability & Debuggability

- Logs: `serve` prints one line per request in `--verbose`
  (`GET /api/audits 200 12ms`); always logs `run start {runId,url,options}`,
  `run complete {runId,auditId,ms}`, `run error {runId,code,message}`,
  `save failed {runId,reason}`.
- `/api/info` reports `uptime`, `dbPath`, `currentRunId`, `apiVersion`.
- `seomator self doctor` gains "web assets present" and "audits.db writable".
- Every SSE event carries `runId`; a bug report three weeks later can be
  reconstructed from the run log lines plus the stored provenance.
- Runbook rows in `docs/WEB-DASHBOARD.md`: port in use; assets missing;
  `saveError`; "audit not found" after delete; SSE banner.
- Joy to operate: `--audit` + `--verbose` gives a one-command reproducible run.

### Section 9 — Deployment & Rollout

- Migrations: additive `ALTER TABLE ... ADD COLUMN`, idempotent, no locks
  beyond a schema write; older CLIs ignore new columns.
- Order: 3.4.0 (schema + defaults) ships before any dashboard code.
- Rollback: `npm install @seomator/seo-audit@3.3.0`; columns remain harmless.
- Deploy-time window: none (local tool).
- Pre-publish smoke: install the packed tarball into a clean temp prefix, then
  `audit https://example.com --no-cwv`, `compare example.com --trend`,
  `serve --no-open` + `curl /api/info` (Windows-safe scripts; no `rm -rf`).
- Feature flags: none needed; `serve` is opt-in by invocation.

### Section 10 — Long-Term Trajectory

- Debt introduced: a `shell` switch in two components; two router modes; the
  legacy JSON fallback (removable after one release — TODOS.md).
- Path dependency: the HTTP API becomes a contract agents script against —
  additive-only rule (D-16).
- Knowledge: `docs/WEB-DASHBOARD.md` + updated `ELECTRON-APP.md` +
  `STORAGE-ARCHITECTURE.md`.
- Reversibility: **4/5** — `serve` is additive; the only sticky parts are the
  persistence default and the schema columns, both benign.
- Ecosystem fit: the `npx <tool> → localhost dashboard` pattern is established
  (Unlighthouse, Vite, Storybook).
- 1-year question: a new engineer reads `src/dashboard/` and finds one
  session, one query module, one contract, two adapters. Obvious.
- Retrospective on cherry-picks: E1 (persistence default) is load-bearing for
  everything else; E2 (provenance) is load-bearing for compare; nothing
  rejected was load-bearing.

### Section 11 — Design & UX

- **Information architecture:** first the domain cards (what is the state of
  my sites), second the run box (Phase 3), third the recent list. Detail:
  score, then failures, then everything else — unchanged from the desktop app.
- **State coverage:**

```
  FEATURE        | LOADING | EMPTY                          | ERROR                 | SUCCESS | PARTIAL
  Home           | skeleton| "no audits yet" + command      | server-unreachable    | cards   | some domains failed-only
  History        | skeleton| per-filter empty               | fetch error + retry   | list    | load-more
  Detail         | skeleton| —                              | 404 page              | result  | saveError banner (live)
  Compare        | skeleton| "first audit for this domain"  | missing side          | diffs   | engine-changed banner
  Run (Ph.3)     | —       | idle form                      | audit-failed / aborted| redirect| crawl phase w/o page counts yet
```

- **Journey:** anxiety ("did the deploy break SEO?") → run or wait for the
  agent → progress that moves during the crawl → result → one click to the
  diff → relief or a fix list you can copy for the LLM.
- **AI-slop risk:** generic "dashboard cards" are a risk; mitigated by
  reusing the existing token system and by cards that carry a real sparkline
  and delta rather than decoration.
- **Design system:** no `DESIGN.md`; tokens live in `globals.css` derived from
  the HTML reporter — the plan stays inside them.
- **Responsive:** explicit tasks (drawer sidebar, 375 px layout).
- **Accessibility:** keyboard rows, focus rings, `aria-live` progress, colour
  paired with text.
- **Inevitable UI:** the run box is the search bar; the domain card is the
  bookmark.

```
  [Home] ──click card──► [History?domain] ──click row──► [Detail] ──Compare──► [Compare]
    │                                                       │  ▲                   │
    └──run (Ph.3)──► [Run: crawl → rules → saving] ──done───┘  └── Re-run ─────────┘ (auto-compare)
                                     │
                                  cancel/error ──► [Run: error] ──retry──► [Run]
```

Recommendation: Phase 2 of `/autoplan` (design review) runs next.

### Error & Rescue Registry

See Section 2 (complete; no GAPs).

### Failure Modes Registry

```
  CODEPATH                    | FAILURE MODE                     | RESCUED? | TEST? | USER SEES?                | LOGGED?
  ----------------------------|----------------------------------|----------|-------|---------------------------|--------
  serve listen                | port in use                      | Y        | Y     | message + hint            | Y
  serve listen                | assets missing                   | Y        | Y     | message + command         | Y
  POST /runs                  | invalid input                    | Y        | Y     | toast                     | Y (verbose)
  POST /runs                  | already running                  | Y        | Y     | toast + progress view     | Y
  session run                 | engine throws                    | Y        | Y     | banner + retry            | Y
  session run                 | abort                            | Y        | Y     | "cancelled"               | Y
  session persist             | SQLITE_BUSY / throw              | Y        | Y     | yellow banner             | Y
  detail                      | legacy running row               | Y        | Y     | status badge              | —
  detail                      | > 1,000 rows                     | Y        | Y     | full result               | —
  compare                     | no previous                      | Y        | Y     | message                   | —
  compare                     | engine changed                   | Y        | Y     | banner                    | —
  export                      | reporter throws                  | Y        | Y     | toast                     | Y
  SSE                         | disconnect                       | Y        | Y     | banner after 3 retries    | Y
  static                      | traversal                        | Y        | Y     | 404                       | Y (verbose)
  origin check                | mismatch                         | Y        | Y     | 403 (not a user path)     | Y
  Electron cancel             | second run during abort          | Y        | Y     | button disabled           | Y
```
**0 CRITICAL GAPS.**

### NOT in scope

- Non-loopback exposure (D-6) — TODOS.md.
- Run queue — TODOS.md.
- Publishing the Electron app — TODOS.md.
- Static history/diff page (C′) — TODOS.md and UC-1.
- Commit SHA per audit — TODOS.md.
- Optional dashboard package — TODOS.md, only if budget is blown.
- CI/PR annotation docs — TODOS.md.
- Scheduled audits — already a documented future enhancement.
- Removing the legacy JSON store entirely — TODOS.md, after one release with
  the read-only fallback.
- Keyboard shortcuts, "view in dashboard" CLI link — TODOS.md.

### What already exists

See §1.2 (every row marked reused or lifted).

### Dream state delta

After 3.5.0 the system is one release away from the 12-month ideal: every
surface writes one provenance-rich history and a human can see any audit and
any diff in a browser. Missing: commit attribution, CI summaries, and a VS Code
shell — all of which the `DashboardAPI` and provenance columns make cheap.

### Diagrams

1. System architecture — §6.2. 2. Data flow with shadow paths — Section 4.
3. State machine — Section 1. 4. Error flow — Section 2 tables.
5. Deployment sequence — §14 (3.4.0 → read-only → execution → 3.5.0).
6. Rollback — §14 step 3 (revert PR; `npm install @3.3.0`; columns harmless).

### Stale diagram audit

- `docs/ELECTRON-APP.md` "How It Works" diagram says **287 rules** (engine has
  332) and shows the bridges calling `Auditor` directly → stale now; updated in
  1.11 to show `AuditSession`.
- `docs/STORAGE-ARCHITECTURE.md` schema tables → updated in 1.11 for the new
  columns.
- `docs/technical-architecture.md` (64 diagram lines) → not touched by this
  plan; a follow-up sweep is noted in TODOS.md.
- `README.md` (2 diagram lines) → unaffected.

### Implementation Tasks (CEO phase)

Synthesized from the findings above; each task derives from a specific
finding. Written to the tasks JSONL for aggregation.

- [ ] **T1 (P1, human: ~4h / CC: ~15min)** — cli — Make SQLite persistence default-on with `--no-save`; keep `--save` writing legacy JSON with a deprecation notice; update skill recipes
  - Surfaced by: 0A premise "history has data" (false); both voices
  - Files: `src/cli.ts`, `src/commands/audit.ts`, `src/commands/analyze.ts`, `SKILL.md`, `skill/SKILL.md`, `README.md`
  - Verify: `seomator audit <url> --no-cwv` then `seomator compare <domain> --trend` lists it
- [ ] **T2 (P1, human: ~1d / CC: ~25min)** — storage — Add `weight`, `source`, `engine_version`, `rule_set_hash`, `run_json`; `busy_timeout`; single-transaction save
  - Surfaced by: §1.3 items 5, 10; Codex #2, #9
  - Files: `src/storage/audits-db/schema.ts`, `results.ts`, `audits.ts`, `src/storage/save-audit.ts`, `src/storage/types.ts`
  - Verify: `npx vitest run src/storage` incl. legacy-NULL and busy tests
- [ ] **T3 (P1, human: ~1d / CC: ~25min)** — storage — `queries.getAuditDetail()` reads all rows with not-measured parity; `listDomains()`; `getTrend()`
  - Surfaced by: §1.3 item 4 (1,000-row cap); both voices
  - Files: `src/dashboard/queries.ts`, `src/storage/audits-db/results.ts`
  - Verify: 40-page fixture reconstructs 11,480 rows; counts equal `buildCategoryResult()`
- [ ] **T4 (P1, human: ~1d / CC: ~25min)** — storage — Pure `buildComparison()`, correct `getPreviousAudit()`, `rule-diff.ts` with added/removed, single trend reversal, `engineChanged`
  - Surfaced by: §1.3 items 6, 7; Codex #4, #5
  - Files: `src/storage/audits-db/comparisons.ts`, `audits.ts`, new `rule-diff.ts`, `src/commands/compare.ts`, `ui/components/ScoreTrend.tsx`
  - Verify: compare twice → zero new rows; trend oldest-first in the chart
- [ ] **T5 (P1, human: ~2d / CC: ~45min)** — engine — Thread `AbortSignal` through Auditor, Crawler, fetchers, sitemap/robots, Electron fetcher; `finally` cleanup; `AuditAbortedError`
  - Surfaced by: §1.3 item 3; Codex #6
  - Files: `src/auditor.ts`, `src/crawler/crawler.ts`, `fetcher.ts`, `playwright-fetcher.ts`, `sitemap.ts`, `robots.ts`, `electron/main/electron-fetcher.ts`
  - Verify: abort tests; cancel mid-crawl shows zero in-flight requests within 2 s
- [ ] **T6 (P1, human: ~3h / CC: ~15min)** — engine — `onCrawlProgress` on `AuditorOptions` wired to `Crawler.onProgress`; CLI progress shows it
  - Surfaced by: §1.3 item 9; Claude #3
  - Files: `src/auditor.ts`, `src/reporters/progress.ts`
  - Verify: crawl of 10 pages emits ≥ 10 progress callbacks before the first category event
- [ ] **T7 (P1, human: ~1d / CC: ~25min)** — dashboard — `AuditSession` with bounded page-aware `RunState`, coalesced rule progress, capabilities, provenance persistence
  - Surfaced by: Section 1 F1.1; Codex #7; Claude #4
  - Files: `src/dashboard/audit-session.ts`, `src/dashboard/contract.ts`
  - Verify: 100-page fake keeps `RunState` under 10 kB; second `start()` rejects
- [ ] **T8 (P1, human: ~1d / CC: ~25min)** — electron — Thin bridges over `AuditSession`/`queries`; Electron persists and cancels; `capabilities` in app info
  - Surfaced by: §1.3 item 1; Claude #4
  - Files: `electron/main/audit-bridge.ts`, `db-bridge.ts`, `electron/preload/index.ts`, `electron/shared/ipc-types.ts`
  - Verify: `electron:dev` audit appears in History; cancel stops network
- [ ] **T9 (P2, human: ~3h / CC: ~15min)** — cli — `report` reads SQLite with JSON fallback
  - Surfaced by: §1.3 item 8; Codex #10
  - Files: `src/commands/report.ts`
  - Verify: `report --list` and `compare` list the same audits
- [ ] **T10 (P2, human: ~2h / CC: ~10min)** — ui — Move renderer to `ui/` (T-1 accepted at the gate)
  - Surfaced by: D-2; Claude #9 (counter-argument)
  - Files: `electron/renderer/**` → `ui/**`, `electron/electron-vite.config.ts`, `electron/tsconfig.json`
  - Verify: `electron:dev` and `electron:build` succeed
- [ ] **T11 (P2, human: ~4h / CC: ~20min)** — docs — 3.4.0 docs: schema tables, ELECTRON-APP diagram (287 → 332, `AuditSession`), CLAUDE.md `exports` row, CHANGELOG
  - Surfaced by: Stale diagram audit; Claude #7
  - Files: `docs/STORAGE-ARCHITECTURE.md`, `docs/ELECTRON-APP.md`, `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md`
  - Verify: `npm run check:docs`
- [ ] **T12 (P1, human: ~1d / CC: ~25min)** — server — `server.ts` + `static.ts` with `Host`/`Origin`/`Sec-Fetch-Site` checks, body cap, id regex, security headers, request log
  - Surfaced by: Section 3; Codex #8
  - Files: `src/dashboard/server.ts`, `static.ts`
  - Verify: 403 matrix tests; traversal 404
- [ ] **T13 (P1, human: ~1d / CC: ~25min)** — server — Read endpoints incl. export and delete; `serve` command with lazy import, `--idle-timeout` (`--audit` lands with T18 in Phase 3)
  - Surfaced by: FR-1, FR-2; delight 5
  - Files: `src/dashboard/api.ts`, `src/commands/serve.ts`, `src/cli.ts`, `src/crawler/validate-url.ts`
  - Verify: route tests; `time seomator --version` unchanged
- [ ] **T14 (P1, human: ~2d / CC: ~45min)** — ui — Web mode: HTTP adapter, `getAPI()` selection, router, shell-aware header, drawer sidebar, keyboard rows, 404, banners
  - Surfaced by: Codex #12; Section 11
  - Files: `ui/lib/http-api.ts`, `ui/lib/api-client.ts`, `ui/App.tsx`, `ui/components/{Header,Sidebar,AuditList}.tsx`
  - Verify: keyboard-only walkthrough; 375 px layout
- [ ] **T15 (P2, human: ~4h / CC: ~20min)** — build — `vite.web.config.ts`, scripts, `vite` devDependency, SVG chart replacing Recharts, size budget script
  - Surfaced by: FR-8; Claude #6; D-14
  - Files: `vite.web.config.ts`, `package.json`, `ui/components/ScoreTrend.tsx`, `scripts/check-bundle-size.mjs`
  - Verify: `npm pack --dry-run` ≤ 900 kB
- [ ] **T16 (P1, human: ~2.5d / CC: ~1h)** — ui — Domain cards (sparkline, relative time), pagination, detail action bar (export, copy-for-LLM, compare, delete), compare page with four lists and engine-changed banner
  - Surfaced by: FR-5; delight 1, 4, 6
  - Files: `ui/components/DomainCards.tsx`, `AuditActions.tsx`, `ui/pages/{AuditDetailPage,ComparePage}.tsx`, `RuleChangeList.tsx`
  - Verify: Phase 2 acceptance
- [ ] **T17 (P2, human: ~3h / CC: ~15min)** — electron — Same routes under `HashRouter`; export via save dialog
  - Surfaced by: D-4; Section 5
  - Files: `electron/main/db-bridge.ts`, `electron/preload/index.ts`
  - Verify: `electron:dev` export writes a file
- [ ] **T18 (P1, human: ~1d / CC: ~25min)** — server — Run endpoints + SSE fan-out with snapshot, heartbeat, retention, coalescing
  - Surfaced by: FR-3
  - Files: `src/dashboard/events.ts`, `api.ts`
  - Verify: SSE tests with fake timers
- [ ] **T19 (P1, human: ~1d / CC: ~25min)** — ui — Event adapter, shared `EventSource`, snapshot replay, page-aware store
  - Surfaced by: FR-3; Section 5 (store duplication)
  - Files: `ui/lib/http-api.ts`, `ui/stores/audit-store.ts`, `ui/components/ProgressStream.tsx`
  - Verify: reload mid-run resumes
- [ ] **T20 (P2, human: ~4h / CC: ~20min)** — ui — Runner options gated by capabilities, localStorage persistence, Re-run pre-fill, auto-compare, tab-title progress, `aria-live`
  - Surfaced by: FR-5; delight 2, 3
  - Files: `ui/components/AuditRunner.tsx`, `ui/pages/AuditDetailPage.tsx`
  - Verify: Phase 3 acceptance
- [ ] **T21 (P1, human: ~2d / CC: ~1h)** — tests — Server, events, adapter, session, storage, engine suites per §12
  - Surfaced by: Section 6
  - Files: `src/dashboard/*.test.ts`, `src/storage/**/*.test.ts`, `src/auditor.test.ts`
  - Verify: `npm run test:run`; ≥ 80 new tests
- [ ] **T22 (P2, human: ~1.5d / CC: ~1h)** — release — Security tests for §10, `/qa` pass, docs (FR-11), size gate, 3.5.0 publish + smoke
  - Surfaced by: Sections 3, 9, 11
  - Files: `docs/WEB-DASHBOARD.md`, `README.md`, `SKILL.md`, `CHANGELOG.md`
  - Verify: Phase 4 acceptance

### Completion Summary (CEO phase)

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION (autoplan)               |
  | System Audit         | clean tree; stored-path parity is the        |
  |                      | recurring smell; TODOS.md created            |
  | Step 0               | 7 premises challenged, 3 false → fixed;      |
  |                      | approach A re-sequenced; UC-1/UC-2 queued    |
  | Section 1  (Arch)    | 6 findings (2 design fixes, 4 accepted)      |
  | Section 2  (Errors)  | 22 error paths mapped, 0 GAPS                |
  | Section 3  (Security)| 6 findings, 0 High after mitigation          |
  | Section 4  (Data/UX) | 21 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 3 findings (DRY lifts, store dup, IPv6)      |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                     |
  | Section 7  (Perf)    | 0 issues                                     |
  | Section 8  (Observ)  | 2 gaps found → logging + doctor checks       |
  | Section 9  (Deploy)  | 1 risk flagged (sequencing) → 3.4.0 first    |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 3            |
  | Section 11 (Design)  | 4 issues → responsive/a11y tasks; state map  |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (10 items)                           |
  | What already exists  | written (§1.2)                               |
  | Dream state delta    | written                                      |
  | Error/rescue registry| 22 methods, 0 CRITICAL GAPS                  |
  | Failure modes        | 17 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 11 items proposed → written                  |
  | Scope proposals      | 18 proposed, 9 accepted, 8 deferred, 1 skip  |
  | CEO plan             | written (~/.gstack/.../ceo-plans/)           |
  | Outside voice        | ran (codex + claude subagent)                |
  | Lake Score           | 9/9 recommendations chose the complete option|
  | Diagrams produced    | 6 (system, data flow, state, error, deploy,  |
  |                      | rollback) + user flow                        |
  | Stale diagrams found | 2 (ELECTRON-APP, STORAGE-ARCHITECTURE)       |
  | Unresolved decisions | 6 → queued for the final gate (2 UC, 4 taste)|
  +====================================================================+
```

> **Phase 1 complete.** Codex: 12 concerns (all verified). Claude subagent: 9
> issues (all verified). Consensus: 5/6 dimensions confirmed as problems and
> addressed; 1 disagreement in degree; 2 user challenges + 4 taste decisions →
> surfaced at the gate. Passing to Phase 2 (Design).

## Phase 2 — Design Review (auto-decided)

### Pre-review

- **DESIGN.md:** none. A `/design-consultation` ran on 2026-09-01 (gstack
  timeline) but left no `DESIGN.md` in the repo. The de-facto system is
  `electron/renderer/styles/globals.css`: tokens derived from the HTML
  reporter — IBM Plex Sans / Mono, slate greys, accent `#064ada`, pass
  `#10b981`, warn `#f59e0b`, fail `#ef4444`, 52 px toolbar, 260 px sidebar,
  radii 4/8/12, light and dark themes. Recommendation: promote those tokens
  plus DD-9 into `DESIGN.md` (TODOS.md).
- **Existing patterns reused:** `Logo`, the toolbar segmented control and
  theme toggle, `ScoreCircle` (140 px), `CategoryGrid` / `CategoryBar`,
  `CategorySection` / `RuleCard`, `IssuesTable`, `FilterTabs`,
  `ProgressStream` (restructured per DD-4), `AuditList` (row-as-link),
  `DomainPicker` (replaced by the strip), `ScoreTrend` (rewritten as SVG).
- **Prior design reviews:** none logged. Retrospective: last week's UI
  commits were toolbar and brand polish; the result view's stacked cards were
  never reviewed — treated as the risk area.
- **Mockups:** the mockup generator was not configured on this machine, so the run
  produced no images.
  This phase is text-only; the Home composition is specified in ASCII (DD-1).
  Generating mockups is the first thing to do once a key is configured — see
  "Mockups for the gate" below.

### Step 0 — Design scope

Initial rating **3/10**. v2's UI spec was a five-row table naming nouns
("domain cards", "action bar", "banner"); hierarchy, copy, states, progress
math, responsive transformations, and accessibility criteria were left to
the implementer. A 10 for this plan: every screen drawn, every state's
visible copy written, a percent formula, per-viewport layouts, WCAG
acceptance criteria, tokens with contrast numbers. Focus: all seven passes.

### Step 0.5 — Dual voices

**CODEX SAYS (design — UX challenge), condensed:** the hierarchy mirrors the
data model (domain → audit → category), not the user's questions (what
changed? is anything worse? what do I fix first?); FR-5 contradicted the
CEO Section 11 on what comes first; states were named, not designed; the
empty state needed a real onboarding composition (explanation, copyable
command, migrate action, database path, refresh behaviour); crawl progress
must be one fixed composition updated in place and per-page `lastScore` is
misleading; "drawer below 1024" is not a responsive strategy; accessibility
was aspirational — muted text ≈ 2.45:1, several status pairs < 3:1, toolbar
controls 28 px; eight ambiguities that would haunt implementation. Litmus:
brand YES; anchor NO; scannable NO; one job NO; cards NO; motion NOT SPEC'D;
premium without shadows NO. Hard rejections: card-grid first impression;
app made of stacked cards.

**CLAUDE SUBAGENT (design — independent review), condensed:** Home and
History are the same screen (critical) → one route, domain strip rows,
56 px mono score anchor, full-width trend with an engine-change rule;
progress percent undefined (critical) → formula; cancel renders as failure;
save-error loses the result on reload → Export primary; compare rows per
rule with "on n of m pages"; missing states (`/run` idle, `409` in a second
tab, after delete, copy success, fixed-height skeletons, two competing
empty-state messages); server-stopped copy; card click target; web nav
segments + back crumb; 375 px two-line rows; row-as-link keyboard pattern;
type scale 12/13/14/16/20/32/56. Litmus: brand YES; anchor NO (Home);
scannable NOT SPEC'D; one job NO; cards NO; motion NOT SPEC'D; shadows NO.
Hard rejections: card grid; stacked cards; three encodings of one number;
cancelled shown as red error; text loaders that reflow.

```
DESIGN DUAL VOICES — LITMUS SCORECARD:
═══════════════════════════════════════════════════════════════
  Check                                    Claude     Codex      Consensus
  ─────────────────────────────────────── ────────── ────────── ─────────
  1. Brand unmistakable in first screen?   YES        YES        CONFIRMED (pass)
  2. One strong visual anchor?             NO         NO         CONFIRMED (fail) → DD-1
  3. Scannable by headlines only?          NOT SPEC'D NO         CONFIRMED (fail) → DD-1, DD-9
  4. Each section has one job?             NO         NO         CONFIRMED (fail) → DD-1, DD-2
  5. Cards actually necessary?             NO         NO         CONFIRMED (fail) → DD-1, DD-2
  6. Motion improves hierarchy?            NOT SPEC'D NOT SPEC'D CONFIRMED (unspecified) → DD-10
  7. Premium without decorative shadows?   NO         NO         CONFIRMED (fail) → DD-9
  ─────────────────────────────────────── ────────── ────────── ─────────
  Hard rejections triggered:               5          2          2 CONFIRMED (card grid, stacked cards)
═══════════════════════════════════════════════════════════════
7/7 confirmed (1 pass, 6 addressed). 0 disagreements between voices.
```

### Passes 1–7 (rated before → after the fixes written into FR-5)

- **Pass 1 — Information architecture: 3 → 9.** Home and History merged;
  strip → anchor → list; detail opens on the score; toolbar segments and back
  crumb (DD-1, DD-2, DD-11). Remaining point: the Home composition is drawn
  in ASCII and mocked up; the final visual is confirmed at the gate.
- **Pass 2 — Interaction states: 5 → 9.** State table with visible copy;
  empty composition; cancelled ≠ error; save-error with Export primary
  (DD-4, DD-5, DD-6).
- **Pass 3 — Journey and emotional arc: 4 → 8.** Climax specified
  (cross-fade + score sweep); re-run shows "Comparing against …" and lands on
  Compare; engine line muted below the delta. Not done: a first-run success
  moment beyond the score — deferred (NOT in scope).
- **Pass 4 — AI slop risk: 3 → 8.** Hard rejections cleared: rows not cards,
  page regions not stacked cards, one encoding per number (numeral + delta
  text; sparkline decorative and `aria-hidden`), no icons-in-circles, no
  gradients, IBM Plex rather than a system stack. Residual taste: 14 px table
  text against the "body ≥ 16 px" universal rule (T-6; prose is 16 px).
- **Pass 5 — Design system alignment: 6 → 8.** No `DESIGN.md` (TODO);
  tokens annotated and extended with contrast-safe text tokens (DD-9); the
  four new components (`DomainStrip`, `ScoreHeadline`, `TrendChart`,
  `ActionMenu`) fit the existing vocabulary.
- **Pass 6 — Responsive and accessibility: 3 → 9.** Per-viewport layouts,
  WCAG 2.2 AA acceptance list, 44 px targets, contrast fixes, reduced motion
  (DD-7, DD-8, DD-9).
- **Pass 7 — Unresolved decisions:** 11 resolved (DD-1…DD-11); 2 taste for
  the gate (T-5 de-card the shipped result view; T-6 table text size);
  1 deferred (`DESIGN.md`).

```
  DECISION NEEDED                          | RESOLUTION
  -----------------------------------------|------------------------------------------
  Home anchor and run-row position         | DD-1: score + what changed; run row one line under the toolbar
  Global vs category navigation            | DD-11 / DD-2: segments + crumb; sidebar is detail-only → chips
  Domain strip anatomy, order, overflow    | DD-1: rows; regressions first; ≤ 6 then "n more"
  Loading / error / partial placement      | DD-5: fixed-height skeletons; copy table
  Mobile table and action-bar transforms   | DD-7: two-line rows; primary + overflow
  Meaning of per-page category events      | DD-4: pagesDone only; no per-page scores shown
  Dialog / menu interaction contract       | DD-8: native dialog/popover, focus in/out, Escape
  Keep the stacked-card composition?       | DD-2: no — page regions; taste T-5 for the desktop app
```

**Overall design score: 4 → 8.6.**

### NOT in scope (design)

- A first-run celebration beyond the score sweep — deferred; utility first.
- Dark-theme redesign — tokens re-checked for contrast only.
- Illustrations for empty states — utility copy only (subtraction default).
- Print stylesheet — the HTML export covers it.
- Per-category sparkline history — one number per row is enough (three
  encodings of one number was a hard rejection).

### What already exists (design)

Tokens and themes in `globals.css`; `Logo`, segmented control, theme
toggle, `ScoreCircle`, `CategoryGrid`, `CategoryBar`, `CategorySection`,
`RuleCard`, `IssuesTable`, `FilterTabs`, `ProgressStream`, `AuditList`,
`DomainPicker`, `ScoreTrend`, `Sidebar`, `Header`; the HTML reporter's
branded header, score ring, category bars, and issue table as the visual
reference. All reused or restructured; nothing rebuilt from scratch.

### Mockups for the gate

None generated: the mockup generator was not configured. Brief to reuse once it
is (saved at
`<gstack workspace>/designs/dashboard-home-20260902/variants.log`):
Home per DD-1 — toolbar with `History | Run` segments, 48 px run row, domain
strip rows with sparklines and a regression badge, 56 px mono score anchor with
"what changed" line, full-width SVG trend with an engine-change rule, dense
audits table; IBM Plex, slate greys, one accent, no cards, no content shadows.

### Design TODOs

- `DESIGN.md` from the tokens + DD-9 (P3) → TODOS.md.
- Post-implementation `/design-review` on the live dashboard — already
  Phase 4 task 4.2.

### Implementation Tasks (design phase)

- [ ] **DT1 (P1, human: ~1.5d / CC: ~40min)** — ui — Build Home per DD-1: `DomainStrip` (rows, regression badge, sparkline, single-domain collapse), `ScoreHeadline` (56 px numeral, delta, what-changed line), `TrendChart` (SVG, y 0–100, engine rule), list with two-line mobile rows, empty composition with copy button
  - Surfaced by: Pass 1, Pass 2 — both voices (no anchor; card grid rejection; empty state)
  - Files: `ui/pages/HomePage.tsx`, `ui/components/{DomainStrip,ScoreHeadline,TrendChart,AuditList}.tsx`
  - Verify: trunk test on `/`; `axe` zero violations; 375 px screenshot
- [ ] **DT2 (P1, human: ~1d / CC: ~25min)** — ui — Detail per DD-2: score-first header with utility line, action bar + overflow `ActionMenu`, page regions with dividers instead of stacked cards, detail-only category chips < 1024 px
  - Surfaced by: Pass 1, Pass 4 — stacked-cards hard rejection (both voices)
  - Files: `ui/pages/AuditDetailPage.tsx`, `ui/components/{ActionMenu,CategorySection,Sidebar}.tsx`, `globals.css`
  - Verify: no `--shadow-*` on content regions; keyboard walkthrough of the menu
- [ ] **DT3 (P1, human: ~1d / CC: ~25min)** — ui — Compare per DD-3: 32 px delta, muted engine line, per-rule rows with "on n of m pages", four lists, zero-delta state, `against` picker
  - Surfaced by: Pass 2 — Claude voice (per-page rows in crawl audits)
  - Files: `ui/pages/ComparePage.tsx`, `ui/components/RuleChangeList.tsx`
  - Verify: 40-page fixture shows one row per rule
- [ ] **DT4 (P1, human: ~6h / CC: ~25min)** — ui — Run per DD-4: two-segment progress bar, percent formula, 20-cell category row, cancelled state, save-error banner, cross-fade
  - Surfaced by: Pass 2, Pass 3 — both voices (progress undefined; cancelled as error)
  - Files: `ui/components/ProgressStream.tsx`, `ui/pages/RunPage.tsx`, `ui/stores/audit-store.ts`
  - Verify: percent reaches 100 exactly at completion on a 10-page fake; cancel shows the neutral state
- [ ] **DT5 (P1, human: ~4h / CC: ~20min)** — ui — States and copy per DD-5/DD-6: fixed-height skeletons, server-stopped state, toasts, 404 page
  - Surfaced by: Pass 2 — both voices
  - Files: `ui/components/{Skeleton,Toast,ServerStopped}.tsx`, `ui/pages/NotFoundPage.tsx`
  - Verify: no layout shift between skeleton and content (CLS 0 in a Playwright check)
- [ ] **DT6 (P1, human: ~1d / CC: ~25min)** — ui — Accessibility per DD-8: skip link, landmarks, row-as-link, native dialog/popover with focus management, chart `<title>`/`<desc>` + hidden table, `aria-live`, reduced motion, 44 px targets
  - Surfaced by: Pass 6 — Codex voice (aspirational a11y), Claude voice (row pattern)
  - Files: `ui/components/*`, `globals.css`
  - Verify: `axe-core` in jsdom for each page; keyboard-only E2E in the `/qa` checklist
- [ ] **DT7 (P1, human: ~4h / CC: ~20min)** — ui — Tokens and type scale per DD-9: `--color-text-muted` → 4.6:1, status text tokens, `--color-line-muted`, scale 12/13/14/16/20/32/56, shadows only on overlays and toolbar
  - Surfaced by: Pass 5, Pass 6 — Codex voice (contrast numbers)
  - Files: `ui/styles/globals.css`, components using `text-muted`
  - Verify: contrast script over both themes ≥ 4.5:1 for text tokens
- [ ] **DT8 (P2, human: ~2h / CC: ~10min)** — ui — Motion per DD-10: cross-fade, trend draw-in, existing score sweep; all under `prefers-reduced-motion`
  - Surfaced by: Pass 3 — both voices (motion NOT SPEC'D)
  - Files: `ui/styles/globals.css`, `TrendChart.tsx`, router transition
  - Verify: reduced-motion emulation shows no animation
- [ ] **DT9 (P1, human: ~4h / CC: ~20min)** — ui — Navigation per DD-11/DD-7: `History | Run` segments, back crumb in the centre slot, shell-aware toolbar padding, per-viewport layouts
  - Surfaced by: Pass 1 — Claude voice (segments don't map to routes)
  - Files: `ui/components/Header.tsx`, `ui/App.tsx`
  - Verify: trunk test on every route; 768 px and 375 px screenshots

### Completion Summary (design phase)

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | no DESIGN.md; tokens in globals.css; 5 screens|
  | Step 0               | 3/10; all 7 passes in focus                  |
  | Pass 1  (Info Arch)  | 3/10 → 9/10 after fixes                      |
  | Pass 2  (States)     | 5/10 → 9/10 after fixes                      |
  | Pass 3  (Journey)    | 4/10 → 8/10 after fixes                      |
  | Pass 4  (AI Slop)    | 3/10 → 8/10 after fixes                      |
  | Pass 5  (Design Sys) | 6/10 → 8/10 after fixes                      |
  | Pass 6  (Responsive) | 3/10 → 9/10 after fixes                      |
  | Pass 7  (Decisions)  | 11 resolved, 2 taste (gate), 1 deferred      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                            |
  | What already exists  | written                                      |
  | TODOS.md updates     | 1 item proposed (DESIGN.md)                  |
  | Approved Mockups     | 0 generated (generator not configured)       |
  | Decisions made       | 11 added to plan (DD-1…DD-11)                |
  | Decisions deferred   | 2 taste (T-5, T-6), 1 TODO                   |
  | Overall design score | 4/10 → 8.6/10                                |
  +====================================================================+
```

> **Phase 2 complete** (text-only: mockup generator not configured). Codex: 9 concerns. Claude subagent: 12 issues.
> Consensus: 7/7 litmus checks confirmed (1 pass, 6 fixed), 2 hard
> rejections confirmed and cleared, 0 disagreements → 2 taste decisions
> (T-5, T-6) surfaced at the gate. Passing to Phase 2.5 (DX).

## Phase 2.5 — DX Review (mode: DX POLISH, auto-decided)

### Product type and persona

Product type: **CLI tool + local HTTP API + Claude Code skill** (primary: CLI;
the dashboard is a CLI subcommand; the API is scripted by agents).

```
TARGET DEVELOPER PERSONA
========================
Who:       Solo developer or small-agency dev shipping a site, SEO-aware but
           not an SEO specialist. Evidence: README leads with `npx`/`npm i -g`,
           package keywords (cli, seo-audit, ai-seo), the Claude Code skill,
           and the CI sections.
Context:   Just deployed (or is about to). Wants "did I make SEO better or
           worse?" answered without leaving the terminal for long.
Tolerance: ~5 minutes and one copy-paste; will not read a docs site first;
           abandons at the first cryptic error.
Expects:   `npx <tool> <url>` works; results persist; a browser view exists.
Secondary: agent operator (Claude Code drives the CLI; the human wants a URL
           to look at). Tertiary: SEO consultant with several client domains.
```

### Developer empathy narrative (today, actual path)

I find SEOmator through the Claude Code skill list. The README's first
heading is "Contents"; "Installation → From npm" gives me
`npm install -g @seomator/seo-audit`. I run `seomator audit https://mysite.com`.
A banner, a category table, a score of 71 — good, this is real. Tomorrow I
deploy a fix and run it again: 74. Was that the meta description or the
engine? I want the two side by side. The README's `compare` section says
audits "must have been saved with `--save`". Neither of mine was. I run twice
more with `--save`, `compare` works, in a terminal. I look for the visual
thing the README promises ("Desktop App"): clone the repo, `npm install`,
`npx electron-rebuild -f -w better-sqlite3`, `npm run electron:dev`. That is
four steps and a native rebuild for a chart. I close the tab. Meanwhile
`docs/README.md` tells me the tool has 148 rules and `docs/quickstart.md`
shows a v2.2.0 transcript; I am no longer sure which docs are current.

**After the plan:** `npx @seomator/seo-audit serve --audit https://mysite.com`.
The browser opens on a progress bar that moves during the crawl, then on a
score with the failing rules and fixes. It is saved. Tomorrow I run the same
command and land on the Compare page.

### Competitive DX benchmark

```
COMPETITIVE DX BENCHMARK
=========================
Tool               | TTHW        | Notable DX choice                                  | Source
Unlighthouse       | ~2 min      | `npx unlighthouse --site` opens a dashboard mid-scan | unlighthouse.dev
Lighthouse CI      | 10–15 min   | history needs a hosted server + config file        | unlighthouse.dev/learn-lighthouse/lighthouse-ci
Screaming Frog     | ~5 min      | desktop install; licence past 500 URLs             | vendor docs
SEOmator today     | 2 min (terminal score) / no visual path for npm users | `--save` opt-in; Electron from source only | README.md
SEOmator after     | ~2–3 min cold, < 45 s warm | one command → populated dashboard, saved by default | this plan
```

Target tier: **Competitive (2–5 min cold), Champion when warm** (P5: the
lowest-effort vehicle that reaches the tier). The cold path is bounded by npm
install plus `better-sqlite3`'s prebuilt binary; a Node version without one
turns install into a compile (risk row added in §13).

### Magical moment

"One command; under a minute later the browser shows my site's score, the
rules that failed, what to fix — and it is kept." Delivery vehicle: **B,
copy-paste demo command** (`npx @seomator/seo-audit serve --audit <url>`),
which the plan already contains (FR-1 `--audit`, now with the audit command's
options). Requirements: first-run block at the top of the README "Web
Dashboard" section; the `/run` screen shows crawl-phase progress within 2 s;
the redirect lands on the score sweep.

### Developer journey map

```
STAGE            | DEVELOPER DOES                                   | FRICTION POINTS (evidence)                                   | STATUS
-----------------|--------------------------------------------------|--------------------------------------------------------------|--------
1. Discover      | npm search / Claude skill list / README          | README promises a desktop app nobody can install            | fixed (README rewrite, FR-11)
2. Evaluate      | reads README + docs/                             | docs/README.md says 148 rules; quickstart shows v2.2.0       | fixed (FR-11: brought current; sync:docs on every doc)
3. Install       | `npx @seomator/seo-audit …`                      | better-sqlite3 compiles when no prebuilt binary matches Node | mitigated (doc + `self doctor` + §13 risk)
4. Hello world   | `serve --audit <url>`                            | `--audit` took no options; empty state said `seomator …` to an npx user | fixed (FR-1 flags; `/api/info.cli`)
5. Integrate     | CI `compare --fail-on-regression`; agent scripts /api | `--no-save` per command; API clamped silently; no schema  | fixed (`[output] save`, `SEOMATOR_HOME`, strict 400s, `GET /api`, openapi.yaml, poll loop)
6. Debug         | reads errors, `-v`, `self doctor`                | errors lacked cause/fix/link; save failure hidden without -v | fixed (envelope + hint + See:, always-printed save failure, error classification)
7. Upgrade       | `npm i -g …@latest`                              | default flip in a patch; `--save` semantics; compare baseline shift | fixed (minor 3.4.0; CHANGELOG Changed; deprecation timeline; `npm install -g` rollback)
8. Scale         | many domains, 40-page crawls, several agents      | 1,000-row cap; 204 on idle; one run at a time               | fixed (all rows; `200 { run }`; 409 with hint + Location); queue deferred (TODOS)
9. Migrate       | old `.seomator/reports` JSON                     | two histories; no removal date                               | fixed (`report` fallback, `db migrate` hint, JSON write removed in 3.6.0)
```

### First-time developer confusion report

```
FIRST-TIME DEVELOPER REPORT
============================
Persona: solo developer shipping a site
Attempting: see my site's SEO score in a browser and compare with yesterday

TODAY
T+0:00  README → "Installation" → `npm install -g @seomator/seo-audit`.
T+0:45  `seomator audit https://mysite.com` → terminal score 71. Good.
T+2:00  Wants history. Scrolls the flag table; finds `--save` ("Save report to .seomator/reports/").
        Unclear that it also feeds `compare`. Audit #1 was not saved.            ← addressed (default-on)
T+4:00  `seomator compare mysite.com` → needs two saved audits.                 ← addressed
T+6:00  "Desktop App" section: clone, npm install, electron-rebuild, electron:dev.
        Gives up on the visual view.                                             ← addressed (`serve`)
T+7:00  Opens docs/README.md: "148 rules / 16 categories". Trust drops.          ← addressed (FR-11)

AFTER THE PLAN
T+0:00  README "Web Dashboard": `npx @seomator/seo-audit serve --audit https://mysite.com`
T+0:40  npm resolves, server prints the URL, browser opens on /run with the crawl bar moving.
T+1:30  Score sweep on /audits/<id>; failing rules with fixes; "Copy for LLM".
T+1:35  Tomorrow: same command → Compare page, "2 rules regressed, 5 fixed".
```

### Step 0.5 — Dual voices

**CODEX SAYS (DX — developer experience challenge), condensed:** NO-GO as
written: `--save`/`--no-save` are not opposites and `--json-report` was absent
from the PRD body; the success metric timed an empty dashboard, not one with
data; "Web assets not built, run npm run build" is wrong for npm installs;
DNS/timeout/non-HTML/Playwright failures collapsed into `audit-failed`;
`saveError` needed the database path and a doctor pointer; `403` should name
the rejected and allowed origins and the Vite proxy would trip it; `409`
needs a hint and `Location`; three error envelope shapes contradicted each
other; the API silently clamped and ignored unknown keys (hostile to agents);
SSE `error` collides with the `EventSource` transport event and most events
lacked `runId`; reconnect could miss `complete`; `docs/README.md` and
`quickstart.md` are badly stale and outside FR-11; README contradicts itself
on Chrome; a persistent side-effect default in a patch release breaks
semver; the rollback command lacked `-g`; `npm run web:dev` was internally
broken (assets before Vite, no supervisor, origin conflict); the
`better-sqlite3` ABI switch is still manual. Verdicts: getting started
PARTIAL; naming NO; errors PARTIAL; docs NO; upgrade PARTIAL; dev env NO.

**CLAUDE SUBAGENT (DX — independent review), condensed:** TTHW today is ~8
steps / 10–15 min for anything visual, effectively infinite for npx users;
after the plan one command — but the Phase 2 empty state told npx users to
run `seomator`, `serve --audit` accepted no options, and "< 30 s incl.
download" ignores `better-sqlite3` compiles; `--save`/`--no-save` map to one
Commander option (critical); `--idle-timeout <min>` vs `--timeout <ms>`;
`complete`/`error` lack the `audit-` prefix; `204` on idle breaks `.json()`;
no `GET /api/runs/:id`; no error carries a docs link; assets message wrong
for npm; `403` will hit the plan's own dev loop; save failure hidden without
`-v` today; Node < 20 message stale in `self doctor`; no OpenAPI or poll-only
loop; three stale docs outside FR-11; no `--host` workaround doc; no data-dir
override (`SEOMATOR_HOME`); `save:false` missing on `POST /api/runs`;
`BROWSER=none`; `--port 0`; patch release flips a filesystem-writing default
(ship as minor); `compare` "previous" change can shift CI baselines; no
deprecation timeline or config-file switch; `apiVersion` header. Verdicts:
getting started PARTIAL; naming PARTIAL; errors PARTIAL; docs PARTIAL;
upgrade NO; dev env NO.

```
DX DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude   Codex    Consensus
  ──────────────────────────────────── ──────── ──────── ─────────
  1. Getting started < 5 min?          PARTIAL  PARTIAL  CONFIRMED (gap) → FR-1 `--audit` flags, empty-state command, TTHW metric, §13 risk
  2. API/CLI naming guessable?         PARTIAL  NO       CONFIRMED (gap) → `--json-report` + `getOptionValueSource`, `<dur>`, `audit-*` events, `200 { run }`
  3. Error messages actionable?        PARTIAL  PARTIAL  CONFIRMED (gap) → one envelope with hint/details/See:, classification, assets message, 409 Location
  4. Docs findable & complete?         PARTIAL  NO       CONFIRMED (gap) → FR-11 expanded (3 stale docs, openapi.yaml, poll loop, sync:docs on all)
  5. Upgrade path safe?                NO       PARTIAL  CONFIRMED (gap) → 3.4.0 minor, CHANGELOG Changed, deprecation timeline, `-g` rollback
  6. Dev environment friction-free?    NO       NO       CONFIRMED (gap) → `web-dev.mjs`, `--api-only`, `SEOMATOR_HOME` (an `--allow-origin` flag was proposed here and removed in Phase 3); ABI switch → TODOS
═══════════════════════════════════════════════════════════════
6/6 confirmed gaps, 0 disagreements; all six addressed in the plan body (FR-1, FR-2, FR-3, FR-4, FR-7, FR-8, FR-10, FR-11, §13, §14, §15).
```

### Passes 1–8 (before → after; evidence from the journey trace)

- **Pass 1 — Getting started: 3 → 8.** Today the visual path needs a clone
  and a native rebuild (journey stage 4); after: one command, crawl progress
  in 2 s, score in ~90 s warm. Residual: the cold `better-sqlite3` compile on
  unsupported Node versions (doctor + docs; not fixable in this plan).
- **Pass 2 — API/CLI design: 4 → 8.** Flag truth table (`--no-save`,
  `--json-report`, deprecated `--save`, `[output] save`), duration flag,
  strict `400`s instead of clamping, `GET /api` index, `200 { run }`,
  `/api/runs/:runId`, `audit-*` events, version header. Residual: no
  `Idempotency-Key` on `POST /api/runs` — unnecessary while the server allows
  one run and answers `409` with the current run.
- **Pass 3 — Errors: 3 → 8.** Three traced paths, today vs after: (a) assets
  missing — today n/a; after: source vs package message + `See:`; (b) `403`
  — after: `details.rejectedOrigin` + `allowedOrigins` + a hint to use the
  proxy (the `--allow-origin` flag proposed here was removed in Phase 3); (c) audit failure — today `Error: fetch failed`; after
  `audit-error { code: 'dns', hint: 'Check the hostname …' }`. Tier 3
  (Stripe-style structured) for the API, Tier 1 conversational for the CLI.
  Residual: the error-code catalogue page exists only once Phase 4 docs land.
- **Pass 4 — Documentation: 3 → 8.** First-run block, `docs/WEB-DASHBOARD.md`
  with API/error/SSE reference, `docs/openapi.yaml`, three stale docs brought
  current, `sync:docs` on every public doc. Residual: no docs search beyond
  GitHub.
- **Pass 5 — Upgrade path: 4 → 8.** Minor version for the default flip;
  CHANGELOG `Changed` entries incl. the `compare` baseline note; `--save`
  warns in 3.4.0, JSON write removed in 3.6.0; `npm install -g` rollback.
  Residual: no codemod (CLI flags do not need one).
- **Pass 6 — Dev environment: 3 → 7.** `scripts/web-dev.mjs`, `--api-only`,
  `SEOMATOR_HOME` for tests and CI, `BROWSER=none`,
  `--port 0`. Residual: the `better-sqlite3` ABI switch stays manual →
  TODOS.md; Windows behaviour of the dev script to verify in Phase 4.
- **Pass 7 — Community: 5 → 6.** MIT, public repo, issues; the README's CI
  sections are the real-world examples. Not in this plan: a CONTRIBUTING.md
  or a chat channel (NOT in scope).
- **Pass 8 — DX measurement: 2 → 6.** TTHW now has a definition and a
  measurement procedure (§15, Phase 4 smoke); the `serve` request log is the
  journey trace; no telemetry by design. Added: the dashboard's error and 404
  states link to a prefilled GitHub issue (DD-5 copy). Residual: no periodic
  friction audit — the post-ship `/devex-review` boomerang covers it.

### Claude Code skill DX checklist

- [x] State storage: global `~/.seomator` with `SEOMATOR_HOME` override
- [x] Skill composition: `SKILL.md` suggests `serve` after audits, never starts it
- [x] Error recovery: live result survives a save failure; export is the escape
- [x] Session continuity: history in SQLite by default
- [x] Bounded autonomy: loopback only; one run at a time; origin checks
- [ ] AskUserQuestion / progressive consent / auto-upgrade: n/a (npm-distributed CLI)

### NOT in scope (DX)

- `CONTRIBUTING.md` and a community channel — separate from this feature.
- Docs search — GitHub markdown for now.
- Idempotency keys on `POST /api/runs` — one run at a time makes them moot.
- Automating the `better-sqlite3` ABI switch — TODOS.md (P3).
- A `--host` workaround page — TODOS.md LAN item covers it.

### What already exists (DX)

`validateUrl()` with its "did you mean https://" hint; `parseEnum` /
`parseIntValue` loud validation in `src/cli.ts`; `seomator self doctor`;
`--format llm`; README CI sections; `docs/ai-agent-integration.md`; the
programmatic API in `src/index.ts`; `scripts/sync-docs.mjs`.

### DX Scorecard

```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      |  8/10  |  3/10  | +5 ↑   |
| API/CLI/SDK          |  8/10  |  4/10  | +4 ↑   |
| Error Messages       |  8/10  |  3/10  | +5 ↑   |
| Documentation        |  8/10  |  3/10  | +5 ↑   |
| Upgrade Path         |  8/10  |  4/10  | +4 ↑   |
| Dev Environment      |  7/10  |  3/10  | +4 ↑   |
| Community            |  6/10  |  5/10  | +1 ↑   |
| DX Measurement       |  6/10  |  2/10  | +4 ↑   |
+--------------------------------------------------------------------+
| TTHW                 | 2–3 min cold / <45 s warm | none (visual) | ↑ |
| Competitive Rank     | Competitive (Champion warm)                  |
| Magical Moment       | designed via copy-paste demo command         |
| Product Type         | CLI + local API + Claude Code skill          |
| Mode                 | POLISH                                       |
| Overall DX           | 7.4/10 | 3.4/10 | +4 ↑   |
+====================================================================+
| DX PRINCIPLE COVERAGE                                               |
| Zero Friction      | covered (one command)                          |
| Learn by Doing     | covered (first-run block, poll loop, EventSource snippet) |
| Fight Uncertainty  | covered (envelope + hints + See:)              |
| Opinionated + Escape Hatches | covered (port, open, save, data dir, idle) |
| Code in Context    | covered (CI + agent examples)                  |
| Magical Moments    | covered                                        |
+====================================================================+
```

### DX Implementation Checklist

```
DX IMPLEMENTATION CHECKLIST
============================
[x] Time to hello world < 5 min (target: 2–3 min cold)
[x] Installation is one command (npx)
[x] First run produces meaningful output (--audit → populated dashboard)
[x] Magical moment delivered via copy-paste demo command
[x] Every error message has: problem + cause + fix + docs link (FR-1, FR-2, FR-7)
[x] API/CLI naming is guessable without docs (flag table, audit-* events, GET /api)
[x] Every parameter has a sensible default (port, open, save, idle)
[x] Docs have copy-paste examples that actually work (README block, Appendix A, openapi.yaml)
[x] Examples show real use cases (CI regression gate, agent poll loop)
[x] Upgrade path documented with migration guide (WEB-DASHBOARD.md upgrade section)
[x] Breaking changes have deprecation warnings (--save; JSON write removed 3.6.0)
[x] TypeScript types included (contract.ts exported from the package)
[x] Works in CI/CD without special configuration ([output] save, SEOMATOR_HOME)
[x] Free tier available, no credit card required (MIT)
[x] Changelog exists and is maintained
[ ] Search works in documentation (GitHub only)
[ ] Community channel exists and is monitored (issues only)
```

### Implementation Tasks (DX phase)

- [ ] **DX1 (P1, human: ~4h / CC: ~15min)** — cli — Flag truth table: `--no-save`, `--json-report`, deprecated `--save` via `getOptionValueSource`, `[output] save` config key, `SEOMATOR_HOME` in `getGlobalDir()`, save failure always printed
  - Surfaced by: Pass 2, Pass 5 — both voices (flags are not inverses; patch-release default flip)
  - Files: `src/cli.ts`, `src/commands/audit.ts`, `src/commands/analyze.ts`, `src/config/schema.ts`, `src/storage/paths.ts`
  - Verify: truth-table tests for default / `--no-save` / `--json-report` / `--save` / config key
- [ ] **DX2 (P1, human: ~4h / CC: ~20min)** — server — One error envelope with `hint`/`details`, `See:` links, `GET /api` index, `X-SEOmator-Api-Version`, `409` + `Location`, strict `400` on unknown/out-of-range options
  - Surfaced by: Pass 2, Pass 3 — both voices (three envelope shapes; silent clamping; 409 without fix)
  - Files: `src/dashboard/server.ts`, `src/dashboard/api.ts`
  - Verify: every error test asserts `hint`; unknown key → 400
- [ ] **DX3 (P1, human: ~4h / CC: ~20min)** — cli — `serve` flags per FR-1: `--audit` with audit options, `--idle-timeout <dur>`, `--port 0`, `BROWSER=none`, `--api-only`, source-vs-package assets message, doctor checks + Node text
  - Surfaced by: Pass 1, Pass 3, Pass 6 — both voices
  - Files: `src/commands/serve.ts`, `src/commands/doctor.ts`, `src/cli.ts`
  - Verify: `serve --help` matches FR-1; assets message differs between checkout and package
- [ ] **DX4 (P1, human: ~4h / CC: ~20min)** — server — SSE `audit-complete`/`audit-error` with `runId` and `id:`, `Last-Event-ID` replay, `200 { run }`, `GET /api/runs/:runId`, `options.save: false`, error classification with hints
  - Surfaced by: Pass 2, Pass 3 — both voices (transport `error` collision; 204 on idle; reconnect can miss complete)
  - Files: `src/dashboard/events.ts`, `src/dashboard/audit-session.ts`, `src/dashboard/api.ts`
  - Verify: reconnect test with `Last-Event-ID`; `.json()` on idle never throws
- [ ] **DX5 (P1, human: ~1d / CC: ~30min)** — docs — README first-run block + `report` note; `docs/WEB-DASHBOARD.md` (API/error/SSE reference, poll loop, EventSource snippet, upgrade guide, runbook anchors); `docs/openapi.yaml`; `docs/README.md`, `quickstart.md`, `ai-agent-integration.md` brought current; `sync:docs` on every doc
  - Surfaced by: Pass 4 — both voices (three stale docs outside FR-11; no schema)
  - Files: `README.md`, `docs/WEB-DASHBOARD.md`, `docs/openapi.yaml`, `docs/README.md`, `docs/quickstart.md`, `docs/ai-agent-integration.md`, `scripts/sync-docs.mjs`
  - Verify: `npm run check:docs` green; every `See:` anchor resolves
- [ ] **DX6 (P2, human: ~3h / CC: ~15min)** — build — `scripts/web-dev.mjs` (tsup watch + `serve --api-only` + vite with header-stripping proxy), documented dev loop
  - Surfaced by: Pass 6 — both voices (`web:dev` internally broken)
  - Files: `scripts/web-dev.mjs`, `vite.web.config.ts`, `package.json`
  - Verify: `npm run web:dev` on macOS and Windows reaches a working dashboard
- [ ] **DX7 (P1, human: ~2h / CC: ~10min)** — release — CHANGELOG `Changed` entries (persistence default, `--save` deprecation timeline, `compare` previous semantics, schema columns), version bump to 3.4.0 minor, `npm install -g` rollback note
  - Surfaced by: Pass 5 — both voices + CEO spec reviewer (patch release flips a default)
  - Files: `CHANGELOG.md`, `package.json`, `docs/WEB-DASHBOARD.md`
  - Verify: CHANGELOG reviewed against the truth table
- [ ] **DX8 (P2, human: ~2h / CC: ~10min)** — release — TTHW measurement script for the Phase 4 smoke (clean cache, Chrome-present and `--no-cwv` paths, records seconds to `audit-complete`)
  - Surfaced by: Pass 1, Pass 8 — both voices (metric timed an empty dashboard)
  - Files: `scripts/measure-tthw.mjs`
  - Verify: numbers recorded in the release notes

> **Phase 2.5 complete.** DX overall: 7.4/10 (from 3.4). TTHW: none (visual) → 2–3 min cold / < 45 s warm; target Competitive.
> Codex: 16 concerns. Claude subagent: 21 issues. Consensus: 6/6 confirmed gaps, 0 disagreements → all folded into the plan body; nothing new for the gate.
> Passing to Phase 3 (Eng Review — the required gate reviews the final amended plan).

## Phase 3 — Eng Review (mode: FULL_REVIEW, auto-decided; the required gate)

### Step 0 — Scope challenge

- **Existing code map:** §1.2 — every sub-problem maps to existing code;
  nothing is rebuilt. The server wraps `AuditsDatabase` and `Auditor`; the UI
  is the existing renderer; reporters serve exports; `compare.ts` logic is
  lifted, not duplicated. Parallel flows introduced: none.
- **Minimum set:** Phases 1 + 2 satisfy "display previous audits"; Phase 3
  satisfies "initiate new audits". Deferrable without blocking the objective:
  T-5 (restyle), D-14 (SVG chart), the delight items — all kept (autoplan:
  never reduce; each is < 1 h CC).
- **Complexity check:** the plan touches > 8 files and adds three new
  modules (`server`, `AuditSession`, `queries`). Treated as a smell and
  answered by phasing (one release per phase, ≤ 2 new modules per phase) and
  by adding no framework, no queue, no API version prefix.
- **Search check:** **[Layer 1]** Node `http` + Server-Sent Events (built-in,
  zero dependencies); **[Layer 1]** `BroadcastChannel` + `navigator.locks`
  for one stream per browser (web platform built-ins; no library);
  **[Layer 1]** `AbortSignal.any()` (Node ≥ 20.3) to combine signals;
  **[Layer 2 footgun]** better-sqlite3's `busy_timeout` is a synchronous spin
  → 500 ms plus asynchronous retries; **[Layer 2 footgun]** `EventSource`
  cannot send headers → loopback only, no token; **[EUREKA]** the blocker to a
  useful history UI was never the missing UI — it was opt-in persistence, so
  the foundations release delivers most of the value before any server exists.
- **TODOS cross-reference:** `TODOS.md` did not exist; created in Phase 1 and
  extended in Phases 2 and 2.5 (13 items). None blocks this plan; none is
  bundled (each is outside the blast radius by construction).
- **Completeness check:** every choice took the complete option (full cancel
  including rule-level I/O, aggregated detail that scales to 1,000 pages, every
  state with copy, WCAG acceptance list, one error envelope). Lake score below.
- **Distribution check:** no new artifact type. `dist/web` ships inside the
  existing npm package (`files: ["dist"]`, built by `prepublishOnly`);
  platforms are Node ≥ 20.3 on macOS, Linux, Windows; no CI publish workflow
  exists today (releases are manual `npm publish`) — unchanged by this plan.
  The Electron distribution is deferred and named in NOT in scope.
- **Retrospective:** the last QA cycle fixed count drift across surfaces
  (ISSUE-004/007/008); this plan touches the same store and reporter seams, so
  stored-vs-live parity tests are mandatory (§12 Storage row), and the
  renderer's rule count comes from `/api/info`, never a literal.

### Step 0.5 — Dual voices

**CLAUDE SUBAGENT (eng — independent review), condensed and verified against
the code:** architecture PARTIAL, tests NO, performance NO, security PARTIAL,
error paths PARTIAL, deployment YES. Findings: (A1) `audit-complete` and the
detail endpoint carried the full result — 1,000 pages × 332 rules ≈ 332k rows
≈ 100 MB JSON and 332k `RuleCard`s; (A2) no typecheck or test project covered
`ui/` and the jsdom/axe devDependencies were missing; (A3) `AuditsDatabase`
is a singleton with a private constructor — no temp-DB seam
(`audits-db/index.ts:44-67`); (A4) `source` enum disagreed between §7.9 and
DD-2; (E1) one `EventSource` per tab against Chrome's six-connection HTTP/1.1
cap starves every `/api` fetch at six tabs; (E2) `initBrowser()` caches a
rejected promise forever (`playwright-fetcher.ts:41-72`) and `closeBrowser()`
re-throws it (`:79-85`) — one missing Chrome poisons a long-lived server;
(E3) `busy_timeout = 5000` blocks the event loop for up to 5 s; (E4) the id
regex could reject legacy ids; (E5) second-resolution `started_at` makes
"previous" and OFFSET pagination ambiguous under back-to-back agent audits;
(E6) the regression badge needed a diff per domain per request; (E7)
unwritable `~/.seomator` crashes at startup and an all-errors crawl saves a
0-score audit; (T1) nine rules do their own HEAD requests inside `run()` with
10 s timeouts — "network stops within 2 s" was false as specified; (T2) three
catches swallow the abort (`crawler.ts:287-293`, `:308`, `auditor.ts:330`);
(T3) `Crawler` hard-imports `fetchPage`; (T4) fake timers over real sockets
and wall-clock assertions are flaky, jsdom axe cannot check contrast; (T5)
missing tests: stale hashed asset must 404, encoded traversal, older CLI
writing to the newer schema, `Host` without port; (S1) clickjacking on `/`;
(S2) clamp-vs-reject contradiction; (S3) `--allow-origin '*'`; (S4)
`Content-Type` + null-prototype parse, CSP; hidden complexity:
`AbortSignal.any` needs Node 20.3, `tsup clean: true` wipes `dist/web`,
message-parsing error classification, `getOptionValueSource` semantics, the
Electron store's per-page duplication shipping in 3.4.0; sequencing: NULL
`engine_version` semantics, fold the `ScoreTrend` patch, 2.9 before 2.6,
`electron:build`/`pack` in Phase 1 acceptance.

Every finding was checked: the cached rejection, the three swallowing catches,
the 0-score save path, `engines >=20.0.0`, `clean: true`, and the vitest
`include` are all as described. One nuance: `generateId()` produced no short
id in 10⁶ samples, so E4 is theoretical — the relaxed regex costs nothing.
All findings were folded into FR-2, FR-3, FR-4, FR-6, FR-7, FR-8, FR-9, §8,
§11, §12, §13 and D-10 (Decision Audit Trail rows 53–66).

**CODEX SAYS (eng — architecture challenge):**
PARTIAL / NO / PARTIAL / PARTIAL / PARTIAL / PARTIAL (architecture, tests,
performance, security, errors, deployment). Second, time-boxed attempt after
the first run exceeded the 10-minute cap on the 2,400-line plan. Eight findings,
none overlapping the Claude voice, all verified: (C1, high) the save-error
banner promised Export HTML and Retry save with no endpoints and a 60 s expiry
→ `/api/runs/:runId/export`, `POST /api/runs/:runId/save`, 15-minute TTL for
unsaved results; (C2, high) `/api/domains` lacked the sparkline and regression
counts the strip renders, forcing N+1 trend/compare calls, and D-13
contradicted task 1.2 on who records comparisons → complete `DomainSummaryDto`
in one query; comparisons recorded on the save path, reads pure; (C3, high)
crawl progress semantics did not match the engine — `Crawler.onProgress`
exposes `discovered` not `queued`, `total` changes during discovery, fires
before processing, has no terminal event, and the Auditor has no page-start
callback (`crawler.ts:16, :276`, `auditor.ts:125`) → monotonic events,
`onPageStart`, clamped percent, engine → session → adapter test; (C4, high)
persisting ~332k rows is synchronous and `saveAuditToDatabase()` duplicates
every result into a second array (`save-audit.ts:59`) → streamed inserts,
Phase 1 benchmark with save/stall budgets, worker-thread fallback; (C5,
medium) `PRAGMA table_info` + `ALTER TABLE` races across two fresh processes →
tolerate `duplicate column name`, two-process test; (C6, medium)
`--allow-origin` was not a usable contract without CORS headers and
`OPTIONS` → removed (the proxy is same-origin); (C7, medium) the Auditor
bypasses the injected Electron fetcher for mobile parity (`auditor.ts:313`)
and the bridge maps neither toggle (`audit-bridge.ts:52`) → capabilities
`false` under Electron, mobile render through the injected fetcher; (C8)
`rm -rf dist` is not portable and Phase 4 lacked a clean-tarball install
smoke → `scripts/clean.mjs`, tarball install in a temp prefix before publish.

```
ENG DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude   Codex    Consensus
  ──────────────────────────────────── ──────── ──────── ─────────
  1. Architecture sound?               PARTIAL  PARTIAL  CONFIRMED (gaps) → payload aggregation, leader election, complete DTOs, unsaved-result endpoints
  2. Test coverage sufficient?         NO       NO       CONFIRMED (gap) → 47 gaps specified, 5 regressions CRITICAL, progress and migration-race tests
  3. Performance risks addressed?      NO       PARTIAL  CONFIRMED (gap) → aggregation, busy retry, save benchmark + worker fallback
  4. Security threats covered?         PARTIAL  PARTIAL  CONFIRMED (gap) → clickjacking headers, 415, static rules, --allow-origin removed
  5. Error paths handled?              PARTIAL  PARTIAL  CONFIRMED (gap) → browser-promise reset, no-pages, unwritable dir, Export/Retry endpoints
  6. Deployment risk manageable?       YES      PARTIAL  DISAGREE (degree) → both concerns folded (Windows-safe clean, tarball smoke, engines 20.3)
═══════════════════════════════════════════════════════════════
5/6 confirmed gaps, 1 disagreement in degree; 0 taste disagreements → nothing new for the gate.
```

### Section 1 — Architecture

```
  EXISTING                                   NEW (this plan)
  src/auditor.ts ◄──────────────┐            src/dashboard/audit-session.ts ──► Auditor (signal, onCrawlProgress)
  src/crawler/*  ◄──── signal ──┤                    │  RunState (bounded), sinks, persist, classify errors
  src/rules/** (fetchUrl ◄─ ctx.signal)             │
  src/storage/audits-db/* ◄─────┼──────────  src/dashboard/queries.ts ──► aggregated detail, domains, trend, compare
  src/reporters/*  ◄────────────┼──────────  src/dashboard/api.ts ──► export, delete, runs
  src/cli.ts ──lazy import──►   │            src/commands/serve.ts ──► src/dashboard/server.ts (http, router, static, events)
                                │            src/dashboard/contract.ts ◄── ui/lib/http-api.ts, electron/preload
  electron/main/{audit,db}-bridge.ts ──────► src/dashboard/{audit-session,queries}.ts (thin adapters)
  ui/ (was electron/renderer) ──► getAPI() → IPC adapter | HTTP adapter (leader tab owns EventSource)
  dist/web  ◄── vite.web.config.ts ◄── ui/     (served by static.ts; built after `node scripts/clean.mjs && tsup`)
```

Boundaries: `src/` never imports `electron/` or `ui/`; `electron/` and `ui/`
import `src/dashboard/contract` types only; the CLI serves a build artifact,
never UI code. Single points of failure: one process, one SQLite file —
acceptable for a local tool, with busy retry for the concurrent CLI writer.
Scaling: 1,000-page audits → aggregated detail (≈ 330 rows) and a summary on
SSE; 1,000 audits → `/api/domains` reads `audit_comparisons`; many tabs → one
stream per browser. Security architecture: loopback bind; `Host`/`Origin`/
`Sec-Fetch-Site` on `/api`; CSP + `X-Frame-Options` + `Sec-Fetch-Dest` on `/`;
`415`/`413`/null-prototype parsing; static traversal guard. Production failure
scenarios per integration point: (server↔engine) Chrome missing →
`playwright-missing` with hint, browser promise reset; (server↔SQLite) CLI
holds the write lock → 500 ms busy + async retries → `saveError` banner;
(server↔browser) tab count > 6 → leader election; (build) stale `dist/web`
after upgrade → hashed asset 404 loud; (Electron↔session) Playwright never
launched under Electron → capabilities hide the toggles. Rollback: revert the
PR; additive columns stay; `npm install -g @seomator/seo-audit@3.3.0`.
Diagrams worth inlining in code: `AuditSession` state machine
(`audit-session.ts`), the leader-election flow (`http-api.ts`), the
save-path transaction (`save-audit.ts`).

Findings (all auto-decided, P5/P1): F1 unbounded payloads → aggregated detail
+ summary event + `/api/runs/:runId/result` (A1); F2 SSE per tab → leader
election (E1); F3 `AuditsDatabase.open(path)` seam (A3); F4 typecheck/test
projects for `ui/` (A2); F5 `source` enum unified (A4); F6 comparison
recorded at save time so reads stay pure and cheap (E6).

### Section 2 — Code quality

- DRY: reconstruction and rule diff each exist once in `src/`; `validateUrl`
  shared; one error envelope; one `fetchUrl` helper receives the signal for all
  nine network rules — rather than nine guards.
- Error handling: typed `AuditError { code }` in the engine (no message
  parsing); every catch on the crawl/render path re-throws on abort; startup
  errors named; no catch-all swallows.
- Naming: `DashboardAPI`, `AuditSession`, `buildComparison`/`recordComparison`,
  `RuleSummary`, `audit-complete`/`audit-error`.
- Debt hotspots touched: `audit-bridge.ts` (shrinks), `report.ts` (fallback),
  `ProgressStream.tsx` per-page growth (fixed in Phase 1 because Electron
  ships then).
- Over/under-engineering: no queue, no framework, no version prefix; leader
  election is the one piece of non-obvious client code and is justified by a
  hard browser limit.
- Stale diagrams: `docs/ELECTRON-APP.md` (287 rules, bridges calling
  `Auditor`), `docs/STORAGE-ARCHITECTURE.md` schema → updated in 1.11.

### Section 3 — Test review

Framework: vitest (from CLAUDE.md), `npm run test:run`; 54 existing test
files under `src/`; a `jsdom` project is added for `ui/`.

```
CODE PATHS                                                         USER FLOWS
[+] src/auditor.ts / crawler / fetchers (signal, onCrawlProgress)  [+] Run from browser
  ├── [GAP→★★★] abort before first fetch / mid-crawl / render / rule I/O    ├── [GAP] [→E2E] serve --audit → progress → score
  ├── [GAP→★★★] every catch re-throws on abort (regression: crawler.ts:287, :308, auditor.ts:330)
  ├── [GAP→★★★] initBrowser() recovers after failed launch (regression)      ├── [GAP] reload mid-run resumes (snapshot)
  ├── [GAP→★★★] zero audited pages → no-pages                                ├── [GAP] second tab: leader/follower
  └── [★★ TESTED] scoring on fixture (auditor.test.ts) + [GAP→★★★] snapshot unchanged with signal
[+] src/storage (columns, transaction, busy retry, ids, keyset, recordComparison at save)
  ├── [GAP→★★★] weight round trip; legacy NULL → 1; not-measured parity vs buildCategoryResult
  ├── [GAP→★★★] single-transaction rollback; SQLITE_BUSY retry; older-CLI insert into newer schema (regression)
  ├── [GAP→★★★] getPreviousAudit by (started_at,id); keyset "Load more" no dup/skip
  └── [GAP→★★★] buildComparison pure (0 rows added); rule-diff added/removed; trend order (regression)
[+] src/dashboard/queries.ts                                        [+] History
  ├── [GAP→★★★] aggregated detail: 40-page fixture + synthetic 1,000 pages     ├── [GAP] empty → command (npx vs global)
  ├── [GAP→★★★] rules/:ruleId/pages keyset                                    ├── [GAP] domain select → anchor + list
  └── [GAP→★★★] listDomains from audit_comparisons; engine NULL → unknown     └── [GAP] delete latest → strip recompute
[+] src/dashboard/audit-session.ts                                  [+] Compare
  ├── [GAP→★★★] one run; cancel settles; bounded RunState (100-page fake)      ├── [GAP] per-rule rows "on n of m pages"
  ├── [GAP→★★★] summary-only audit-complete; unsaved result served 60 s       ├── [GAP] engine changed line; zero-delta-moved
  └── [GAP→★★★] error classification codes + hints                            └── [GAP] first audit state
[+] src/dashboard/server.ts / api.ts / static.ts / events.ts         [+] Detail actions
  ├── [GAP→★★★] every route × {200,400,403 matrix,404,409+Location,413,415}   ├── [GAP] export 4 formats; copy-for-LLM toast
  ├── [GAP→★★★] same-origin dev-proxy request passes; foreign Origin through the proxy rejected         ├── [GAP] delete confirm → / + toast
  ├── [GAP→★★★] / : CSP, XFO, Sec-Fetch-Dest iframe → 403                      └── [GAP] 404 state in second tab
  ├── [GAP→★★★] static: stale hashed asset 404, %2e%2e, NUL, Host w/o port   [+] Error states
  └── [GAP→★★★] SSE: snapshot, id: + Last-Event-ID replay, injected heartbeat  ├── [GAP] server stopped copy + reconnect
[+] src/commands/{serve,audit,report,doctor}.ts                                ├── [GAP] saveError banner → Export primary
  ├── [GAP→★★★] flag truth table (default/--no-save/--json-report/--save/config) ├── [GAP] cancelled state (not red)
  ├── [GAP→★★★] assets message by install kind; port in use; --port 0; idle    └── [GAP] playwright-missing hint
  └── [GAP→★★★] report reads SQLite, JSON fallback; doctor checks + Node text
[+] ui/ (adapter, store, router, components)
  ├── [GAP→★★★] adapter→store mapping; leader election (two jsdom windows); replay
  ├── [GAP→★★★] percent formula reaches 100; axe structure/ARIA; keyboard row activation
  └── [GAP→★★★] token contrast script (both themes ≥ 4.5:1)

  ├── [GAP→★★★] crawl progress monotonic; percent reaches 100 once (engine → session → adapter)
  └── [GAP→★★★] schema migration race (deterministic two-connection test)

COVERAGE (plan-level): 1/50 paths tested today (2%)  |  after plan: 50/50 specified (100%)
QUALITY target: ★★★ everywhere  |  GAPS today: 49 (5 E2E in the /qa checklist)  |  REGRESSIONS: 5 flagged CRITICAL
```

Regression rule applied: five changed existing behaviours (abort catches,
`initBrowser`, trend order, `getPreviousAudit`, older-CLI writes) get
regression tests as critical requirements. Flakiness removed as specified:
injected fetcher counters instead of wall-clock waits; injected heartbeat
interval instead of fake timers over sockets; contrast by token script, not
jsdom. Test plan artifact:
the gstack test-plan artifact for this branch (local workspace, not in the repo).
No LLM/prompt changes; no eval suites apply.

### Section 4 — Performance

- No N+1: detail is one `GROUP BY`; domains read `audit_comparisons`; trend
  is one indexed query.
- Memory: `RunState` bounded; the aggregated result of the last run held for
  60 s (≈ 330 rows); no full result on SSE.
- Event loop: busy wait capped at 500 ms; all-rows reads only for export and
  compare (streamed to the response, not buffered twice).
- Caching: hashed assets immutable; API `no-store`.
- Slow paths: HTML export of a 1,000-page audit (reporter, ~1 s — acceptable,
  it is a download); aggregated detail < 500 ms; leader election < 50 ms.
- Findings folded: P1 payload size (A1), P2 busy wait (E3), P3 badge diff per
  request (E6). No open items.

### Failure Modes Registry (Eng)

```
  CODEPATH                         | FAILURE MODE                                | RESCUED? | TEST? | USER SEES?                       | LOGGED?
  ---------------------------------|---------------------------------------------|----------|-------|----------------------------------|--------
  serve startup                    | data dir unwritable                         | Y        | Y     | message + SEOMATOR_HOME hint     | Y
  serve startup                    | assets missing (checkout / package)         | Y        | Y     | two distinct messages + See:     | Y
  AuditSession.run                 | Chrome launch fails; later run after install| Y        | Y     | playwright-missing hint; recovers| Y
  AuditSession.run                 | all pages error                             | Y        | Y     | no-pages error                   | Y
  AuditSession.cancel              | rule mid-HEAD loop                          | Y        | Y     | cancelled within 2 s             | Y
  AuditSession.cancel              | abort swallowed by a catch                  | Y        | Y     | never "page errored"             | Y
  persist                          | SQLITE_BUSY beyond retries                  | Y        | Y     | saveError banner, Export primary | Y
  persist                          | transaction throw                           | Y        | Y     | saveError banner                 | Y
  SSE                              | 6+ tabs                                     | Y        | Y     | leader/follower, no starvation   | —
  SSE                              | reconnect after buffer rolled               | Y        | Y     | snapshot with terminal auditId   | —
  detail                           | 1,000-page audit                            | Y        | Y     | aggregated rows, drill-down      | —
  static                           | stale hashed asset after upgrade            | Y        | Y     | 404 (reload fixes)               | Y (verbose)
  /                                | framed by another site                      | Y        | Y     | 403 / CSP block                  | Y
  POST /api/runs                   | wrong content type / unknown key            | Y        | Y     | 415 / 400 with details           | Y (verbose)
  list                             | same-second audits                          | Y        | Y     | stable order                     | —
  Electron progress                | per-page category duplication               | Y        | Y     | fixed in 3.4.0                   | —
```
**0 CRITICAL GAPS.**

### NOT in scope (Eng)

- Electron distribution (signing/notarization/release workflow) — TODOS.md P2.
- A CI publish workflow for npm — releases stay manual `npm publish`; separate.
- Worker-thread persistence — 500 ms busy + retries is enough for one local
  writer; revisit if a queue ships.
- HTTP/2 — browsers do not do h2c on loopback; leader election solves the cap.
- Idempotency keys on `POST /api/runs` — one run at a time.

### What already exists (Eng)

§1.2 plus: `parseEnum`/`parseIntValue` validation helpers; `hashUrl`;
`db.transaction()` already used for batch inserts (`results.ts:115, 241`);
`unauditableReason()`; the `fetchUrl` helper shared by the network rules;
`electron-fetcher.ts` as the second `browserFetcher` implementation.

### Worktree parallelization strategy

| Step | Modules touched | Depends on |
|---|---|---|
| 1.1 persistence flags | `src/cli`, `src/commands`, `src/config`, `src/storage/paths` | — |
| 1.2 schema + save | `src/storage/audits-db`, `src/storage` | — |
| 1.3 queries | `src/dashboard`, `src/storage/audits-db` | 1.2 |
| 1.4 comparison | `src/storage/audits-db`, `src/commands` | 1.2 |
| 1.5 cancel + 1.6 crawl progress | `src/auditor`, `src/crawler`, `src/rules` (fetchUrl) | — |
| 1.7 session + 1.8 contract/bridges | `src/dashboard`, `electron/main`, `electron/preload` | 1.3, 1.5 |
| 1.9 report | `src/commands` | 1.2 |
| 1.10 renderer move | `ui/`, `electron/` | — |
| 2.1–2.3 server + serve | `src/dashboard`, `src/commands` | 1.3, 1.7 |
| 2.4–2.6, 2.9 renderer | `ui/` | 1.10, 2.1 (API shapes) |
| 3.x execution | `src/dashboard`, `ui/` | 2.x |

Lanes (Phase 1): **A:** 1.2 → 1.3 → 1.4 → 1.9 (shared `src/storage`);
**B:** 1.5 → 1.6 (engine); **C:** 1.1 (flags); **D:** 1.10 (renderer move).
Launch A + B + C + D in parallel worktrees; merge; then 1.7 → 1.8 → 1.11.
Phase 2: **E:** 2.1 → 2.2 → 2.3 (server) ∥ **F:** 2.5 → 2.9 → 2.4 → 2.6 → 2.7
(renderer); merge; 2.8 tests. Conflict flags: lanes A and B both touch
`src/storage/types.ts`? No — B touches `src/types.ts` (AuditContext.signal);
lanes C and A both touch `src/commands/audit.ts` — sequence C before A's 1.9
or coordinate. Phase 3 is sequential (`src/dashboard` and `ui/` both change
in each task).

### Implementation Tasks (Eng phase)

- [ ] **ET1 (P1, human: ~1d / CC: ~25min)** — dashboard — Aggregated `RuleSummary` detail in SQL, `/rules/:ruleId/pages` keyset, summary-only `audit-complete`, `/api/runs/:runId/result` for unsaved results
  - Surfaced by: Section 1 F1 / Claude eng A1 — 1,000 pages × 332 rules ≈ 100 MB over SSE and 332k cards
  - Files: `src/dashboard/queries.ts`, `src/dashboard/audit-session.ts`, `src/dashboard/api.ts`, `src/dashboard/contract.ts`, `ui/stores/audit-store.ts`
  - Verify: synthetic 1,000-page fixture → detail < 500 ms and ≈ 330 rows
- [ ] **ET2 (P1, human: ~6h / CC: ~30min)** — ui — One `EventSource` per browser: `navigator.locks` leader election, `BroadcastChannel` rebroadcast, follower polling fallback
  - Surfaced by: Section 1 F2 / Claude eng E1 — HTTP/1.1 six-connection cap
  - Files: `ui/lib/http-api.ts`
  - Verify: two jsdom windows share one stream; leader close → follower takes over ≤ 5 s
- [ ] **ET3 (P1, human: ~4h / CC: ~20min)** — engine — `AuditContext.signal` into `fetchUrl`; every crawl/render catch re-throws on abort; `initBrowser()` rejection reset; typed `AuditError`; injectable `fetchPage`; `AbortSignal.any` + `engines >=20.3.0`
  - Surfaced by: Section 3 T1–T3, E2, hidden complexity — verified at `crawler.ts:287-293`, `:308`, `auditor.ts:330`, `playwright-fetcher.ts:41-85`
  - Files: `src/types.ts`, `src/rules/**/fetch-url helper`, `src/crawler/crawler.ts`, `src/crawler/playwright-fetcher.ts`, `src/auditor.ts`, `package.json`
  - Verify: regression tests: no errored page after abort; Chrome recovery
- [ ] **ET4 (P1, human: ~4h / CC: ~20min)** — storage — `busy_timeout` 500 ms + async retries; `recordComparison()` at save; `started_at DESC, id DESC` ordering; ids from the existing `utils/hash.ts` `generateId()`; `AuditsDatabase.open(path)`; NULL `engine_version` = unknown
  - Surfaced by: Section 4 P2, E3, E5, E6, A3, sequencing
  - Files: `src/storage/audits-db/{schema,audits,comparisons,index}.ts`, `src/storage/save-audit.ts`, `src/storage/paths.ts`
  - Verify: busy test; keyset no-dup test; older-CLI insert test
- [ ] **ET5 (P1, human: ~4h / CC: ~20min)** — server — CSP + `X-Frame-Options` + `Sec-Fetch-Dest` on every `index.html` response; `415`; null-prototype JSON; static: extension paths 404, `%2e%2e`/NUL, `Host` without port
  - Surfaced by: Section 1 security / Claude eng S1–S4, T5
  - Files: `src/dashboard/server.ts`, `src/dashboard/static.ts`
  - Verify: security matrix tests
- [ ] **ET6 (P1, human: ~3h / CC: ~15min)** — build — `scripts/clean.mjs` + `clean: false`; `ui/tsconfig.json` in `typecheck`; vitest workspace (`node` + `jsdom`); `jsdom`/`@testing-library/react`/`axe-core` devDependencies
  - Surfaced by: Claude eng A2, hidden complexity (tsup wipes `dist/web`)
  - Files: `tsup.config.ts`, `package.json`, `vitest.config.ts`, `ui/tsconfig.json`
  - Verify: `npm run dev` watch keeps `dist/web`; `npm run typecheck` covers `ui/`
- [ ] **ET7 (P1, human: ~2h / CC: ~10min)** — engine — Startup guard for an unwritable data directory; `no-pages` error when every page fails; Electron store per-page fix moved to Phase 1
  - Surfaced by: Claude eng E7, sequencing
  - Files: `src/commands/serve.ts`, `src/dashboard/audit-session.ts`, `ui/stores/audit-store.ts`
  - Verify: read-only `SEOMATOR_HOME` → clean exit; all-errors crawl → no row
- [ ] **ET8 (P2, human: ~2h / CC: ~10min)** — tests — Injected heartbeat interval and fetcher counters (no fake timers over sockets, no wall-clock asserts); token contrast script for both themes
  - Surfaced by: Section 3 flakiness (T4)
  - Files: `src/dashboard/events.ts`, `src/dashboard/*.test.ts`, `scripts/check-contrast.mjs`
  - Verify: suite passes 20× in a loop

- [ ] **ET9 (P1, human: ~4h / CC: ~20min)** — server — Unsaved-result recovery: `GET /api/runs/:runId/export`, `POST /api/runs/:runId/save`, 15-minute TTL for unsaved results with expiry tests
  - Surfaced by: Codex C1 — banner actions had no endpoints; results expired in 60 s
  - Files: `src/dashboard/api.ts`, `src/dashboard/audit-session.ts`, `ui/components/ProgressStream.tsx`
  - Verify: save failure → Export downloads, Retry succeeds after the directory becomes writable
- [ ] **ET10 (P1, human: ~3h / CC: ~15min)** — storage — Complete `DomainSummaryDto` (sparkline, regressed/improved counts, engine version) in one query; comparisons recorded on the save path
  - Surfaced by: Codex C2 — N+1 trend/compare calls; D-13 vs task 1.2
  - Files: `src/dashboard/queries.ts`, `src/storage/save-audit.ts`, `src/storage/audits-db/comparisons.ts`
  - Verify: `/api/domains` with 50 domains is one statement (SQL trace) and < 50 ms
- [ ] **ET11 (P1, human: ~4h / CC: ~20min)** — engine — Monotonic crawl progress (`crawled`, `discovered`, `maxPages`, terminal event), `onPageStart`, clamped percent; engine → session → adapter test
  - Surfaced by: Codex C3 — `crawler.ts:16, :276`, `auditor.ts:125`
  - Files: `src/crawler/crawler.ts`, `src/auditor.ts`, `src/dashboard/audit-session.ts`, `ui/stores/audit-store.ts`
  - Verify: percent never decreases; reaches 100 once
- [ ] **ET12 (P1, human: ~4h / CC: ~20min)** — storage — Streamed inserts (no duplicate array); Phase 1 benchmark of save/export/compare on a 1,000-page fixture with save < 3 s and stall < 3 s; worker-thread fallback design
  - Surfaced by: Codex C4 — `save-audit.ts:59`
  - Files: `src/storage/save-audit.ts`, `scripts/bench-persist.mjs`, (`src/storage/persist-worker.ts` if needed)
  - Verify: benchmark numbers recorded in the 3.4.0 release notes
- [ ] **ET13 (P2, human: ~2h / CC: ~10min)** — storage — Tolerate `duplicate column name` from a concurrent first open; two-process init test
  - Surfaced by: Codex C5
  - Files: `src/storage/audits-db/schema.ts`, tests
  - Verify: two child processes open a fresh file simultaneously without error
- [ ] **ET14 (P2, human: ~1h / CC: ~5min)** — server — Remove `--allow-origin` and its docs; state "no CORS" explicitly
  - Surfaced by: Codex C6
  - Files: `src/commands/serve.ts`, `docs/WEB-DASHBOARD.md`
  - Verify: `serve --help` has no `--allow-origin`
- [ ] **ET15 (P1, human: ~3h / CC: ~15min)** — engine/electron — Mobile-parity render through the injected `browserFetcher`; Electron advertises `mobileParity`/`simulateInteraction` `false` until its fetcher supports them
  - Surfaced by: Codex C7 — `auditor.ts:313`, `audit-bridge.ts:52`
  - Files: `src/auditor.ts`, `electron/main/audit-bridge.ts`, `electron/main/electron-fetcher.ts`
  - Verify: Electron run with mobile requested → `400 unsupported-option`; CLI mobile run unchanged
- [ ] **ET16 (P2, human: ~2h / CC: ~10min)** — release — `scripts/clean.mjs` (Windows-safe); tarball install smoke in a clean temp prefix before publish (3.4.0 and 3.5.0)
  - Surfaced by: Codex C8
  - Files: `scripts/clean.mjs`, `package.json`, release checklist in `docs/WEB-DASHBOARD.md`
  - Verify: `npm run build` on Windows; smoke passes from the tarball

### Completion summary (Eng)

- Step 0: Scope Challenge — scope accepted as-is (autoplan: never reduce); complexity smell answered by phasing
- Architecture Review: 9 issues found (all folded; incl. Codex C1, C2, C7)
- Code Quality Review: 4 issues found (all folded)
- Test Review: diagram produced, 49 gaps identified → 50/50 paths specified (progress monotonicity and migration race added); 5 regressions flagged CRITICAL
- Performance Review: 4 issues found (all folded; incl. Codex C4)
- NOT in scope: written (5 items)
- What already exists: written
- TODOS.md updates: 13 items across all phases (written; 0 new from Eng)
- Failure modes: 0 critical gaps flagged (16 modes, all rescued + tested + visible)
- Outside voice: ran (codex + claude subagent; Codex on a second time-boxed attempt after the first exceeded 10 minutes)
- Parallelization: 6 lanes, 4 parallel / 2 sequential (Phase 1); 2 parallel lanes (Phase 2); Phase 3 sequential
- Lake Score: 16/16 recommendations chose the complete option

> **Phase 3 complete.** Codex: 8 concerns (all verified, all folded). Claude subagent: 27 issues (all verified, all folded). Consensus: 5/6 confirmed gaps, 1 disagreement in degree (deployment), 0 taste disagreements → nothing new for the gate. Passing to Phase 4 (Final Gate).

## Decision Audit Trail

<!-- AUTONOMOUS DECISION LOG -->

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | 0 | Skip the `/office-hours` offer | Mechanical | P6 | autoplan one-gate rule; CEO 0A covers the premise challenge | run office-hours first |
| 2 | 0 | Plan file = `docs/PRD-local-web-dashboard.md` (repo convention `docs/PRD-*.md`) | Mechanical | P5 | two PRDs already live there | `~/.gstack` only |
| 3 | 1 | Mode SELECTIVE EXPANSION | Mechanical | — | autoplan override; also the enhancement default | HOLD / EXPANSION |
| 4 | 1 | Approach A (server + shared renderer), re-sequenced foundations → read-only → execution | Taste → User Challenge UC-1/UC-2 | P1 | only approach meeting G1–G4; both voices prefer C′-first → queued for the user | C′ first; B; E |
| 5 | 1 | Persistence default-on, `--no-save` | Taste T-2 (accepted) | P1, P2 | both voices; 2 files; history empty otherwise | keep `--save` opt-in |
| 6 | 1 | Provenance columns on `audits` instead of `config_json.run` | Mechanical | P5 | `SeomatorConfig` type must not grow a foreign key | JSON blob |
| 7 | 1 | `weight` column for not-measured parity | Mechanical | P1 | one definition of "not measured" | separate flag |
| 8 | 1 | Fix 1,000-row cap in reconstruction | Mechanical | P1 | live 40-page audit truncated to < 9% | paginate in UI |
| 9 | 1 | Pure comparison; correct previous; single trend reversal; added/removed rules | Mechanical | P5 | reads must not write; verified bugs | leave as is |
| 10 | 1 | Cancel spans crawler, fetchers, sitemap/robots, electron fetcher; `finally` cleanup | Mechanical | P1 | partial cancel is the current bug | auditor-only checks |
| 11 | 1 | Crawl-phase progress event | Mechanical | P1 | G3 false without it | drop the claim |
| 12 | 1 | Bounded page-aware `RunState`, coalesced rule events | Mechanical | P1, P5 | per-page callbacks make v1's state unbounded | stream everything |
| 13 | 1 | Capabilities in `/api/info`; UI hides unsupported toggles | Mechanical | P5 | Electron cannot launch Playwright | let it fail |
| 14 | 1 | Loopback only; drop `--host`/token from v1 | Mechanical | P3, P5 | `EventSource` cannot send headers; `Host` check breaks on `0.0.0.0` | query-param token now |
| 15 | 1 | Single-transaction save + `busy_timeout` | Mechanical | P1 | partial `running` rows; concurrent CLI writer | leave as is |
| 16 | 1 | `report` reads SQLite with JSON fallback | Expansion accepted | P4 | one history; both voices | keep two stores |
| 17 | 1 | Renderer → `ui/` | Taste T-1 (recommendation kept) | P5 | honest ownership; Claude voice prefers in-place | keep in `electron/renderer/` |
| 18 | 1 | SVG chart replaces Recharts | Taste T-3 (accepted) | P3, P5 | one series; largest chunk; devDependency removed | lazy-load Recharts |
| 19 | 1 | Web bundle ships in the main package | Taste T-4 (accepted) | P3 | ≤ ~400 kB gz on an install dominated by native deps | separate package |
| 20 | 1 | Idle exit opt-in | Taste (one voice) | P6 | a dashboard left open must not vanish | default-on |
| 21 | 1 | SSE over WebSocket | Mechanical | P5 | one-way stream; no dependency | `ws` |
| 22 | 1 | `react-router-dom`; Browser on web, Hash under Electron | Mechanical | P5 | deep links; `file://` | Hash everywhere |
| 23 | 1 | One run per server; 409 | Mechanical | P3 | engine has module-level state | queue |
| 24 | 1 | Port 7360 | Mechanical | — | avoids 3000/5173/8080 | other |
| 25 | 1 | No `/v1` prefix; `apiVersion` in info; additive-only | Mechanical | P5 | agents script against it | version prefix |
| 26 | 1 | Delight 1–6 accepted; 7–9 deferred | Expansion | P2 | each accepted item < 1 h CC in touched files | — |
| 27 | 1 | E10–E17 deferred to TODOS.md | Expansion | P3 | outside blast radius or separate deliverables | build now |
| 28 | 1 | Dual voices run in parallel, both foreground | Mechanical | P6 | both complete before the consensus table | strictly sequential |
| 29 | 1 | Spec-review loop on the CEO plan (2 iterations, 7/10 → 8/10): fixed `--save` semantics (`--json-report` + `getOptionValueSource`), dev-proxy origin handling, idle definition, `--audit` phase, Electron persistence stated, file counts/rationale; rejected one finding (the command is `seomator self doctor`, verified in `src/cli.ts`) | Mechanical | P1 | reviewer findings verified against the code | — |
| 30 | 2 | Merge Home and History into `/`; domain strip as rows; anchor = score + what changed + trend | Mechanical (structural) | P5, P1 | both voices; hard rejection (card grid); no anchor | separate routes; cards |
| 31 | 2 | Detail opens on the score; page regions instead of stacked cards; shadows only on overlays | Taste T-5 (recommendation applied) | P5 | both voices; hard rejection (stacked cards); changes the shipped Electron look | keep cards |
| 32 | 2 | Compare: one row per rule, "on n of m pages", four lists, engine line muted below the delta | Mechanical | P1 | Claude voice; crawl audits would list per page | per-page rows |
| 33 | 2 | Progress composition + percent formula; no per-page category scores; cancelled ≠ error; save-error copy | Mechanical | P1, P5 | both voices; `lastScore` misleading | keep feed + lastScore |
| 34 | 2 | State table with visible copy; fixed-height skeletons; server-stopped copy; empty composition | Mechanical | P1 | both voices | "No items found" |
| 35 | 2 | Per-viewport layouts; two-line rows < 768 px; chips instead of a drawer | Mechanical | P5, P3 | both voices; a drawer needs focus trapping the plan never specified | drawer |
| 36 | 2 | WCAG 2.2 AA acceptance list; 44 px targets; row-as-link | Mechanical | P1 | Codex voice; contrast numbers verified against `globals.css` | aspirational |
| 37 | 2 | Contrast tokens (muted text 2.5:1 → 4.6:1; status text tokens); type scale 12–56 | Mechanical; 14 px table text = Taste T-6 | P1, P5 | Codex voice measured; Claude voice scale | leave tokens |
| 38 | 2 | Three motions under reduced-motion | Mechanical | P5 | both voices NOT SPEC'D | none / many |
| 39 | 2 | Toolbar `History \| Run` segments + back crumb; sidebar detail-only | Mechanical | P5 | Claude voice; trunk test | 5 nav items |
| 40 | 2 | Attempted 3 Home mockups with the gstack designer; the generator was not configured, so the phase is text-only and the brief is saved for later | Mechanical | P6 | designer unavailable; no blocking wait under the one-gate rule | skip the attempt |
| 41 | 2 | `DESIGN.md` deferred to TODOS.md | Expansion | P3 | outside blast radius; tokens documented in DD-9 | write now |
| 42 | 2.5 | Persona: solo developer shipping a site; mode DX POLISH; tier Competitive; magical moment = copy-paste `serve --audit` | Mechanical | P6, P5 | README/keywords/skill evidence; enhancement of an existing product | EXPANSION / TRIAGE |
| 43 | 2.5 | Foundations release is a minor (3.4.0), dashboard 3.5.0 | Mechanical | P5 | three reviewers: a persistence default flip is not a patch | 3.3.1 patch |
| 44 | 2.5 | Flag truth table: `--no-save`, `--json-report`, deprecated `--save` via `getOptionValueSource('save')`, `[output] save`, `SEOMATOR_HOME` | Mechanical | P5, P1 | both voices; Commander 12.1 verified (`getOptionValueSource` present) | argv sniffing |
| 45 | 2.5 | One error envelope with `hint`/`details`/`See:`; `GET /api`; version header; `409` + `Location`; strict `400`s | Mechanical | P1, P5 | both voices; agents must fail loudly | clamp silently |
| 46 | 2.5 | SSE `audit-complete`/`audit-error`, `runId` + `id:` on every event, `Last-Event-ID` replay; `200 { run }`; `/api/runs/:runId`; `save:false` | Mechanical | P5, P1 | both voices; transport `error` collision; `.json()` on 204 throws | keep names |
| 47 | 2.5 | `serve` flags: `--audit` with audit options, `--idle-timeout <dur>`, `--port 0`, `BROWSER=none`, `--api-only`; assets message by install kind; doctor checks | Mechanical | P1, P5 | both voices | minimal flags |
| 48 | 2.5 | Engine failure classification with hints (`dns`, `timeout`, `non-html`, `http-error`, `playwright-missing`, `aborted`) | Mechanical | P1 | both voices; `unauditableReason()` reused | `audit-failed` only |
| 49 | 2.5 | Docs: three stale docs brought current, `openapi.yaml`, poll loop, `sync:docs` on all docs | Mechanical | P1 | both voices; `docs/README.md` says 148 rules today | new doc only |
| 50 | 2.5 | `scripts/web-dev.mjs` + `--api-only`; ABI switch automation → TODOS.md | Mechanical / Expansion deferred | P5, P3 | both voices; `web:dev` was unbuildable as written | two terminals |
| 51 | 2.5 | TTHW metric = time to a **completed** audit in the dashboard, both Chrome paths, measured by a script | Mechanical | P1 | both voices; empty dashboard is not hello world | keep metric |
| 52 | 2.5 | Empty-state command uses `/api/info.cli` (`npm_command === 'exec'` → npx form); `Report a problem` link on error states | Mechanical | P5 | Claude voice; verified `npm_command=exec` under `npm exec` | always `seomator` |
| 53 | 3 | Detail aggregated per rule in SQL; summary-only `audit-complete`; `/api/runs/:runId/result`; rules/pages drill-down | Mechanical | P1, P5 | Claude eng A1 — 332k rows ≈ 100 MB on the wire | send everything |
| 54 | 3 | One `EventSource` per browser (`navigator.locks` + `BroadcastChannel`), follower polling | Mechanical | P5 | Claude eng E1 — HTTP/1.1 six-connection cap | one stream per tab |
| 55 | 3 | `initBrowser()` rejection reset; typed `AuditError`; catches re-throw on abort; `AuditContext.signal` into `fetchUrl`; injectable `fetchPage`; `engines >=20.3` | Mechanical | P1 | Claude eng E2, T1–T3, hidden complexity — all verified in code | between-rules checks only |
| 56 | 3 | `busy_timeout` 500 ms + async retries; `recordComparison()` at save; `(started_at, id)` keyset; ids from the existing `utils/hash.ts` `generateId()`; `AuditsDatabase.open(path)`; NULL engine = unknown | Mechanical | P1, P5 | Claude eng E3–E6, A3, sequencing | 5 s sync wait |
| 57 | 3 | CSP + `X-Frame-Options` + `Sec-Fetch-Dest` on `/`; `415`; null-prototype JSON; static extension paths 404; `%2e%2e`/NUL; `Host` without port | Mechanical | P1 | Claude eng S1–S4, T5 | `/api`-only checks |
| 58 | 3 | `scripts/clean.mjs` + `clean: false`; `ui/tsconfig.json`; vitest workspace; jsdom/testing-library/axe devDeps | Mechanical | P5 | Claude eng A2, hidden complexity; Codex C8 (Windows) | `rm -rf` |
| 59 | 3 | Startup guard for an unwritable data dir; `no-pages` error; Electron store fix moved to Phase 1; `electron:build`/`pack` in Phase 1 acceptance | Mechanical | P1 | Claude eng E7, sequencing | — |
| 60 | 3 | Unsaved-result endpoints (`export`, `save`) with a 15-minute TTL | Mechanical | P1 | Codex C1 — banner actions had no endpoints | dead buttons |
| 61 | 3 | Complete `DomainSummaryDto` in one query; comparisons recorded on the save path (D-13 clarified) | Mechanical | P5, P1 | Codex C2 | N+1 |
| 62 | 3 | Monotonic crawl progress + `onPageStart` + clamped percent + end-to-end test | Mechanical | P1 | Codex C3 — `crawler.ts:16, :276` | percent may regress |
| 63 | 3 | Streamed inserts; Phase 1 persistence benchmark with budgets; worker-thread fallback reserved | Mechanical | P1, P5 | Codex C4 — `save-audit.ts:59` | lower the page cap |
| 64 | 3 | Tolerate `duplicate column name`; two-process init test | Mechanical | P1 | Codex C5 | assume single process |
| 65 | 3 | Remove `--allow-origin`; explicit "no CORS" | Mechanical | P5, P3 | Codex C6 — a CORS contract nobody needs | full CORS |
| 66 | 3 | Mobile render through the injected fetcher; Electron capabilities `false` until supported | Mechanical | P5 | Codex C7 — `auditor.ts:313` | launch Playwright under Electron |
| 67 | 3 | Tarball install smoke in a clean temp prefix before publish | Mechanical | P1 | Codex C8 | npx-only smoke |
| 68 | 3 | Codex voice retried once with a time-boxed brief after a 10-minute timeout | Mechanical | P6 | degradation matrix allows subagent-only; a second attempt was cheap and succeeded | tag [subagent-only] |

| 69 | ship | Per-launch token (HttpOnly cookie for the browser, header for agents, `serve.json` 0600) on top of the origin checks | User decision D1 (ship review) | — | Codex adversarial: loopback is not authentication (sandboxes, forwarded ports) | keep loopback trust |
| 70 | ship | Drop SSE replay; one stream per visible tab via the Page Visibility API; drop `rules-progress`; one 15-minute retention rule | User decision D2 (ship review) | P5 | simplification lens: each duplicated something the same section already did | leader election, ring buffer |
| 71 | ship | Drop `rule_set_hash`, `openapi.yaml` (route index derived from the router), the API-version header; offset pagination with a deterministic tie-break | User decision D3 (ship review) | P5 | no consumers; the OpenAPI file would drift | keyset, hash |
| 72 | ship | `web:dev` via `concurrently` + `node --watch` (no `--api-only`, no `web-dev.mjs`); drop `--idle-timeout` | User decision D4 (ship review) | P5 | platform features over a hand-rolled process manager; the idle flag had no scenario | keep both |
| 73 | ship | Keep the `--save` → `--json-report` deprecation path and the capability flags | User decision D4 (declined cuts) | P1 | DX and spec reviews asked for the deprecation period; capabilities keep Electron honest | no-op notice; viewport in Electron |
| 74 | ship | Codex structured review P1s applied as doc corrections without a gate question: signal reaches the two bare `fetch()` rules, `RuleSummary` keeps the not-measured marker, only the save path records comparisons | Mechanical | P5 | each contradiction had one correct resolution | ask A/B |
| 75 | ship | Adversarial and specialist findings folded: dev-proxy Origin rewrite only for the same-origin case, clickjacking headers on every `index.html` response, `/api/*` typos → 404 JSON, retry budget ≥ save budget, TZ test script, vitest 2.x workspace file, scoring baseline before 1.5, deterministic migration-race test, synchronous slot reservation, `createShutdown` seam, SSRF hardening and `db prune` TODOs, workstation paths scrubbed, aggregated task list replaced by a pointer to §11 | Mechanical | P1, P5 | reviewers verified against the code | — |

## Implementation Tasks (aggregated across phases)

The four per-phase task lists above (T1–T22, DT1–DT9, DX1–DX8, ET1–ET16) were
aggregated at the final gate (55 entries, 41 P1) for the approval summary. They
are not repeated here: **§11 is the authoritative schedule** and already absorbs
every finding-derived task into its numbered rows; the per-phase JSONL lists live
in the gstack workspace for `/autoplan` tooling. Keeping one inventory avoids the
drift a second copy had already started to show.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (PLAN via /autoplan) | 18 proposals, 9 accepted, 8 deferred, 1 skipped; 2 user challenges declined and 4 taste decisions taken as recommended at the gate; 0 critical gaps |
| Codex Review | `/codex review` | Independent 2nd opinion | 4 (one per phase) | issues_found (via /autoplan) | CEO 12, Design 9, DX 16, Eng 8 findings — all verified against the code and folded |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN via /autoplan) | 17 issues, 0 critical gaps; 50/50 code paths specified; 5 regression tests CRITICAL |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL via /autoplan) | score: 4/10 → 8.6/10, 11 decisions; 2 taste decisions taken as recommended; text-only (mockup generator not configured) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | CLEAR (via /autoplan) | score: 3.4/10 → 7.4/10, TTHW: none (visual) → 2–3 min cold |

- **CODEX:** ran in all four phases (Eng on a second time-boxed attempt); 45 findings, 0 rejected after verification, 1 corrected (the CLI command is `seomator self doctor`).
- **CROSS-MODEL:** the Claude and Codex voices agreed on every dimension in every phase except the degree of the 6-month risk (CEO) and of deployment risk (Eng); both disagreements were folded rather than surfaced. Cross-phase themes: stored-vs-live parity (CEO, Eng); persistence opt-in (CEO, DX, spec reviewer); desktop-specific UI (CEO, Design); cancel is larger than it looks (CEO, Eng); agents as API consumers need loud failures and one envelope (DX, Eng); the dev loop must pass its own origin checks (spec reviewer, DX, Eng).
- **SHIP REVIEW (2026-09-02):** pre-landing checklist, testing/maintainability/simplification specialists, Claude + Codex adversarial passes, and Codex structured review ran on the branch; 3 P1 and 4 P2 contract contradictions, 8 + 11 adversarial findings, and 30 consistency findings were folded; 13 simplification proposals went to the user — 10 adopted, 2 declined, 1 kept as decided; a per-launch API token was adopted (rows 69–75).
- **VERDICT:** CEO + DESIGN + DX + ENG CLEARED via /autoplan — approved as-is at the final gate on 2026-09-02, then hardened at the ship review; ready to implement (Phase 1 → 3.4.0).

NO UNRESOLVED DECISIONS
