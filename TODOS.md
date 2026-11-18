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

- ~~**The SEO fundamentals are the lowest-weighted rules in the product**~~ **Decided and shipped in 5.0.0, 2026-09-05.** Weights are now 25/20/15/15/10 against the product's own precedent; runs carry `scoringVersion` and `compare` treats a change as material. Real sites held or improved (growthmarketing.ai 94→94, livechatai.com 87→92); the blank document's `core` went 85→47. The open half remains the *overall* score: a blank page still scores 81, because 19 other categories award vacuous passes. Whether an absent subject is a pass or a non-measurement is still a design call.

  ~~original finding:~~ **The SEO fundamentals are the lowest-weighted rules in the product.** Found by /qa
  on 2026-09-04. `<html><body><p>x</p></body></html>` — no title, description, lang,
  viewport, canonical or h1 — scores **84/100**, and `core` scores 85 with 9 failures
  against 13 passes.

  `core-title-present`, `core-description-present`, `core-canonical-present`,
  `core-viewport-present` and `core-h1-present` are all weight **1**, the bottom of a
  scale that runs to 25. `core-title-unique` is 5, so "your title is duplicated" is
  weighted 5x "you have no title". Ten canonical edge-case rules at weight 6-8 pass
  vacuously on a page with no canonical, contributing ~63 weight-points at 100.

  Measured: treating those ten as not-measured takes `core` from 85.4 to 56.2 and the
  overall from 84.2 to 81.0. **The weighting is the defensible half of this** — the
  pass-vs-not-measured question is a design call, since the 68 files using
  `notMeasured` do so for missing instrumentation data, not for an absent subject.
  It reads as an oversight because the product weights presence checks heavily
  elsewhere: `schema-present` 25, `images-alt-present` 20, `core-title-present` 1.

  Not changed by /qa: it is an SEO judgement call and it moves every stored score, so
  it needs a version marker or `compare` reads it as a site regression.

- ~~**`analyze` and `compare` return 1 for both an error and a low score**~~ **Shipped in 5.0.0.** 0 success, 1 below threshold, 2 failed, 130 cancelled, documented in SKILL.md. Original note: **`analyze` and `compare` return 1 for both an error and a low score.** `audit` uses
  2 for errors and 1 for "score under 70", so an agent can distinguish them there and
  not here. Aligning the three is a contract change; small, but it needs a version note.

- **Three config keys are parsed, validated, and not acted on.** Found by sweeping all
  30 leaf keys in `schema.ts` for a consumer. Unlike the keys fixed on 2026-09-04,
  each of these has a default matching real behaviour, so only changing one is
  misleading — `seomator config validate` now warns, the docs mark them, and
  `src/config/validator.ts` holds the list as data so it cannot drift. (8.0.0
  implemented the other six: `crawler.per_host_concurrency`, the four
  `external_links.*` keys with `--refresh`, and `rule_options`.)

  - `crawler.breadth_first` — the queue is `push`/`shift`, always breadth-first.
    Depth-first is `pop()`, but the frontier ordering should be one decision with
    `max_prefix_budget`.
  - `crawler.follow_redirects` — `fetcher.ts` follows by hand with a hop limit so the
    redirect chain can be recorded. Honouring `false` means stopping at the first hop
    and deciding what `redirect-*` rules report then.
  - `crawler.max_prefix_budget` — no prefix budget exists. It is the guard against a
    crawl spending all 100 pages inside `/blog/`.

- ~~**`crawler.delay_ms` and `crawler.per_host_delay_ms` are declared and unread**~~
  **Fixed by /qa on main, 2026-09-04** (`ISSUE-009`). Both were defaulted,
  range-validated and written by `init --preset ci`, and no crawler code read either:
  a config asking for a 2s gap crawled at full speed. The crawler now reserves each
  request's slot synchronously before awaiting, so the gap survives concurrency
  instead of every worker reading one timestamp and starting together.

- **Nothing reads a crawl back out of `project.db`.** `db migrate` and `db stats` are
  its only readers/writers; `analyze` goes through `loadCrawl()`/`getLatestCrawl()` in
  `crawl-store.ts`, which read `.seomator/crawls/*.json` and nothing else. The SQLite
  crawl store is therefore write-only. /qa (2026-09-04) stopped the migration from
  moving the JSON aside by default, because that made the store the user was told to
  migrate to unreadable; finishing the job means a DB-backed `loadCrawl` that
  reconstructs `StoredCrawl` (pages, HTML, links, images) from `crawls`/`pages`, after
  which `--archive` can go back to being the default.

