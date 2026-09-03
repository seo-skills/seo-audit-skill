# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [Unreleased]

### Breaking

- **`RuleStatus` gains a fourth value, `not-measured`.** A check that could not
  take a reading used to be encoded as `status: 'warn'` with `weight: 0`, and
  recovered by testing the weight. Consumers that branched on status alone —
  the markdown and LLM reporters among them — reported checks that never ran as
  genuine warnings, and the LLM report filed them under `<passed>`, so a model
  could propose fixes for measurements the audit never took.

  **If you script against the output:** a predicate like
  `results.filter(r => r.status === 'warn')` now returns fewer rows. The rows
  did not disappear; they are `'not-measured'`. `weight === 0` is still set on
  every one of them, so a predicate keyed on weight keeps working unchanged —
  that is deliberate, and it is also what lets an older build read a database
  written by a newer one.

  `AuditResult` now carries `schemaVersion: 2`, and `<seo-audit>` a `schema="2"`
  attribute. A payload with no version is version 1.

- **The score-to-grade scale is one scale.** It was three. A score of 55 printed
  **D** in the terminal and **F** in the report handed to an LLM. The boundary
  settles at **D ≥ 50**, matching the terminal, which is the default output. If
  you gate a deploy on `grade != "F"` from `--format llm`, scores of 50–59 now
  read D where they used to read F — re-run your baseline.

- **70–79 now reads "Fair" where it read "Good".** Letter grades had five
  buckets and word labels had four; unifying them needs a fifth word. This
  changes the label on every dashboard card, HTML report and markdown summary in
  that band.

### Added

- `scoreToVerdict()` in `src/verdict.ts`, exported from the package entry: one
  bucket set returning `{ grade, label, colorToken }`. Colour is part of the
  verdict, so a score cannot be green on one surface and amber on another.
- The LLM report emits `<not-measured>` alongside `<passed>`, so an agent can
  tell "we checked and it is fine" from "we could not check".
- **`rulePriority()` — what to fix first.** An audit produces 332 findings and
  no surface could say which mattered; the HTML report ordered by severity and
  then by registry order, so a weight-1 warning sat above a weight-25 one. No
  new data was needed: the registry already carries a rule weight (13 distinct
  values) and every category a weight, and `rule x category x severity x share
  of pages affected` ranks the lot. On a real 8-page audit that turns 332 rules
  into 46 actionable ones led by render-blocking resources and lazy-loading
  above the fold. Unmeasured and passing rules rank 0, so the top of a report
  is never "we did not check this". The number travels on `RuleSummary`;
  surfaces never compute it, because the weights behind it exist only once the
  whole rule registry has loaded.
- `getResultCounts()` returns a fourth bucket, and the four now sum to the
  total. Bucketing by status alone left `pass + warn + fail` quietly short.
- **Two named count ledgers.** The HTML report said an audit had 332 findings
  and the dashboard said 2,656, for the same audit. Both were right — one
  counted rules, the other counted rule-per-page evaluations of them — and
  neither said which. `countLiveResult()` and `countFromSummaries()` return
  both, named, each with four buckets that sum. `affectedPages` is a distinct
  page count rather than a sum of per-rule counts, which double-counted a page
  that two rules both flagged.

### Fixed

- **`compare` no longer blames the site for a measurement-mode change.** The
  CLI measures Core Web Vitals by default and the desktop app does not, and both
  write to the same history — so comparing a desktop baseline against a CLI run
  showed a score drop, a category down 12 points and 23 "new" rules, none of
  which had anything to do with the site. `--fail-on-regression` failed CI on
  it. The run options were already stored from 3.4.0; nothing read them. Now
  `AuditResult` carries them, `compare` reports any difference, and a difference
  that can move the score on its own suppresses the regression exit code with an
  explanation. A genuine regression on a like-for-like pair still exits 1.

- **An unmeasured check is no longer promoted into the issues table.**
  `generateIssuesFromResults` filed every weight-0 row as a warning-severity
  issue with a priority score.
- **The terminal's issue grouping is no longer quadratic.** It re-normalised
  every candidate message on every comparison — eight regex replaces per step,
  invisible on an 8-page audit and roughly 10⁸ applications on a 1,000-page
  crawl. Keyed through a Map now.
- **"Nothing could be measured" stops grading F.** An audit whose total weight
  is zero scores 0; that now reads "Not scored" rather than reporting the site
  as catastrophic.

- **Score badges render their background again.** `getScoreColor()` returns a
  CSS custom property, so the three call sites that built a tint by appending a
  hex alpha suffix produced `var(--color-pass)15` — not a colour, silently
  dropped. The audit list, the score circle, the category headers and the HTML
  report all drew their badge with no background. `verdictStyle()` now returns
  the foreground and its paired background together.

- **Six surfaces share one palette and one grade scale.** Colours are defined
  once in `src/design/tokens.ts`; the HTML reporter inlines them and the
  dashboard and Electron read a generated stylesheet. The report kept a private
  90/70/50 scale, so a score of 85 drew green everywhere else and amber there.
  Along the way 8 of 13 text/background pairs failed WCAG AA; all 18 pairs now
  clear 4.5:1 in both themes, and a test computes the ratios.

- **`--format llm` output is parseable.** The format exists so a program can
  read stdout, and two things prevented that. Progress display was suppressed
  for `--format json` but not for `--format llm`, so every run printed
  "✗ Core …" lines before `<seo-audit>` and the output was not XML at all.
  And a failed audit wrote only to stderr, leaving stdout empty — which a caller
  reads as an audit with nothing to report. Progress now treats both document
  formats alike (including under `--verbose`), and a failure emits a
  `<seo-audit ok="false">` envelope carrying the code, message and hint.

- **The markdown and LLM reports say a thing once.** A crawl produces one rule
  result per rule per page, and both reporters rendered them raw: a forty-page
  site with one render-blocking script got forty identical `### ` sections and
  forty `<issue>` elements. For the LLM report that is forty times the tokens
  for one problem, and a model reading it has every reason to conclude there are
  forty problems. Both now group by rule and message through a shared
  `collectFindings()`, carry page attribution ("affects 3 of 8 pages" and the
  URLs), and order by the same ranking the HTML report uses.

- **The LLM report admits when it is truncated.** It emitted every finding, so a
  large crawl overran the context of the model meant to read it. It now carries
  the fifty highest-impact findings and states `total` and `omitted` on the
  `<issues>` element, because a truncated list with no marker reads as a
  complete one.

- **Solid buttons are readable in dark mode.** The run, cancel, delete and
  filter buttons set a themed background and a hardcoded white foreground. In
  the light theme those backgrounds are a dark blue, amber and red, so white
  read at 7.00:1, 7.09:1 and 6.47:1. In the dark theme they are a bright blue,
  amber and red, and the same white read at 2.50:1, **1.67:1** and 2.77:1 — the
  Cancel button was very nearly invisible. They use `--color-on-accent`, which
  flips with the theme: 7.49:1, 11.22:1 and 6.77:1 in dark, unchanged in light.
  A test now rejects hex literals and fixed white/black utilities anywhere in
  `ui/` outside the token definitions and the brand mark.

- **Deleting an audit asks first, and says so when it fails.** Delete removed a
  stored audit permanently on a single click with no confirmation, and its
  handler had no failure path — a refused delete reset the button and said
  nothing, leaving the audit in place and the user unsure whether it had gone.
  It now confirms inline (not `confirm()`, which blocks the renderer under
  Electron), and a failure names the reason and keeps you on the page. Export
  under Electron gained the same treatment: a save that fails no longer leaves
  the user believing they have a file they do not have.

