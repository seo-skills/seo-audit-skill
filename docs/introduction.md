# Introduction to SEOmator

> **Type:** Explanation

This page explains what SEOmator is, how an audit turns a web page into a
score, and where that score can mislead you. To run an audit first, follow the
[Quickstart](./quickstart.md).

## The problem

Most search problems on a website are mechanical, and invisible to the people
who run it. A `noindex` tag left over from a staging build, a page with no
`<title>`, a canonical link pointing at the wrong URL, a security header the
server never sends: the page still loads fine for a visitor, so nobody notices
until search traffic drops.

Finding these by hand means checking hundreds of signals on every page: in the
HTML the server sends, in the page after JavaScript runs, in the HTTP headers,
in `robots.txt` and in the sitemap. The list grows as search engines and AI
assistants change what they read.

## What SEOmator does

SEOmator automates those checks. It is a command-line tool, published on npm as
`@seomator/seo-audit`, that loads a page, tests it against
**373 rules** across **20 categories**, and turns the results into a score out
of 100 and a ranked list of what to fix.

It runs on your machine. There is no account, and pages are not sent to a
service. Each audit is stored in a local database, so you can compare runs.

The categories cover on-page basics (titles, descriptions, headings,
canonicals), technical SEO and crawlability, performance and Core Web Vitals,
links, images, security headers, accessibility, structured data, content,
JavaScript rendering, mobile, internationalization, E-E-A-T trust signals, URL
structure, HTML validity, readiness for AI search, and legal compliance.
[SEO Audit Rules](./SEO-AUDIT-RULES.md) lists every rule.

## How an audit works

```
  seomator audit https://example.com
                │
                ▼
  ┌─────────────────────────┐
  │ 1. Fetch                │  HTTP request, redirects recorded.
  │                         │  Not HTML, or HTTP 400+?  ──►  error, no score
  └────────────┬────────────┘
               ▼
  ┌─────────────────────────┐
  │ 2. Render (optional)    │  Headless browser: Core Web Vitals,
  │                         │  rendered DOM, loaded assets. Off with --no-cwv.
  └────────────┬────────────┘
               ▼
  ┌─────────────────────────┐
  │ 3. Site files           │  robots.txt and sitemaps, read once per audit.
  └────────────┬────────────┘
               ▼
  ┌─────────────────────────┐
  │ 4. Rules                │  Each rule returns pass, warn, fail
  │                         │  or not measured.
  └────────────┬────────────┘
               ▼
  ┌─────────────────────────┐
  │ 5. Score                │  rules ──► categories ──► overall score,
  │                         │  then page-level caps.
  └────────────┬────────────┘
               ▼
       report + stored audit
```