- ~~**`--refresh` and `--resume` are accepted and ignored**~~ **Addressed on main,
  2026-09-04.** Neither has a feature behind it, so neither was wired: `--refresh`
  bypasses a cache, and the only cache in the codebase (`LinkCache`) is never
  instantiated outside its own test — nothing fetches an external link, so nothing is
  cached. `--resume` continues from the `frontier` table, which `schema.ts` creates
  with two indexes and no code ever writes to. Both are now hidden from `--help` and
  warn when passed, while staying parseable so existing scripts keep running.

  The two missing features, if they are ever wanted:

  - **External link checking.** `LinkCache` and the whole `[external_links]` config
    section (`enabled`, `cache_ttl_days`, `timeout_ms`, `concurrency`) exist for a
    checker that was never written; `src/rules/links/external-valid.ts` counts
    external links without requesting any. Writing the checker is what makes
    `--refresh` mean something.
  - **Resumable crawls.** The `frontier` table is the persisted queue. The crawler
    keeps its queue in memory (`private queue: string[]`), so an interrupted crawl
    has nothing to resume from. `cancelCrawl()` and `failCrawl()` already mark the
    crawl row, so the missing half is writing and reading the frontier.
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
- ~~**`[rules] enable` / `disable` are documented and do nothing**~~ **Fixed on main,
  2026-09-04.** The auditor filters rules with `isRuleEnabled()`, and a category left
  with no rules is dropped from the result rather than scored — `calculateCategoryScore([])`
  returns 0, so keeping it would report a narrower audit as a catastrophic one. The
  patterns reach `AuditRunOptions` and are marked material in `run-profile.ts`, so
  `compare --fail-on-regression` reports a filter change as a run difference instead of
  a regression. `analyze` honours the same config. `getRuleCategory()` now derives from
  the real category list instead of the invented `meta-tags`/`core-web-vitals`/
  `structured-data`/`headings` taxonomy its own test used to assert.

  Known sharp edge, documented: the five Core Web Vitals rules in `perf` are named
  `cwv-*`, so `disable = ["perf-*"]` leaves them running. Every other category's rule
  ids match its own id.
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

## From the rule reverse-verification (/qa, 2026-10-15)

All 373 verdicts on developer.mozilla.org/en-US/docs/Web/HTML (plus a 6-page
crawl) were checked against the raw page. 25 root causes were fixed on
`qa/rule-verification-2026-10-15`. These were verified and deferred. Evidence
and file:line for each item: `.gstack/qa-reports/run-20261015T075717Z/verify-*.md`
and `qa-report-developer-mozilla-org-2026-10-15.md`.

### P1 — speed

- **Done (8.0.0).** Every request that is not a page now goes through one
  service per run that asks each distinct question once, with per-host limits
  and 429/503 backoff; external link answers persist in the link cache; a
  crawl scores four pages at a time. Kept below for the record.
- ~~**Link checks are sequential and uncached.**~~ One page sends about 489 HEAD/GET
  requests for 374 distinct URLs; the audited URL itself is requested 23 times.
  Categories, rules and each rule's loop run one request at a time
  (`auditor.ts`), and `LinkCache` (`src/storage/link-cache.ts`) exists but no
  rule uses it. Wall time: 4 min per page at 240 ms latency, 11.6 min at 1.9 s.
  The 6-page crawl took 27.5 min for 25 s of CPU and repeated every check on
  every page. Fix: one shared per-run status cache keyed by URL (crawl-wide),
  and bounded per-host concurrency. Both need a politeness decision, which is
  why they were not patched. ISSUE-005 and ISSUE-024 already removed the
  duplicate fragment and self-link checks.

### P2 — wrong verdicts that need data the engine does not collect yet

- `perf-http2` judges by `alt-svc` alone; MDN negotiates h2. Read
  `nextHopProtocol` from the render, or probe ALPN.
- `perf-minify-css` / `-js` flag hashed, minified bundles. They compare the
  compressed `content-length` with 2048 and read only URLs. Inspect bodies from
  the render (`response.body()`), or use Resource Timing's `decodedBodySize`.
