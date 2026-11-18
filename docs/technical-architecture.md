# Technical Architecture

> **Type:** Explanation

This page explains how SEOmator turns a URL into findings and a score, and why the engine is built the way it is. Each section names the trade-off its design makes. For exact flags, keys, tables and rules, follow the links to the reference pages.

## The problem

An audit has to turn one page, or a crawl of a few hundred, into a score from 0 to 100 that means the same thing on every run. Five things get in the way.

1. **Inputs cost very different amounts.** The HTML is one request. Core Web Vitals and the rendered DOM need a real browser. Duplicate titles and orphan pages need every page of the site and the links between them.
2. **A check can lack its input.** Most checks pass when the thing they look for is absent, so a check that could not look would pass silently and the score would lie.
3. **An average cannot say "nothing else matters".** Most of the weight sits in checks that read the same on every page of a server: headers, TLS, compression. Before score caps, a page Google is told not to index scored 94, and a page holding one word scored 85.
4. **Several surfaces share one history.** The CLI, the local dashboard, the desktop app and the MCP server all write to the same database, and the audits in it were not all measured the same way.
5. **The site chooses what the audit fetches.** Links, redirects, images and sitemap entries are URLs the audited site picks, so a page must not be able to point the audit at the machine running it or at its network.

The sections below follow an audit from the command line to the database and show which part answers which problem.

## One engine, four surfaces

```
  Terminal                  Browser tab               Desktop window          AI agent
  seomator audit / analyze  seomator serve            Electron app            seomator mcp
  src/cli.ts                src/dashboard/server.ts   electron/main/          src/mcp/server.ts
  src/commands/             HTTP + SSE on             IPC through the         MCP over stdio
                            127.0.0.1:7360            preload bridge
        |                     |                         |                         |
        |                     +-- React UI from ui/ ----+                         |
        |                     |   (dist/web in the      |                         |
        |                     |    browser)             |                         |
        |                     +------------+------------+-------------------------+
        |                                  |
        |                   AuditSession   src/dashboard/audit-session.ts
        |                   one run at a time, progress, cancel, save
        |                                  |
        +----------------+-----------------+
                         |
                 Auditor   src/auditor.ts
                         |
         rules (src/rules/)   scoring (src/scoring.ts)   caps (src/score-caps.ts)
                         |
         reporters (src/reporters/)        storage (src/storage/save-audit.ts)
                         |
              $SEOMATOR_HOME/audits.db
```

All four surfaces run the same `Auditor` and write through the same `saveAuditToDatabase()`. The CLI builds an `Auditor` itself. `seomator serve`, the desktop app and `seomator mcp` (`src/mcp/server.ts`, over stdio) go through `AuditSession`, which owns one run at a time, its cancellation, a bounded progress state and saving. Reading history goes through one module too: `src/dashboard/queries.ts` serves the dashboard's HTTP API, the desktop app's `electron/main/db-bridge.ts`, `seomator report` and the MCP server's read tools.

The React app in `ui/` is the same code in the browser and in Electron. `ui/lib/api-client.ts` picks the transport at run time: the IPC bridge when the preload script has put `electronAPI` on the window, the HTTP adapter (`ui/lib/http-api.ts`) otherwise. A change in `ui/` ships to both.

The desktop app renders pages in an Electron `BrowserWindow` (`electron/main/electron-fetcher.ts`), passed to the engine as its `browserFetcher` option, instead of Playwright. That window gives Core Web Vitals and a rendered DOM, but no mobile emulation, no synthetic interaction and no code coverage (which needs the DevTools protocol), so the desktop build reports those three as unavailable (`DESKTOP_CAPABILITIES` in `electron/main/audit-bridge.ts`).