1. **Fetch.** A plain HTTP request gets the page the way a crawler first sees
   it, and records each redirect on the way. If the response is not an HTML
   page (a PDF, a JSON API, a feed), or its status is 400 or higher, the audit
   stops with an error instead of a score. [Refusing to score](#refusing-to-score)
   explains why.
2. **Render.** Unless you pass `--no-cwv`, SEOmator opens the page in a headless
   browser. It tries the Chrome, Chromium or Edge installed on your machine
   first, then Playwright's own Chromium. The render measures Core Web Vitals,
   captures the page after JavaScript has run, and records every asset the page
   loaded. If no browser can start, the audit carries on without the render.
3. **Site files.** SEOmator reads `robots.txt`, then every sitemap it lists, or
   `/sitemap.xml` when it lists none. Sitemap indexes and gzipped sitemaps are
   followed.
4. **Rules.** Every rule reads what it needs from what was collected: the
   served HTML, the rendered page, headers, the redirect chain, robots.txt, the
   sitemap. Each returns pass, warn, fail or not measured. A rule that crashes
   counts as a failure, so a bug cannot pass silently.
5. **Score.** The results become category scores and an overall score, and the
   overall score may be capped. The next sections explain how.

## How the score is built

The score is three layers of weighted averages:

```
  rule results               category scores               overall
  ─────────────              ───────────────               ───────
  pass          100          Core            × 11%
  warn           50   ──►    Performance     × 10%   ──►   0-100, then caps
  fail            0          ...
  not measured   (left out)  Legal Compliance × 1%
```

- **Rules to a category.** A pass is worth 100, a warning 50 and a failure 0.
  Each rule also carries a weight of up to 25 inside its category, so
  `core-title-present` (weight 25) moves the Core score 25 times as much as a
  weight-1 check. A category score is the weighted average of its rules.
- **Categories to the overall score.** Each category has a weight, from 11% for
  Core down to 1% for Legal Compliance, and the weights add up to 100. The
  overall score is the weighted average of the category scores.
  [SEO Audit Rules](./SEO-AUDIT-RULES.md) lists the weights.
- **Grade.** A is 90 or more, B 80 or more, C 70 or more, D 50 or more, and F
  below 50. Every surface uses the same bands. 70 is also the pass line:
  `seomator audit` exits with `1` below it, so a CI job fails.

## Score caps

An average cannot say "nothing else matters". Most of the weight sits in checks
that read the same on every page of a server: headers, TLS, compression, URL
shape. Before caps existed, a page that told Google not to index it scored 94,
and a page holding a single word scored 85, because the server around it was
well configured.

Re-weighting rules cannot fix that. Core, where the title and the indexing
directives live, carries 11% of the overall score, so even a zero there moves
the result by at most 11 points. Re-weighting had already been tried: 5.0.0
raised the weight of the five core presence checks (title, description, H1,
viewport, canonical) after a blank document scored 84.

A cap is the missing operator. While a condition holds that no other work can
outweigh, the overall score is held at or below a ceiling. There are two kinds:

- **Indexability caps** hold the score to 20 or less when Google is told not to
  index the page (`noindex` in a robots meta tag or `X-Robots-Tag` header), or
  when robots.txt blocks Googlebot from fetching it.
- **Content caps** apply when a page gives a search engine nothing to be found
  for. Their ceilings are 69 for no `<title>`, 49 for fewer than 20 words of
  main content, and 30 for both.

Only the lowest applicable ceiling counts, and only when it is below the
average. Every ceiling is under 70, so a capped audit always fails a CI run.
Category scores are never capped: they still describe what was measured. The
report prints the uncapped average and the reason under the score; JSON output
carries them as `scoreCap`, and `--format llm` as `<score-cap>`.

Some details are choices worth knowing about:

- **Caps read the page, not rule results.** A cap still holds if you disable
  the rule that reports the same problem.
- **Title and word count come from the rendered page** when there is one,
  because that is what Google indexes. Directives come from the HTML and
  headers the server sent, which Google reads before it decides to render.
- **The content line is 20 words**, far below the 100 words at which
  `content-word-count` fails. Google sets no minimum length, and a short
  contact page should not be capped.
- **An unrendered client-side app gets no content cap.** When an audit skips the
  render, an app shell that JavaScript fills in looks empty. Capping a page the
  audit could not read is the costly direction to be wrong in.

### Single page or crawl

A single-page audit is capped by its own page, with every cap.

A crawl is capped by its start page only, and only by the indexability caps. A
site-wide block, such as `noindex` shipped from staging or `Disallow: /`, always
reaches the start page. A page kept out of search on purpose, such as a login
or thank-you page, is almost never the start page, and capping a crawl on any
`noindex` page would mark down every site that has one. Content caps never cap
a crawl, because each page's title and content are already scored.

Crawls were not always capped. When caps applied to single pages only, a
five-page site with `noindex` on every page scored 20 as a single page but 92
as a crawl, and the same site behind `Disallow: /` crawled to 93.

### Staging sites

A staging site is kept out of search on purpose, so its indexability caps would
fail every audit. `--staging` waives them and keeps the content caps. A staging
crawl also ignores robots.txt, so a site behind `Disallow: /` can be crawled
past its first page. The waived caps are listed under the score as a launch
checklist (`waivedCaps` in JSON, `<waived-caps>` for `--format llm`). The audit
is recorded as a staging audit, and `compare` does not treat it as like-for-like
with a production audit.

## Checks that were not measured

Most rules pass when the thing they look for is absent. That is right for "no
mixed content" and wrong for "Core Web Vitals are good" when nothing was
measured. Older versions scored such gaps anyway: a missing Core Web Vitals
metric counted as a warning, and an orphan-page check that could never fail
counted as a pass. The first fix took these checks out of the score but still
counted them as warnings, which produced category rows that read "score 100,
13 warnings".

Since 3.6.0, a check that could not take a reading has its own status, **not
measured**, and says what it needs. It carries weight 0, so it moves neither
side of the average: you cannot score what you did not measure. The usual
reasons:

- **No render** (`--no-cwv`, or no browser found): Core Web Vitals and most
  JavaScript-rendering checks.
- **A single page**: checks that compare pages or need the link graph, such as
  title uniqueness, duplicate content, click depth, inbound links and sitemap
  orphans. They need `--crawl`.
- **No mobile render**: the mobile parity checks need `--mobile`.
- **No interaction**: INP needs a real one. `--simulate-interaction` clicks and
  scrolls during the render to give an indicative value, flagged as synthetic.
- **Nothing to grade**: no Content-Security-Policy to grade, no JSON-LD to
  validate, no robots.txt to read.

The trade-off: an audit that measured less can score higher, because the checks
it skipped can no longer fail. A single-page audit of example.com reported 54
checks as not measured and scored 86. The same audit with `--no-cwv` reported
76 and scored 87. That is why SEOmator records how each audit was measured.

## Comparing audits over time

Every audit is stored in a local SQLite database, `~/.seomator/audits.db` (or
under `$SEOMATOR_HOME` when it is set), unless you pass `--no-save`. Saving was
opt-in before 3.4.0, and a history that fills up only when someone remembers a
flag stays empty.

`seomator compare` diffs the latest audit of a site against the previous one,
or one you name: score movement, category changes, and which rules regressed,
improved, appeared or stopped being measured. With `--fail-on-regression` it
exits with `1` when the score dropped or a rule got worse, which makes it a CI
gate.

Two scores are only comparable if they were measured the same way. Each stored
audit records how it ran: Core Web Vitals on or off, mobile parity, simulated
interaction, category and rule filters, staging, and the scoring model. When
one of these differs, `compare` says the diff is not like-for-like, and
`--fail-on-regression` does not fail. A different page limit is reported but
does not count: it changes how much was covered, not whether a check could run.
The scoring model has a version number that changes whenever weights or the
score arithmetic change, so a scoring update is not read as your site getting
worse.

This is not hypothetical. The desktop app leaves Core Web Vitals off by default
and the CLI turns them on, and both write to the same history. A baseline from
one against a run from the other moved about 55 rules between measured and not
measured without the site changing.

## Trade-offs

### Lab data, not field data

SEOmator's Core Web Vitals are lab measurements: one page load in a headless
browser, from your machine and network, at the moment you run the audit. Real
visitors use other devices and networks, and only field data (Chrome's CrUX
report, or your own real-user monitoring) shows what they experience.

Lab numbers are good at showing what changed between two runs under the same
conditions. They still move from run to run: two audits of an unchanged
example.com, two minutes apart, timed the server's first byte as a pass and
then as a warning at 978 ms.

SEOmator has no field data and no data from search engines: no rankings, no
backlinks, no search demand. A high score means the page follows the rules it
was checked against, not that it ranks.

### One page or a crawl

A single-page audit, the default, is fast and gets every cap, but every
cross-page check is unmeasured.

`--crawl` follows internal links on the start URL's hostname, obeys robots.txt
(unless `--staging`), and stops at 10 pages unless you raise `-m`. Each
category score averages every rule result from every page, so a rule that fails
on 3 of 50 pages lowers the category in proportion instead of deciding it. Only
the start page can cap the score. A crawl is slower: with Core Web Vitals on,
every page is rendered.

A known gap: `seomator audit` ignores `max_pages`, `concurrency` and
`timeout_ms` in the `[crawler]` section of `seomator.toml`, because the
command's own flag defaults override them. Set them with `-m`, `--concurrency`
and `--timeout` instead. See [Configuration](./configuration.md).

You can also split the work. `seomator crawl` stores the pages without scoring
them, and `seomator analyze` runs the rules on a stored crawl later. robots.txt
is not stored with a crawl, so `analyze` caps a replayed crawl on `noindex`
only.

### Refusing to score

Most rules pass when what they check is absent, so a page with nothing on it
scores well. An empty response once scored 84, a JSON response 83, and a
mistyped URL that returned 404 a confident 87. A confident wrong score is worse
than an error, so these now stop the audit with exit code `2` and an error code
(`non-html`, `http-error`) that says what went wrong.

### A narrower audit

`-c` limits an audit to some categories, and the `[rules]` section of
`seomator.toml` can enable or disable individual rules. The overall score then
averages only what ran, so it is not comparable with a full audit. The CLI
prints a note when a rule filter is in force, and `compare` treats a change in
categories or rule filters as not like-for-like.

## Where SEOmator runs

- **Terminal and CI.** `seomator audit` prints the report from the
  [Quickstart](./quickstart.md). `--format json`, `html`, `markdown` and `llm`
  write the same result for programs, browsers, documents and AI assistants.
  The exit code carries the verdict: `seomator audit` exits with `0` at 70 or
  more, `1` below 70, `2` when the audit could not run, and `130` when you
  cancel it. `compare --fail-on-regression` exits with `1` on a regression.
- **Local dashboard.** `seomator serve` shows your stored audits in a browser
  at `127.0.0.1:7360`. See [Web dashboard](./WEB-DASHBOARD.md).
- **AI agents.** `--format llm` is a compact report written for language
  models, and the SEOmator skill teaches an agent to run audits and act on the
  results. See [AI Agent Integration](./ai-agent-integration.md).
- **Your own code.** The package exports the same `Auditor` the CLI uses.
- **Desktop app.** An Electron app built from the same repository wraps the
  same engine and the same interface as the dashboard. It is not part of the
  npm package. See [Desktop app](./ELECTRON-APP.md).

## Related

- [Quickstart](./quickstart.md)
- [SEO Audit Rules](./SEO-AUDIT-RULES.md)
- [Configuration](./configuration.md)
- [Technical Architecture](./technical-architecture.md)
- [Storage Architecture](./STORAGE-ARCHITECTURE.md)
- [Web dashboard](./WEB-DASHBOARD.md)
- [AI Agent Integration](./ai-agent-integration.md)
- [Desktop app](./ELECTRON-APP.md)
- [Documentation index](./README.md)