- **A failed read no longer looks like an empty database.** `HttpApiError` was
  built with `super(failure.message)` from whatever the response body carried.
  Any body that was not the exact error envelope — a bare string, a proxy's HTML
  502, an empty body — left that undefined, so the error carried the message
  `''`. Every caller tests `if (error)`, an empty string is falsy, and the
  failure walked through every error branch untouched: the dashboard reported
  "No audits yet" and invited the user to run their first audit while the ones
  they had sat unread. An error now always describes itself, `useAsync` never
  stores a falsy one, and a non-JSON body no longer throws a `SyntaxError` past
  the status check. Home shows a read-error state with the reason and a retry.

- **Filtering to a site with no audits says so.** It previously rendered the
  first-run empty state, telling someone with twelve audits of another site to
  run their first one. It now names the site and offers a way back to all of
  them.

- **Reduced motion is honoured.** A `prefers-reduced-motion` block existed in
  the dashboard under a comment claiming "anything that animates does so only
  for people who want it to", and disabled exactly one transition — the skip
  link. Everything else kept moving, and the HTML report had no such rule at
  all. Both surfaces now stop animation and transition globally.

- **The issues table is reachable by keyboard.** Rows carried a click handler
  and nothing else, so the drill-down into a rule existed only for a mouse.
  Each row now leads with a focusable button — one tab stop per row, matching
  the audit list — and the run options show a focus ring, which their
  screen-reader-only checkboxes previously swallowed.

- **A running audit no longer floods a screen reader.** `aria-live` wrapped the
  whole progress panel, so every change to the bar, the current URL or any of
  the twenty category rows re-announced the entire section. It is now a single
  status line that changes only when the phase or the count does.

- **The HTML report leads with what to fix, and folds away what needs nothing.**
  It rendered all 332 checks expanded, ordered by severity and then by
  registration order, so a weight-1 warning could sit above a weight-25 one and
  the 278 checks that passed took up most of a 54,675-pixel page. Findings are
  now ranked by `rulePriority()` within each severity, and the passed and
  unmeasured checks fold into a per-category disclosure. The page is 17,147
  pixels; nothing was removed, and filtering to Passed opens the fold.

- **The HTML report has category navigation on a phone again.** The sidebar was
  `display: none` below 1024px, which left a report that can run to 17,000
  pixels with no way to reach a category except scrolling. It becomes a
  scrollable strip of category links above the content.

- **The HTML report no longer offers a page filter it cannot honour.** It built
  its page list by scraping `pageUrl` out of rule details. That is exact for a
  live crawl, where every result carries its own page, and wrong for a stored
  audit, which keeps one row per rule with a capped sample of pages. An
  eight-page crawl exported from the dashboard showed "8 pages" in its header,
  offered seven in "Filter by Page", and returned one or two rules for whichever
  page you picked; the page missing from every sample was unreachable.
  `AuditResult` now carries `coverage` — the pages covered and whether the
  results are per-page or aggregated — so the report renders a real filter when
  it has per-page results and lists the audited pages when it does not.

## [3.5.0] - 2026-09-03

### Added

- **Audits run from the browser.** The dashboard starts them, streams progress
  as it happens (a crawl's discovery and the per-page scoring are separate
  phases, because one bar for both sat at 0% and then jumped to done), and
  cancels for real. A tab that opens or reloads mid-run is caught up by the
  snapshot every connection receives, so there is no replay buffer to keep and
  nothing to lose on a reconnect. One audit at a time: a second start is a
  `409` naming the run in progress, not a silent queue.

- **A run that cannot be saved is not lost.** Its result stays available for
  fifteen minutes — the same window for saved and unsaved runs — so it can be
  exported or the save retried. The in-memory result is aggregated by the same
  rules the database read uses, so it renders identically either way.

- **`seomator serve --audit <url>`** starts a run as the server comes up, with
  the audit flags, so a script can hand someone a link to a running audit.

- **`seomator serve` — a local dashboard for the audits you have already run.**
  Until now a finished audit produced a one-shot HTML report and nothing that
  accumulated. The dashboard opens on your history: which sites you audit, how
  each score moved, what changed between two runs, and the full detail of any
  single audit with its per-rule drill-down. It reads the same
  `~/.seomator/audits.db` the CLI writes, binds to `127.0.0.1`, and makes no
  outbound requests.

- **A documented HTTP API** under `/api`, usable from curl or an agent:
  audits with paging, one audit aggregated to a row per rule, per-rule pages,
  compare, export (html/markdown/json/llm), delete, domains and trends.
  `GET /api` returns the route index, derived from the router table so it
  cannot drift. One error shape everywhere, with a code, a hint and structured
  details; out-of-range options are rejected rather than clamped.

- **A per-launch token** guards every `/api` request — sent as the
  `X-SEOmator-Token` header or the `HttpOnly; SameSite=Strict` cookie the page
  response sets — on top of `Host`, `Origin` and `Sec-Fetch-Site` checks, a
  framing refusal and a CSP. Loopback is reachable from sandboxes, forwarded
  ports and host-network containers, so reaching the dashboard is not the same
  as being allowed to use it. The token is written to
  `$SEOMATOR_HOME/serve.json` (0600) for agents and removed on shutdown.

- **`docs/WEB-DASHBOARD.md`**: the API and error reference, the token workflow
  for agents, the security model, and what to do about a port in use or a
  missing build.

### Changed

- **The desktop app and the dashboard are the same React app.** Both are served
  from `ui/`, pick their transport at runtime, and show a stored audit
  identically. The app moved from two tabs to real routes (`/`, `/audits/:id`,
  `/compare/:id`), so a URL in the browser is bookmarkable and the back button
  works.

- **Recharts is gone**, replaced by a hand-drawn SVG trend chart: 350 kB of
  dependency for one chart of at most twenty points. The desktop bundle went
  from 1,369 kB to 712 kB.

- **The UI no longer fetches a webfont from Google.** A dashboard that runs on
  localhost should not need the internet to render text, or ping a third party
  on every open. IBM Plex is still used when it is installed locally; otherwise
  the platform's own UI font.

- **`seomator self doctor`** reports whether the dashboard's assets are present.

- **The dashboard works on a phone.** The category rail becomes a scrolling
  row below 1024px, tables scroll inside their own box rather than widening the
  page, and the score counters and filter pills wrap — four counters do not fit
  across a phone, and "Not measured" was painting outside the viewport.

- **Audited URLs go through a scheme check before reaching an `href`.** Page
  URLs come from the sites being audited; the crawler only queues http(s), but
  that guarantee spanned the crawler, the database and the API rather than the
  component rendering the link. A test fails the build if a raw one is ever
  used, and another asserts the renderer never uses `dangerouslySetInnerHTML`.

## [3.4.0] - 2026-09-03

### Changed

- **Every audit is stored by default.** `--save` defaulted to off, so for
  almost everyone the history database was empty and `seomator compare` had
  nothing to compare — the schema, the comparison engine and the trend queries
  all existed and were never fed. `audit` and `analyze` now write to
  `~/.seomator/audits.db` unless the run passes `--no-save` or the project sets
  `[output] save = false`. `--json-report` writes the old per-project JSON file;
  `--save` still does the same for one more minor and prints a deprecation
  notice (removed in 3.6.0). A storage failure is always reported, with the
  path and a pointer to `seomator self doctor`, and never costs you the report.
  `SEOMATOR_HOME` relocates the data directory.

- **`seomator compare` no longer writes to the database when you read it.**
  Comparing two audits inserted a comparison row every time it ran. The
  computation is now pure and the row is written once, by the save path. It
  also reports rules that appeared or disappeared between runs, and warns when
  the two audits came from different engine versions, so a score change is not
  mistaken for a site change.