- `perf-source-maps` passes while all 45 MDN assets reference public maps. It
  reads inline scripts and document headers only.
- `cwv-cls` is one unthrottled lab sample: 0 in 4 of 7 reruns, 0.159-0.194 in
  the other 3, because of a late `font-display: swap`. Throttle, or take N
  samples.
- `security-ssl-expiry` never reads the certificate. `security-ssl-protocol`
  never reads the TLS version, and demands HSTS preload on a subdomain, which
  cannot be preloaded. `security-csp-xss` ignores host allowlists without
  `'strict-dynamic'`.
- Declarative shadow DOM: names projected through `<slot>` read as empty
  (`a11y-aria-labels`, `a11y-form-labels`, `a11y-link-text`), and Playwright's
  `page.content()` drops shadow roots, so `rendered$` does not help.
- The schema rules other than `schema-breadcrumb` and `schema-present` read
  JSON-LD only, so a microdata or RDFa site is told "No X schema found".
- The crawler fetches the slash-stripped form of a URL and resolves links
  against the requested URL, not the final one (`url-filter.ts`,
  `crawler.ts`): `/en-US` was audited where MDN serves `/en-US/`.
- `crawl-sitemap-lastmod` and the sitemap loader stop at 50,000 URLs and 10
  child sitemaps, silently: 17,325 of MDN's 67,325 URLs were never read.
  The skipped count is now on the context, but only `crawl-sitemap-url-limit`
  mentions it.

### P2 — judgment calls, left for a decision

- `technical-url-structure` fails an uppercase path (score 0, "critical") that
  `url-uppercase` already warns on. MDN 301s the lowercase form, so no
  duplicate exists. Downgrade, or leave uppercase to one rule.
- `perf-css-file-size` fails on 17 stylesheets that total 14.5 KB compressed
  over HTTP/2. The rule counts files and never measures sizes.
  `perf-render-blocking` already warns on the same 17.
- `crawl-canonical-form-drift` compares the trailing-slash form across
  unrelated paths (the locale home `/en-US/` against `/docs/...` pages). Flag
  only one path in both forms, or a canonical that differs from the form served.
- `eeat-author-byline` misses a visible "by MDN contributors".
  `eeat-editorial-policy` misses a "Writing guidelines" link.
  `eeat-trust-signals` matches `[class*="member"]` inside "remember" and can
  never fail.
- `content-title-pattern` and `content-thin-vs-site` hold the homepage to the
  docs pages' template and length (`pageKindFrom` buckets them together).
- `links-chrome-inbound` should exempt locale roots as well as the entry page.
- `crawl-sitemap-orphan-urls` in a crawl: 6 crawled pages cannot show that
  67,000 sitemap URLs are orphans. Consider not measuring it below some coverage.

### P3 — messages

- `url-stop-words` splits acronyms into letters (`H, T, M, L`).
- `perf-font-loading` claims `display=swap` from an empty array.
- `security-password-http` and `security-brand-impersonation` describe elements
  that are absent.
- The eeat privacy and terms counts include docs pages
  (`/Web/Privacy`, `Define_terms_with_HTML`).
- `content-date-agreement` treats a "last modified" `<time>` as a published date.
- `a11y-identical-links-purpose` strips punctuation, so `<title>` and "title"
  read as one name.
- `crawl-sitemap-duplicate-urls` shows the normalized URL, not the one in the file.
- `schema-website-search` still recommends the sitelinks search box Google
  retired in November 2024.
- Latent: `crawl-canonical-redirect` sends HEAD without a User-Agent.
  `links-nofollow-appropriate` does not accept `rel="sponsored"`.
  `crawl-noindex-in-sitemap` would read gzipped child sitemaps undecompressed.

### Follow-up: CLI and skill QA on 6.0.0 (/qa, 2026-10-15)

Probed the 6.0.0 CLI and the published package end to end against an owned
fixture site. Evidence is in `.gstack/qa-reports/run-20261015T102121Z/`.
Fixed on `qa/cli-skill-2026-10-15`: ISSUE-026 to 029 and ISSUE-032. Still open:

