# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [Unreleased]

### Added

- **robots.txt compliance.** The crawler now parses and obeys robots.txt per
  RFC 9309: user-agent group selection (most specific group wins), Allow and
  Disallow with longest-match precedence and Allow breaking ties, `*` and `$`
  wildcards, comments, and multi-agent groups. No new dependency. `respect_robots`
  finally does what it has always claimed; set it to `false` to opt out.

### Fixed

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