- **"The previous audit" now means the audit before this one.** It meant "the
  newest audit that isn't this one", so comparing anything but the latest run
  compared it against a later one. Runs in the same second are ordered
  consistently.

- **A stored audit is now as complete as a live one.** Reading one back capped
  at 1,000 result rows, which silently truncated any crawl past three pages,
  and lost the marker that says a check could not take a reading, so every
  unmeasured check came back as a warning. Audits now record each rule's weight
  and are read back aggregated per rule in SQL: one row per rule with its worst
  page, its counts and sample pages, at the same cost for one page or a
  thousand.

- **Audits record where they came from.** Each stores its source (cli,
  dashboard, desktop, api), the engine version that produced it, and the
  options it ran with. Credentials in an audited URL are stripped before
  storage.

- **The desktop app runs audits through the same code the CLI does.** It never
  stored a result, its cancel button only stopped the UI listening while the
  audit carried on in the background, and its progress list grew by one row per
  category per page. It now uses the shared run controller: results are stored,
  cancel actually cancels, and progress stays bounded. The React renderer moved
  from `electron/renderer/` to `ui/`, since the web dashboard will serve the
  same app.

- **Node.js 20.3 is now the minimum**, up from 20.0, for `AbortSignal.any()`.
  `seomator self doctor` checks for it and also checks that the data directory
  is writable.

- **The finding leads each rule card in the HTML report.** The measured result
  ("LCP is 0.44s") was 13px muted grey below the rule's generic definition, so
  the two loudest lines on every card were text identical on every audit of
  every site. The result now renders first at full contrast; the definition
  drops below it as reference.

### Added

- **Cancelling an audit actually stops it.** Ctrl-C, or Cancel in the desktop
  app, now aborts the page fetches, link and redirect checks, robots.txt and
  sitemap requests, and the browser render, rather than leaving them running to
  completion in the background. The CLI exits 130 and stores nothing partial.

- **A crawl now shows its progress while it crawls.** The bar sat at 0 of N for
  the entire crawl and then filled in a second, because nothing was reported
  until scoring began. Discovery and scoring are now separate, monotonic
  phases.

- **Audit failures say what went wrong and what to do.** Errors carry a code
  (`dns`, `timeout`, `non-html`, `http-error`, `playwright-missing`,
  `no-pages`, `aborted`) and a hint. `--format json` includes both.

- **`seomator report` reads your audit history** rather than only the legacy
  JSON files, and shows a single stored audit with `seomator report <id>`.

- **The programmatic API exposes the new surface**: the typed errors
  (`AuditError`, `AuditAbortedError`, `classifyError`), the watchable
  `AuditSession`, the audits database, and the shared read queries
  (`listAudits`, `getAuditDetail`, `listDomains`, `getTrend`, `compareStored`,
  `diffRules`) with their result types.

- **The real SEOmator mark ships through the desktop app.** The app icon was a
  generic dark "S" and the in-app header drew a gradient square with the letter
  S beside the product name — placeholders for artwork the project already
  owned. The lockup, its white variant, and the square mark now live in
  `electron/resources/brand/`; `npm run gen:icons` renders the 1024px app icon
  from the mark so the SVG stays the source of truth, and `--check` fails when
  the icon falls behind it. A `Logo` component paints the wordmark in
  `currentColor`, so one component serves both themes. The renderer gained a
  favicon and development runs a Dock icon. A blanket `*.png` in `.gitignore`
  had been excluding `electron/resources/icon.png` since it was created, so the
  icon had never been committed and a clone would package without one.

- **The window toolbar reads as native chrome rather than a web navbar.**
  Frosted material over the scrolling content with a hairline separator and no
  drop shadow; 52px tall, the height of a macOS unified toolbar, with traffic
  lights re-centred and clearance raised from 78px to 92px so the brand mark
  stops crowding them; a segmented control in place of the accent-filled pill
  for Audit/History; and stroked sun/moon glyphs instead of the ☀/☾ text
  characters, which picked up the emoji font and sat on the text baseline.

- **Fix-suggestion coverage is held by a test.** `FIX_SUGGESTIONS` covered all
  332 rules, but nothing enforced it and `getFixSuggestion()` answers an
  unknown id with a generic sentence rather than failing — so a new rule would
  have shipped "Review and fix this issue based on SEO best practices" into the
  HTML and LLM reports silently. The suite now checks both directions: no rule
  without a suggestion, no suggestion for a deleted rule.

- **`npm run sync:docs` derives the counts the docs advertise.** The rule count,
  category count, per-category counts, and the skill manifest's version are now
  rewritten from the live registry and `package.json` rather than typed by hand.
  `npm run check:docs` reports drift without writing and exits non-zero;
  `prepublishOnly` runs it, so a release cannot ship prose that disagrees with
  the code. The registry and category table are exported from the package entry
  so consumers can read the same numbers.