- **P2: URL rules judge the requested URL, not the one served.**
  Auditing `/en-us/docs/page`, which 301s to `/en-US/Docs/Page`, gets
  `url-uppercase` "URL path is all lowercase" and passes
  `technical-url-structure`. The page actually lives at an uppercase URL.
  `context.url` is the requested URL throughout, so fixing this means deciding
  which URL every rule (and stored result) should name. Related to the crawler
  item above.
- **P2: `seomator.toml` crawl settings never apply to `seomator audit`.**
  `commands/audit.ts:189-210` always passes the CLI defaults (`-m 10`,
  concurrency 3, timeout 30000) into `loadConfig` as overrides. So
  `[crawler] max_pages` and the presets (`init --preset ecommerce` writes 1000,
  `blog` 500) are ignored, while `seomator config --list` shows 100. The fix is
  to stop defaulting those flags in Commander so the config applies. That
  changes the default crawl size from 10 to the config default (100) unless the
  default is also changed, so it needs a decision.
- **P2: The installed skill is out of date and not visible to Claude Code.**
  `~/.agents/skills/seo-audit` is 29 commits behind (`version: "5.1.0"`, no
  score-cap docs), and the `~/.claude/skills/seo-audit` symlink is gone. Fix
  on the machine: `git -C ~/.agents/skills/seo-audit pull --ff-only` and
  `ln -s ~/.agents/skills/seo-audit ~/.claude/skills/seo-audit`.
- **P3: smaller issues.**
  - A fetch-blocked port (e.g. `:1`) still classifies as `unknown`
    ("bad port").
  - `security-csp` says "configured with 1 directives".
  - `report --list` keeps ANSI colours when piped with `NO_COLOR=1`.
  - `db stats` counts legacy report files from the working directory rather
    than `SEOMATOR_HOME`.
  - `self doctor` never loads the native SQLite module. npm 11.19 warns that
    `better-sqlite3`'s install script is not covered by an `allowScripts`
    policy; if npm starts enforcing that, default-on saving breaks on fresh
    installs and doctor would not notice.

### Found while rewriting docs/ (2026-10-15)

Each item was found by checking a doc claim against the code. "Run" means it
was reproduced; "read" means it comes from the source only. Already fixed on
`qa/cli-skill-2026-10-15`: compare --json output, compare hints, enableRules
spelling (ISSUE-034 to 036).

- **P2: usage errors exit 1.** A command line Commander rejects (unknown
  flag, invalid URL) exits 1 with empty stdout, the code the exit table
  reserves for "below threshold" (run). SKILL.md now tells agents; exiting 2
  would match the contract (`program.exitOverride` in `src/cli.ts`).
- **P2: Ctrl-C during a browser render exits 130 before the `aborted` error
  document is written.** Playwright's own SIGINT handler wins
  (`processLauncher.js:59-75`); SIGTERM works (run).
- **P2: a TOML syntax error reports code `unknown`, not `config`.** `config`,
  `crawl` and `analyze` print a stack trace and exit 1 on the same file (run).
- **P2: config surface gaps.**
  - The presets ship `*.pdf` exclude patterns that match nothing, because
    patterns match the whole path (run).
  - `config <key> <value>` writes the JSON settings file, never
    `seomator.toml`, and `--local` does nothing (run).
  - `project.domains` is read by no command (read).
  - The audit banner says "Config: (none, using defaults)" when a
    `seomator.toml` was loaded (run).
  - The `ci` preset's `delay_ms = 0` still leaves 200 ms between requests,
    because the gap is the larger of `delay_ms` and `per_host_delay_ms` (run).
- **P2: dashboard and desktop.**
  - `npm run web:dev` returns 403: the Vite proxy's Host header fails
    `checkOrigin`, and the page never gets the token cookie (run).
  - The desktop compare page hangs on a site's first audit, because
    `db:compare` returns null instead of throwing (read).
  - Unknown category ids in `POST /api/runs` are dropped silently (run).
- **P3: rule verdicts (read).**
  - `core-nosnippet` treats `max-snippet:-1` as blocking.
  - `core-canonical-header` and `core-canonical-conflicting` penalise one
    mismatch twice.
  - `redirect-broken` fails a crawled 4xx/5xx page that had no redirect.
  - `technical-www-redirect` follows redirects, so it can report "both
    accessible" on a site that redirects correctly.
  - `links-localhost` flags dev ports on any host.
  - `links-local-file` matches `href="/home/"`.
  - `crawl-blocked-images` reads SEOmator's own robots.txt group, not
    Googlebot's.
  - `crawl-pdf-size` sends HEAD requests to PDFs on any host, even with
    external links disabled.
  - `analyze` can grade a synthetic INP, because the crawl stores INP without
    its synthetic flag (`project-db/pages.ts:21`).
