# Technical Architecture

> **Type:** Explanation

This page explains how SEOmator turns a URL into findings and a score, and why the engine is built the way it is. Each section names the trade-off its design makes. For exact flags, keys, tables and rules, follow the links to the reference pages.

## The problem

An audit has to turn one page, or a crawl of a few hundred, into a score from 0 to 100 that means the same thing on every run. Four things get in the way.

1. **Inputs cost very different amounts.** The HTML is one request. Core Web Vitals and the rendered DOM need a real browser. Duplicate titles and orphan pages need every page of the site and the links between them.
2. **A check can lack its input.** Most checks pass when the thing they look for is absent, so a check that could not look would pass silently and the score would lie.
3. **An average cannot say "nothing else matters".** Most of the weight sits in checks that read the same on every page of a server: headers, TLS, compression. Before score caps, a page Google is told not to index scored 94, and a page holding one word scored 85.
4. **Several surfaces share one history.** The CLI, the local dashboard and the desktop app all write to the same database, and they do not share defaults.

The sections below follow an audit from the command line to the database and show which part answers which problem.

## One engine, three surfaces

```
  Terminal                    Browser tab                     Desktop window
  seomator audit / analyze    seomator serve                  Electron app
  src/cli.ts                  src/dashboard/server.ts         electron/main/
  src/commands/               HTTP + SSE on 127.0.0.1:7360    IPC through the preload bridge
        |                              |                               |
        |                              +--- React UI from ui/ ---------+
        |                              |    (dist/web for the browser) |
        |                              |                               |
        |                              +---------------+---------------+
        |                                              |
        |                               AuditSession   src/dashboard/audit-session.ts
        |                               one run at a time, progress, cancel, save
        |                                              |
        +----------------------+-----------------------+
                               |
                       Auditor   src/auditor.ts
                               |
         rules (src/rules/)   scoring (src/scoring.ts)   caps (src/score-caps.ts)
                               |
         reporters (src/reporters/)        storage (src/storage/save-audit.ts)
                               |
                    $SEOMATOR_HOME/audits.db
```

All three surfaces run the same `Auditor` and write through the same `saveAuditToDatabase()`. The CLI builds an `Auditor` itself. `seomator serve` and the desktop app go through `AuditSession`, which owns one run at a time, its cancellation, a bounded progress state and saving. Reading history goes through one module too: `src/dashboard/queries.ts` serves the dashboard's HTTP API, the desktop app's `electron/main/db-bridge.ts` and `seomator report`.

The React app in `ui/` is the same code in the browser and in Electron. `ui/lib/api-client.ts` picks the transport at run time: the IPC bridge when the preload script has put `electronAPI` on the window, the HTTP adapter (`ui/lib/http-api.ts`) otherwise. A change in `ui/` ships to both.

The desktop app renders pages in an Electron `BrowserWindow` (`electron/main/electron-fetcher.ts`), passed to the engine as its `browserFetcher` option, instead of Playwright. That window gives Core Web Vitals and a rendered DOM, but no mobile emulation and no synthetic interaction, so the desktop build reports those two as unavailable.