- **SEOmator branding in the HTML report.** The header carries the SEOmator
  wordmark, inlined so the report stays one self-contained file, in a lockup
  with the product name and an "Open Source" tag. The footer credits
  "SEO Audit Open Source" and links to
  [seomator.com/free-seo-audit-tool](https://seomator.com/free-seo-audit-tool).
  The wordmark lettering renders in `currentColor`, so it flips with the theme
  rather than staying black against the dark background.

- **"Not measured" is a real state in the HTML report.** Checks that took no
  reading get their own neutral status, filter tab, and summary counter instead
  of being painted amber next to real findings. They are excluded from the
  issues-to-fix table and no longer carry fix advice.

- **robots.txt compliance.** The crawler now parses and obeys robots.txt per
  RFC 9309: user-agent group selection (most specific group wins), Allow and
  Disallow with longest-match precedence and Allow breaking ties, `*` and `$`
  wildcards, comments, and multi-agent groups. No new dependency. `respect_robots`
  finally does what it has always claimed; set it to `false` to opt out.

### Fixed

- **Four performance rules passed on assets they never sized.** Asset bodies
  are never captured, so `perf-asset-compression`, `perf-minify-css`,
  `perf-minify-js` and `perf-image-encoding` judge size from the
  `content-length` header. Each folded the size test into one `filter()`, so an
  asset without the header dropped out of the offender list exactly like an
  asset under the threshold, and the rule returned `pass()` — a positive claim
  ("All sizable text assets are served with compression") about files it never
  read. Chunked transfer-encoding and HTTP/2 framing omit the header on most
  real sites: 29 of 30 stylesheets and scripts on seomator.com and 89 of 92 on
  vercel.com arrive without one. A shared `asset-size.ts` now distinguishes
  "small" from "unknown", and the rules report `notMeasured()` when an
  unreadable size is all that stands between them and an offender. Partial
  readings survive: sized offenders are still flagged, with the unsized
  remainder disclosed alongside them.

- **`redirect-loop` and `redirect-broken` could never fire.**
  `context.redirectChain` was declared in `types.ts` and read by both rules,
  but written by no code path — `fetchUrlWithRedirects()` is implemented,
  exported and called from nowhere, while `fetchPage()` used
  `redirect: 'follow'`, which discards the hops. Both rules returned
  "redirect chain was not recorded" on every page in every mode: two of the 332
  rules could not report a finding. `fetchPage` now takes an opt-in
  `trackRedirects` that follows the chain by hand and records each hop, off by
  default so the fifteen robots.txt and sitemap call sites keep the existing
  path. A looping URL names its own cycle instead of failing as "empty response
  body". This also activates the crawler's redirect discovery-source tracking,
  written against the same never-populated field.

- **`compare` printed UTC timestamps as though they were local.** `formatDate`
  rendered with `toISOString()` and sliced off the `Z`, so an audit run at
  18:04 on a UTC+3 machine displayed as `15:04` in both the two-run diff and
  `--trend` — three hours before the command that produced it. Every other
  surface (`report --list`, the HTML and Markdown reports) renders local time.
  The storage layer parses these columns correctly; the offset was
  reintroduced at the display boundary.

- **The terminal footer and LLM `<summary>` dropped the not-measured count.**
  The closing line of a 332-rule audit read "217 passed • 34 warnings • 24
  failed", accounting for 275 rules with no hint the other 57 existed — the
  total was already computed a few lines above and simply unused. Both
  summaries now carry all four counts, which add up to the rule total, as the
  HTML report always has.

- **The desktop app advertised 251 rules while the engine had 332.** The
  empty state hardcoded the v3.0.0 count, so the first thing a user saw
  understated the engine by 81 rules; `check:docs` never caught it because
  `sync-docs.mjs` only scans `SKILL.md` and `README.md`. The app now counts
  the registry over a new `app:get-info` IPC channel, the way the CLI banner
  does, so there is no literal left to drift. Its overall-score card also
  gained the not-measured counter, which had the same gap as the terminal
  footer.

- **The HTML report's stat row broke out of its card at 375px.**
  `.score-stats` is a nowrap flex row of five stats measuring 329px inside a
  card whose content box ends at 359, so "332 Total" crossed the right border.
  The mobile query set `justify-content: center`, which does nothing for a row
  that overflows; it now wraps, as `.category-header` already did.

- **Every JavaScript-rendering rule was unmeasured in crawl mode.** All eleven
  rendered-DOM rules (`js-rendered-title`, `-description`, `-h1`, `-canonical`,
  `-content`, `-links`, `js-canonical-mismatch`, `js-noindex-mismatch`,
  `js-title-modified`, `-description-modified`, `-h1-modified`) reported
  "rendered DOM not available — run without `--no-cwv`" on every page of every
  crawl, on runs that had rendered the page: a 30-page crawl measured Core Web
  Vitals and caught failed requests from the same render while discarding the
  DOM those rules read. The renderer always returned the HTML — `auditWithCrawl`
  rebuilt the result as `{ cwv, diagnostics, assets }` and dropped it, and
  `PageRenderResult` never modelled an `html` field, so the crawler could not
  have consumed it either. Single-page audits were unaffected, having wired it
  up separately. Found because unmeasured checks are now labelled as such;
  previously these eleven reported as ordinary warnings and the gap was
  invisible.
- **The HTML report over-counted warnings.** It re-derived its own counts from
  raw rule results instead of reading `CategoryResult`, so the weight-0 results
  produced by `notMeasured()` were counted as warnings: a report advertising 52
  warnings where 28 were real, and a "How to Fix: reduce INP, optimize
  JavaScript" box on a metric no one had measured. `scoring.ts` and the terminal
  reporter had always read this correctly through `isNotMeasured()`; the HTML
  reporter is now the third caller rather than a second implementation.
- **Single-page reports rendered a page link on every rule.** A 316-rule audit
  of one URL emitted 316 identical `/` chips, the only coloured element on each
  card and the one carrying no information. Per-rule page links now appear only
  when the report actually covers more than one URL, and the site root displays
  as "Homepage" rather than `/`.
- **The docs advertised four different rule counts.** The same repository
  claimed 251 rules (the published 3.2.0 `dist`), 261 (a README heading), and
  316 (every other doc) while the registry held 320, and `SKILL.md` still
  declared `version: "3.1"`. Every per-category count was stale too
  (Accessibility said 12 against 31, Crawlability 19 against 33). The code was
  never wrong — `getRuleCount()` and `getVersion()` have been derived since
  3.1.1 — only the prose was, so the prose is now generated.
- **The HTML report scrolled sideways on a phone.** A category header put its
  title and four counters on one row, overflowing the viewport at 390px. Both
  rows now wrap. The `pages` icon in the header meta had also never rendered:
  it was a flex item with no intrinsic size, measuring 0×0.
- **Piped JSON output was truncated at 64KB.** `seomator audit --format json | jq`
  silently lost everything past the pipe buffer (119,040 bytes to a file,
  65,536 through a pipe, `jq: parse error: Unfinished string at EOF`).
  `process.exit()` discards whatever is still buffered on stdout, and writes to
  a pipe are asynchronous where writes to a file are not. Same fix applied to
  `analyze --json` and `compare --json/--trend`. In `compare` those exits sat
  inside a `try/finally`, and `process.exit()` skips `finally`, so the database
  close had never run on the success path.
- **The crawler ignored robots.txt entirely.** `respect_robots` was declared,
  defaulted to true, validated, and read by no code — there was no robots
  parsing in the crawler at all. Crawls fetched disallowed paths while
  reporting they were being polite.
- **Empty and non-HTML responses were scored as pages.** Nothing checked what
  came back before parsing it as HTML, so a zero-byte body scored **84/100**, a
  `text/plain` response 83, and JSON 83. An empty page scored 84 because 195 of
  287 rules pass when the thing they check is absent. The auditor now refuses to
  score a response that is empty, carries a non-HTML content type, or contains
  no markup. Error pages that return real HTML still audit.
- **`redirect-loop` and `redirect-broken` always passed.** Both gate on
  `context.redirectChain`, which no code path has ever populated, so both
  returned "No redirect chain to check" on every page. At weight 15 each they
  are the heaviest rules in the category. They now report as unmeasured, since
  redirects are followed silently and an absent chain means it was never
  recorded, not that none happened.

- **Checks that took no reading were counted as warnings.** `notMeasured()`
  results carry weight 0 so they are excluded from the score, but every
  reporter still counted them as warnings — producing rows like
  `JavaScript Rendering 100 — 13 warnings` and `Mobile 100 — 5 warnings`, a
  score that deliberately excluded the very rules the count advertised. A
  `--no-cwv` run reported 61 warnings, 27 of which were checks that never ran.
  `CategoryResult` gains `notMeasuredCount`, and console, HTML, markdown and
  LLM output now label them distinctly.
- **Stored timestamps came back shifted by the machine's UTC offset.** Every
  `_at` column defaults to SQLite's `datetime('now')`, which writes UTC with no
  timezone designator; `new Date()` parsed that as local time. An audit written
  at 12:43 UTC was reported as 09:43 UTC on a UTC+3 machine. Affected `compare`,
  `compare --json` and the desktop app's audit history. The same mismatch broke
  `since`/`until` range filters, where an ISO bound compared lexically against
  the stored format excluded same-day rows. Storage was always correct, so
  existing databases need no migration.
- **Crawl mode printed a full category breakdown per page.** An 8-page crawl
  emitted 160 unlabelled category rows; 100 pages would emit 2000.
  `ProgressReporter` already carried an `isCrawlMode` flag and a page progress
  bar for this, but the flag was never read. `analyze` now starts that bar too.
- **URL validation was written but never wired up.** `seomator audit
  example.com` printed the whole banner before failing with a parser error, and
  `ftp://` URLs reached the fetch. Now rejected at parse time, with a suggested
  `https://` form when the scheme is simply missing.
- **`--format` and `--preset` accepted any value.** A typo'd `--format josn`
  silently produced console output and exit 0 — indistinguishable from success
  in CI. `--preset bogus` silently wrote a default config. Both now validate
  against the same arrays their types derive from, as does `report --format`.
- **The banner reported `v2.1.0`** on every audit, four minor versions behind
  the published package, and the crawl header advertised `251 SEO checks`
  rather than the current 287. Both now read from the live source.
- **The issue list titleized rule ids** instead of using registered rule names,
  showing `Links Depth` for a rule named "Page Depth" and `Eeat About Page`
  for "About Page".

## [3.3.0] - 2026-09-01

> ### ⚠️ Scores move again in this release — re-baseline before comparing
>
> Forty-five new rules joined the scored set. Each one dilutes its category
> average, so an existing site's category and overall scores may shift
> slightly in either direction with no change on its side. Re-run your
> baseline before treating a movement as a regression.

### Added

- **16 rules closing static audit-coverage gaps (287 → 303).**
  - Canonical checks (`core`): `core-canonical-outside-head` fails on a
    `<link rel="canonical">` placed outside the `<head>` (search engines
    ignore it); `core-canonical-attributes` flags canonical elements carrying
    invalid (`hreflang`, `lang`, `media`, `type`) or superfluous attributes;
    `core-canonical-multiple` detects multiple canonical elements in one
    document, failing when the URLs disagree.
  - `core-robots-directive-mismatch` (`core`) compares robots directives
    between meta tags and the X-Robots-Tag header, failing on index/noindex
    or follow/nofollow conflicts and warning on duplicated declarations.
  - `technical-empty-html` fails on 200 responses with an empty body or no
    meaningful `<head>`/`<body>` content; `technical-form-get-method` warns
    on forms submitted with GET, whose inputs become crawlable, indexable
    query-string URLs; `technical-duplicate-gtm` and `technical-duplicate-ga`
    warn on multiple distinct Google Tag Manager containers or Google
    Analytics properties embedded in one page.
  - `htmlval-title-outside-head` fails on `<title>` elements outside
    `<head>`; `htmlval-base-url` validates the `<base>` element (empty or
    malformed href, more than one per document, conflicting hrefs).
  - `links-non-http-protocol` warns on anchor links using protocols other
    than HTTP(S), tel: or mailto: (ftp:, file:, intent:, …).
  - `content-title-same-as-description` warns when the title tag and meta
    description contain identical text.
  - `i18n-hreflang-relative-url` fails on hreflang annotations using
    relative URLs; `i18n-hreflang-x-default` is an insight-level rule
    reporting when a language annotation targets the same URL as x-default.
  - `mobile-image-maps` warns on `<map>`/`<area>` image maps, whose
    fixed-coordinate tap targets do not adapt to mobile screens;
    `mobile-viewport-content` validates the viewport meta tag's directives
    (width present, initial-scale=1, no minimum-scale).
  - Category totals: core 19 → 23, technical 13 → 17, htmlval 9 → 11,
    links 19 → 20, content 17 → 18, i18n 10 → 12, mobile 10 → 12.

### Added (phase 2 — crawl-mode cross-page checks, 303 → 316)

- **`SiteContext.pages`: per-URL crawl state.** The crawler now records, for
  every URL it fetches, the HTTP status code (`0` on timeout), the resolved
  canonical (`undefined` when undeclared, `null` when unresolvable), the
  noindex/nofollow robots directives, a best-effort robots.txt `disallowed`
  flag, the outgoing hreflang targets, and the page's H1 text — everything a
  cross-page rule needs to cross-reference one page's signals against
  another's state. Sitemap parsing also records per-source membership, so a
  URL's declaring sitemap documents are known (`sitemapUrlSources`).
- **13 new rules, all crawl-mode cross-page checks.** Each needs
  `SiteContext.pages`, so it only measures in a multi-page crawl; in a
  single-page audit it reports as not measured (weight 0) and does not affect
  the score.
  - Sitemap cross-referencing: `crawl-sitemap-non-200` fails on sitemap URLs
    that returned 4xx/5xx during the crawl and warns on 3xx and timed-out
    URLs; `crawl-sitemap-non-canonical` fails on sitemap URLs whose canonical
    resolves elsewhere; `crawl-sitemap-disallowed` fails on sitemap URLs that
    robots.txt disallows; `crawl-sitemap-cross-duplicates` warns on URLs
    declared by more than one sitemap document.
  - Canonical target validation: `crawl-canonical-to-noindex` and
    `crawl-canonical-to-disallowed` fail when the canonical target is itself
    noindex or robots.txt-disallowed; `crawl-canonical-chain` warns when the
    target is itself canonicalized elsewhere; `crawl-canonical-loop` fails
    when following canonical targets loops with no final destination.
  - Hreflang target validation: `crawl-hreflang-to-noindex` and
    `crawl-hreflang-to-disallowed` fail on outgoing annotations whose crawled
    targets are noindex or disallowed; `crawl-hreflang-disallowed-target` is
    the mirror — this page is disallowed while other crawled pages point
    hreflang annotations at it.
  - Pagination isolation: `crawl-pagination-isolated` fails on paginated URLs
    with no incoming internal anchor links.
  - Duplicate H1 across pages: `content-duplicate-h1` warns when a page's H1
    text is identical to another crawled page's.
- **Two i18n rules extended with live crawl checks.** `i18n-hreflang-to-broken`
  now also fails on crawled hreflang targets that returned 4xx/5xx and warns
  on targets whose fetch timed out; `i18n-hreflang-to-redirect` now also warns
  on crawled targets that answered 3xx — both previously heuristic-only
  (malformed URLs, HTTP-on-HTTPS). Targets the crawl never visited are
  skipped.
- Category totals: crawl 19 → 31, content 18 → 19.

### Added (phase 3 — discovery tracking, inbound link quality, per-asset checks, 316 → 331)

- **Per-URL discovery tracking (`SiteContext.discoverySourceByUrl`).** The
  crawler now records how it first learned about every URL: an internal link,
  a canonical tag, a redirect hop, the XML sitemap, or the crawl entry point
  (a URL can carry several). To make `canonical` a real discovery source,
  internal canonical targets are now also queued for crawling — conservatively:
  same-host, filtered through the usual crawl rules, and capped by `maxPages`.
  Sitemap URLs are source-marked but deliberately NOT queued — declaring a URL
  in a sitemap does not make the crawler fetch it.
- **Per-edge inbound link metadata (`SiteContext.inboundEdgesByUrl`).** The
  inbound link graph previously said only WHO links to a URL; each edge now
  also carries its nofollow state and anchor text, so rules can judge link
  equity and anchor quality from the receiving side.
- **Per-subresource render data (`AuditContext.assets`).** The Playwright
  render now records every loaded subresource's final URL, resource type,
  status code, response headers (whitelisted to cache/encoding/length/type
  headers to bound memory), and redirect chain (including loop detection).
  The main document is excluded — it is not an asset. `transferBytes` exists
  in the type but is never populated: Playwright exposes no transfer size
  without re-fetching the body, so rules fall back to the `content-length`
  header.
- **15 new rules.** Six crawl-mode rules need the crawl state and report as
  not measured (weight 0) in a single-page audit; six per-asset rules need the
  rendered page's asset data and report as not measured under `--no-cwv`.
  - Discovery and isolation: `crawl-isolated-url` fails when no internal
    anchor link points to the URL — the crawl found it only via a canonical,
    a redirect or the sitemap — when every linking page is noindex,follow, or
    when every linker is itself isolated.
  - Incoming hreflang validation (crawl mode):
    `crawl-hreflang-incoming-conflict` fails when other crawled pages annotate
    this URL with different hreflang codes; `crawl-hreflang-reciprocity` warns
    when crawled hreflang targets do not annotate this page in return;
    `i18n-hreflang-incoming-invalid` fails when annotations from other pages
    targeting this URL use invalid language/region codes.
  - Canonical insight: `core-canonical-external` is an insight-level rule
    (always passes) reporting when the canonical points to a different host —
    legitimate for syndication, worth confirming.
  - Inbound link quality (crawl mode): `links-inbound-all-nofollow` and
    `links-inbound-mixed-follow` warn when every inbound internal link is
    nofollow, or when followed and nofollowed links are mixed;
    `links-inbound-low-quality` warns when no inbound link passes link equity
    (all nofollow or from canonicalized pages); `links-inbound-anchor-text`
    warns when every followed inbound link uses generic anchor text.
  - Resource redirects (render required): `redirect-resource-broken` fails
    when redirected page resources resolve to 4xx/5xx; `redirect-resource-loop`
    fails on resources caught in a redirect loop; `redirect-resource-chain`
    warns on resources resolving through multi-hop chains.
  - Per-asset performance (render required): `perf-asset-cache-policy` warns
    on static assets with a cache-control max-age under 1 hour;
    `perf-asset-compression` warns on text assets over 2KB served without
    gzip/Brotli; `perf-image-encoding` warns on images transferred over 100KB
    and fails on legacy BMP/TIFF formats.
- **Two minification rules extended.** `perf-minify-js` and `perf-minify-css`
  still check inline code directly, and now — when render asset data is
  available — also flag large external scripts/stylesheets (>2KB by
  content-length) whose URL lacks a `.min.` marker as heuristic suspects
  (warn only; asset bodies are not captured, so external minification cannot
  be verified directly).
- Category totals: crawl 31 → 35, links 20 → 24, redirect 8 → 11,
  perf 23 → 26, core 23 → 24, i18n 12 → 13.
- **Blocked images (`crawl-blocked-images`).** Added after phase 3 closed out:
  same-origin image URLs are matched against robots.txt with the RFC 9309
  matcher, and a disallowed image fails — it cannot be crawled, so it will
  not appear in image search. Not measured when robots.txt was not fetched.

### Changed

- **`htmlval-size-limit`** gains a fail branch above ~2 MB: Googlebot may
  only crawl and index the first part of the HTML, so content and links near
  the end of the document can be missed entirely. The 250 KB warn / 500 KB
  fail thresholds are unchanged.
- **`url-parameters`** now also warns on malformed query strings: the same
  parameter name repeated, or more than one literal `?` in the URL.
- **`i18n-hreflang-conflicting`** now also flags the same URL targeted by
  multiple different hreflang codes, and the current page self-referenced by
  multiple conflicting codes (previously only same-code → multiple-URLs was
  flagged).
- **`js-noindex-mismatch`** is renamed "Noindex/Nofollow Mismatch" and now
  also detects the nofollow directive being added or removed by JavaScript
  rendering, not just noindex.

## [3.2.0] - 2026-09-01

> ### ⚠️ Scores move again in this release — re-baseline before comparing
>
> Four independent changes shift scores, all of them corrections rather than
> regressions: category weights were rebalanced (a11y 4 → 7), 26 new rules
> joined the scored set, Core Web Vitals are now measured with `web-vitals`
> instead of hand-rolled observers, and TTFB was understated by up to 4×.
> A site will score differently on 3.2.0 than on 3.1.1 with no change on its
> side. Re-run your baseline before treating a movement as a regression.

### Added

- **26 Lighthouse-parity rules (261 → 287).** Accessibility gains 19
  (`a11y-aria-valid`, `a11y-duplicate-id`, `a11y-iframe-title`,
  `a11y-main-landmark`, `a11y-table-caption`, `a11y-svg-img-alt`,
  `a11y-tabindex-positive`, `a11y-empty-heading` and others), security 5
  (`security-csp-xss`, `security-coop`, `security-trusted-types`,
  `security-info-disclosure`, `security-paste-blocking`), plus
  `perf-legacy-javascript` and `js-document-write`. Category totals: a11y
  12 → 31, security 18 → 23, perf 22 → 23, js 15 → 16.
- **Page snapshot in the HTML report** — the audited page's title,
  description, canonical, headings and social preview rendered alongside the
  findings, so a reviewer can see what was audited without opening the site.
- **Mobile-first parity (`--mobile`).** An opt-in second render at a mobile
  viewport (393×852, mobile UA), with five rules comparing the desktop-rendered
  DOM against the mobile one — the checks that catch a mobile-first indexing
  loss, which a desktop-only audit cannot see :
  - `mobile-parity-content` — mobile body word count vs desktop. Google indexes
    the mobile version, so content hidden from mobile is effectively unindexed.
  - `mobile-parity-title` — title (fail) and meta description (warn) match.
  - `mobile-parity-canonical` — canonical matches; Google uses the mobile one.
  - `mobile-parity-structured-data` — JSON-LD present on mobile as on desktop,
    since rich results are built from the mobile page.
  - `mobile-parity-links` — comparable internal link count.

  Parity runs on the single-page `audit` path (where the rendered DOM is
  available) and roughly doubles render time, so it is off by default. Without
  `--mobile` the rules report as unmeasured (weight 0) and do not affect the
  score. The mobile render uses a real Android Chrome UA so dynamic-serving
  sites return their mobile markup.
- **Synthetic INP (`--simulate-interaction`).** INP cannot be measured without a real
  interaction, so an untouched crawl never reports one. This flag makes the crawler scroll,
  click and keypress the page so INP has something to measure. Navigation and form
  submission are suppressed with capture-phase `preventDefault`, so the click measures the
  site's own handlers without tearing down the document. The value reflects one arbitrary
  element rather than real usage, so it is labelled synthetic and carries **weight 0** — it
  is reported, never scored.
- **LCP element and largest layout-shift target** are now captured via `web-vitals`
  attribution (`cwv.lcpElement`, `cwv.clsLargestShiftTarget`).
- **Total Blocking Time** (`cwv.tbt`), collected from a `longtask` observer.
- **Complete public type exports.** `AuditContext` and `AuditResult` referenced
  types consumers could not name, so a custom rule could read `context.site` or
  `result.page` with no way to type the variable. `FigureInfo`, `InlineSvgInfo`,
  `PictureElementInfo`, `CookieInfo`, `SitemapEntry`, `SitemapFetchResult`,
  `RenderDiagnostics`, `ConsoleMessageInfo`, `FailedRequestInfo`, `SiteContext`
  and `PageSnapshot` are now exported.

### Changed

- **Category weights rebalanced** so the new accessibility rules carry real weight:
  a11y 4 → 7, funded by perf 12 → 10 (Phase 1b will add a Lighthouse performance score
  alongside it) and core 12 → 11 (18 rules, largely title/description/canonical variants).
  Weights still sum to exactly 100, as `validateCategoryWeights()` requires.
- **Site-wide link graph.** The crawler now records click depth as it discovers
  URLs and builds an inbound/outbound internal link graph, shared with every
  page as `AuditContext.site`. This is the first cross-page data available to
  rules, which previously received one page at a time and had to fake it.
  - `links-depth` measured URL path segments, which is nesting rather than
    reach — a page at `/a/b/c/d` linked from the homepage is one click away,
    not four. It now measures true click distance from the crawl entry point.
    Verified on a 6-page chain where every URL is a single segment: the old
    heuristic reported depth 1 for all of them, the graph reports 0 through 5.
  - `links-orphan-pages` always returned `pass` and advised running `--crawl`
    for detection that was never implemented. It now measures inbound internal
    link count, and is renamed in reporting to "Inbound Internal Links" to
    match what it can actually determine: a crawl reaches a page only by
    following a link to it, so every page it finds has at least one inbound
    link by construction, and true zero-inbound orphans require a URL
    inventory from outside the graph — which `crawl-sitemap-orphan-urls`
    provides by diffing the sitemap against what the crawl reached.
  - Both report as unmeasured (weight 0) outside crawl mode rather than
    guessing, so a single-page audit is not penalised.
- **Core Web Vitals are now collected with the `web-vitals` library** injected into the page
  before navigation, replacing hand-rolled `PerformanceObserver` code. Metrics are now
  spec-compliant — the same values Lighthouse, PSI and CrUX report.
- **Rendered audits are substantially faster.** Two waits were removed from the render path:
  the previous CWV collector blocked a second inside `page.evaluate` waiting for metrics the
  injected collectors already hold (−973ms/page), and the flat 1s post-load settle is now a
  race between network quiet and that same 1s ceiling (−313 to −439ms/page). Combined, real
  sites came in ~1.2–1.5s faster per page: example.com 3469→1984ms, en.wikipedia.org
  3938→2701ms, react.dev 3953→2600ms. A page that never goes network-quiet costs exactly
  what it did before. Rendered-DOM capture was byte-identical across all three sites, and
  LCP showed no systematic shift.

### Fixed

- **TTFB was substantially understated.** It was computed as
  `responseStart - requestStart`, which excludes redirect, DNS, TCP and TLS time.
  `web-vitals` measures from navigation start. On `example.com` the old formula reported
  61ms against an actual 265ms — a 4.3× understatement, and worse on hosts with slow DNS or
  TLS. `cwv-ttfb` was effectively grading a narrower metric than the one it names.
- **LCP and CLS were truncated, not finalized.** Collection resolved on a fixed 1s timer, so
  an LCP landing later than that was missed and any layout shift after it was dropped.
  `reportAllChanges` now keeps the latest value available without waiting for page-hide.

## [3.1.1] - 2026-08-31

### Fixed

- `seomator --version` reported a hardcoded `3.0.0`, and `--help` a hardcoded
  `251 rules` — neither was updated with the version bumps, so the published
  3.1.0 package identified itself as 3.0.0 with 251 rules despite shipping the
  new command surface and rules. The version now reads from `package.json` and
  the rule count from `getRuleCount()`, so both are derived and cannot drift
  again. (Functionality was unaffected; only the self-reported version was wrong.)
- `package.json` declared `engines: node >=18.0.0`, but `better-sqlite3` has
  required Node 20+ for several releases, so npm would not warn a Node 18 user
  whose native build is guaranteed to fail. Corrected to `>=20.0.0`.

### Changed

- Bumped `better-sqlite3` to `^12.11.1`, which publishes prebuilt binaries for
  Node 26 and adds `26.x` to its engines range. Cloning the repo and running
  `npm install` now works on Node 26; npm consumers were already unaffected
  because the `^12.6.2` range already resolved a working build. (Thanks to
  @slima4 — #4.)

## [3.1.0] - 2026-08-31

> ### ⚠️ Scores change in this release — re-baseline before upgrading
>
> A scoring bug meant failing rules were weighted 100× less than passing ones,
> so previous scores were inflated. Fixing it moves real numbers: a sample audit
> of example.com went **93 → 85**, with `geo` 89 → 43, `social` 48 → 17 and
> `htmlval` 100 → 83 (a category that contained a failing rule yet scored a
> perfect 100). Two further corrections move scores in *both* directions: the
> `js` category no longer awards a free 100 under `--no-cwv`, and `perf` no
> longer penalises Core Web Vitals it never measured.
>
> Nothing in the public API breaks and no code needs changing. But if you gate
> CI on a score threshold, or hold a client-facing baseline, **the same site will
> score differently on 3.1.0 than on 3.0.1**. Re-run your baseline before
> treating a drop as a regression.

### Added

- **`seomator compare <domain>`** — diffs the latest audit of a site against the
  previous one, with `--trend` for score history, `--against` to pin a specific
  audit, `--json`, and `--fail-on-regression` for CI. Rules are diffed by ID, so
  one rule breaking and another being fixed are reported separately rather than
  cancelling out; in crawl mode each rule is reduced to its worst status so the
  diff reports the rule, not every page it touched.
  The comparison engine (`compareAudits`, `getScoreTrend`, category deltas, the
  `audit_comparisons` table) already existed with no caller, and the tables it
  reads were always empty because commands persisted only to the JSON report
  store. `audit --save` now also writes to the audits database.
- **Render diagnostics.** The Playwright renderer now captures uncaught page
  errors, console output and failed subresource requests, exposed to rules as
  `AuditContext.renderDiagnostics`. Previously it kept only html, statusCode,
  responseTime and cwv and discarded everything else the browser observed.
- **5 new rules (251 → 256).**
  - `js-console-errors` — distinguishes uncaught exceptions (fail; the script
    that threw stops, so anything it would have rendered never appears) from
    console errors (warn), filtering extension and browser-intervention noise.
  - `js-failed-requests` — separates failures that can change what gets indexed
    (script, stylesheet, xhr) from ones that cannot (a tracking pixel). A 404
    on a script is invisible to a static parse: the tag is well-formed and only
    a real fetch reveals nothing came back.
  - `security-cookie-flags` — fails a session cookie missing `HttpOnly` and
    `SameSite=None` without `Secure`; warns on missing `Secure` over HTTPS or an
    absent `SameSite`.
  - `security-cookie-lifetime` — warns past the 400-day cap Chrome enforces.
  - `crawl-sitemap-lastmod` — invalid dates, future dates, and a single date
    shared by effectively every URL. Google discounts `lastmod` on sites where
    it does not track real changes, so a build-time timestamp forfeits the
    signal rather than merely wasting it.
- `src/crawler/sitemap.ts` — sitemap discovery that follows index nesting,
  gunzips by magic bytes, and reads every `Sitemap:` line in robots.txt.
- `src/crawler/cookies.ts` — `Set-Cookie` parsing that never retains cookie
  values, only their length, since audit output is shareable and reaches LLMs.

### Fixed

- Sitemap indexes were parsed as if they were page lists. `fetchSitemap`
  regex-scraped every `<loc>`, so a `<sitemapindex>` yielded child *sitemap*
  URLs posing as page URLs and every sitemap rule judged the wrong list. Gzipped
  sitemaps arrived as binary (`fetch` decompresses `Content-Encoding`, not a
  gzip payload served as `application/gzip`), and only the first `Sitemap:`
  line in robots.txt was read, truncating sites that split sitemaps by section.
- Multiple `Set-Cookie` headers were unrecoverable. `fetcher.ts` flattened
  headers into `Record<string,string>`, comma-joining them into something that
  cannot be split again because `Expires` dates contain a comma of their own.
  Now read via `getSetCookie()`.
- The mirror image of the Core Web Vitals scoring bug: 11 of 13 `js` rules
  returned `pass` when the rendered DOM was absent, so `--no-cwv` awarded the
  `js` category a perfect 100 having measured nothing. Where the CWV rules
  penalised an unmeasured metric, these rewarded one. Both now use
  `notMeasured()`. **Behaviour change:** `js` scores drop under `--no-cwv`.

### Changed

- **Scores will move, in some cases substantially.** Category scoring now
  weights each rule result by the rule's declared `weight`. Previously
  `calculateCategoryScore` used the *status score* as the weight, so a passing
  rule counted 100, a warning 50 and a failure 1 — failures were effectively
  weightless and `AuditRule.weight` never reached the calculation at all. A
  category with 1 pass and 9 failures scored 92 instead of 10, and a category
  containing a failing rule could still score a perfect 100. On a sample audit
  of example.com the overall score moved 93 → 85, with `geo` 89 → 43,
  `social` 48 → 17 and `htmlval` 100 → 83.
- `geo-ai-bot-access` now grades on answer-engine crawlers rather than counting
  all AI bots equally. Blocking training-only crawlers (`GPTBot`, `CCBot`,
  `Applebot-Extended`, …) is treated as a policy choice and no longer
  penalised; blocking crawlers that fetch pages to answer user questions
  (`OAI-SearchBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`, …) warns
  or fails. The bot list was refreshed for 2026: it previously knew only the
  retired `anthropic-ai` and `Claude-Web`, so a site blocking `ClaudeBot` and
  `OAI-SearchBot` while allowing `GPTBot` was reported as fully accessible.

### Fixed

- Cross-page rule state leaked between audits in any long-lived process,
  affecting the Electron desktop app and the programmatic API. Five rules
  (`core-title-unique`, `content-duplicate-exact`, `content-duplicate-near`,
  `content-duplicate-description`, `crawl-sitemap-orphan-urls`) accumulate a
  module-level registry as pages stream through, and each exported a
  `reset*Registry()` documented "call at start of audit" that nothing outside
  the test suite ever called. The second audit in a session compared its pages
  against the first one's, so every page reported phantom duplicate titles and
  descriptions against an unrelated domain's URLs. Resets now self-register via
  `registerResettable()` — mirroring how rules self-register — and run at the
  start of `audit()` and `auditWithCrawl()`.
- `seomator analyze` scored only the first page of a stored crawl while
  reporting the full page count, so a 200-page crawl produced a one-page score
  labelled "200 pages". It now audits every stored page through the same
  aggregation the live crawl path uses (`Auditor.aggregateCrawlResults` is now
  the public `Auditor.auditPages`).
- `seomator analyze` reported five phantom rule failures on every run. Its
  hand-rolled context builder omitted `invalidLinks`, `specialLinks`,
  `figures`, `inlineSvgs` and `pictureElements`, which rules dereference
  unguarded; the resulting `TypeError` was caught per-rule and recorded as a
  score-0 failure reading "Rule execution failed". It now delegates to the
  crawler's own `createAuditContext`, which also gains it invalid-link
  detection and `data-src` resolution that the copy had dropped.
- Unmeasured Core Web Vitals no longer reduce scores. All five CWV rules warned
  when a metric was absent, so `--no-cwv` silently cost a site five warnings in
  the 12%-weight `perf` category. `cwv-inp` was affected on *every* audit: INP
  requires real user interaction and is never populated by an automated crawl,
  so no site could score full marks on performance. A new `notMeasured()`
  result helper reports the gap with weight 0, excluding it from both sides of
  the category average — you cannot score what you did not measure. On the
  sample audit `perf` moved 80 → 98 under `--no-cwv`.
- `crawler.user_agent` from `seomator.toml` was validated but never reached any
  request. The User-Agent was hardcoded, and inconsistently: `SEOmatorBot/1.0`
  in the crawler, `SEOmatorBot/2.0` in the auditor, and the default headless
  Chrome string in the Playwright renderer, so one audit identified itself
  under three names. All requests now resolve their identity from a single
  source that the config populates.
- `links-orphan-pages` always returned `pass` and advised using `--crawl` for
  "full orphan detection" that was never implemented — a rule that could not
  fail, inflating the `links` category. Detecting orphans requires a site-wide
  inbound link graph, which does not exist yet, so it now reports as unmeasured
  and points at `crawl-sitemap-orphan-urls` for the case that is answerable.
- Playwright rendering leaked a browser context per page. Fetching now creates
  and closes a context explicitly so it can carry the configured User-Agent.

- `content-keyword-stuffing` produced false positives on a majority of real
  pages. Root cause was a denominator mismatch: the minimum-length guard tested
  the raw token count (`>= 100`) while density divided by the post-stopword
  content-word count. Since roughly half of English prose is stopwords, a page
  clearing the guard was scored against a sample of ~50 words, where a term used
  3 times is 5.6% by arithmetic alone. The guard now measures the same
  population as the metric and requires 200 content words. Specifically:
  - Added an absolute floor of 5 occurrences before density is considered, so
    incidental repetition on short pages can no longer trip the rule.
  - The page's most frequent content word is now treated as its topic and
    allowed 8% density before flagging, so a video platform is no longer
    flagged for the word "video".
  - URLs, bare domains and emails are stripped before tokenizing, so
    `example.com` no longer contributes "com" as a keyword.
  - Added a `WEB_BOILERPLATE` stopword set covering interface chrome, file
    extensions and icon-font ligatures (`icon`, `menu`, `svg`, …), which leak
    into body text as literal text nodes.
  - Raised warn density 2% → 4% and severe 5% → 10%, and removed the branch
    that warned when a single term crossed the threshold.
  - The rule no longer returns `fail`. Term density cannot distinguish
    manipulation from a page that is simply about its topic, so its strongest
    verdict is now `warn`.

### Security

- LLM reporter now wraps all site-derived content (rule messages and details)
  in nonce-stamped `<untrusted-{nonce}>...</untrusted-{nonce}>` delimiters and
  emits a `<security-notice>` instructing the consuming LLM to treat those
  blocks as data only. Defends against indirect prompt injection from audited
  pages whose content reaches the report (e.g., a hostile `<title>` or meta
  description). The 128-bit per-report nonce prevents an attacker from forging
  a closing tag because they cannot predict it at audit time.
- LLM reporter now strips zero-width characters (U+200B–U+200D, U+2060,
  U+FEFF) and Unicode tag block characters (U+E0000–U+E007F) from quoted site
  content before XML escaping. The Unicode tag block is the dominant
  invisible-prompt-injection vector — characters render as zero pixels but
  carry hidden ASCII instructions LLMs will read.
- Removed `context7.json` from the repository. The file contained only a
  Context7 documentation-service public identifier (analogous to a Stripe
  publishable key — designed to ship in source) but tripped a credential
  scanner via `pk_<base62>` regex matching.

### Added

- `npm run typecheck` (`tsc --noEmit`). The build runs through tsup/esbuild,
  which transpiles without typechecking, so type errors shipped silently — the
  `analyze` context bug above was reported by the compiler and released anyway.
  130 pre-existing errors remain and are tracked separately; most are latent
  (rules building `RuleResult` without `ruleId`, which the Auditor injects at
  runtime) rather than live defects.
- `notMeasured()` result helper in `src/rules/define-rule.ts` for checks whose
  input is unavailable. Reports the gap at weight 0 so it is visible without
  affecting the score.
- Regression tests: `src/rules/perf/perf.test.ts` (CWV weighting, `--no-cwv`
  parity), `src/rules/geo/geo.test.ts` (answer-engine vs training crawler
  grading), plus cross-audit state isolation in `src/auditor.test.ts` and
  rule-weight scoring in `src/scoring.test.ts`.

- `src/reporters/llm-reporter.test.ts` — covers the new security envelope:
  nonce uniqueness, security-notice presence, untrusted-block wrapping for
  messages and details, fix-suggestion exemption, zero-width and Unicode-tag
  character stripping, and closing-tag forgery defense via XML escaping.
- "Trust Model" section in `SKILL.md` documenting the layered defense applied
  to LLM-format output.

### Changed

- `references/rules.md` (and `skill/references/rules.md`) rewritten from the
  stale v1.2.2 rule set (55 rules / 9 categories, `meta-tags-*`/`headings-*`
  IDs) to the current v3.0.0 reference: all 20 categories with weights and
  rule counts, `<category>-<name>` ID convention, score grades, and CWV
  thresholds.

## [3.0.1] - 2026-05-06

### Fixed

- Republished `dist/index.js` so the programmatic entry point
  (`import { createAuditor } from '@seomator/seo-audit'`) works on npm. The
  source was correct, but the `3.0.0` tarball was missing the library build
  artifact, causing programmatic consumers to receive an undefined export.

### Added

- Integration test suite for the programmatic API (`src/auditor.test.ts`).
  Covers `createAuditor` / `Auditor` exports, default-vs-filtered category
  selection, the `AuditResult` shape returned by `audit()`, lifecycle callback
  ordering (`onCategoryStart` → `onRuleComplete*` → `onCategoryComplete`), and
  the single-fetch invariant. Imports through `./index.js` to mirror the npm
  consumer entry point and catch packaging regressions like the one reported
  against the published `3.0.0` artifact.