- **P3: housekeeping.**
  - `npm run electron:icon` runs the old generator and overwrites the brand
    icon; `gen:icons` is the current one.
  - The `sandbox: false` comment in `electron/main/index.ts` credits
    better-sqlite3, but the real constraint is the ES-module preload.
  - CLAUDE.md says the Electron main bundle is CJS; it builds as ESM.

## From the page-level score caps (2026-10-15)

`src/score-caps.ts` holds a single-page score under a ceiling for noindex,
robots.txt disallow, an empty page, almost no content, and a missing title. A
crawl takes the first two from its start page, and `--staging` waives them.
`src/score-ladder.test.ts` and `src/crawl-ladder.test.ts` are the contract.
These were left out.

### P1 — a capped score shown without its reason

- **Done (8.0.0).** Caps, waivers, overrides and reasons are stored in
  `extras_json`, returned by `getAuditDetail` and shown on the score card.
- ~~**Stored audits drop `scoreCap` and `waivedCaps`.**~~ The `audits` table keeps
  `run_json`, not the result, so history, `report`, and the score card in `ui/`
  (dashboard and desktop app) show a capped score with no reason, the confusion
  the cap was added to prevent. Persist both beside `run_json`, return them from
  `getAuditDetail`, and render them under the score in `ui/`.

### P2

- **The dashboard and desktop app cannot run a staging audit.** `--staging` is
  CLI-only. The run form in `ui/` needs a toggle, carried through
  `normalizeRunArgs` to `AuditorOptions.staging`, so the GUI can audit a
  noindex staging site without a failing grade.
- **A crawl blocked on part of the site is not capped.** Only the start page
  caps a crawl, so a site whose whole `/blog/` went noindex passes. A cap on the
  share of crawled pages that cannot be indexed would catch it, once there is a
  threshold that does not flag the default 10-page crawl's one login page.
- **`analyze` cannot apply the robots.txt cap.** A stored crawl keeps pages, not
  the site's robots.txt, so a replay caps on noindex only. Storing robots.txt
  with the crawl would close it. `crawl` also stores depth 0 for every page
  (`src/commands/crawl.ts`), which is why `analyze` finds the start page by
  crawl order.
- **No category can be wholly unmeasured yet.** `calculateCategoryScore()`
  returns 0 when every result is unmeasured, and `calculateOverallScore()` still
  counts that category at full weight. `images` scores 100 on a page with no
  images (every rule passes on nothing). Before converting it, skip unmeasured
  categories in the overall, and show "—" in the 11 files that render a category
  score.
- **The core canonical cluster still passes with nothing to check.** About ten
  rules at weight 6–8 pass when no canonical is declared, so a blank page reads
  `core` 47. Category honesty only: the caps already handle the overall.

## Dashboard

The E numbers, T-4, DD-9 and the phases in this section refer to the local web
dashboard PRD, removed from `docs/` on 2026-10-15. Read it with
`git show v6.0.0:docs/PRD-local-web-dashboard.md`.

### Publish the Electron app as a GitHub Release

**What:** Build, sign, notarize, and attach the dmg/zip/nsis/AppImage artifacts that `electron-builder.yml` already targets.

**Why:** The desktop app is the only visual surface today and nobody can install it. Once 3.4.0 makes it persist its own audits and cancel for real, publishing it is the cheapest way to make the existing UI reachable.

**Context:** `npm run electron:dist` works from source. Missing: an Apple Developer ID + notarization step, a Windows signing decision (or unsigned with a warning), a release workflow, and a README download section. Deferred by the local-web-dashboard PRD (E12); independent of `seomator serve`.

**Effort:** M
**Priority:** P2
**Depends on:** 3.4.0 foundations (Phase 1 of the dashboard PRD)

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
**Depends on:** Phase 2 of the dashboard PRD (final token values)

### Automate the better-sqlite3 ABI switch