**Trade-off.** One engine means one score for one site, whichever surface ran it, and a fix to a rule lands everywhere at once. What it does not remove is the difference in capabilities. The browser render, and with it Core Web Vitals, is off by default everywhere: the CLI renders with `--render` (`--cwv` is the older name for the same flag), the run form in `ui/` when "Render in a browser" is checked, and `seomator mcp` when a call passes `render`, which it accepts only from a server started with `--allow-private` (see [The network guard](#the-network-guard)). Only the CLI and `seomator mcp` read `seomator.toml`, so only they apply `[rules]` filters and the crawler's politeness settings, and only the CLI offers `--staging`. A browser run and a no-browser run of the same site score differently for reasons that have nothing to do with the site, so every stored audit records how it was measured, and `seomator compare` will not call a measurement difference a regression. [Storage Architecture](./STORAGE-ARCHITECTURE.md#the-run-profile-run_json) lists the recorded fields.

## How a single-page audit runs

```
 seomator audit https://example.com
        |
        v
 1. Network policy  src/net/policy.ts, auto mode: private addresses refused for every
        |             request; a local or intranet target, and the private hosts its
        |             start page redirects to, pinned to the addresses they resolved to
        v
 2. Load rules      src/rules/loader.ts imports every category; the imports register the rules
        |
        v
 3. Fetch           src/crawler/fetcher.ts: one GET through netFetch(), redirects
        |             followed by hand (20 hops max), body capped at 10 MB
        |             429 or 503              -> wait (Retry-After, or 5 s doubling), retry
        |                                        3 times, then AuditError 'rate-limited'
        |             empty body or not HTML  -> AuditError 'non-html'
        |             HTTP 400 or above       -> AuditError 'http-error'
        v
 4. Render          src/crawler/playwright-fetcher.ts (only with --render)
        |             Core Web Vitals, rendered DOM, console errors, failed requests,
        |             assets, probes, code coverage
        |             --mobile: a second render at a mobile viewport
        v
 5. Build context   createAuditContext(): Cheerio DOM, links, images, figures, SVGs, pictures
        |
        v
 6. Enrich          robots.txt (5 s timeout), then sitemaps (src/crawler/sitemap.ts)
        |
        v
 7. Run rules       external links checked once (src/site/external-links.ts), then
        |             category by category, rule by rule, minus [rules] filters
        v
 8. Score           src/scoring.ts: weighted averages, rule -> category -> overall
        |
        v
 9. Cap             src/score-caps.ts: hold the score under a ceiling if the page cannot rank
        |
        v
10. Gate            src/gate.ts: the run fails if any gate fails
        |             score below --fail-under, else [ci] fail_under (default 70)
        |             a [rules.override] rule with fail_ci failed on any page,
        |               or could not take a reading
        |             a [[custom.search]] with fail_ci failed, hit its regex time
        |               limit, or checked no page
        |             --min-coverage, else [ci] min_coverage (crawl only): too few
        |               of the attempted pages measured
        v
11. Store, report   saveAuditToDatabase() unless --no-save, then src/reporters/
                      exit 0    every gate passed
                      exit 1    a gate failed; the last stderr line names why
                      exit 2    the run could not happen (usage, config, AuditError)
                      exit 130  cancelled
```

**Refuse before scoring.** Step 3 turns some responses away because most rules pass when their subject is missing. An empty response body once scored 84, a JSON response 83, and a mistyped URL that returned 404 scored 87. The auditor now throws an `AuditError` instead of scoring such a response: a confident wrong score is worse than an error. The error carries a code (`dns`, `unreachable`, `tls`, `timeout`, `http-error`, `non-html`, `rate-limited`, `private-address`, `playwright-missing`, `no-pages`, `config`, `aborted` or `unknown`, from `src/errors.ts`, which also holds `crawl-too-slow`, `busy` and `run-not-found` for `seomator mcp`; the MCP tools add `usage`, `render-unavailable`, `audit-not-found` and `unknown-rule` of their own) and usually a hint, so every surface can say what to do next. When the output is a document, the failure is written to stdout instead of stderr: a JSON error object under `--format json`, an `<error>` element under `llm`, `html` and `markdown`. An agent reading stdout would otherwise get an empty string that looks like a clean audit.

**The browser is optional and allowed to fail.** The render is the expensive step, so it runs only when you ask for it with `--render` (or `--cwv`). When it is off, or when it fails, the audit continues on the HTTP response alone, and the checks that needed the render return `notMeasured()` instead of passing. One Chromium instance serves every render in an audit (`initBrowser()` caches it) and is closed when the audit ends, including when it is cancelled, because a leaked browser outlives the process that started it. `--mobile` adds a second render with the real Playwright renderer, roughly doubling render time, which is why it is off by default.

**Render-only rules and probes.** A rule that can only be answered by a render declares `requiresRender: true`. When no render was asked for, the auditor reports it not measured with reason `needs-render`, without running it, and the console report counts them in one line ("N checks need a browser render: rerun with --render"). When the render was asked for and failed, the reason is `could-not-verify`. Checks that need something only the page knows (an image's displayed size, the accessibility tree) use **render probes** (`src/render/probes.ts`): a script string evaluated in the rendered page after the metrics are read, returning JSON. The Playwright fetcher runs them through `page.evaluate`, the desktop fetcher through `webContents.executeJavaScript`, so both run the same code. Results land on `context.probes[id]`; a probe that fails is absent and its rule is not measured. A render's results reach the context through one function, `applyRender()`, in both the single-page and crawl paths, and the crawl's renderer returns the fetcher's result unchanged, so no field can be dropped on the way.

**Order of enrichment.** robots.txt is fetched before the sitemaps because it can name them: the sitemap module reads every `Sitemap:` line, follows sitemap indexes and decompresses gzipped files. A robots.txt that cannot be fetched is treated as absent rather than as a failure.

**Running the rules.** Each receives the page's `AuditContext`. Categories run in order; the rules of one category run together, since rules read the context and never write it, and their results keep the rules' order. The auditor adds the rule's weight and the page URL to each result. A rule that throws becomes a `not-measured` result with reason `rule-error`: it took no reading, so it stays visible in every report without marking the site down for a bug in SEOmator. A category whose rules are all filtered out by `[rules]` is dropped from the result rather than scored 0, so a narrower audit is not reported as a disastrous one.

**The exit code is a set of gates.** `evaluateGate()` in `src/gate.ts` reads per-page results, never an aggregate, so a `fail_ci` rule that fails on one page of fifty fails the run at any score. A gated rule that could not take a reading on some page (it needed a render or a crawl, a resource could not be verified, the check crashed) also exits 1, because a gate that cannot run must not pass silently; a page with nothing to find (`not-applicable`, `not-compared`) satisfies it. A `fail_ci` rule that `[rules]` or `--categories` leaves out could never run, so `findFilteredGates()` reports it as a config error before the first request, and the run exits 2. The verdict travels on the result as `gate`, so every format carries it, and a run that exits 1 names every reason on its last stderr line. Overrides re-rank findings; they never change the score. [CI gates](./ci-gates.md) shows how to use them in a pipeline.

## The network guard

An audit requests URLs the audited site chooses: the links on its pages, its redirects, its images, the entries of its sitemap. Any of them can name `127.0.0.1`, a router on the local network or the cloud metadata endpoint at `169.254.169.254`, and without a check the machine running SEOmator would request it on the page's behalf. The guard in `src/net/` refuses those destinations unless the run's own target put them in scope.

```
 any engine request: page, redirect hop, robots.txt, sitemap, link check, rule request
        |
        v
 netFetch()        src/net/fetch.ts; a test fails on a bare fetch( anywhere else in src/
        |
        v
 run's policy      currentNetPolicy(), carried by AsyncLocalStorage;
        |            the open policy when no runWithNetPolicy() scope is set
        v
 connect           allowed host:port  -> connect
                   pinned host        -> connect to its pinned addresses, no DNS
                   any other host     -> resolve once, check every address
                                         (src/net/address.ts), open the socket
                                         to the address that was checked;
                                         blocked and not pinned -> refused
```

**Checked at connect time.** Under a blocking policy, `netFetch()` sends the request through an undici agent whose connector makes the check when it opens a connection, after DNS. The socket opens to the address that was checked, so a DNS answer that changes between check and connect (rebinding) cannot slip through. An IP literal skips the resolver and is checked directly. Each redirect hop opens a new connection through the same connector, so a public page that redirects to `127.0.0.1` is refused at that hop. `src/net/address.ts` blocks loopback, private, link-local, shared address space (`100.64.0.0/10`), unique-local, multicast and reserved ranges and the unspecified address; IPv4-mapped, NAT64 and 6to4 IPv6 forms are checked as the IPv4 address they carry, and an answer that is not a parseable address is refused. A refused request fails like a network error, with a `PrivateAddressError` as its cause. When that request is the page fetch, the audit fails with `private-address`; when it is a link check, the link is reported as not verified ("private address"), not as broken.

**Three modes.** `policyForTarget()` builds the policy when a run starts.

| Mode | Used by | Private destinations |
|---|---|---|
| `auto` | `seomator audit`, `crawl` and `analyze`, the dashboard, the desktop app | Refused, except a local or intranet target, which is pinned |
| `strict` | `seomator mcp` | Refused for every request, the target included |
| `open` | `seomator mcp --allow-private` | Allowed |

`--allow-host <host:port>`, repeatable, is the narrow alternative on `seomator mcp`: that host and port connect without the check while every other private destination stays refused. Over MCP a private target is refused before the run starts, with a hint that names both options. The CLI has neither flag; auto mode covers its local and intranet targets.

**Local and intranet targets.** Auditing your own dev server or an intranet site is ordinary use, so auto mode does not refuse a target whose DNS answer is entirely private. It pins the hostname to the addresses it resolved to when the run started: later requests to it connect to those addresses without asking DNS again, so an answer that changes mid-run cannot open the guard. A target whose answer mixes public and private addresses is not pinned, and stays refused. Before the run, `pinEntryRedirects()` follows the start URL's redirects, up to five hops, each with the run's timeout, and pins every hop whose host resolves only to private addresses, so a short name that redirects to its full name, a proxy or a sign-in hop still reaches the page. The walk stops at the first public hop, or at a hop on a metadata or link-local address, which is never pinned. Only the entry chain is pinned: a private host that a page links to later is still refused, and a public target gets no pins at all.

**Every entry point sets a policy.** `runWithNetPolicy()` puts the policy in `AsyncLocalStorage`, so a rule ten calls deep makes its requests under the policy of the audit that called it, and two runs in one process (`serve`, the desktop app, MCP) never see each other's. Outside any scope, `netFetch()` uses the open policy. Each entry point therefore sets one: the Auditor's `underNetPolicy()` wraps `audit()`, `auditWithCrawl()` and an `auditPages()` call made outside a run, which is how `seomator analyze` replays a stored crawl; `crawlSite()` in `src/commands/crawl.ts` does it for `seomator crawl`; and the MCP server wraps the Crawl-delay check it makes before a run. A new code path that makes requests without one is not guarded.

**Not covered yet: browser renders.** Playwright's Chromium and the desktop app's `BrowserWindow` load the page and its resources through their own network stack, so `netFetch()` never sees those requests. A host check made before navigation cannot bind Chromium's connection to the address it checked. A `--render` run on the CLI, the dashboard or the desktop app can therefore reach a private address that a page loads a resource from. `seomator mcp` refuses `render` with `render-unavailable` unless the server was started with `--allow-private`.

## The rule system

```
 src/rules/<category>/<rule>.ts    defineRule({ id, name, description, category, weight, run })
            |                        checks every field; weight must be 0 to 100
            v
 src/rules/<category>/index.ts     registerRule(rule), once per rule
            |                        a duplicate id throws at import time
            v
 src/rules/loader.ts               static import of all 20 category index files
            |                        importing a file is what registers its rules
            v
 src/rules/registry.ts             Map of id -> rule; getRulesByCategory(), getRuleById()
            |
            v
 Auditor.runAllCategories()        each category's rules, filtered by isRuleEnabled()
```

A rule is a plain object with a `run(context, options)` function, where `options` are the defaults the rule declares with any `rule_options` from `seomator.toml` laid over them. The context always carries the URL, the served HTML and its Cheerio DOM, headers, status, response time, Core Web Vitals (possibly empty) and the extracted links, images, figures, inline SVGs and picture elements. Other inputs are present only when the run produced them: robots.txt and sitemap data, the redirect chain, the external link answers, the rendered DOM, render diagnostics, asset data, probe results, code coverage, the mobile DOM, and in a crawl the site graph. A rule returns `pass` (100), `warn` (50), `fail` (0) or `notMeasured` through the helpers in `src/rules/define-rule.ts`. [SEO Audit Rules](./SEO-AUDIT-RULES.md) lists all 398 rules.

`[rules] enable` and `[rules] disable` in `seomator.toml` hold rule id patterns, where `*` matches any run of characters. A rule runs when it matches an enable pattern (an empty list enables everything) and no disable pattern. Disable wins. `src/rules/pattern-matcher.ts` holds the logic, and [Configuration](./configuration.md) documents the keys.

**Trade-off: registration by import.** Adding a rule takes a file and one `registerRule()` call, and the registry becomes the single source of the rule count: the CLI's help text, the package's `getRuleCount()` and `npm run check:docs` all read it. The cost is that the coupling is invisible. A rule file that is never imported never runs, and no type error says so. All rules load at start-up through static imports, even for a `-c core` run; `loadAllRules()` is kept for API compatibility and does nothing. In exchange there is no module lookup at run time that could fail.

**Cross-page questions** are answered from **the site graph** (`SiteContext`, built by the crawler after the crawl). It is complete and shared by reference with every page: inbound and outbound links, click depth, how each URL was discovered, and a per-page record of status, canonical, indexability and content fingerprints. Every page sees the whole site, so a verdict never depends on the order pages were audited in. Groups such as "pages with this title" and the near-duplicate analysis are computed once per site from it and memoised on the `SiteContext` (`src/site/groups.ts`). Rules hold no state of their own between pages; there is no registry to reset between audits. A rule reads another page's status through `pageStatus()` or `pageOutcome()`, never `SitePageInfo.statusCode`: those fold a timed-out or rate-limited page into "unknown" so it is never read as broken, and a test fails on a direct read. A rule that needs the whole sitemap checks `sitemapComplete`: the loader records every sitemap it could not fetch or parse, the URLs past 50,000, and the sitemaps a limit kept it from reading.

A single-page audit has no site graph, so `core-title-unique` and the other cross-page rules report not measured and point to `--crawl`.

**Requests other than pages** go through one `UrlService` per run (`src/net/url-service.ts`, on `context.urls`), and like page fetches through `netFetch()` and the run's network policy. Each distinct request (URL, method, redirect mode, headers, byte range) is made once, whichever page or rule asks: robots.txt, the 404 probe, GEO well-known files and a link every page carries are one request per run, not one per page. The service limits requests globally (`[external_links] concurrency`) and per host (`crawler.per_host_concurrency`), backs off on 429 and 503 as a crawl does, and keeps settled external link statuses in the link cache. Before rules run, the auditor checks every unique external link of the run once (`src/site/external-links.ts`); `links-external-valid` only reads the answers. A rule called on its own, as in tests, gets a fresh service through `urlServiceFor()`.

## Scoring

```
 rule result     pass 100 | warn 50 | fail 0 | not-measured: weight 0
                 advisory rule: reported, left out of the average
       |  x rule weight (1 to 25 across the registry)
       v
 category score  = sum(score x weight) / sum(weight)       every scored result, every page
       |  x category weight (they add up to 100)
       v
 overall score   = sum(category x weight) / sum(weights of the categories that ran)
       |
       v
 score caps      = the lowest ceiling below the average, if any condition holds
```

Every step rounds to a whole number. A rule's weight sets how far it moves its category: `core-title-present` carries 25, `core-title-unique` 5. The category weights are core 11, perf 10, links 8, images 8, security 8, a11y 7, technical 7, crawl 5, schema 5, content 5, js 5, social 3, eeat 3, url 3, redirect 3, mobile 2, i18n 2, htmlval 2, geo 2 and legal 1. `validateCategoryWeights()` in `src/categories/index.ts` can confirm they add up to 100, but nothing calls it during a run: the overall score divides by the weights of the categories that actually ran, so a filtered audit still lands between 0 and 100. The verdict bands in `src/verdict.ts` (A at 90, B at 80, C at 70, D at 50, F below) are shared by every surface.

**Unmeasured means weight 0.** A check that could not take a reading returns `notMeasured()`: status `not-measured`, weight 0. It appears in every report, so the gap is visible, but it adds nothing to either side of an average and is counted apart from passes, warnings and failures. Earlier versions recorded it as a warning, which produced category rows reading "score 100, 13 warnings": a score that excluded the very rules the count advertised. Stored audits from those versions still read correctly; [Storage Architecture](./STORAGE-ARCHITECTURE.md#table-audit_results) lists the three encodings.

**Advisory rules are reported, not scored.** A rule declared `advisory: true` runs on every page and its findings appear in every report (JSON marks each result `advisory: true`; the dashboard and the desktop app show a chip), but `calculateCategoryScore()` skips its results and the category counts them in `advisoryCount`, apart from passes, warnings and failures. New rules start advisory and are promoted once their verdicts have been checked on real sites, so a new check can be read before it can move anyone's score.

**Trade-off.** Leaving unmeasured checks out keeps a score honest about what was seen, but two scores then cover different sets of checks. A run without `--render` leaves dozens of checks unmeasured that a browser run grades. The score is still correct for what it measured, and it is not comparable with a browser run. That is the reason for the run profile.

**`SCORING_VERSION`** in `src/scoring.ts` covers the other way two scores can differ while the site stays the same: a change to the model. It names the scoring model and is bumped whenever weights or arithmetic change:

| Version | Introduced | Change |
|---|---|---|
| 1 | Through 4.1.0 | The original model. |
| 2 | 5.0.0 | The five core presence checks (title, description, h1, viewport, canonical) were raised from weight 1. A blank document had scored 84. |
| 3 | 6.0.0 | Page-level score caps. |
| 4 | 7.0.0 | A crawl is capped when its start page cannot be indexed. |
| 5 | 8.0.0 | Soft-404, duplicate, external-link, share-image-size and rendered accessibility verdicts changed; a crashed check is not measured; advisory rules are reported but not scored. |

The version is stored in each audit's run profile, and `compare` treats a different version, or one that was never recorded, as a material difference rather than a regression.

## Score caps

The problem is in the arithmetic. `core`, where the title and the indexing directives live, carries 11% of the weight, so even a zero there moves the overall score by at most eleven points. No change to individual rules can make an average say "this page cannot be found, so nothing else matters". A cap is the missing operator: while a condition holds, the overall score is held at or below a ceiling, and the result records which condition and what the average would have been.

| Cap | Ceiling | Condition |
|---|---|---|
| `noindex` | 20 | A robots meta tag (`robots` or `googlebot`) or X-Robots-Tag keeps the page out of Google's index |
| `robots-disallowed` | 20 | robots.txt blocks Googlebot from the page |
| `empty-page` | 30 | No `<title>` and fewer than 20 words of main content |
| `thin-content` | 49 | Fewer than 20 words of main content |
| `no-title` | 69 | No `<title>` |

The first two are **indexability** caps: the page is kept out of search. The other three are **content** caps, and at most one of them applies, the most specific. Every ceiling is below 70, so a capped audit fails a CI run at the default `fail_under` of 70.

How `src/score-caps.ts` applies them:

- **Facts come from the page, not from rule results.** Turning a rule off with `[rules] disable` cannot turn a cap off.
- **Title and content come from the rendered DOM** when the audit rendered the page, because that is what Google indexes. Directives come from the served HTML and headers, which Google reads before it decides to render. Header directives for other crawlers, such as `bingbot: noindex`, do not count.
- **An unrendered app shell gets no content cap.** A served page that is an empty `#root`, `#app`, `#__next`, `#__nuxt` or `#__svelte` mount reads as empty without a render, and Google does render it. A cap is most costly when it is wrong in that direction.
- **Only binding caps are recorded.** A ceiling above the page's average changed nothing, so it is not listed. Category scores are never changed.
- **A single-page audit is capped by its own page.** A crawl is capped by its **start page only, and by indexability only.** A site-wide block, such as noindex shipped from staging or `Disallow: /`, always reaches the start page, while a page kept out of search on purpose (a login or thank-you page) is almost never the start page. Content is already scored on every page.
- **`--staging`** (on `audit` and `analyze`) waives the indexability caps and keeps the content caps. The waived caps are reported as `waivedCaps`, a list of what to lift at launch, and a staging crawl also ignores robots.txt so that a `Disallow: /` staging site can be crawled at all.

The JSON report records the cap next to the score. On a local three-page test site whose home page is noindex, `seomator audit <url> --crawl -m 3 --format json` printed:

```json
"overallScore": 20,
"scoreCap": {
  "uncappedScore": 86,
  "caps": [
    {
      "id": "noindex",
      "ceiling": 20,
      "reason": "A noindex directive (robots meta tag or X-Robots-Tag) keeps the start page (http://127.0.0.1:49258/) out of Google's index. On a staging site that is expected: audit it with --staging."
    }
  ]
}
```

With `--staging` the same crawl scored 86 and listed the cap under `waivedCaps`, and it exited 0 instead of 1. Every report format shows the cap. The terminal, Markdown and HTML reports print `Capped from 86, the category average:` followed by each reason, and `--format llm` emits a `<score-cap>` element. Waived caps follow under `Waived for staging, would cap the score in production:`, or in a `<waived-caps>` element for `--format llm`.

**Alternatives considered.**

- *Raise the weights of the indexing and title rules.* Rejected because of the 11% ceiling described above.
- *Leave crawls uncapped.* This was 6.0.0. A five-page site that was noindex on every page scored 20 in a single-page audit and 92 in a crawl, and one behind `Disallow: /` crawled to 93. Those are the two common launch accidents, and the mode meant to check a whole site missed both.
- *Cap a crawl on any noindex page.* Rejected: it would mark down every site that has a login page.
- *A soft-404 cap.* Rejected: the soft-404 heuristic fires on the word "error" in a title.

**Trade-off.** A cap overrides arithmetic people can otherwise check by hand. The `scoreCap` record keeps the uncapped average next to the capped score so that no surface shows a capped score without its reason. The audits database keeps that record too, in `audits.extras_json`, so a stored audit viewed later still has it.

## Crawl mode

```
 seomator audit https://example.com --crawl -m 50
        |
        v
 network policy for the run (see The network guard)
        |
        v
 robots.txt and sitemaps fetched once by the Auditor, shared with every page
        |
        v
 Crawler   src/crawler/crawler.ts
   reads robots.txt again: the group for its own user agent, and Crawl-delay
   queue: first in, first out (so breadth-first)  <-----------------------------+
     |   --concurrency workers; stop at -m pages or at the time limit           |
     |     (--max-duration, [crawler] max_duration_s): fetched pages are kept   |
     |                                                                          |
     |   before each request, wait for a turn ([crawler] keys):                 |
     |     delay_ms               gap between the starts of any two requests    |
     |     per_host_delay_ms      gap between two requests to one host, or the  |
     |                            site's Crawl-delay when longer (10 s cap; off |
     |                            with --ignore-crawl-delay or                  |
     |                            respect_crawl_delay = false)                  |
     |     per_host_concurrency   most requests in flight to one host           |
     |     and any pause the host asked for (429 or 503, below)                 |
     v                                                                          |
   fetch                                                                        |
     |   429 or 503: pause the host for Retry-After (max_retry_after_ms cap)    |
     |     or 5 s doubling to 60 s; requeue the page, 3 retries, then record    |
     |     it rate-limited (the start page: AuditError 'rate-limited');         |
     |     every second backoff in a row lengthens the host's delay for the run |
     |   10 failed pages in a row on one host (error, 5xx, rate-limited):       |
     |     give the host up; its queued pages are recorded as not fetched       |
     v                                                                          |
   optional browser render -> AuditContext                                      |
     |                                                                          |
     +-- internal links on the same host, plus canonical targets ---------------+
           skipped: nofollow, non-HTML extensions, URL filter,
                    robots.txt for the crawler's own user agent
        |
        v
 buildSiteContext()   inbound and outbound links, click depth, discovery
                      sources (entry, link, canonical, redirect, sitemap)
        |
        v
 auditPages()         external links checked once, then every page through every
                      rule, four pages at a time, merged in page order
        |
        v
 category scores over every rule-page result -> overall -> start-page caps
        |
        v
 Link Score per page (src/site/link-score.ts): a metric, changes no score
```

The crawl finishes before any rule runs. That is what lets every page see the complete site graph: inbound links, orphans and click depth are only known once the crawl is over. The price is memory, because every page's context, DOM included, is held until the audit ends.

Some choices about scope, most of them explained in comments in `src/crawler/crawler.ts` and `src/auditor.ts`:

- **Canonical targets are queued**, a deliberate small widening of scope: a canonical is a strong page-equivalence signal, and without it the "reachable only through a canonical" checks could never fire. Redirect targets are recorded as discovered but not queued, since the fetch already followed them.
- **Sitemap URLs are marked as discovered but never queued.** Queuing them would let a large sitemap take over the crawl.
- **Depth is the shortest path.** The queue is first in, first out, and a URL is queued at most once, so the depth recorded on first discovery is its shortest click distance from the start page.
- **The crawler obeys robots.txt for its own user agent** (`SEOmatorBot` by default, `[crawler] user_agent`), while the `robots-disallowed` cap reads the Googlebot group. `[crawler] respect_robots = false` or `--staging` turns the crawler's check off.

With `--render`, the browser render in a crawl measures Core Web Vitals and captures the rendered DOM for every page. It does not do the mobile render or the synthetic interaction; `--mobile` and `--simulate-interaction` apply to single-page audits.

**Politeness.** A crawl should not be the reason a site slows down or starts refusing requests. Each worker reserves its start time before it waits, so `delay_ms` and `per_host_delay_ms` hold at any `--concurrency` instead of every worker reading the same "last request" time and starting together. A 429 or 503 is the site asking for fewer requests, not a finding: the page is retried after the wait, and a page still refused after three retries is recorded as rate-limited, not scored, and never read as broken by a cross-page rule. The CLI's defaults are `delay_ms = 100`, `per_host_delay_ms = 200`, `per_host_concurrency = 2`, `max_retry_after_ms = 120000` and `max_duration_s = 0` (no time limit). The dashboard and the desktop app do not read `seomator.toml`: their crawls honour Crawl-delay and back off the same way, but add no fixed delay and no per-host limit below the run's concurrency. Every `AuditSession` run (dashboard, desktop, MCP) stops requesting pages after an hour unless told otherwise, and `seomator mcp` refuses a crawl with `crawl-too-slow` before it starts when the site's Crawl-delay would make it outlast that limit.

**Completed with gaps.** Rate-limited pages, failed pages, and pages that a given-up host or the time limit left unfetched are counted, not hidden. The result's `coverage` records attempted, measured, rate-limited, failed and not-fetched pages, `completionState` becomes `completed-with-gaps`, `extras.crawl` names the hosts, and `--min-coverage` turns too little coverage into exit 1.

A category's score in a crawl is the weighted average over every rule result from every page, so a rule that fails on 3 of 50 pages pulls the category down in proportion instead of deciding it. A page that failed to load stays in the site graph, so sitemap checks can see it, and is skipped by the rules. A crawl that finds no page at all fails with `no-pages`.

**Flags and config.** For `seomator audit`, `-m`, `--concurrency` and `--timeout` override `[crawler] max_pages`, `concurrency` and `timeout_ms` only when typed (`getOptionValueSource() === 'cli'`); otherwise the config file's values apply. `--max-duration` overrides `max_duration_s`, `--min-coverage` overrides `[ci] min_coverage`, and `--ignore-crawl-delay` turns `respect_crawl_delay` off for one run.

**Replaying a stored crawl.** `seomator crawl` fetches with the same `[crawler]` politeness settings and network policy as `audit --crawl` (`crawlerOptionsFor()` and `crawlSite()` in `src/commands/crawl.ts`), saves pages to `.seomator/crawls/<id>.json`, and `seomator analyze` replays that file through the same `auditPages()`, under the network policy an audit of that site would have. A replay has no site graph, robots.txt or sitemap data, so the checks that need those inputs have nothing to read. It caps on the start page's noindex only, since robots.txt is not stored with a crawl, and it takes the first stored page as the start page because the crawler records the entry before it queues a link.

## Link Score

A crawl also measures which pages the site's own links favour. After the pages are scored, `computeLinkScores()` in `src/site/link-score.ts` runs PageRank over the site graph:

```
 nodes     crawled pages that answered 200 and were not rate-limited, each under
           the URL its recorded redirects end at, so an alias adds no node
 edges     every internal link from one node to another, self-links left out
             canonicalised page   -> one link to its canonical; its own links ignored
             nofollow link        -> counts in the page's out-degree, passes nothing
             link to a non-node   -> dropped
             no links left        -> the page's rank spread evenly over every page
 iterate   damping 0.85, every page starting at 1/n, until the total change
           is below 1e-6 or after 50 rounds
 rescale   100 x ln(rank / floor) / ln(best / floor), floor = 0.15 / n,
           clamped to 0..100, one decimal
```

`floor` is the rank of a page that only PageRank's random jump reaches, so that page scores 0 and the best-linked page scores 100. When every page has the same rank, or the crawl has one page, every page scores 100. The scale is relative to one crawl: 100 means the best-linked page of that crawl, not a property of the page.

**A metric, not a rule.** No rule reads it, and it changes no score, cap or gate. It answers a different question from the findings: not "what is wrong" but "where does the internal linking send its weight".

**Where it is kept and shown.** The result carries every page's score in `extras.linkScores`, keyed by normalised URL, and a summary in `extras.linkScoreSummary`: the ten best-linked pages and the ten weakest pages a search engine would index (200, not noindex, not blocked by robots.txt, no canonical pointing elsewhere, not a later page of a series), leaving out pages already in the top ten or scoring as high as the best. `saveAuditToDatabase()` writes the per-page scores to their own table, `audit_link_scores`, in the same transaction as the audit, because one row per page is too much for `audits.extras_json`; the summary stays in `extras_json`, and `getAuditDetail()` in `src/dashboard/queries.ts` puts the two back together. The terminal, Markdown and HTML reports and `--format llm` (a `<link-score>` element) print the summary when the crawl has more than one page; JSON carries both fields; the dashboard and the desktop app list "Pages by Link Score" in an audit's site section from five pages up. Only a live crawl has Link Scores: a single-page audit and an `analyze` replay have no site graph.

## Saving and comparing

When the audit is done, the result goes to the reporters (`src/reporters/`: console, JSON, HTML, Markdown and LLM) and, unless `--no-save` or `[output] save = false`, to `saveAuditToDatabase()`. One transaction writes the audit row, its categories, one row per rule per page, a crawl's Link Scores, the values custom extractions pulled from each page, and a comparison with the previous audit of the same domain. If storing fails, the CLI prints why and still prints the report.

The stored row carries a run profile: crawl mode, page limit, concurrency, Core Web Vitals, mobile parity, simulated interaction, categories, scoring version, rule filters, rule options, staging and timeout. The engine records its own part of the profile on the result, and `saveAuditToDatabase()` merges it beneath what the calling surface knows, so the scoring version and rule filters reach the database from every surface. `seomator compare` reads both profiles and reports any difference that can move a score on its own as "not a like-for-like comparison"; in that case `--fail-on-regression` does not fail. [Storage Architecture](./STORAGE-ARCHITECTURE.md) has the tables, the profile fields and the comparison rules.

## Related

- [Storage Architecture](./STORAGE-ARCHITECTURE.md): data locations, every table and column, the run profile and the `seomator db` commands.
- [SEO Audit Rules](./SEO-AUDIT-RULES.md): every rule with its id, weight and category.
- [Configuration](./configuration.md): `seomator.toml` keys, including `[crawler]`, `[ci]`, `[rules]` and `[output]`, and CLI options.
- [Web Dashboard](./WEB-DASHBOARD.md): `seomator serve`, its API and its security model.
- [Desktop App](./ELECTRON-APP.md): the Electron app built on the same engine and UI.
- [AI Agent Integration](./ai-agent-integration.md): driving audits from an agent, `seomator mcp` and its `--allow-private` and `--allow-host` options, and reading machine output.
- [Quickstart](./quickstart.md): install SEOmator and run a first audit.
- [Documentation index](./README.md): all SEOmator docs.