**Trade-off.** One engine means one score for one site, whichever surface ran it, and a fix to a rule lands everywhere at once. What it does not remove is the difference in defaults and capabilities. The CLI measures Core Web Vitals unless `--no-cwv`; the run form in `ui/` starts with them off. Only the CLI applies `[rules]` filters and offers `--staging`. A browser run and a no-browser run of the same site score differently for reasons that have nothing to do with the site, so every stored audit records how it was measured, and `seomator compare` will not call a measurement difference a regression. [Storage Architecture](./STORAGE-ARCHITECTURE.md#the-run-profile-run_json) lists the recorded fields.

## How a single-page audit runs

```
 seomator audit https://example.com
        |
        v
 1. Load rules      src/rules/loader.ts imports every category; the imports register the rules
        |
        v
 2. Fetch           src/crawler/fetcher.ts: one GET, redirects followed by hand (20 hops max)
        |             empty body or not HTML  -> AuditError 'non-html'
        |             HTTP 400 or above       -> AuditError 'http-error'
        v
 3. Render          src/crawler/playwright-fetcher.ts (skipped with --no-cwv)
        |             Core Web Vitals, rendered DOM, console errors, failed requests, assets
        |             --mobile: a second render at a mobile viewport
        v
 4. Build context   createAuditContext(): Cheerio DOM, links, images, figures, SVGs, pictures
        |
        v
 5. Enrich          robots.txt (5 s timeout), then sitemaps (src/crawler/sitemap.ts)
        |
        v
 6. Run rules       category by category, rule by rule, minus [rules] filters
        |
        v
 7. Score           src/scoring.ts: weighted averages, rule -> category -> overall
        |
        v
 8. Cap             src/score-caps.ts: hold the score under a ceiling if the page cannot rank
        |
        v
 9. Report, store   src/reporters/, then saveAuditToDatabase() unless --no-save
                    exit 0 at 70 or above, 1 below 70, 2 on failure, 130 when cancelled
```

**Refuse before scoring.** Step 2 turns some responses away because most rules pass when their subject is missing. An empty response body once scored 84, a JSON response 83, and a mistyped URL that returned 404 scored 87. The auditor now throws an `AuditError` instead of scoring such a response: a confident wrong score is worse than an error. The error carries a code (`dns`, `unreachable`, `tls`, `timeout`, `http-error`, `non-html`, `playwright-missing`, `no-pages`, `config`, `aborted` or `unknown`, from `src/errors.ts`) and usually a hint, so every surface can say what to do next. When the output is a document, the failure is written to stdout instead of stderr: a JSON error object under `--format json`, an `<error>` element under `llm`, `html` and `markdown`. An agent reading stdout would otherwise get an empty string that looks like a clean audit.

**The browser is optional and allowed to fail.** The render is the expensive step, so it is the one you can turn off. When it is off, or when it fails, the audit continues on the HTTP response alone, and the checks that needed the render return `notMeasured()` instead of passing. One Chromium instance serves every render in an audit (`initBrowser()` caches it) and is closed when the audit ends, including when it is cancelled, because a leaked browser outlives the process that started it. `--mobile` adds a second render with the real Playwright renderer, roughly doubling render time, which is why it is off by default.

**Order of enrichment.** robots.txt is fetched before the sitemaps because it can name them: the sitemap module reads every `Sitemap:` line, follows sitemap indexes and decompresses gzipped files. A robots.txt that cannot be fetched is treated as absent rather than as a failure.

**Running the rules.** Rules run one at a time, each receiving the page's `AuditContext`. The auditor adds the rule's weight and the page URL to each result. A rule that throws becomes a `fail` result with the message `Rule execution failed: ...`. That makes a broken rule visible in every report, at the cost of marking the site down for a bug in SEOmator. A category whose rules are all filtered out by `[rules]` is dropped from the result rather than scored 0, so a narrower audit is not reported as a disastrous one.

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

A rule is a plain object with a `run(context)` function. The context always carries the URL, the served HTML and its Cheerio DOM, headers, status, response time, Core Web Vitals (possibly empty) and the extracted links, images, figures, inline SVGs and picture elements. Other inputs are present only when the run produced them: robots.txt and sitemap data, the redirect chain, the rendered DOM, render diagnostics, asset data, the mobile DOM, and in a crawl the site graph. A rule returns `pass` (100), `warn` (50), `fail` (0) or `notMeasured` through the helpers in `src/rules/define-rule.ts`. [SEO Audit Rules](./SEO-AUDIT-RULES.md) lists all 373 rules.

`[rules] enable` and `[rules] disable` in `seomator.toml` hold rule id patterns, where `*` matches any run of characters. A rule runs when it matches an enable pattern (an empty list enables everything) and no disable pattern. Disable wins. `src/rules/pattern-matcher.ts` holds the logic, and [Configuration](./configuration.md) documents the keys.

**Trade-off: registration by import.** Adding a rule takes a file and one `registerRule()` call, and the registry becomes the single source of the rule count: the CLI's help text, the package's `getRuleCount()` and `npm run check:docs` all read it. The cost is that the coupling is invisible. A rule file that is never imported never runs, and no type error says so. All rules load at start-up through static imports, even for a `-c core` run; `loadAllRules()` is kept for API compatibility and does nothing. In exchange there is no module lookup at run time that could fail.

**Cross-page questions** are answered two ways, and the difference matters.

- **The site graph** (`SiteContext`, built by the crawler after the crawl) is complete and shared by reference with every page: inbound and outbound links, click depth, how each URL was discovered. Every page sees the whole site.
- **Accumulators** are module-level stores that fill up as pages are audited, such as the title registry behind `core-title-unique`. Each registers a reset callback with `registerResettable()`, and every audit starts by calling `resetCrossPageState()`. They need no second pass, but they are order-dependent: the first page with a given title passes, and only the later ones warn. Reset callbacks survive `clearRegistry()` on purpose, because ESM caches a module after its first import, so a cleared set would never fill up again.

A single-page audit has no site graph, so `core-title-unique` and the other cross-page rules report not measured and point to `--crawl`.

## Scoring

```
 rule result     pass 100 | warn 50 | fail 0 | not-measured: weight 0
       |  x rule weight (1 to 25 across the registry)
       v
 category score  = sum(score x weight) / sum(weight)       every result, every page
       |  x category weight (they add up to 100)
       v
 overall score   = sum(category x weight) / sum(weights of the categories that ran)
       |
       v
 score caps      = the lowest ceiling below the average, if any condition holds
```

Every step rounds to a whole number. A rule's weight sets how far it moves its category: `core-title-present` carries 25, `core-title-unique` 5. The category weights are core 11, perf 10, links 8, images 8, security 8, a11y 7, technical 7, crawl 5, schema 5, content 5, js 5, social 3, eeat 3, url 3, redirect 3, mobile 2, i18n 2, htmlval 2, geo 2 and legal 1. `validateCategoryWeights()` in `src/categories/index.ts` can confirm they add up to 100, but nothing calls it during a run: the overall score divides by the weights of the categories that actually ran, so a filtered audit still lands between 0 and 100. The verdict bands in `src/verdict.ts` (A at 90, B at 80, C at 70, D at 50, F below) are shared by every surface.

**Unmeasured means weight 0.** A check that could not take a reading returns `notMeasured()`: status `not-measured`, weight 0. It appears in every report, so the gap is visible, but it adds nothing to either side of an average and is counted apart from passes, warnings and failures. Earlier versions recorded it as a warning, which produced category rows reading "score 100, 13 warnings": a score that excluded the very rules the count advertised. Stored audits from those versions still read correctly; [Storage Architecture](./STORAGE-ARCHITECTURE.md#table-audit_results) lists the three encodings.

**Trade-off.** Leaving unmeasured checks out keeps a score honest about what was seen, but two scores then cover different sets of checks. A run with `--no-cwv` leaves dozens of checks unmeasured that a browser run grades. The score is still correct for what it measured, and it is not comparable with a browser run. That is the reason for the run profile.

**`SCORING_VERSION`** in `src/scoring.ts` covers the other way two scores can differ while the site stays the same: a change to the model. It names the scoring model and is bumped whenever weights or arithmetic change:

| Version | Introduced | Change |
|---|---|---|
| 1 | Through 4.1.0 | The original model. |
| 2 | 5.0.0 | The five core presence checks (title, description, h1, viewport, canonical) were raised from weight 1. A blank document had scored 84. |
| 3 | 6.0.0 | Page-level score caps. |
| 4 | 7.0.0 | A crawl is capped when its start page cannot be indexed. |

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

The first two are **indexability** caps: the page is kept out of search. The other three are **content** caps, and at most one of them applies, the most specific. Every ceiling is below 70, so a capped audit fails a CI run.

How `src/score-caps.ts` applies them:

- **Facts come from the page, not from rule results.** Turning a rule off with `[rules] disable` cannot turn a cap off.
- **Title and content come from the rendered DOM** when the audit rendered the page, because that is what Google indexes. Directives come from the served HTML and headers, which Google reads before it decides to render. Header directives for other crawlers, such as `bingbot: noindex`, do not count.
- **An unrendered app shell gets no content cap.** A served page that is an empty `#root`, `#app`, `#__next`, `#__nuxt` or `#__svelte` mount reads as empty without a render, and Google does render it. A cap is most costly when it is wrong in that direction.
- **Only binding caps are recorded.** A ceiling above the page's average changed nothing, so it is not listed. Category scores are never changed.
- **A single-page audit is capped by its own page.** A crawl is capped by its **start page only, and by indexability only.** A site-wide block, such as noindex shipped from staging or `Disallow: /`, always reaches the start page, while a page kept out of search on purpose (a login or thank-you page) is almost never the start page. Content is already scored on every page.
- **`--staging`** (on `audit` and `analyze`) waives the indexability caps and keeps the content caps. The waived caps are reported as `waivedCaps`, a list of what to lift at launch, and a staging crawl also ignores robots.txt so that a `Disallow: /` staging site can be crawled at all.

The JSON report records the cap next to the score. On a local three-page test site whose home page is noindex, `seomator audit <url> --crawl -m 3 --no-cwv --format json` printed:

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

**Trade-off.** A cap overrides arithmetic people can otherwise check by hand. The `scoreCap` record keeps the uncapped average next to the capped score so that no surface shows a capped score without its reason. One gap remains: the audits database stores only the capped number, so a stored audit viewed later has lost the reason.

## Crawl mode

```
 seomator audit https://example.com --crawl -m 50
        |
        v
 robots.txt and sitemaps fetched once by the Auditor, shared with every page
        |
        v
 Crawler   src/crawler/crawler.ts
   queue: first in, first out (so breadth-first)  <------------------+
     |   --concurrency workers; stop at -m pages                      |
     |   wait between requests: [crawler] delay_ms, per_host_delay_ms |
     v                                                                |
   fetch -> optional browser render -> AuditContext                   |
     |                                                                |
     +-- internal links on the same host, plus canonical targets -----+
           skipped: nofollow, non-HTML extensions, URL filter,
                    robots.txt for the crawler's own user agent
        |
        v
 buildSiteContext()   inbound and outbound links, click depth, discovery
                      sources (entry, link, canonical, redirect, sitemap)
        |
        v
 auditPages()         every page through every rule, one page at a time
        |
        v
 category scores over every rule-page result -> overall -> start-page caps
```

The crawl finishes before any rule runs. That is what lets every page see the complete site graph: inbound links, orphans and click depth are only known once the crawl is over. The price is memory, because every page's context, DOM included, is held until the audit ends.

Some choices about scope, most of them explained in comments in `src/crawler/crawler.ts` and `src/auditor.ts`:

- **Canonical targets are queued**, a deliberate small widening of scope: a canonical is a strong page-equivalence signal, and without it the "reachable only through a canonical" checks could never fire. Redirect targets are recorded as discovered but not queued, since the fetch already followed them.
- **Sitemap URLs are marked as discovered but never queued.** Queuing them would let a large sitemap take over the crawl.
- **Depth is the shortest path.** The queue is first in, first out, and a URL is queued at most once, so the depth recorded on first discovery is its shortest click distance from the start page.
- **The crawler obeys robots.txt for its own user agent** (`SEOmatorBot` by default, `[crawler] user_agent`), while the `robots-disallowed` cap reads the Googlebot group. `[crawler] respect_robots = false` or `--staging` turns the crawler's check off.

The browser render in a crawl measures Core Web Vitals and captures the rendered DOM for every page. It does not do the mobile render or the synthetic interaction; `--mobile` and `--simulate-interaction` apply to single-page audits.

A category's score in a crawl is the weighted average over every rule result from every page, so a rule that fails on 3 of 50 pages pulls the category down in proportion instead of deciding it. A page that failed to load stays in the site graph, so sitemap checks can see it, and is skipped by the rules. A crawl that finds no page at all fails with `no-pages`.

**Known gap.** For `seomator audit`, the `-m`, `--concurrency` and `--timeout` flags have defaults (10, 3 and 30000 ms), and `src/commands/audit.ts` passes them to the config loader as overrides. The `[crawler] max_pages`, `concurrency` and `timeout_ms` values in `seomator.toml` are therefore always overridden. Set them with the flags.

**Replaying a stored crawl.** `seomator crawl` saves pages to `.seomator/crawls/<id>.json`, and `seomator analyze` replays that file through the same `auditPages()`. A replay has no site graph, robots.txt or sitemap data, so the checks that need those inputs have nothing to read. It caps on the start page's noindex only, since robots.txt is not stored with a crawl, and it takes the first stored page as the start page because the crawler records the entry before it queues a link.

## Saving and comparing

When the audit is done, the result goes to the reporters (`src/reporters/`: console, JSON, HTML, Markdown and LLM) and, unless `--no-save` or `[output] save = false`, to `saveAuditToDatabase()`. One transaction writes the audit row, its categories, one row per rule per page, and a comparison with the previous audit of the same domain. If storing fails, the CLI prints why and still prints the report.

The stored row carries a run profile: crawl mode, page limit, concurrency, Core Web Vitals, mobile parity, simulated interaction, categories, scoring version, rule filters, staging and timeout. The engine records its own part of the profile on the result, and `saveAuditToDatabase()` merges it beneath what the calling surface knows, so the scoring version and rule filters reach the database from every surface. `seomator compare` reads both profiles and reports any difference that can move a score on its own as "not a like-for-like comparison"; in that case `--fail-on-regression` does not fail. [Storage Architecture](./STORAGE-ARCHITECTURE.md) has the tables, the profile fields and the comparison rules.

## Related

- [Storage Architecture](./STORAGE-ARCHITECTURE.md): data locations, every table and column, the run profile and the `seomator db` commands.
- [SEO Audit Rules](./SEO-AUDIT-RULES.md): every rule with its id, weight and category.
- [Configuration](./configuration.md): `seomator.toml` keys, including `[crawler]`, `[rules]` and `[output]`, and CLI options.
- [Web Dashboard](./WEB-DASHBOARD.md): `seomator serve`, its API and its security model.
- [Desktop App](./ELECTRON-APP.md): the Electron app built on the same engine and UI.
- [AI Agent Integration](./ai-agent-integration.md): driving audits from an agent and reading machine output.
- [Quickstart](./quickstart.md): install SEOmator and run a first audit.
- [Documentation index](./README.md): all SEOmator docs.
