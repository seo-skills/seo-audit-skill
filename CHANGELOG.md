# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **The report opens on its score, then goes straight to what to fix.** In
  the dashboard, the desktop app and the HTML report, the score leads and one
  fix queue follows from 01, with no fix featured above the rest. Each fix is
  written as an instruction ("Reduce DOM size") with what the check saw, the
  score points it returns, and a brief to copy for a developer. The SEOmator
  agent introduces the queue with one sentence the numbers support ("The
  first five return 2.4 of the 8.8 points this page is missing"); while a
  score cap holds, the score names it and the fix that lifts it.
- **Score points per fix.** Every failing or warning check carries `points`:
  what the score gains if it passes, from the same weights that make the score
  (`src/rules/points.ts`). All of an audit's points add up to what its score is
  missing, on a single page or a crawl; a crawl counts the pages that failed
  and the pages that warned separately (`failedPages`). The dashboard API and
  the desktop app send them on every rule summary, with `categoryWeights` on
  the audit detail.
- **Where the points went:** a strip with one column per category, as wide as
  its weight, whose empty top is what the category costs the score. Pick a
  column to filter the fix queue; the same numbers are one click away as a
  table.
- **The agent in the product.** The emblem appears as a character: crawling
  while a run is live (the only animation that loops), focused over the fix
  queue, and reacting once when a run hands over to its report. Reduced motion
  shows still poses.
- `DESIGN.md`: the design system ("The Fix Brief") the three surfaces follow.

### Changed

- **One fix queue, ranked by points across failures and warnings.** A heavy,
  widespread warning can now come before a narrow failure; the status shape
  still says which is which. The HTML report ranks the same way, and its
  category sections follow the same order.
- **Colour only where it is wrong.** Scores of 80 and above are drawn in ink,
  70 to 79 in amber and under 70 in red; nothing in the grade ladder is orange
  any more (the D grade was `#c2410c`, next to the brand orange). Passing
  checks are quiet; green now means "better than the last run". The terminal
  keeps its own green-for-good palette.
- Status is a shape beside its word everywhere: a filled square fails, a
  half-filled one warns, an open one passes, a dashed one was not measured and
  a circle is advisory.
- The audit page has no category sidebar or score ring: the score is a plain
  number at the top, with what it is missing, what it did not count, and what
  changed since the last run beside it. Export formats sit in one menu and
  Delete in the ⋯ menu.
- **All checks reads like the rest of the report.** Each category is one white
  surface with hairline rows (it was faint grey boxes on the grey page), the
  filters stay pinned under the app bar while you scroll the list, the active
  filter is ink with each status's shape beside it, Expand all / Collapse all
  sits next to them, and choosing Warnings or Not measured opens the
  categories that have them. "Details · 3 items" is a real control, and a
  single-page audit no longer prints a "/" page chip on every check.
- **The score is a measured bar.** Under the number, a meter shows the exact
  score with the missing part hatched and a notch where each grade starts, and
  one line says what the next grade costs in the queue's own terms ("3.5 points
  to Good: the first 3 fixes get you there"). Grades read the rounded score,
  so the gap is to half a point under the threshold. The same meter sits beside
  every category score and in the history table, and the HTML report has it too.
- Interaction details: buttons answer a press (scale 0.97), hover styles only
  apply where there is a hovering pointer, menus grow from their trigger and
  take arrow keys, Home and End, the strip's tooltip appears after a moment and
  then follows the pointer instantly, fix-queue rows show a chevron and open
  on a click anywhere, and the report shows its own shape while it loads.
- **The run form offers every option a run takes.** Core Web Vitals with its
  mobile render and interaction run, crawl with pages, pages at once, a time
  limit and ignoring the site's crawl-delay, staging, the categories to run
  (with each one's weight), the page timeout, checking external links again,
  and saving to history. An option that needs another first, or that this app
  cannot do, stays on the page with the reason instead of disappearing. A
  summary beside the form says what the run will do and gives the same run as
  a `seomator audit` command to copy.
- The dashboard and desktop run API take `staging`, `refresh`,
  `ignoreCrawlDelay` and `maxDuration` (seconds), as the CLI's `--staging`,
  `--refresh`, `--ignore-crawl-delay` and `--max-duration` do.
- The primary button's label is white, as on seomator.com (3.3:1, the brand's
  own call; a test holds it above 3:1).
- The run screen shows the phase as its headline, a 2px progress line, the
  latest results and the run's scope, with Stop beside it.
- History is a ledger: thousands separators, no green or red count columns.
  The row of site cards above it is now a Site menu in the table's header,
  with each site's latest score and change.
- Corners stop at 6px (4px on controls); status colours follow seomator.com
  (fails `#be1212`, improved `#167a34`).
- The HTML report carries Geist and Geist Mono inline (about 70 KB), so it
  reads in brand type offline, including when exported from the desktop app.

### Fixed

- The web dashboard never loaded its build facts: it asked only the desktop
  app's bridge, so it had no rule count, no capabilities and no category list.
  It reads them from `/api/info` now.
- "Run again" on a stored audit dropped the audit's crawl and render options.
  A stored audit keeps them on the audit row, which the page now reads.
- The HTML report's fix queue listed a rule twice when a crawl found it
  failing on some pages and warning on others, and each row printed the
  rule's whole points: a 40-page crawl showed "Add async/defer to scripts" at
  03 and 04, +0.5 each, and counted 115 fixes where the dashboard counted 105.
  The queue holds one entry per scored rule now, at its worst status and with
  every page it was found on, and advisory findings, which score nothing yet,
  are no longer counted as fixes.
- **Valid language tags were reported as invalid** (#14).
  `i18n-lang-attribute` warned on `<html lang="es-419">`, `EN-US` and
  `de-CH-1996` and passed the malformed `es419`; `i18n-hreflang` and
  `i18n-hreflang-incoming-invalid` failed hreflang codes with a script
  subtag (`zh-Hant`, `zh-Hans-US`) or a lowercase region (`en-gb`). The three
  rules share one check now (`src/rules/i18n/language-tag.ts`): `<html lang>`
  takes any well-formed BCP 47 tag in any case, and hreflang takes a language
  with an optional script and region, in any case, as Google reads it.
  Numeric regions and variants stay invalid in hreflang, which Google does not
  document. A two-letter language must exist, so a country code in its place
  (`hreflang="GB"`) still fails, and `en-GB` beside `en-gb` is reported as
  the duplicate it is.

## [8.0.0] - 2026-11-17

Upgrading from 7.x: see [docs/upgrading-to-8.md](docs/upgrading-to-8.md) for
what can break a script or CI job, why scores move, and what to change.

### Added

- **CI gates you control.** `--fail-under <n>` on `audit` and `analyze`, and
  `[ci] fail_under` in `seomator.toml`, replace the fixed threshold of 70 (the
  flag wins; `0` never fails on score).
- **`[rules.override]`** re-ranks findings and gates CI on them without
  touching the score. `priority = "high" | "normal" | "low" | "ignore"` moves a
  finding in the "what to fix first" order; `ignore` takes it out of every
  findings list and shows it in a collapsed "Ignored by config" section, and
  JSON keeps it marked `overridden`. `fail_ci = true` exits 1 when the rule
  fails on any page, at any score. A gated rule that ran but took no reading
  also exits 1, so a gate that could not be evaluated never passes silently.
- JSON output carries the CI verdict in `gate`:
  `{ failUnder, score, failedCiRules, unevaluated, exitCode }`. When a run
  exits 1, the last line on stderr says why, for example
  `Exit 1: core-canonical-present failed (fail_ci); score 85 passed fail-under 70`.
- `seomator config validate --config <path> --json` checks a config file the
  way `audit` will, rule ids included, and prints the result as JSON.
- `seomator analyze --config <path>`.
- **`rule_options` reaches the rules.** Rules declare the options they read,
  starting with `technical-soft-404` (`min_words`, `min_words_body`,
  `extra_title_phrases`, `extra_body_phrases`) and `core-description-length`
  (`min_length`, `max_length`). An undeclared key, a wrong type or an
  out-of-range value stops the run with exit 2 and lists the keys the rule
  reads; an unknown rule id is a warning at run start. Values that differ from
  the defaults are stored with the audit, and `compare` treats a change as a
  different measurement. `seomator explain` lists every option.
- **Advisory rules.** A rule can be reported in full, with its findings
  ranked, while not counting toward the score yet. Results carry
  `advisory: true` and each category counts them in `advisoryCount`, outside
  pass/warn/fail.
- **Why a check was not measured.** A `not-measured` result now carries
  `reason`: `not-applicable`, `not-compared`, `needs-render`, `needs-crawl`,
  `could-not-verify`, `probe-failed`, `disabled`, `unsupported` or
  `rule-error`. A `fail_ci` gate reads it: "nothing to find on this page"
  satisfies the gate, "could not look" on any page exits 1. A cross-page check
  (duplicates, orphans, canonical chains) on a single-page run is "could not
  look": it needs a crawl.
- **`seomator mcp`, an MCP server for AI agents.** Registered as
  `seomator-audit`, it serves `audit_url`, `audit_status`, `cancel_run`,
  `list_audits`, `get_audit`, `get_findings`, `compare_audits`, `list_rules`
  and `explain_rule` over stdio. `audit_url` returns a `runId` at once
  (`waitS` up to 25 waits for short runs), one run at a time. Every failure is
  `isError` with `{ code, message, hint }`; an unexpected one carries a
  correlation id and logs its stack to `$SEOMATOR_HOME/mcp.log`. Private,
  loopback and link-local destinations are refused for every request unless
  the server runs with `--allow-private` or `--allow-host <host:port>`, and
  browser renders need `--allow-private` for now. `seomator.toml` (or
  `--config`) is read again at the start of every run. stdout carries
  protocol frames only.
- **`seomator explain <rule-id>`** says what a rule checks, its weight, how to
  fix what it finds, and the `[rules.override]` lines to re-rank it or gate CI
  on it. `--list [category]` prints every rule id, `--json` is for scripts. An
  unknown id exits 2 and names the closest ids.
- **Crawls back off when a site asks them to.** A 429 or 503 is retried up to
  3 times, waiting for the `Retry-After` (cut to `crawler.max_retry_after_ms`,
  default 120 s) or 5 s doubling when there is none, and a host that keeps
  asking gets a longer delay for the rest of the run. A page that never clears
  is reported as rate-limited: it is not scored, and no rule calls it broken.
  After 10 pages in a row fail on one host, the crawl stops asking it and
  lists the rest as not fetched. A start page that stays rate-limited stops
  the run with error code `rate-limited`.
- **Crawls honour robots.txt `Crawl-delay`**, capped at 10 s, and print how
  long the crawl may take before it starts. `--ignore-crawl-delay` or
  `crawler.respect_crawl_delay = false` turns it off.
- **`--max-duration <s>`** (`crawler.max_duration_s`) stops a crawl requesting
  pages after that many seconds and scores what it fetched.
- **Coverage in every report, and a gate on it.** Console, markdown and LLM
  reports say how many pages were measured, for example `Measured 3 of 4
  pages · 1 rate-limited`. JSON carries the counts in `coverage` and sets
  `completionState` to `completed-with-gaps` when pages were skipped.
  `--min-coverage <pct>` or `[ci] min_coverage` exits 1 below the threshold.
- **External links are checked once per run, all of them.** A footer link on
  500 pages is one request, not 500, and a single page checks every external
  link instead of the first 20 (within 30 seconds). A crawl checks up to
  2,000 unique targets within 300 seconds, most-linked first; the
  `links-external-valid` options `max_urls` and `max_seconds` change that.
  Every report lists each broken target once, with the pages that link to it
  (`extras.externalLinks` in JSON).
- **`[external_links]` works.** `enabled`, `timeout_ms` and `concurrency` are
  read, and `cache_ttl_days` keeps settled answers in
  `$SEOMATOR_HOME/link-cache.db` for later runs. `audit --refresh` (now in
  `--help`) checks every link again.
- **New advisory rules** (reported in every format, not counted in the score
  until their verdicts are checked on real sites):
  - `core-unavailable-after`: a past `unavailable_after` date in a robots meta
    tag or X-Robots-Tag removes the page from Google's results, as noindex
    does. Fails a past date, warns one within 30 days or one it cannot read.
  - `core-obsolete-robots-directives`: `noodp` and `noydir` do nothing any
    more.
  - `core-canonical-fragment`: a canonical with `#`, a hash-bang included,
    points at the bare URL.
  - `social-og-image-reachable`: fetches the share image (64 KB, once per run
    however many pages use it) and fails one that does not load, is not an
    image, is over 5 MB or is under 600x315; warns under 1200x630 or off
    1.91:1. A `summary` Twitter card is judged as a square. Sizes are read
    from PNG, JPEG, GIF and WebP headers.
  - `social-meta-multiple`: an `og:*` or `twitter:*` property declared twice
    with different values.
  - `social-twitter-attribute`: `twitter:*` written with `property=`.
  - `social-duplicate-og`: in a crawl, `og:title` or `og:description` shared
    with other indexable pages.
  - `htmlval-body-structure`: reads the raw source for a second `<body>`, a
    `<body>` before `<html>`, or content before `<head>`, which the parser
    repairs out of sight. Markup inside comments, attribute values, scripts,
    textareas and titles does not count.
  - `crawl-indexable-not-in-sitemap`: in a crawl, a page search engines can
    index that the sitemap leaves out. Not measured when the sitemap was read
    only in part.
  - `js-ajax-crawling-scheme`: `#!` links or the fragment meta tag, which
    Google stopped supporting in 2018.
  - `mobile-separate-urls` and `technical-amp-pairing`: a declared mobile or
    AMP version that does not load, or does not name this page as its
    canonical.
  - `images-oversized-delivery` (needs `--cwv`): reads each displayed image's
    natural and displayed size in the rendered page and estimates the bytes
    wasted at a 2x pixel ratio. An image wasting over 4 KiB warns; over
    200 KiB in total fails. The top ten are listed.
  - `perf-unused-js` and `perf-unused-css` (need `--cwv`): the browser's code
    coverage during load, per file. A file wasting 20 KiB warns, 250 KiB in
    total fails, and the top ten are listed as first- or third-party.
    Coverage is collected in the same page load: measured on a fixture, it
    does not change Core Web Vitals. The desktop app cannot collect it yet
    and reports these as not measured.
  - **Accessibility with axe-core** (need `--cwv`): axe-core runs in the
    rendered page, on the CLI, the web dashboard and the desktop app, with
    every rule except experimental and deprecated ones, violations only. Ten
    `a11y-axe-*` rules group the axe rules no SEOmator rule already covers by
    area (names, landmarks, keyboard and focus, tables, lists, media, frames,
    ARIA, language, other), each naming the axe rule, impact and WCAG tags.
    `disable_axe_rules` in `[rule_options]` leaves out known exceptions.
- **Internal Link Score.** A crawl computes PageRank over the site's own links,
  scaled 0 to 100: redirecting URLs fold into their target, a canonicalised
  page passes everything to its canonical, nofollow links pass nothing. Every
  report lists the ten best-linked pages and the ten weakest indexable ones;
  JSON has every page in `extras.linkScores`, and stored audits keep them in
  a table of their own. A metric: it changes no score.
- **Custom checks in `seomator.toml`.** `[[custom.search]]` tests every page
  for text, HTML, head or body content, or a CSS selector, literally or by
  regular expression, limited by `scope`, expecting it present or absent.
  `[[custom.extract]]` pulls text or an attribute from a selector. They run
  beside the rules and never change the score; results are in JSON
  `extras.custom`. Every selector and pattern is checked before a run (exit
  2, naming the entry), a regular expression gets 50 ms per page, and a
  search with `fail_ci = true` exits 1 when a page fails, no page was checked,
  or the time limit stopped one. Every report has a "Custom checks" section,
  the markdown one with one row per extracted value, and stored audits keep
  every value in a table of their own.
- **The web dashboard and the desktop app show the new results.** The audit
  page's score card names how the run ended ("Completed" or "Completed with
  gaps"), what the crawl measured, a capped score's reason, and how many
  checks a browser render would add, with a link to run again with rendering.
  Advisory findings carry a chip and are counted on their own line, checks
  that did not apply are counted apart from the rest, and a "Not measured"
  tab lists the others, each with its reason and the one thing to do about
  it. A "Site" section shows the crawl's notes, broken external links by
  target and pages by Link Score; a "Custom checks" section comes last.
- "Issues to fix" labels a failure "Fails" instead of "Critical", lists
  advisory findings after the scored ones, and orders by the same priority
  the reports use, `[rules.override]` included.
- `--render` names the browser render (`--cwv` still works), and the run form
  calls it "Render in a browser". "Crawl the whole site" is now "Crawl linked
  pages", with the page cap in its hint. "Run again" keeps the audit's render
  and crawl settings.
- While a run waits or checks links, the dashboard and desktop progress view
  say so: "Checking 312 external links", "Waiting on example.com, 12 s", or
  the time a site's Crawl-delay will add.
- The MCP run summary carries `notMeasuredByReason` and `advisoryCount`, and
  its `topFindings` are scored findings only. `get_audit` takes `maxFindings`
  (default 50).
- `seomator init` appends commented examples of `[ci]`, `[rules.override]`,
  `[rule_options]` and `[[custom.*]]`, each valid once uncommented.
- The README says where SEOmator fits, and `docs/upgrading-to-8.md` covers
  the upgrade from 7.x.
- The MCP `audit_url` tool takes `respectCrawlDelay` and `maxDurationS`, and
  refuses up front with `crawl-too-slow` when the site's `Crawl-delay` means
  the crawl cannot finish in time. Its summary carries `coverage` and
  `completionState`.

- The dashboard's empty history (desktop app and `seomator serve`) shows an
  illustration in the house image style: the SEOmator agent scanning a site,
  with the audit history it will leave below it. It comes as a light and a dark
  twin of the same drawing, and switches with the theme.
- The HTML report has a tab icon: the emblem, inlined, so the file still needs
  no network.

### Changed

- **Breaking: a config that does not mean what it says stops the run.**
  `audit` and `analyze` now run the same checks as `config validate` before
  the first request, and exit 2 with error code `config` on any error: an
  out-of-range value, an unknown rule id or key in `[rules.override]` (with a
  "Did you mean" suggestion), or a `fail_ci` rule that `[rules]` or
  `--categories` leaves out. These configs used to run and ignore the bad
  part. `config validate` now exits 2 on an error (it exited 1) and prints to
  stderr.
- **Breaking: a bad flag or argument exits 2, not 1.** Exit 1 now always means
  a gate failed (score, `fail_ci`), never that the command line was wrong.
- The JSON schema version is 4 (`gate`, `warnings`, `RuleResult.overridden`,
  `reason`, `advisory`, `CategoryResult.advisoryCount`).
- **A check that crashes is not measured, not failed.** It used to score as a
  `fail` at the rule's full weight, blaming the site for the engine's bug. It
  is now `not-measured` with reason `rule-error`, and never moves the score.
- A page's canonical is read from the HTTP `Link` header when the HTML has
  no `<link rel="canonical">`, and its noindex from the `googlebot` meta tag
  and Google-scoped `X-Robots-Tag` (not other engines'). The score caps and
  the crawl's per-page records now share one reader.
- The `reset*Registry` and `get*RegistryStats` helpers of the duplicate rules
  are gone; nothing needs resetting between audits any more.
- The `blog` preset wrote `rule_options` for `meta-tags/description-length`, a
  rule id that does not exist. It now writes `core-description-length`.
- **`crawler.max_pages` defaults to 10** (was 100), the same as `-m`, so a crawl
  with no config covers the same pages whichever way it is started.
- **`crawler.per_host_concurrency` works** (default 2). A crawl stays on one
  host, so it now loads at most 2 pages at once by default, whatever
  `concurrency` says. Raise both to crawl faster.
- **robots.txt groups match the crawler's product token.** A group applied when
  its `User-agent` appeared anywhere in the header, so `User-agent: bot`
  governed `SEOmatorBot/3.0 (+https://...)`. It now applies only when it
  starts a product token (`SEOmator` still matches), the longest match wins,
  and `*` is the fallback. A crawl can reach pages a broad group blocked
  before.
- **Checks that need a browser render say so the same way.** Without
  `--render`, the 42 render-only checks (rendered DOM, Core Web Vitals,
  assets, mobile parity, image sizing, unused code and accessibility with
  axe-core) are reported not measured with reason `needs-render`, and the
  console report adds one line: "42 checks need a browser render: rerun with
  --render". A render that ran and failed reports them as could not verify.
  `seomator explain` says when a rule needs a render.
- **Dates are judged against the run's clock.** Every page of a run shares
  one start time, and `seomator analyze` judges a stored crawl's dates
  (sitemap `lastmod`, `unavailable_after`) against the time it was crawled,
  not the time it is replayed.
- **`a11y-color-contrast` and `a11y-touch-targets` use axe-core's verdict when
  the page was rendered** (`--cwv`): measured colours and laid-out target
  sizes instead of guesses from the source, and a serious violation now
  fails. Without a render they keep their heuristics. This moves the
  accessibility score of `--cwv` runs.
- New dependency: `axe-core` (MPL-2.0, used unmodified). It is loaded only
  when a page is rendered.
- **A crawl scores four pages at a time, and a category's rules run
  together.** Rules that make requests no longer wait on each other, and the
  run's request limits still apply. Results are merged in page order, so they
  do not depend on which page finished first.
- **Site-wide questions are asked once per run.** robots.txt, the sitemap,
  the made-up URL that tests the 404 page, the GEO well-known files, PDF sizes,
  redirect hops and internal link statuses were requested by every page's
  rules: a 20-page crawl tested the 404 page 20 times. Every request that is
  not a page now goes through one service per run, which asks each distinct
  question once and limits requests per host.
- **An external link counts as broken only when its target is gone**: 404,
  410, another 5xx, or a domain that does not resolve. A 401, 403, 429, 999 or
  a timeout used to warn; now it is listed as "could not verify" and never
  changes the status. This is part of scoring model 5.
- **`social-og-image-size` checks the declared size against the real one.** It
  used to grade the declared `og:image:width` and `og:image:height` alone,
  warning when they were missing. It now fetches the image and warns only when
  the declaration is wrong; whether the image is big enough is
  `social-og-image-reachable`'s check. Pages without declared dimensions are
  not measured. Part of scoring model 5.
- **Breaking: a page that answers 503 is retried before the run gives up.** A
  single-page `audit` of a start page that stays 503 now fails with error code
  `rate-limited` (still exit 2) instead of `http-error`, and the message says
  the site may be down.
- Web, desktop and MCP runs stop requesting pages after one hour and score
  what they fetched. The CLI has no limit unless you set one.
- Requires Node.js 20.18.1 or later (was 20.3.0). The HTML parser already
  needed it; `package.json` now says so.
- **The new SEOmator brand, from seomator.com.** The logo is the orange emblem
  and the new wordmark, drawn from the designer's files byte for byte, in the
  desktop app and dashboard header, the HTML report, the favicon and the app
  icon (which now sits on Apple's 824px icon grid). The interface drops slate
  and zinc for neutral greys with no colour cast, selection, focus and links
  are ink, and the brand orange `#FE5000` is kept for the agent at work (the
  progress bar) and the one primary action on a screen (Run audit, Run again),
  with ink text on it for AA contrast. The CLI banner and the crawl progress
  bar are orange too. Text is set in the brand's Geist, with Geist Mono for
  readouts, URLs and numbers; both faces ship inside the dashboard and the
  desktop app, so nothing is fetched at runtime. The single-file HTML report
  falls back to the system font.

- **Breaking: the browser render is opt-in. Add `--cwv` to get it.** `seomator
  audit` used to start headless Chrome on every run to measure Core Web Vitals
  and capture the rendered DOM. That one step was most of the runtime: a small
  local page took 8.6s with a cold browser and 1.3s warm, against 0.4s without
  it, and example.com took 7.6s against 4.3s. Under `--crawl` it ran once per
  page. `audit` and `serve --audit` now skip it unless you pass `--cwv`, and a
  dashboard API request that leaves out `measureCwv` skips it too. The run form
  shared by the dashboard and the desktop app already started with it off, so
  every surface now has the same default. Without the render, the Core Web
  Vitals, JavaScript-rendering and rendered-asset rules report "not measured".
  They carry no weight, so they do not cost points. `--no-cwv` still parses, so
  existing scripts keep working, but it now does what the default does. Your
  next default audit of a site you used to audit with the render will show
  `compare` a different run profile. `compare` reports that as a measurement
  change, not a regression, and `--fail-on-regression` does not fail on it.
  Pass `--cwv` to keep comparing like for like. `--mobile` and
  `--simulate-interaction` still turn the render on by themselves, as before,
  unless `--no-cwv` is also given.
- The `--no-cwv` hints in rule messages now read "run with `--cwv`", and the
  mobile-parity hint reads "run with `--cwv --mobile`".

### Security

- **Text from the audited site cannot inject into reports.** The markdown
  report escapes `<`, `>` and `&` and collapses line breaks in everything it
  prints from a page, so a title or an extracted value cannot render as HTML
  in a markdown viewer or break a table. The console report drops control
  characters from everything it prints, so a page cannot send escape
  sequences to the terminal through a title, a URL or an attribute a rule
  quotes.

- **`seomator analyze` checks links under the same network policy as
  `audit`.** Replaying a stored crawl ran its link checks with no policy, so a
  stored page of a public site linking to a private or cloud-metadata address
  made this machine request it.

- **A public site can no longer point an audit at your network.** Every
  request the engine makes, from `audit`, `crawl`, `analyze`, the dashboard,
  the desktop app and MCP, now goes through one network module. When the site
  you audit is public, a link, image, redirect or sitemap entry on it that
  resolves to a loopback, private, link-local (cloud metadata), shared or
  unique-local address is refused instead of requested. The address is checked
  when the connection opens, after DNS, so a hostname that changes its answer
  between check and connect cannot get through, and every spelling of those
  addresses (IPv4-mapped IPv6, decimal, NAT64) is covered. Auditing a site on
  `localhost` or an intranet still works: that host, and any private host its
  start page redirects to, is let through, held to the addresses it resolved
  to when the run started, so a DNS answer that changes mid-run cannot open
  the guard. Other private hosts its pages link to are refused, and read
  "could not verify". A refused request reports error code `private-address`.
  Browser renders are not covered yet: the browser loads a page's own
  resources without the check, so MCP refuses a render unless the server runs
  with `--allow-private`.
- Response bodies are read with a cap: 10 MB for a page or robots.txt, and
  50 MB for a sitemap, decompressed. A huge or endless response, or a small
  gzip that expands without limit, can no longer exhaust memory.

### Fixed

- **The dashboard showed checks that took no reading as warnings.** A stored
  rule that was not measured on any page came back as a warning-shaped row,
  so it took a warning icon and could be listed under "Issues to fix". It now
  comes back as not measured, live and from the database alike.
- Link Score's "weakest pages" no longer repeats the best-linked list on a
  small or evenly linked site.

- **A page the site kept rate-limiting is not a sitemap error or a broken
  hreflang target.** `crawl-sitemap-non-200` and `i18n-hreflang-to-broken`
  read its 429 or 503 as an error; they now count it with the pages that could
  not be fetched.
- **Sitemap orphans are not cleared on a partial sitemap.** The sitemap loader
  dropped, without a word, sitemaps it could not fetch or parse, URLs past
  50,000 and sitemaps past its limits. It now records each, and
  `crawl-sitemap-orphan-urls` reports not measured, instead of passing, when
  part of the sitemap was not read. Orphans it does find are still reported.

- **Sitemap orphans no longer depend on the order pages were audited.**
  `crawl-sitemap-orphan-urls` grew its list of linked URLs page by page, so
  the first page of a crawl compared the sitemap against its own links only
  and reported almost every sitemap URL as an orphan. It now compares against
  every URL the whole crawl reached, and every page reports the same answer.
- `links-broken-internal` no longer calls a link broken because its host kept
  answering 429 or 503 after the retries; it is counted as not checked.

- **A stored audit keeps its score cap.** The `audits` table kept the run
  options but not the cap, so history, `seomator report` and the dashboard
  showed a capped score with no reason, which is the confusion the cap was
  added to prevent. The cap, the caps a staging audit waived, and the
  `[rules.override]` marks are now stored in a new `extras_json` column and
  come back with the audit. Each result also keeps its not-measured `reason`
  and `advisory` flag, and a crawl keeps its completion state and the counts
  of pages it could not measure, so a stored crawl with gaps still reads
  "Completed with gaps" and prints its "Measured 2 of 3 pages" line. A stored value that cannot be read loads as empty, with
  a line on stderr naming the audit, and the rest of the audit is intact.
- **`audit` reads `[crawler] max_pages`, `concurrency` and `timeout_ms` from
  `seomator.toml`.** It passed the defaults of `-m`, `--concurrency` and
  `--timeout` to the config loader as overrides, so the file's values never
  reached it. A flag now wins only when you type it. The console banner's
  `Config:` line names the file in use, found or given.
- **Duplicate checks compare the whole crawl, so the first page of a group is
  flagged too.** `core-title-unique`, `content-duplicate-description`,
  `content-duplicate-exact` and `content-duplicate-near` kept their own
  registries as pages were scored, so the first page of a duplicate group
  passed, only later pages were flagged, and the answer depended on scoring
  order. They now read the finished crawl: every page in a group is flagged,
  and shuffling the scoring order changes nothing. Only pages a search engine
  would index are compared: status 200, not noindex or robots-blocked,
  self-canonical (or no canonical), and not a later page of a series, so a
  paginated archive or a `?color=red` variant canonicalised to its product no
  longer counts as a duplicate. A page outside that set is `not-measured`
  with reason `not-compared` and says why. `content-duplicate-h1` uses the
  same set. Each check declares `include_paginated` and
  `include_non_indexable` options to widen it.
- **Near-duplicate detection reads every language and scales.** The
  tokenizer dropped everything outside ASCII, so a Turkish or Greek page
  looked empty. It now keeps Unicode letters and digits. Pages are compared
  through MinHash candidate pairs confirmed by exact similarity, so a 10,000
  page crawl is compared in seconds instead of 50 million set intersections,
  and `fail_threshold` / `warn_threshold` (0.8 / 0.6) are rule options. A
  crawl so template-heavy that it yields more than five million candidate
  pairs reports `could-not-verify` instead of running without bound.
- **Soft-404 detection stops failing real pages.** It matched "error", "404"
  and "not found" anywhere in the title or H1, so long pages titled "Error
  Handling in Rust", "Terrorism Studies MA" or "Book Room 404" failed. It now
  takes two signals. The first is a title or H1 that *is* an error message:
  any segment (split at `|`, `·`, `–`, `—`, ` - ` and `: `) equals "404",
  "page not found", "not found", "error 404", "404 not found", "this page
  could not be found" or "oops! that page can't be found"; or text that says
  so ("no longer available", "does not exist" and similar, on word
  boundaries). The second is a thin page: under 500 words with the title or
  H1 signal, under 100 with the text signal alone. Common CMS defaults such as
  "404 - Page Not Found | Shop" are now caught. This is part of scoring model
  5: `compare` reads audits from before it as a different model, not a
  regression.
- **Crawls now use the concurrency you set.** A crawl worker that found the
  queue empty waited 100 ms and then quit for good. The start page almost
  always takes longer than that, so every other worker left before the first
  links were queued, and crawls ran one request at a time whatever
  `--concurrency` or `crawler.concurrency` said. Idle workers now wait for a
  running page to finish, and stop only when the queue is empty and nothing
  is in flight. Crawls with `concurrency` above 1 are faster, and may reach
  pages in a different order.
- **The CLI no longer hangs in a terminal that reports 0 columns.** Some
  embedded terminals and CI shells report a width of 0. The category spinner
  divided by it and tried to erase an endless number of lines, so `audit`
  never finished. It now prints plain lines there.
- **A crawl whose start page cannot be reached exits 2.** The crawler recorded
  the failure as one more broken page, so a dead site, a typo in the host or a
  refused connection did not stop the run: `audit --crawl` scored zero pages
  and exited 1, and `seomator crawl` printed "Crawl complete!" and exited 0.
  Both now stop with the same message and hint as a single-page audit.
- **The LLM report counts every page a rule was measured on.** In a live
  crawl, `pages="N" of="M"` counted M from the failing pages only, so it
  always read "3 of 3" even when the rule passed on a fourth page. It now
  counts every page with a reading, as stored audits already did.

## [7.0.0] - 2026-10-15

### Added

- **`--staging`, for auditing a site kept out of search on purpose.** On `audit`
  it waives the noindex and robots.txt caps, and a crawl ignores robots.txt, so a
  staging site behind `Disallow: /` can be crawled past its first page. The
  content caps still apply. What it waived is listed under the score as the
  launch checklist (`waivedCaps` in JSON, `<waived-caps>` for `--format llm`).
  `analyze --staging` waives the noindex cap on a replayed crawl. A staging
  audit is recorded on its run, and `compare` reports it as not like-for-like
  against a production audit.

### Changed

- **Breaking: a crawl is capped when its start page cannot be indexed.** 6.0.0
  capped single-page audits only, so the same site scored 20 in a single-page
  audit and 92 in a crawl when every page was noindex, and 93 behind
  `Disallow: /`, from the one page robots.txt let the crawler fetch. Those are
  the two common launch accidents, staging settings shipped to production, and
  the mode meant to check a whole site missed both. A crawl now takes the
  noindex (20) and robots.txt (20) caps of its start page. A noindex page deeper
  in the site, usually deliberate, caps nothing: content caps stay per-page.
  `analyze` applies the noindex cap to a replayed crawl, robots.txt not being
  stored with one. A crawl of a staging site now exits `1` unless run with
  `--staging`. `SCORING_VERSION` is 4.
- **The guides in `docs/` are rewritten and checked against the code.** Each
  page now does one job, following [Diataxis](https://diataxis.fr/): a tutorial
  (the quickstart), how-to guides (AI agents, the local dashboard, the desktop
  app), references (rules, configuration, storage) and explanations (the
  introduction and the architecture). `docs/README.md` indexes them by type and
  by task, and every guide keeps its file path. The rules reference now matches
  the registry, which corrected 182 rule names, 88 severities and 123
  descriptions. Claims the code contradicted are gone, such as `--refresh`,
  `--resume` and a global `config.toml`. `npm run check:docs` now checks five
  more pages, the per-category rule counts in the rules reference, and the
  version the guides show.

### Removed

- **The four PRDs in `docs/`.** They recorded plans as they stood when written
  and were not kept current. Git history keeps them; read one with, for example,
  `git show v6.0.0:docs/PRD-local-web-dashboard.md`.

### Fixed

- **`compare` reads a 5.x → 6.0.0 upgrade as a model change again.** 6.0.0
  raised the scoring version so that `compare` would not count an upgrade as a
  regression. But only `analyze` stored the scoring version; `seomator audit`, the
  dashboard and the desktop app did not. So after upgrading,
  `compare --fail-on-regression` exited 1 on any page whose score dropped, such
  as a noindex staging page going from 90 to its cap of 20. Every surface now
  stores the scoring version and rule filters the engine recorded.

  Audits saved before this fix have no recorded scoring version, so `compare`
  treats the first comparison against one of them as a model change
  ("scoring model: not recorded → 4"). That is the correct reading, and it
  happens once per site after upgrading. `compare` also now shows an empty
  disabled-rules list as "none" instead of "all".
- **`schema-present` no longer treats Open Graph tags as structured data.** It
  counted any `property=` attribute as RDFa. A page with ordinary
  `<meta property="og:*">` tags and no structured data was told "Structured data
  found (RDFa)" and got a warn instead of a fail.
- **`crawl-indexability-conflict` reads Googlebot's robots.txt group**, as the
  score cap does. It used to merge the Disallow lines of every group, so it
  could warn "blocked by robots.txt" about a page Googlebot is allowed to crawl.
  It also no longer downloads robots.txt a second time.
- **A refused connection now has its own error code.** `seomator audit`
  reported `{"code":"unknown","message":"fetch failed"}` for a URL nothing listens
  on. Refused, reset and unroutable connections are now `unreachable`, and
  rejected TLS certificates are `tls`. Each comes with a hint.
- **The skill documents the new not-measured checks and the error codes.**
  `SKILL.md` lists the cross-page checks that are not measured on a single page,
  and the checks that report not measured when there is nothing to grade.
- **`compare --json` output stays parseable.** With `--fail-on-regression`, a
  pair of audits measured differently printed the JSON document and then a
  plain-text "Not failing on regression" line, so piping it to `jq` failed. The
  note now goes to stderr; the document already says `"comparable": false`.
  `compare --trend --json` with no stored audits printed plain text and exited
  `1`, the below-threshold code. It now prints the structured `no-audits` error
  and exits `2`. The no-audits hint names a command that runs,
  `seomator audit https://<domain>`, instead of a bare domain with `--save`.
- **The skill's instructions match the CLI.** `SKILL.md` showed a JSON error
  object for `--format llm`, which prints XML. It said every command shares the
  same three exit codes, but a command line the parser rejects exits `1` with
  nothing on stdout, which an agent would read as a low score. It told agents to
  create a config with `seomator init`, which writes nothing without a terminal
  (`init -y` does), and recommended Node 18 when the package requires 20.3. It
  now also lists `--staging` and says what `--fail-on-regression` counts as a
  regression.

## [6.0.0] - 2026-10-15

### Added

- **8 rules** that finish the coverage expansion. The registry is now **373 rules**.
  Category weights are unchanged, so each new rule dilutes its category average.
  These eight are not in the published `@seomator/seo-audit@5.1.0` package.

  - Content: a page far shorter than the median page of the same kind, and a
    title that drops the suffix most of the site uses. Both need a crawl of
    at least four pages.
  - Crawl: a linked PDF whose `Content-Length` is over 10 MB. A missing length
    is skipped, and a page with no PDF links passes.
  - Schema: one organization or person name published under two absolute `@id`s.
  - E-E-A-T: one organization name with more than one phone number or address.
    Different names are treated as different places.
  - GEO: a Markdown representation of each URL other than `/`, and an HTTP 402
    that names payment terms. The root URL stays on `geo-markdown-response`.
  - Accessibility: an explicit ARIA widget role missing its required parent or
    child. A normal list is left to `a11y-list-structure`.

  **Scores move** on sites that fail the new checks, and slightly on sites that
  pass them, because content (25 → 27 rules), crawl (37 → 38), schema
  (18 → 19), eeat (15 → 16), geo (11 → 13), and accessibility (35 → 36) now
  average in more results. On the pinned fixture the overall score stays 91.

### Changed

- **Breaking: a page-level condition can cap the overall score.** The overall
  score is a weighted average of 20 categories, and most of that weight sits in
  checks that read the same on every page of a server, so an average could not
  say "nothing else matters". On one well-configured server, a page Google is
  told not to index scored 94, a page holding the single word "x" scored 85,
  and a page with one four-word sentence scored as high as a full article (95).

  A single-page audit now holds the overall score at the lowest ceiling that
  applies, and every report prints the cap and the category average beneath
  the score:

  | Condition | Ceiling |
  |-----------|---------|
  | `noindex` for Google, in a robots meta tag or `X-Robots-Tag` | 20 |
  | robots.txt disallows the page for Googlebot | 20 |
  | No `<title>` and fewer than 20 words of main content | 30 |
  | Fewer than 20 words of main content | 49 |
  | No `<title>` | 69 |

  Every ceiling is under 70, so these pages now exit `1`. A staging site that is
  noindex on purpose fails CI; its uncapped score is `scoreCap.uncappedScore` in
  the JSON output. Category scores do not change.

  Crawl audits are not capped: a site score aggregates pages, and one noindex
  page among fifty is usually deliberate. A client-rendered app shell audited
  without rendering (`--no-cwv`, or the desktop app's default) gets no content
  cap, because its words were never read. Soft-404 detection is not a cap: it
  keys on words such as "error" in the title.

  `SCORING_VERSION` is 3, so `compare` reports a model change rather than a
  regression. `AuditResult` gains an optional `scoreCap`, and `ScoreCap` is
  exported. Stored audits do not keep `scoreCap` yet, so history views show a
  capped score without its reason.

### Fixed

- **Wrong or misleading verdicts in about 60 rules, found by reverse-checking all
  373 rules against developer.mozilla.org.** Each verdict was compared with the raw page,
  not with the rule's own logic. Every fix carries a regression test.
  - **False failures.** Open Graph tags written as `<meta name="og:*">` were
    reported as missing (6 rules); they are now found, with a warn for the
    deviation from `property=`. Inline SVG `<title>` elements no longer count as
    document titles. RDFa and microdata `<meta>` in `<body>`, buttons named by
    `aria-labelledby`, and RDFa or microdata breadcrumbs now pass. A
    case-normalizing 301 is no longer a "redirect loop".
  - **Link checks.** A check that got no answer (timeout or network error) is
    reported as unchecked, not broken. Every status check confirms a failed HEAD
    with GET, since some servers reject HEAD. Each distinct URL is checked once:
    448 links became 355 requests on MDN.
  - **Page text.** Script and stylesheet source, including CSS inside
    declarative shadow roots, is no longer counted as page text.
    `content-text-html-ratio` had passed MDN at 33.6% (really 6.4%), and
    `content-duplicate-near` flagged 5 of 6 MDN pages as near-duplicates. It now
    compares main content.
  - **Sitemaps.** The URL and size limits apply to each sitemap file behind an
    index instead of the index itself, which reported "0 URLs".
    `crawl-sitemap-domain` checks the page URLs. A URL repeated inside one file
    is no longer reported as listed by two sitemaps.
  - **Not measured instead of a guess.**
    - Five cross-page rules no longer pass a single page they have nothing to
      compare with.
    - The three JSON-LD validators no longer each warn about a missing JSON-LD
      that `schema-present` already reports.
    - `a11y-color-contrast` no longer passes after examining nothing.
    - The entity rules no longer pass a crawl with no structured data.
  - **Smaller corrections.**
    - `i18n-hreflang` no longer claims a "single-language site". It now warns
      when a page links to its own translations without hreflang.
    - `content-mime-type` accepts a `<meta charset>` in the first 1,024 bytes.
    - `security-csp` counts `default-src` and `X-Frame-Options`.
    - `a11y-touch-targets` reads real CSS rules and cites the right success
      criteria.
    - Wrapping labels with nested text count as labels.
    - `eeat-citations` counts only outside sources in the content.
    - `content-article-links` measures links and words on one scope.
    - `technical-trailing-slash` flags only a path linked both ways.
    - `links-redirect-chains` samples distinct pages.
    - The `htmlval` head checks read the source the parser repairs, so they can
      fail at all.
  - **Scores move** on sites these affected. On the pinned fixture: content
    97 → 96, eeat 87 → 90, overall unchanged at 91.
- The README features list and contents link still said 332 rules. The catalog
  weights now match the registry (core 11%, performance 10%, accessibility 7%),
  and the lines for DOM size, response time, page weight, inline JavaScript,
  HTML size, `noscript` in `head`, canonical-plus-noindex, and AI crawler
  access describe what those rules measure.

## [5.1.0] - 2026-09-22

### Added

- **12 rules from the coverage-expansion plan.**
  The registry is now **344 rules** across the same 20 categories. Category
  weights are unchanged, so each new rule dilutes its category average.

  - Content: mojibake, unrendered Markdown, template leftovers, a stale footer
    copyright year, published-date disagreement, and long text hidden with an
    inline style.
  - Links: `rel=nofollow` on a same-host link.
  - Schema: identity entities without an absolute `@id`, and `AggregateRating`
    on a legal or account URL or with a `ratingValue` the reader cannot see.
  - GEO: `Content-Signal` syntax and contradictions in robots.txt (unmeasured
    when robots.txt was not fetched), and a report-only `noai` / `noimageai` check.
  - Security: cross-origin scripts and stylesheets with no `integrity` hash.

  **Scores move** on pages that fail the new checks, and slightly on pages
  that pass them, because content (19 → 25 rules), links (24 → 25), schema
  (13 → 15), geo (5 → 7), and security (23 → 24) now average in more results.

- **21 more rules** from the same plan. The registry is now **365 rules**.
  Category weights are still unchanged.

  - Crawl: canonicals that mix www, scheme, or trailing slash; sitemap
    `lastmod` versus schema `dateModified`.
  - Links: a non-entry page with one dofollow inbound link, and pages whose
    inbound links are all in the nav, header, or footer.
  - Schema: the same absolute `@id` with two logos or phone numbers, a
    referenced `@id` that no page declares, and one `@id` with two `@type`s.
    The crawler keeps a short JSON-LD summary on each crawled page for these.
  - Performance: the same library loaded twice, and a published source map.
  - Technical: a Google tag with no consent update.
  - Accessibility: unnamed buttons, email and telephone autocomplete,
    `lang` versus `xml:lang`, and `aria-hidden` on the document.
  - E-E-A-T: geo meta tags when the page already publishes local-business schema.
  - Security: a long obfuscated inline script, and a brand sign-in link that
    points at neither the brand nor this host.
  - GEO, probed once per origin: `AGENTS.md`, a `.well-known` agent manifest,
    a robots.txt `License:` target, and a Markdown representation of `/`.

  On the pinned fixture the overall score moves from 90 to 91. Perf and
  security rise because the new checks pass there. GEO gains warnings for
  the origin probes that 404.

## [5.0.0] - 2026-09-05

The score means more than it did. Two contract changes, both about a tool being
readable — by a person looking at a number, and by an agent reading an exit code.

### Breaking

- **The core presence checks are weighted like fundamentals.**
  `core-title-present`, `core-viewport-present`, `core-description-present`,
  `core-h1-present` and `core-canonical-present` were all weight **1**, the
  bottom of a scale running to 25, while ten canonical edge-case rules sat at
  6-8 and passed vacuously on a page with no canonical to examine. A page
  missing its title lost a single weight-point, and
  `<html><body><p>x</p></body></html>` scored **84/100**.

  They are now 25, 20, 15, 15 and 10, against the product's own precedent for
  presence checks (`schema-present` 25, `images-alt-present` 20).

  **Scores move.** A well-built site is unaffected or improves, because it has
  the fundamentals and they now count — measured: growthmarketing.ai 94 → 94,
  livechatai.com 87 → 92, and the `core` category on a properly marked-up page
  99. A page missing them falls: that blank document goes from `core` 85 to 47.

  Audits carry `run.scoringVersion`, and `compare` treats a change in it as a
  material run difference. `compare --fail-on-regression` therefore reports a
  model change rather than failing a build over a site that did not change.

- **Errors exit 2 everywhere.** `analyze` and `compare` returned `1` for both a
  failure and a low score, so an agent could not tell "the analysis failed"
  from "the site scored 65". They follow `audit` now: `0` success, `1` the run
  worked but the result is below a threshold, `2` the command failed, `130`
  cancelled. `compare` keeps `1` for `--fail-on-regression`. The exit codes are
  documented in `SKILL.md`.


## [4.1.0] - 2026-09-05

### Added

- **`[rules] enable` / `disable` now filter the audit.** They were documented
  with worked examples and nothing applied them. A category left with no rules
  is dropped from the result rather than scored zero, so a narrower audit does
  not read as a catastrophic one, and the patterns are recorded on the run so
  `compare` reports a filter change as a run difference instead of a
  regression. `analyze` honours the same config.

  One sharp edge, now documented: the five Core Web Vitals rules in `perf` are
  named `cwv-*`, so `disable = ["perf-*"]` leaves them running. Use
  `["perf-*", "cwv-*"]` for the whole category.
- **The `[crawler]` URL filter now applies.** `include`, `exclude`,
  `allow_query_params` and `drop_query_prefixes` never reached the crawler,
  which accepted them all along. `--preset ecommerce` excludes `/cart/**`,
  `/checkout/**` and `/account/**`, and a crawl walked into all three. Default
  behaviour is unchanged.

- **`--config <path>` works.** It was declared on the command and on
  `AuditOptions`, and nothing read it: pointing the CLI at a config file audited
  with defaults and reported nothing unusual. A path that does not exist now
  fails with a `config` error rather than silently falling back to the search.
- **`db migrate --archive`** moves the original JSON files aside. It used to be
  the default; see Changed.

### Changed

- **`[output]` in `seomator.toml` is honoured.** `format` and `path` were
  parsed, validated, printed by `seomator config`, and never consulted, because
  the output format was resolved before the config was read. `init --preset ci`
  writes both, so a CI setup produced a coloured console banner on stdout and no
  file. Precedence is flag > config > default, and the config-only `text`
  format maps onto `console`.

  `format` and `path` resolve together: passing `--format` drops a configured
  path, because inheriting it wrote a markdown report into a file named
  `audit.json` and left stdout empty. Pass `-o` to name a file explicitly.
- **`crawler.delay_ms` and `crawler.per_host_delay_ms` are applied.** Both were
  defaulted, range-validated and written by `--preset ci`, and no crawler code
  read either, so a config asking for a gap between requests crawled at full
  speed. **A crawl is slower now:** the 200ms per-host default applies, taking a
  12-page crawl from 0.8s to 2.8s in local measurement. Set both to `0` to opt
  out. Single-page audits are unaffected, and a `Crawler` or `Auditor`
  constructed directly still defaults both to 0.
- **`db migrate` no longer moves the JSON files aside by default.** `analyze`
  reads `.seomator/crawls/*.json` and `report` reads `.seomator/reports/*.json`;
  nothing reads a crawl back out of `project.db`. So the migration `db stats`
  recommends made every stored crawl unreachable — `analyze <id>` answered
  "Crawl not found" — with nothing pointing at `db restore`. Use `--archive` for
  the old behaviour. `--no-backup` still parses and is now the default.
- **Re-running `db migrate` is a skip, not an error.** An already-migrated crawl
  was reported as `UNIQUE constraint failed: crawls.crawl_id` beneath a green
  "Migration complete!". The `crawls skipped` and `reports skipped` counters
  were printed on every run and never incremented; they work now.

### Fixed

- **`analyze --json` emitted status lines before the payload.** Four
  human-readable lines went to stdout in front of the JSON, so `JSON.parse`
  failed on the first character and every agent calling it got nothing usable.
  Status now goes to stderr, as it already did in `audit`.
- **Machine-mode errors are parseable everywhere.** `analyze --json`,
  `compare --json` and `report --format json` used to leave stdout completely
  empty on a failure, so an agent could not tell a missing crawl from a crash.
  All three now emit the `{"error": true, "code": …}` object `audit` already
  did. `report --format json` with no matches emits `[]` instead of a sentence
  on stdout under a success exit code, and distinguishes "nothing stored" from
  "nothing matched that filter".
- **`compare` closes its database on every path.** Three error paths called
  `process.exit(1)`, which skips the `finally` that calls
  `closeAuditsDatabase()`, so the SQLite handle stayed open and the WAL was
  never checkpointed.
- **An analysed audit records its rule filter**, so `compare` no longer reads a
  filtered analysis as like-for-like against a full audit.
- **The skill no longer tells agents to use `--refresh` and `--resume`.**
  `skill/SKILL.md` documented both with a section, a table row and a worked
  example, and neither does anything. An agent told to resume an interrupted
  crawl restarted it from nothing and reported that it resumed. A test now
  fails if any live doc mentions a flag on the unimplemented list.
- **Lone surrogates are stripped from the LLM report.** One is not a legal XML
  character and does not encode to valid UTF-8, so it would have cost an agent
  the whole audit rather than one field. Hardening: no end-to-end repro found.

- **`--refresh` and `--resume` no longer advertise features that do not exist.**
  There is no cache to refresh — `LinkCache` is never instantiated and no rule
  fetches an external link — and no crawl state to resume, since the `frontier`
  table is created and never written. Both are out of `--help` and warn when
  passed. They still parse, so existing scripts keep working and get exactly
  what they got before: a full fresh crawl.
- **Nine config keys that do nothing now say so.** `crawler.per_host_concurrency`,
  `breadth_first`, `follow_redirects`, `max_prefix_budget`, the four
  `external_links` keys, and `rule_options` are parsed and validated with
  nothing behind them. Their defaults match real behaviour, so a default config
  is unaffected; changing one warns. `crawler.per_host_concurrency = 8` used to
  produce a precise range error for a setting with no implementation.
- **`getRuleCategory()` described a taxonomy this project does not have** —
  `meta-tags`, `core-web-vitals`, `structured-data`, `headings` — and its own
  test asserted that taxonomy, so it passed while being wrong about every rule
  the product ships. It now derives from the real category list, and maps
  `cwv-*` onto `perf`.
- **Config docs corrected:** `max_pages` was documented as 10 (it is 100),
  `drop_query_prefixes` listed three of its five entries, and four `[crawler]`
  keys were missing.

- **A report path may name a directory that does not exist.** `audit <url> -o
  reports/out.json` failed with a bare `ENOENT` — with no config involved, and
  `--preset ci` ships exactly that path. Parent directories are created.
- **A bad `--config` path no longer prints a Node stack trace.** Config loading
  happens before the run starts, outside the command's error handling, so it
  exited 1 with a stack trace where every other error gives a message, a hint
  and exit 2. Machine formats emit `"code": "config"`.
- **`analyze` explains an empty crawl store.** When crawls are sitting in a
  `.bak` directory left by an older `db migrate`, it now reports how many and
  names `seomator db restore`, instead of only "Crawl not found".
- **`[rules] enable` / `disable` say they do nothing.** They are documented with
  worked examples and no code applies them — every rule runs whatever the file
  says. `seomator config validate` and any audit run that loads such a config
  now warn. `--preset ci` no longer writes the block, whose patterns
  (`meta-tags/*`) used the wrong separator against a category that does not
  exist, so they matched zero rules even in principle. Applying the filter is
  tracked in `TODOS.md`: it changes the score, so it has to reach the run
  profile before `compare` can be trusted across it.


## [4.0.0] - 2026-09-04

**npm went from 3.3.0 straight to this.** 3.4.0 and 3.5.0 were tagged in the
repository and never published, so upgrading from the last release on npm brings
all three at once — their sections below are part of this release in practice.

The major is for the three breaking changes here, chiefly `RuleStatus` gaining a
fourth value: a consumer filtering `results.filter(r => r.status === 'warn')`
gets fewer rows than before, and the rows did not disappear, they are
`'not-measured'`. A predicate keyed on `weight === 0` keeps working unchanged.

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

- **The terminal ranks issues too.** It groups by category, which is right for a
  terminal, but inside a category issues were left in the order their rules
  happened to register, so a weight-1 warning could print above a weight-25 one
  — on the surface most people actually read. All four surfaces now answer
  "what first?" the same way. Unmeasured checks sink below real findings and no
  longer draw the yellow warning triangle one line under the label
  "(not measured)".

- **Clicking an issue opens the rule it names.** `CategorySection` initialised
  its expansion with `useState(defaultExpanded)`, and `useState` reads its
  argument on the first render only — so a section already on screen ignored
  every later change to that prop, which is exactly how the issues table asks
  for the category it is jumping to. The category never expanded, the scroll
  found no element, and the drill-down did nothing at all. Expansion is derived
  during render now, so the section is open in the same commit; the reader's own
  collapse still wins until the table asks for that category again. The jump
  also moves keyboard focus to the rule, so Tab continues from there and a
  screen reader announces it, and it honours `prefers-reduced-motion` — an
  explicit `behavior` overrides the CSS that would otherwise handle it.

- **A running audit says how long it has taken and how long is left.** An
  eight-page audit takes about four and a half minutes and the UI said nothing
  about time, so a slow run was indistinguishable from a stuck one. Elapsed is
  always shown. The projection appears only when it is real: measured from the
  first completed page (not the run's start, which folds in the crawl and the
  browser launch), over at least two completions, never during the crawl, and
  computed between completions rather than against the clock — dividing by
  `now` makes the estimate climb while a page is in flight, which on a real
  four-page crawl read 76s, 86, 97, 107, 117, 127 while nothing was wrong. Past
  its own estimate it is withdrawn rather than floored at "0s left".

- **A trend needs three points.** Two audits drew a straight segment between
  them, which reads as a direction while being a single comparison. The chart
  now asks for three, and below that says how many more audits are needed —
  a message that could not previously appear, because the page repeated the
  threshold and hid the whole section.

- **A clean audit reads as a result.** Zero issues rendered as "No issues found"
  in muted grey, indistinguishable from a panel that had failed to load. It is
  now a success state that says every measurable check passed.

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

- **A history row is clickable across its whole width.** Only the date text was
  a link. The URL, the score, the page count, all three result columns and the
  chevron pointing right were dead — eleven-twelfths of a row that looks
  clickable, with an arrow at the end promising navigation it was not wired to.
  The row now navigates anywhere, through a single stretched link, so keyboard
  focus stays one tab stop and cmd-click still opens a new tab.

- **A restarted server no longer strands an open tab on a Retry that cannot
  work.** `seomator serve` mints a per-launch token, so restarting it leaves any
  open tab holding the previous cookie: every API call 401s while the document
  request would set the new one. The dashboard showed "Could not load your
  audits — The server returned 401" with a Retry button that re-ran the same
  fetch with the same stale cookie, failing identically every time. A 401 is now
  its own state — "The dashboard was restarted" — offering the one action that
  resolves it.

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

- **A filter that matches nothing says so.** Each `CategorySection` returns null
  when nothing in it matches — right per category, and with all twenty doing it
  the page was a heading and a row of filter tabs over empty space. It now names
  what matched nothing, and "no failures" reads as the good news it is rather
  than getting the same treatment as "no passing checks".

- **Revealing a finding is one complete action.** Clicking an issue expanded its
  category, scrolled and moved focus — but the summary table lists the top
  findings regardless of the active filter, so clicking a warning while filtered
  to Failures asked the page to reveal a rule the filter had just removed from
  the DOM. The jump found nothing and did nothing, for exactly the reason the
  collapsed category used to. The filter clears as part of the same action, and
  the URL now names the revealed finding, so the view can be shared or reloaded
  straight back to it.

- **Export says it is working.** Clicking Markdown looked like nothing happened,
  because on a fast download nothing visible does. The button reports
  "Preparing…" and its siblings disable while it runs. A browser download gives
  no completion event, so nothing claims success that cannot be known — under
  Electron, where the save is awaited, a real failure is still reported.

- **One finding is listed once, however its message is worded.** Message
  grouping normalised a hand-maintained list of units — `X chars`, `X words`,
  `X images`, `X links`, `Xpx`, `Xms`, `XKB` — which only covers what someone
  thought of. On a real crawl `technical-trailing-slash` printed **five times**,
  because its message counts URLs and a percentage: "16 URLs with slash, 2
  without (11% inconsistency)", then 14, 6, 21 and 8. One finding took five
  entries and five of the agent report's slots. Any number that is not part of a
  word is now treated as a quantity, so `H1` and `H2` stay the distinct findings
  they are while those five collapse to one. The terminal and the shared grouper
  had separate copies of this; there is one now.

- **The agent report stops truncating real audits.** The 50-finding cap was
  chosen when a 1,000-page crawl produced 1.4 MB — but that size came from
  listing each finding once per page, not from the number of findings. With the
  duplication fixed, 50 was simply too low: an eight-page personal blog produced
  77 findings and 27 were dropped. The cap is 150, which is a bound on the
  pathological case rather than a curation — curation is what the ordering is
  for, since an agent can stop reading a ranked list but cannot recover what was
  truncated. That blog's 77 findings now arrive complete, in 60 KB.

- **A 1,000-page crawl is a budget now, not a hope.** Nothing asserted what the
  reporters do at scale, and the 8-page fixture hides all of it, because every
  cost is per-rule-per-page on a live crawl. Measured for the first time, a
  1,000-page HTML report was **69.28 MB**: 48.11 MB of it 340,004 page anchors
  (every affected page linked inside every rule card, all of them inside a
  closed `<details>` nobody opens), and 20.59 MB of it full URL lists repeated
  in `data-urls` on both the table row and the card. The agent report was
  1.44 MB because `<passed>` listed each rule once per page it passed on —
  113,000 entries, the same duplication that was fixed for `<issue>` and left
  here.

  Page lists cap at ten with a count for the rest; the affected-page attribute
  carries indices into a page list emitted once, or `*` when a finding covers
  every page; `<passed>` is a set. **HTML 69.28 MB → 1.11 MB, agent report
  1.44 MB → 0.04 MB.** In a browser that report loads in 113ms with 10,655 DOM
  nodes and a 9.5 MB heap, and the page filter still resolves correctly — eight
  budget assertions cover it, including that ten times the pages must not mean
  ten times the report.

  **If you script against the report's HTML:** `data-urls` is gone, replaced by
  `data-pages` carrying indices rather than URLs.

- **The report stops printing every finding twice.** The summary table and the
  category sections below it rendered the same 46 findings — 3,191px of rows and
  12,217px of cards, 90% of a 17,199px page. The table is a ranked index now
  (top 10 of 46) and the sections hold the detail. Fix advice folds, the rule's
  generic description moves inside it rather than sitting under every finding's
  own message, and the category-score grid moved below the findings: it was
  442px of orientation pushing the first thing to fix to y=976 on a 900px
  screen. **17,199px → 10,046px**, with nine of the top ten findings on the
  first screen where none were before.

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

- **PRD for the local web dashboard (`seomator serve`).** `docs/PRD-local-web-dashboard.md`
  specifies a loopback HTTP server that lists stored audits, compares them, and
  runs new ones from the browser, reusing the Electron renderer through a typed
  `DashboardAPI` with an HTTP adapter. It was taken through a four-phase
  `/autoplan` review (CEO, design, developer experience, engineering) with two
  outside models; the review found ten defects in the existing storage and
  cancel paths (opt-in persistence, a 1,000-row cap on stored detail, a
  comparison that writes on read, a cosmetic cancel) and sequences their fixes
  as a 3.4.0 foundations release before the dashboard ships in 3.5.0.
  `TODOS.md` was created with the deferred items.

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