**What:** `npm run native:cli` / `npm run native:electron` wrappers plus a `self doctor` check that reports which ABI the compiled addon targets.

**Why:** Switching between the CLI/tests and Electron still needs a rebuild step; a wrong state fails with a cryptic `NODE_MODULE_VERSION` error. The DX review flagged it as contributor friction; the web dashboard reduces how often it happens but does not remove it.

**Partly addressed 2026-09-05:** `npm run rebuild:electron` and `npm run rebuild:cli` wrap the dance and, critically, re-sign the module. On Apple Silicon the artifact `electron-rebuild` restores is refused by the kernel at `dlopen` (`SIGKILL`, CODESIGNING / "Invalid Page") while `codesign -v` still calls it valid, so the desktop app died before drawing a window with no output at all. That is why it read as untestable for four sessions. The remaining friction is that a rebuild is still needed at all — an N-API build of better-sqlite3, or a second `node_modules` tree, would remove it.

**Context:** Commands exist as one-liners in `CLAUDE.md`. The doctor check can read `process.versions.modules` and compare with the addon's compiled ABI.

**Effort:** S
**Priority:** P3
**Depends on:** None

### ~~Engine SSRF hardening for redirects and link checks~~ (done in 8.0.0)

Every request goes through `src/net/`: each DNS answer is checked at connect
time, a public target blocks private and cloud-metadata addresses, and
`seomator analyze` runs under the same policy. Kept below for the record.

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

## From the agent-ready audit engine (8.0.0, 2026-11-17)

Scope consciously left for later. The PRD and its review live outside the
repository, under `~/.gstack/projects/`.

### P1: deferred from the 8.0 PRD at ship

Five PRD items were not built in 8.0.0 and were deferred when it shipped:

- **Memory at 10,000 pages.** The crawler keeps every page's parsed DOM until
  the run ends. Keep only what the cross-page checks read (`SitePageInfo`),
  drop the DOM after a page is scored, and add a heap benchmark at 10,000
  pages that fails on a regression.
- **Group findings** (`extras.groups`) and the shared **`details.table`**
  contract. See "Dashboard and desktop items not taken in 8.0.0" below.
- **Scoring model on the compare page and trend chart.** Same section below.
- **A preparation state before a crawl with a Crawl-delay.** Same section below.

The desktop parity check for axe-core (below) was dropped from 8.0.0 at ship:
the code is in place but was never run in the desktop app.

### P1: browser renders under the network guard

Every engine request goes through `netFetch` and the run's private-address
policy, but a browser render (Playwright for `--render`, the desktop app's
window) loads a page's own resources without it. Route each render request
through the same check (a `context.route` guard that resolves the host and
applies `isBlockedAddress` and the pins, or host-resolver rules mapping a
pinned host to its addresses), then let MCP render without `--allow-private`.

### P2: memory in long-lived processes

- The MCP server keeps every finished run's full result and session until
  it exits. Keep the summary and the auditId once a run ends, or evict
  finished runs after a retention window as `AuditSession` does.
- The per-run URL memo keeps whole response bodies for `needBytes: 'all'`
  requests, such as the AMP or mobile alternate of every crawled page. Keep the
  parsed result instead, or drop the bytes once read, and bound the memo by
  total size.

Measure both with the 10,000-page benchmark above.

### Release P: promote the advisory rules

The 25 rules added in 8.0.0 are advisory: reported, not scored. Promote them
once their verdicts have been checked on a precision corpus of real sites,
replayed offline (stored HTML, headers, redirect chains, recorded responses
and the crawl clock). Also decide whether the static accessibility rules with
an axe-core equivalent should take axe's verdict when rendered, as
`a11y-color-contrast` and `a11y-touch-targets` already do, and whether a past
`unavailable_after` on the start page should cap the score like noindex (run
the strategic reasoner first).

### Dashboard and desktop items not taken in 8.0.0

- Group findings (`extras.groups`) rendered as expandable groups in the rule
  card; a shared `details.table` contract rendered the same in every surface.
- Compare page: say when two audits use different scoring models, mute the
  deltas, and break the trend line at the change.
- A preparation state before a crawl with a Crawl-delay, with "Keep going" and
  "Restart without the delay"; rate-limit copy with a countdown and Try again.
- Section states for Site and Custom checks (not run, nothing found,
  truncated, unreadable), a one-time "new scoring model" note, output caps of
  50 rows with a pointer to JSON, stacked tables below 640 px, a full
  paginated Link Score list with a URL filter, sidebar anchors for Site and
  Custom checks, and a keyboard-only walkthrough of the new sections.
- Rerun: say when the audit used seomator.toml settings the dashboard does not
  apply (rule options, custom checks, overrides).

### `serve --config` and project settings in the dashboard and desktop app

Web and desktop runs use defaults: no `[external_links]` cache, no
`[rule_options]`, no `[[custom.*]]`. Read a project's seomator.toml there too.

### Desktop parity check for axe-core

The desktop app runs axe-core through `executeJavaScript` in a window set to
Playwright's viewport. Add a smoke test comparing a fixed allowlist of axe ids
between the two renderers (they ship different Chromium versions).

### Smaller follow-ups

- `[external_links] broken_statuses`: let a team count a status as broken.
- A page carbon estimate from transfer sizes.
- A remediation loop: re-audit only the pages whose findings were fixed.
- Two-phase execution: fetch everything first, then score, so a crash during
  scoring never repeats requests.
- `seomator self doctor` checks the MCP setup; MCP saves still use the
  blocking busy retry.

### Left after the QA pass on 8.0.0 (/qa, 2026-11-18)

The QA pass fixed six defects before release: a hang in a terminal that reports
0 columns, misspelled gate keys accepted, a dead start page scored as a crawl,
the LLM report's page counts, cross-page checks with no reason for not being
measured, and a stored crawl losing its gaps. It also fixed two gaps the PR
listed as known: a `fail_ci` gate on a cross-page rule passing a single-page
run, and a misspelled `[ci]` or custom-search key being ignored. What is left:

**P2: PRD items not built**

- **Secrets in output (EN28).** A report can carry a token or key that appears
  in a page's HTML, a URL or a header. Redact known secret shapes before any
  format is written.
- **Cold first-run timing (DX15).** The repo has no CI. Add a job that installs
  the package fresh and times the first audit.

**P2: PRD items built in part**

- **Advisory and override marks on every surface (DS1, DS12, F17).** JSON marks
  advisory results and overrides. The terminal, HTML and markdown reports show
  no advisory chip, and the dashboard has no "Ignored by config" row or
  override chip.
- **Group not-measured checks by reason in the reports (DS2).** The dashboard
  groups them; the console counts only the render and crawl groups; HTML and
  markdown list them flat.
- **Crawl summary in the HTML report (F3).** It has no "Measured N of M pages"
  line. Web and desktop runs ignore `respect_crawl_delay`, and `crawl` has no
  `--ignore-crawl-delay`.
- **The desktop fetcher ignores its timeout and abort (EN12).**
  `electron/main/electron-fetcher.ts`.
- **Extraction caps are silent (F16).** Values are cut at 1 KB and 50 per page
  with no note in the output.
- **Probe errors are swallowed (S3)**; run counters (S2) and the annotation
  shape (EN7) are partial.
- Docs and flags: `docs/errors.md` and `retryAfterS` (DX6), `analyze
  --min-coverage` (DX3), `--cwv` in `--help` (DX9), hard-coded thresholds
  (DX13), the `rule_options` table in sync-docs (DX14), report section order
  (DS6), the axe HTML snippet (DS14).

**P2: network guard, from the pre-landing review**

- **A local target's addresses are allowed on any port.** A page on
  `localhost:3000` can make the audit request another local service. Pinning
  by port alone would break the http-to-https redirects pinning exists for, so
  allow the ports the entry redirect chain used.
- **The link cache is read before the network policy is checked.** A strict
  MCP run can learn a private URL's earlier status that way. Check the policy
  first.
- **`--allow-host` cannot express an IPv6 target** (`[::1]:port`): a bracket
  mismatch in the connector.

**P3: found by QA, not fixed**

- **"1 page stayed rate-limited after their retries."** `crawlWarnings()` in
  `src/commands/crawl.ts` needs "its" for one page. Repro: crawl a site with
  one page that always answers 429.
- **`analyze` says "Crawling and auditing up to N pages..."** while it reads a
  stored crawl (`src/reporters/progress.ts`). Repro: `seomator crawl <url>`,
  then `seomator analyze --latest`.
- **`/verify` cannot map this branch's files to tests.** The repo has no
  `.gstack/pregate.json`, so the checker reports `tests=UNMAPPED` even when
  every test passes. Add a policy, or accept the full suite as the gate.

### Left after the crawl QA of the Fix Brief (/qa, 2026-11-19)

Crawls of crawler-test.com (40 pages) and books.toscrape.com (5 to 25 pages)
on `main` @ cc7b6e9. The points add up exactly on every surface, and the
cross-page checks, Link Score, custom checks, gates and MCP held up against the
real pages. The HTML report's fix queue counting a rule twice is fixed. What
is left:

**P2: `[rules.override]` priority no longer reaches the fix queue**

- **`priority = "ignore"` findings stay in the queue, and can lead it.** The
  dashboard's `rankedFixes()` (`ui/lib/fixes.ts`) and the HTML report's queue
  rank every scored failure and warning by points, ignored or not. Repro: a
  5-page crawl of books.toscrape.com with `"schema-present" = { priority =
  "ignore" }` opens on "Add JSON-LD structured data" (+1.0) while the same
  report lists it under "Ignored by config (1)". `docs/ci-gates.md` says ignore
  "takes it out of every findings list". Leaving it out of the queue must not
  change "of the N points this site is missing": `agentLine()` sums the fixes
  it is given, so pass it the full total.
- **`high` and `low` only break ties.** The queue sorts by points first, so
  `priority = "low"` left `core-canonical-present` at 04 and `"high"` left
  `geo-well-known` at 76 of 77. The docs promise x4 and x0.25. Decide: keep the
  queue points-only and say so in `docs/ci-gates.md`, or scale the sort key by
  the override while printing the exact points. The console and LLM reports
  still rank by priority, so today an agent and a person get different first
  fixes for the same audit (MCP `get_findings` led with
  `core-description-present`, the dashboard with `schema-present`).
- Both touch `agentLine()`, `FixQueue` and the score panel, which
  `fix/report-opens-on-score` is reworking; land it there or after it.

**P2: dashboard and desktop crawls skip the per-host limit**

- 8.0.0 made `crawler.per_host_concurrency` (default 2) cap how many pages a
  crawl loads at once from one host. `seomator audit` and `crawl` pass it;
  `AuditSession` (`src/dashboard/audit-session.ts`) never does, and the
  crawler reads a missing value as no limit. Measured on an owned 13-page
  fixture that answers each page after 400 ms: the CLI with
  `--concurrency 6` peaked at 2 page GETs in flight, the same crawl started
  through `POST /api/runs` with `concurrency: 6` peaked at 6. The run form's
  "Pages at once" (default 3, up to 20) is what a dashboard crawl really
  uses, so its "same run from the terminal" command is not the same run.
  Decide: make "Pages at once" set the per-host count too and default it to
  2, or apply the default and say the field is capped per host. Passing the
  default alone would leave the field doing nothing above 2.

**P3: found by QA, not fixed**

- **A domain's first audit logs two 404s.** The audit page asks
  `GET /api/audits/:id/compare` twice and the API answers 404 when there is no
  earlier audit. The page handles it ("Nothing to compare yet"), but the
  console shows two errors on every first audit. Answer 200 with no previous
  audit, or skip the request when the audit list says there is none.
- **At 375px the dashboard header is 4px too wide** and clips the theme
  toggle, and the lead fix's code headline breaks mid-word
  ("width=de / vice-width").
- **A crawl checks every internal link of every page.** On crawler-test.com
  the home page links 407 internal URLs, so a 40-page crawl sent about 450
  extra requests and took 393 s (62 s fetching, about 99 s on the site's slow
  test sitemaps, about 163 s on link checks queued behind two per-host slots).
  Without `-v` the terminal is silent for those minutes. Consider the external
  links' cap (2,000 within 300 s, most-linked first) and a progress line.
- **`--max-duration` bounds page requests, not the run.** A 25-page crawl of
  books.toscrape.com with `--max-duration 3` fetched 12 pages in 3 s and then
  ran for about 205 s more checking their links. The CLI help says so ("stop
  requesting pages"), but the run form calls the same setting "Time limit,
  seconds". Either cap the link checks by the same deadline, or name the field
  for what it limits.
