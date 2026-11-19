# Configuration

> **Type:** Reference

SEOmator takes its settings from a `seomator.toml` file in your project, two
optional JSON settings files, and command-line flags. This page lists every
`seomator.toml` key with its type, default, valid values and effect, which
command reads which key, the `seomator init` and `seomator config` commands,
and the flags that override keys. Three task recipes follow at the end, under
[How-to guides](#how-to-guides).

## Sources and precedence

A command that reads configuration merges these sources in order. A later
source overrides an earlier one.

| Order | Source | Location | Written by |
|---|---|---|---|
| 1 | Built-in defaults | The code | - |
| 2 | Global settings | `$SEOMATOR_HOME/settings.json`, or `~/.seomator/settings.json` when `SEOMATOR_HOME` is not set | `seomator config <key> <value> --global` |
| 3 | Project file | The first `seomator.toml` found walking up from the current directory. The walk ends at your home directory, which is checked, or at the filesystem root, which is not. | `seomator init`, or by hand |
| 4 | Local settings | `.seomator/settings.json` in the current directory | `seomator config <key> <value>` |
| 5 | Flags | See [Flags that override keys](#flags-that-override-keys) | - |

- Only one `seomator.toml` is read. A file in a parent directory is not merged
  with one below it.
- `seomator audit --config <path>` reads the named file instead of searching.
  Global and local settings still apply. A path that does not exist stops the
  audit with exit code 2 and error code `config`. `analyze`, `mcp` and
  `config validate` accept `--config` too; no other command does.
- Tables merge key by key. Any other value, a list included, replaces the
  earlier one whole: an `exclude` list in local settings replaces the list in
  `seomator.toml`.
- `.seomator/settings.json` and `[output] path` are relative to the current
  directory, not to the directory that holds `seomator.toml`.
- `seomator config validate`, `audit`, `analyze` and `mcp` check types and
  ranges, and an error stops a run before its first request. `crawl` uses
  whatever it reads.
- Unknown keys are kept and ignored. `config validate` does not report them.
  `seomator config show` prints them, so a misspelt key appears next to the
  real one.
- A TOML syntax error stops every command that parses the file. `audit` prints
  `Error: Failed to parse <path>: ...` and exits 2 (error code `unknown`).
  `config`, `config show`, `config validate`, `crawl` and `analyze` print a Node
  stack trace and exit 1. `config path` does not parse the file and still works.

## Which commands read it

| Command | Reads |
|---|---|
| `seomator audit` | `[project] name`, `[crawler]`, `[rules]` (with `[rules.override]`), `[rule_options]`, `[external_links]`, `[custom]`, `[ci]`, `[output]`. A single-page audit uses `user_agent`, `timeout_ms`, `max_retry_after_ms` and `per_host_concurrency` from `[crawler]`; the other `[crawler]` keys apply with `--crawl`. `-m`, `--concurrency` and `--timeout` override `max_pages`, `concurrency` and `timeout_ms` only when typed: see [Flags and [crawler]](#flags-and-crawler). |
| `seomator crawl` | `[project] name`, and from `[crawler]`: `max_pages`, `concurrency`, `timeout_ms`, `delay_ms`, `per_host_delay_ms`, `per_host_concurrency`, `respect_crawl_delay`, `max_retry_after_ms`, `max_duration_s`, `respect_robots`, `user_agent`, `include`, `exclude`, `drop_query_prefixes` and `allow_query_params`. `-m` replaces `max_pages` only when you pass it. |
| `seomator analyze` | `[rules]` (with `[rules.override]`), `[rule_options]`, `[external_links]`, `[custom]`, `[ci] fail_under` and `[output] save`, from `--config <path>` or the `seomator.toml` the search finds. It takes the project name from the stored crawl and ignores `[output] format` and `path` (use `--json`). It fetches no pages, so `[crawler]` has no effect; external links are still checked. |
| `seomator mcp` | At the start of every run, from `--config <path>` or the `seomator.toml` the search finds from the server's working directory: `[rules]` (with `[rules.override]`, whose `priority` is applied to stored audits; `fail_ci` does nothing, as MCP has no exit code), `[rule_options]`, `[external_links]`, `[custom]`, `[output] save`, and from `[crawler]` every implemented key except `max_pages`, `concurrency` and `max_duration_s`. Those three come from the `audit_url` arguments instead: `maxPages` (default 10), a fixed concurrency of 3, and `maxDurationS` (default 3600). It does not read `[ci]` or `[output] format` and `path`. |
| `seomator config` | All sources. |
| `seomator serve` and the desktop app | Nothing. Their audits take settings from the run form (10 pages and concurrency 3 by default) and run every rule. |
| `seomator report`, `compare`, `db`, `explain`, `self doctor` | Nothing. `self doctor` reports only whether `seomator.toml` exists in the current directory. |

### Flags and [crawler]

`-m`, `--concurrency` and `--timeout` override `crawler.max_pages`,
`crawler.concurrency` and `crawler.timeout_ms` only when you type them. Without
the flag, `audit` uses the value from `seomator.toml` or a settings file, and
the built-in default (10 pages, concurrency 3, 30000 ms) when neither sets it.

The `Config:` line of the `audit` console banner names the `seomator.toml` in
use, whether it came from `--config` or the search.

## seomator.toml keys

"Valid values" are what `seomator config validate` enforces. A value outside
them is an error, which makes `config validate` exit 2 and stops `audit` and
`analyze` before they make a request (exit 2, error code `config`). A warning leaves the
file valid. Defaults are the built-in defaults, which apply to every key you
leave out.

### [project]

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `name` | string | `""` | Any string | Project name stored with each audit and crawl. `seomator report` shows it, and `report --project <name>` filters on it. Empty is stored as `default`. |
| `domains` | list of strings | `[]` | Strings. Warning for an entry that does not look like a domain name. | Read by no command. A crawl follows links on the start URL's hostname only, whatever this lists. `config validate` does not warn that the key has no effect. |

### [crawler]

Except for `user_agent`, `timeout_ms`, `max_retry_after_ms` and
`per_host_concurrency`, which every audit uses, these keys apply to crawls
only: `seomator crawl`, `seomator audit --crawl` and a `seomator mcp` crawl.
`mcp` takes `max_pages`, `concurrency` and `max_duration_s` from its own
arguments instead; see [Which commands read it](#which-commands-read-it).

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `max_pages` | integer | `10` | 1 to 10000. Warning above 5000. | Most pages one crawl fetches. A typed `-m` overrides it. |
| `concurrency` | integer | `3` | 1 to 20. Warning above 10. | Pages a crawl fetches at the same time. A typed `--concurrency` overrides it. |
| `timeout_ms` | integer | `30000` | 1000 to 300000 | Timeout in milliseconds for each page request and browser render, and for the crawl's robots.txt request. A typed `--timeout` overrides it. |
| `delay_ms` | integer | `100` | 0 to 60000 | Minimum gap in milliseconds between the starts of any two page requests. |
| `per_host_delay_ms` | integer | `200` | 0 to 60000 | Minimum gap in milliseconds between the starts of two page requests to one host. A crawl stays on one host, so the larger of the two delays sets the pace: 200 ms by default. |
| `respect_robots` | boolean | `true` | `true`, `false` | When `true`, a crawl does not follow URLs that robots.txt disallows for the configured user agent. The start URL is always fetched. `audit --staging` crawls past robots.txt whatever this says. The robots.txt score cap does not depend on this key: the cap always reads Googlebot's rules. |
| `user_agent` | string | `""` | Any string | `User-Agent` header on every request: pages, browser renders, robots.txt, sitemaps and the requests some rules make. It also picks the robots.txt group a crawl obeys: a group applies when its `User-agent` line is the start of a product token in the header (`SEOmator` matches `SEOmatorBot/3.0`; `bot` does not), the longest match wins, and `*` applies when none does. Empty means `SEOmatorBot/3.0 (+https://github.com/seo-skills/seo-audit-skill)`. The `--mobile` render always sends a fixed Android Chrome user agent. |
| `include` | list of strings | `[]` | Strings | Path patterns a crawl may follow. Empty means every path. See [URL patterns](#url-patterns). |
| `exclude` | list of strings | `[]` | Strings | Path patterns a crawl never follows. |
| `drop_query_prefixes` | list of strings | `["utm_", "gclid", "fbclid", "mc_", "_ga"]` | Strings | Query parameters whose names start with one of these are removed from each URL a crawl queues. Ignored while `allow_query_params` is not empty. See [Query parameters](#query-parameters). |
| `allow_query_params` | list of strings | `[]` | Strings | When not empty, a crawl keeps only these query parameters and removes all others. |
| `per_host_concurrency` | integer | `2` | 1 to 5 | Most page requests in flight to one host at the same time. A crawl stays on one host, so the smaller of this and `concurrency` is how many pages load at once: 2 by default. |
| `respect_crawl_delay` | boolean | `true` | `true`, `false` | When `true`, a crawl waits at least the `Crawl-delay` of the matching robots.txt group between requests to its host, capped at 10 s. `audit` prints how long the crawl may take before it starts. `--ignore-crawl-delay` turns it off for one run, and `--staging` always ignores it. |
| `max_retry_after_ms` | integer | `120000` | 0 to 600000 | Longest a crawl waits on one `Retry-After` from a 429 or 503 before it asks again. A longer `Retry-After` is cut to this. |
| `max_duration_s` | integer | `0` | 0 to 86400 | Stop requesting pages after this many seconds and score the pages fetched so far. The rest are reported as not fetched. `0` means no limit. A typed `--max-duration` overrides it. |
| `breadth_first` | boolean | `true` | `true`, `false` | Not implemented. The queue is always breadth-first. |
| `follow_redirects` | boolean | `true` | `true`, `false` | Not implemented. Redirects are always followed. |
| `max_prefix_budget` | number | `0.25` | 0 to 1 | Not implemented. No prefix budget is applied. |

The three "Not implemented" keys are parsed and validated, and no code reads
them. Their defaults describe what the crawler does anyway. `config validate`
warns about each one you change, with a message that begins
`<key> is not implemented and has no effect`.

#### Rate limits, Crawl-delay and coverage

A crawl slows down when a site asks it to, and reports what it could not
fetch instead of scoring it.

- **429 and 503.** The page is asked for again, up to 3 more times. Each wait
  is the response's `Retry-After` (seconds or an HTTP date, cut to
  `max_retry_after_ms`), or 5 s doubling with jitter when there is none. While
  a host is backing off, no other request goes to it, and every second backoff
  in a row doubles that host's delay for the rest of the run, up to 60 s.
- **A page that never clears** is recorded as rate-limited. It is not scored
  and no rule reports it as broken or missing; it counts against coverage
  instead. If it is the start page, the run stops with error code
  `rate-limited` and exit 2. A single-page `audit` retries the same way.
- **A host that keeps failing.** After 10 pages in a row end rate-limited or
  5xx, the crawl stops asking that host. Its queued pages are reported as not
  fetched.
- **Crawl-delay** sets a minimum gap between requests to the host, the larger
  of it and `per_host_delay_ms`. See `respect_crawl_delay` above.
- **Coverage.** Every report shows how many of the attempted pages were
  measured, for example `Measured 3 of 4 pages · 1 rate-limited`. A run that
  skipped pages ends `completed-with-gaps` in JSON (`completionState`). To fail
  CI on it, set `[ci] min_coverage` or pass `--min-coverage`.

### [rules]

Read by `audit`, `analyze` and `seomator mcp`.

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `enable` | list of strings | `["*"]` | Strings | Rule ID patterns to run. An empty list also means every rule. |
| `disable` | list of strings | `[]` | Strings | Rule ID patterns to skip. `disable` wins over `enable`. |

- A skipped rule is neither run nor reported.
- A category left with no rules is dropped from the result. The overall score
  is the weighted average of the categories that remain.
- Anything other than the defaults (an `enable` that is not `["*"]` or empty,
  or a `disable` that is not empty) is a filter. `audit` then prints this note
  on stderr, and `config validate` prints the same text as a warning:

  ```
  Note (/path/to/seomator.toml): a rule filter is in force, so this score is not comparable to an unfiltered audit. `compare` reports the difference rather than calling it a regression.
  ```

- The patterns are stored with each audit. `seomator compare` reports two
  audits run with different patterns as not like-for-like, and
  `--fail-on-regression` does not fail on such a pair.

Pattern syntax is under [Rule patterns](#rule-patterns).

### [rules.override]

Read by `audit`, `analyze` and `seomator mcp`. Re-ranks findings and gates CI
on them. **It never changes the score**: the score describes the site, not a
team's preferences about it. `seomator mcp` applies `priority` to the audits
it stores; it has no exit code, so `fail_ci` has no effect there.

```toml
[rules.override]
"core-description-present" = { priority = "low" }
"url-underscores"          = { priority = "ignore" }
"core-canonical-present"   = { fail_ci = true }
```

| Key | Type | Valid values | Effect |
|---|---|---|---|
| `priority` | string | `high`, `normal`, `low`, `ignore` | Moves the finding up (`high`) or down (`low`) the "what to fix first" order. `ignore` takes it out of every findings list and shows it in a collapsed "Ignored by config" section instead. JSON keeps the result, marked `"overridden": { "priority": "ignore" }`. |
| `fail_ci` | boolean | `true`, `false` | A `fail` from this rule on any page exits 1, whatever the score. A warning never does. |

- Every id must be a registered rule (`seomator explain --list`). An unknown
  id, an unknown key or a bad value stops `audit` and `analyze` with exit 2 and
  error code `config`, with a "Did you mean" suggestion; an MCP run fails with
  the same code. A typo must never turn a CI gate off.
- A `fail_ci` rule that `[rules] enable/disable` or `--categories` leaves out
  is the same error: its gate could never run.
- A `fail_ci` rule that ran but took no reading on any page (for example a
  browser-render check on a run without `--cwv`) exits 1, and the last line
  says why. A gate that could not be evaluated never passes silently.
- `priority = "ignore"` and `fail_ci = true` together hide the finding from
  reports and still gate CI.

### [ci]

Read by `audit` and `analyze`.

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `fail_under` | number | `70` | `0` to `100` | Exit 1 when the overall score is below this. `--fail-under` wins over it. `0` never fails on score. |
| `min_coverage` | number | `0` | `0` to `100` | With `audit --crawl`: exit 1 when fewer than this percentage of the attempted pages were measured. Pages that were rate-limited, failed or not fetched count against it. `--min-coverage` wins over it. `0` never fails on coverage. |

### [output]

Read by `audit`. `analyze` and `seomator mcp` read `save` only.

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `format` | string | `"console"` | `console`, `text`, `json`, `html`, `markdown`, `llm` | Report format when you pass neither `--format` nor `--json`. `text` means `console`. |
| `path` | string | `""` | Any string | File the report is written to, for every format except `console`. Missing directories are created, and a `... saved to: <path>` line goes to stderr. Empty means stdout. Ignored when you pass `--format` or `--json`: the report then goes to stdout unless you also pass `-o`. |
| `save` | boolean | `true` | `true`, `false` | Store each result in `$SEOMATOR_HOME/audits.db`, which `compare`, `report` and the dashboard read. `--no-save` always skips storing. The deprecated `--save` flag stores even when this is `false`. |

### [external_links]

Read by `audit`, `analyze` and `seomator mcp`. An audit checks every external
link once per run, however many pages carry it: a footer link on 500 pages is
one request. `links-external-valid` reads the answers.

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `enabled` | boolean | `true` | `true`, `false` | `false` requests no external link, and `links-external-valid` is reported as not measured. |
| `cache_ttl_days` | number | `7` | 0 to 365 | Days a settled answer is kept in the link cache (`$SEOMATOR_HOME/link-cache.db`) and reused by later runs. `0` keeps nothing. `audit --refresh` checks every link again and stores the fresh answers. |
| `timeout_ms` | number | `10000` | 1000 to 60000 | Per request. A link that does not answer in time could not be verified, and never counts as broken. |
| `concurrency` | number | `5` | 1 to 20 | External requests in flight at once. `crawler.per_host_concurrency` also limits requests to any one host. |

- **Broken** means the target is gone: 404, 410, another 5xx, or a domain that
  does not resolve. Only that warns.
- **Could not verify** means the server refused the check (401, 403, 429,
  999, other 4xx) or did not answer. It is listed and never changes the
  status.
- **Cached** are only `ok` answers and 404 or 410. A 5xx or a DNS failure can be
  a short outage, so it is remembered for the run only.
- **Budget.** A single-page audit checks every external link on the page within
  30 seconds. A crawl checks up to `max_urls` (2000) unique targets within
  `max_seconds` (300), most-linked first; both are `[rule_options]` of
  `links-external-valid`. Links past the budget are reported as not checked.
- Every report lists broken targets once each, with the pages that link to
  them. JSON carries the list in `extras.externalLinks`.

`enabled = false` does not stop the `crawl-pdf-size` rule, which sends a
`HEAD` request to up to eight linked PDFs per page, on any host.

### [rule_options]

Read by `audit`, `analyze` and `mcp`. Per-rule thresholds and lists, keyed by
rule id. Each rule declares the options it reads; `seomator explain <rule-id>`
lists them with their type, default and range, and prints a block to paste.

```toml
[rule_options."technical-soft-404"]
min_words = 800                       # an error-shaped title fails only below this
extra_title_phrases = ["Sorry, that page is gone"]

[rule_options."core-description-length"]
min_length = 100
max_length = 170
```

- A key the rule does not declare, a value of the wrong type and a number out
  of range are errors: `audit` and `analyze` stop with exit 2 and error code
  `config`, and the message lists the keys the rule does read.
- An entry for an unknown rule id is an error in `config validate` and a
  warning when a run starts: the run continues and says the entry is ignored,
  so a config written before options were read keeps working.
- Values that differ from a rule's defaults are stored with the audit.
  `seomator compare` reports two audits run with different options as not
  like-for-like.

### [custom]

Read by `audit`, `analyze` and `seomator mcp`. Your own checks, run on every
page beside the rules. They are reported in a "Custom checks" section of every
report and in JSON `extras.custom`, and they **never change the score**.

```toml
[[custom.search]]
name = "Old brand name"
where = "text"           # text | html | head | body | selector
text = "Acme Old"
expect = "absent"        # present | absent: what a passing page shows
severity = "fail"        # warn | fail: how a failing page is shown
fail_ci = true           # exit 1 when any page fails

[[custom.search]]
name = "Products show a price"
where = "selector"
selector = "[itemprop=price]"   # no text: the selector must match
scope = "/products/"            # only pages under this path

[[custom.extract]]
name = "SKU"
selector = "[itemprop=sku]"
attribute = ""           # empty: the element's text
multiple = false         # true: every match, not just the first
```

| Key | Default | Effect |
|---|---|---|
| `search[].name` | required | Shown in reports and in the CI exit line. |
| `search[].where` | `"text"` | `text` is the page's body text; `html` the whole HTML; `head` and `body` those elements' HTML; `selector` the elements `selector` matches. |
| `search[].selector` | | CSS selector, required with `where = "selector"`. |
| `search[].text` | | What to find. Required unless `where = "selector"`, where leaving it out tests that the selector matches; with it, the text is searched inside the matched elements. |
| `search[].match` | `"literal"` | `regex` reads `text` and `scope` as regular expressions. |
| `search[].expect` | `"present"` | What a passing page shows. |
| `search[].severity` | `"warn"` | How a failing page is shown. |
| `search[].fail_ci` | `false` | Exit 1 when any page fails, when no page was checked (a scope that matches nothing), or when the time limit stopped a regular expression on any page. The last line says which. |
| `search[].scope` | every page | A URL path prefix, or a regular expression with `match = "regex"`. |
| `extract[].name` | required | Shown in reports. |
| `extract[].selector` | required | CSS selector. |
| `extract[].attribute` | `""` | Read this attribute instead of the text. |
| `extract[].multiple` | `false` | Every match instead of the first. |

- Every selector and regular expression is checked before the run starts. A
  bad one is a `config` error (exit 2) that names the entry, for example
  `custom.search[1] ("Products show a price"): selector "div[" is not valid CSS`.
- A regular expression gets 50 ms per page. One that takes longer (a pattern
  that backtracks catastrophically) is stopped and counted as `stopped`, and
  the crawl carries on.
- Stored audits keep every extracted value; the markdown report lists them one
  row per value, so the table pastes into a spreadsheet.

## Pattern syntax

### URL patterns

`include` and `exclude` patterns are matched against the URL path only: no
scheme, host, query string or fragment. A pattern must match the whole path,
and a path always starts with `/`.

| Token | Matches |
|---|---|
| `*` | Any characters except `/` |
| `**` | Any characters, `/` included |
| `?` | Exactly one character |
| `/**` at the end | Also the path in front of it: `/admin/**` matches `/admin` |
| Any other character | Itself. `[`, `]` and `.` are literal. |

Results from the matcher:

| Pattern | Matches | Does not match |
|---|---|---|
| `/admin/**` | `/admin`, `/admin/users` | `/administrator` |
| `/blog/*` | `/blog/post` | `/blog`, `/blog/a/b` |
| `**/*.pdf` | `/doc.pdf`, `/files/doc.pdf` | |
| `*.pdf` | Nothing | `/doc.pdf`, because `*` cannot match the leading `/` |

- When `include` is not empty, a URL must match one of its patterns. A URL that
  matches any `exclude` pattern is dropped.
- The patterns filter the links a crawl discovers. The start URL is always
  fetched.
- A crawl never follows a link whose path ends in one of these extensions,
  whatever the patterns say: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`,
  `.pptx`, `.zip`, `.rar`, `.tar`, `.gz`, `.jpg`, `.jpeg`, `.png`, `.gif`,
  `.svg`, `.webp`, `.ico`, `.mp3`, `.mp4`, `.avi`, `.mov`, `.wmv`, `.css`,
  `.js`, `.json`, `.xml`.

### Query parameters

A crawl normalizes every URL before it queues and fetches it, the start URL
included:

1. The fragment (`#...`) is removed.
2. If `allow_query_params` is not empty, every parameter whose name is not in
   it is removed. Names must match exactly, case included, and
   `drop_query_prefixes` is not used.
3. Otherwise, every parameter whose name starts with an entry of
   `drop_query_prefixes` is removed, ignoring case. Entries are prefixes: `ref`
   also removes `referrer`.
4. The remaining parameters are sorted, so `?b=2&a=1` and `?a=1&b=2` are one
   page.

Results from the normalizer:

| Settings | URL found | URL crawled |
|---|---|---|
| Defaults | `https://example.com/p?_ga=1&mc_cid=2&gclid=3&fbclid=4&ref=5` | `https://example.com/p?ref=5` |
| Defaults | `https://example.com/p?b=2&a=1#top` | `https://example.com/p?a=1&b=2` |
| `drop_query_prefixes = ["ref"]` | `https://example.com/p?referrer=x&REF=y&id=1` | `https://example.com/p?id=1` |
| `allow_query_params = ["page"]` | `https://example.com/p?page=2&utm_source=a&sort=asc` | `https://example.com/p?page=2` |

### Rule patterns

`enable` and `disable` patterns are matched against whole rule IDs, case
included. `*` matches any run of characters, an empty one included, anywhere in
the pattern. Every other character is literal.

Rule IDs have the form `<category>-<name>`. The separator is `-`, not `/`. The
category is one of `core`, `technical`, `perf`, `links`, `images`, `security`,
`crawl`, `schema`, `a11y`, `content`, `social`, `eeat`, `url`, `mobile`,
`i18n`, `legal`, `js`, `redirect`, `htmlval`, `geo`. One exception: the five
Core Web Vitals rules in `perf` are `cwv-lcp`, `cwv-cls`, `cwv-inp`, `cwv-ttfb`
and `cwv-fcp`, so `perf-*` does not match them. To skip the whole category, use
`disable = ["perf-*", "cwv-*"]`.

| Pattern | Matches |
|---|---|
| `*` | Every rule |
| `security-*` | Every rule in `security` |
| `content-*-h1` | `content-duplicate-h1`, `content-title-same-as-h1` |
| `a11y-color-contrast` | That rule only |
| `CORE-*`, `meta-tags/*` | Nothing |

Rule IDs are listed in [SEO Audit Rules](./SEO-AUDIT-RULES.md) and appear as
`ruleId` in `--format json` output.

## Presets

`seomator init --preset <name> -y` writes one of these. Every preset also
writes `[project]` with `name` (the `--name` value or the directory name) and
`domains = []`.

| Preset | Keys written besides `[project]` |
|---|---|
| `default` | None |
| `blog` | `[crawler]`: `max_pages = 500`, `exclude = ["/wp-admin/**", "/wp-content/uploads/**", "*.pdf"]`. `[rule_options."core-description-length"]`: `min_length = 120`, `max_length = 160`. |
| `ecommerce` | `[crawler]`: `max_pages = 1000`, `include = ["/products/**", "/categories/**", "/collections/**"]`, `exclude = ["/cart/**", "/checkout/**", "/account/**", "*.pdf"]`, `allow_query_params = ["category", "sort", "filter", "page"]`. |
| `ci` | `[crawler]`: `max_pages = 100`, `delay_ms = 0`, `respect_robots = false`. `[external_links]`: `enabled = false`, `cache_ttl_days = 7`, `timeout_ms = 10000`, `concurrency = 5`. `[output]`: `format = "json"`, `path = "reports/audit.json"`. |

Preset values with limited or no effect:

- `"*.pdf"` in `blog` and `ecommerce`: it matches no path, and a crawl never
  follows `.pdf` links anyway.
- `delay_ms = 0` in `ci`: `per_host_delay_ms` still spaces a crawl's requests
  200 ms apart. Add `per_host_delay_ms = 0` to remove the delay.
- `[external_links] enabled = false` in `ci`: CI runs request no external
  link, so `links-external-valid` is reported as not measured. Remove the line
  to check external links in CI.

## seomator init

Creates `seomator.toml` in the current directory.

```
$ seomator init --help
Usage: seomator init [options]

Create seomator.toml config file

Options:
  --name <name>    Project name
  --preset <type>  Use preset (default, blog, ecommerce, ci)
  -y, --yes        Use defaults without prompts (default: false)
  -h, --help       display help for command
```

| Option | Default | Effect |
|---|---|---|
| `--name <name>` | Name of the current directory | Value of `[project] name`. Used only with `-y`. |
| `--preset <type>` | `default` | One of the [presets](#presets). Used only with `-y`. Any other value exits 1. |
| `-y, --yes` | Off | Skips the name and preset prompts. |

- Without `-y`, `init` prompts for a project name (default: the directory name)
  and a preset number (default: `1`, the `default` preset). It ignores `--name`
  and `--preset` in this mode, so pressing Enter twice after
  `seomator init --preset ci` writes the `default` preset.
- When `seomator.toml` exists, `init` asks `Overwrite? (n)`, with or without
  `-y`. Any answer other than `y` prints `Aborted.` and keeps the file.
- With answers piped on stdin, only the first prompt reads them and no file is
  written. Use `-y` in scripts.
- The file always goes in the current directory. `init` creates nothing else.
- Exit code 0 when the file is written or the overwrite is declined, 1 for an
  invalid option value.

In a directory named `my-site`:

```
$ seomator init -y

Created seomator.toml

Next steps:
  1. Edit seomator.toml to customize settings
  2. Run: seomator audit <url>

$ cat seomator.toml
[project]
name = "my-site"
domains = [ ]
```

`seomator init --preset ci -y` prints the same lines and writes:

```
$ cat seomator.toml
[crawler]
max_pages = 100
delay_ms = 0
respect_robots = false

[external_links]
enabled = false
cache_ttl_days = 7
timeout_ms = 10_000
concurrency = 5

[output]
format = "json"
path = "reports/audit.json"

[project]
name = "my-site"
domains = [ ]
```

The prompts:

```
$ seomator init --preset ci
Project name (my-site):
Select a preset:
  1. default - Standard configuration
  2. blog - Optimized for blog/content sites
  3. ecommerce - Optimized for e-commerce sites
  4. ci - Minimal config for CI/CD pipelines
Enter choice (1):
```

An unknown preset:

```
$ seomator init --preset shop -y
error: option '--preset <type>' argument 'shop' is invalid. Invalid preset: "shop". Valid: default, blog, ecommerce, ci
```

## seomator config

```
$ seomator config --help
Usage: seomator config [options] [key] [value]

View or modify configuration

Options:
  --global    Modify global settings (default: false)
  --local     Modify local settings (default: false)
  --list      Show all config values (default: false)
  -h, --help  display help for command
```

| Form | Effect | Exit code |
|---|---|---|
| `seomator config` or `seomator config --list` | Prints the `seomator.toml` in use, or `(using defaults)`, then the merged configuration as JSON. | 0 |
| `seomator config show` | Prints the four file-based sources in priority order, each with its path or `(not found)`, then the merged configuration as JSON. | 0 |
| `seomator config path` | Prints the global directory, the global settings file, the `seomator.toml` the search finds, and the local settings file, each with whether it exists. Parses nothing. | 0 |
| `seomator config validate [--config <path>] [--json]` | Runs the checks `audit` and `analyze` run before they start, rule ids in `[rules.override]` included, then prints errors and warnings to stderr. `--config` checks that file instead of searching for `seomator.toml`. `--json` prints `{ valid, configPath, errors, warnings }` to stdout. | 0 with no errors (warnings allowed), 2 with errors |
| `seomator config <key>` | Prints one merged value as JSON. `<key>` is a dotted path such as `crawler.max_pages`. | 0, or 1 with `Key not found: <key>` |
| `seomator config <key> <value>` | Writes the value to `.seomator/settings.json` in the current directory, or with `--global` to `$SEOMATOR_HOME/settings.json`. Never edits `seomator.toml`. | 0 |

- `<value>` is parsed as JSON when it parses: `50` is a number, `true` a
  boolean, `'["cwv-*"]'` a list. Anything else is stored as a string. Nothing
  is validated on write: `seomator config crawler.concurrency lots` succeeds,
  and `config validate` then fails with `crawler.concurrency must be a number`.
- A value written to local settings overrides `seomator.toml`. A value written
  with `--global` does not. See [Sources and precedence](#sources-and-precedence).
- `--local` changes nothing: local settings are already where values go.
  `--global` affects writes only.

```
$ seomator config crawler.max_pages
100
$ seomator config crawler.max_pages 50
Set crawler.max_pages = 50 (local)
$ cat .seomator/settings.json
{
  "crawler": {
    "max_pages": 50
  }
}
$ seomator config output.format markdown --global
Set output.format = "markdown" (global)
$ seomator config crawler.max_page
Key not found: crawler.max_page
```

`config validate` on a file with errors:

```toml
[project]
name = "my-site"
domains = ["example.com", "not a domain"]

[crawler]
max_pages = 20000
concurrency = 12

[output]
format = "pdf"
```

```
$ seomator config validate
Validating configuration...
Config file: /path/to/my-site/seomator.toml

✗ crawler.max_pages: crawler.max_pages must be between 1 and 10000
  Value: 20000
✗ output.format: output.format must be one of: console, text, json, html, markdown, llm
  Value: "pdf"
⚠ crawler.concurrency: crawler.concurrency is high (>10), may cause performance issues
  Value: 12
⚠ project.domains[1]: project.domains[1] may not be a valid domain name
  Value: "not a domain"

✗ Configuration has 2 errors
```

`config path`, with your own paths in place of the ones shown:

```
$ seomator config path
Configuration Paths
==================================================

Global directory:
  /Users/you/.seomator
  (exists)

Global settings:
  /Users/you/.seomator/settings.json
  (does not exist)

TOML config file:
  /path/to/shop/seomator.toml
  (exists)

Local settings:
  /path/to/shop/.seomator/settings.json
  (does not exist)
```

## Flags that override keys

| Flag | Command | Key | Notes |
|---|---|---|---|
| `-m, --max-pages <n>` | `audit` | `crawler.max_pages` | Applied only when typed. Range 1 to 1000. |
| `--concurrency <n>` | `audit` | `crawler.concurrency` | Applied only when typed. Range 1 to 20. |
| `--timeout <ms>` | `audit` | `crawler.timeout_ms` | Applied only when typed. Range 1000 to 120000. |
| `--fail-under <n>` | `audit`, `analyze` | `ci.fail_under` | Range 0 to 100. |
| `--min-coverage <pct>` | `audit` | `ci.min_coverage` | Range 0 to 100. Crawls only. |
| `--max-duration <s>` | `audit` | `crawler.max_duration_s` | Range 1 to 86400. Crawls only. |
| `--ignore-crawl-delay` | `audit` | `crawler.respect_crawl_delay` | Sets it to `false` for this run. |
| `-r, --refresh` | `audit` | `external_links.cache_ttl_days` | Ignores the link cache for this run and stores the fresh answers. |
| `-f, --format <type>` | `audit` | `output.format` | `console`, `json`, `html`, `markdown` or `llm`. Also cancels `output.path`. |
| `-j, --json` | `audit` | `output.format` | Deprecated form of `--format json`. Also cancels `output.path`. |
| `-o, --output <path>` | `audit` | `output.path` | |
| `--no-save` | `audit`, `analyze` | `output.save` | |
| `--config <path>` | `audit`, `analyze`, `mcp`, `config validate` | Which `seomator.toml` is read | |
| `--staging` | `audit` | `crawler.respect_robots` | A crawl ignores robots.txt. Also waives the noindex and robots.txt score caps. No config key sets it. |
| `-m, --max-pages <n>` | `crawl` | `crawler.max_pages` | Applied only when given. Range 1 to 1000. |

These exist only as flags, with no config key: `--crawl`, `-c, --categories`,
`--render` (or `--cwv`), `--mobile`, `--simulate-interaction`, `--json-report` and
`-v, --verbose` on `audit`. The `--output <path>` flag of `crawl` names the
directory the crawl is stored under. It is not `[output] path`.

## Examples

A `seomator.toml` that uses only keys `audit` acts on:

```toml
[project]
name = "shop"

[crawler]
delay_ms = 250
exclude = ["/cart/**", "/checkout/**", "/account/**"]
drop_query_prefixes = ["utm_", "gclid", "fbclid", "mc_", "_ga", "ref"]

[rules]
disable = ["cwv-*"]

[output]
format = "json"
path = "reports/audit.json"
```

```
$ seomator config validate
Validating configuration...

Config file: /path/to/shop/seomator.toml

✓ Configuration is valid (with warnings)

⚠ rules: a rule filter is in force, so this score is not comparable to an unfiltered audit. `compare` reports the difference rather than calling it a regression.
  Value: {"enable":["*"],"disable":["cwv-*"]}
$ seomator audit https://example.com --crawl -m 25
Note (/path/to/shop/seomator.toml): a rule filter is in force, so this score is not comparable to an unfiltered audit. `compare` reports the difference rather than calling it a regression.
Report saved to: reports/audit.json
$ jq '{url, overallScore, crawledPages}' reports/audit.json
{
  "url": "https://example.com",
  "overallScore": 88,
  "crawledPages": 1
}
```

Local settings override the file:

```
$ seomator config crawler.delay_ms 500
Set crawler.delay_ms = 500 (local)
$ seomator config crawler.delay_ms
500
$ seomator config show | head -9
Merged Configuration
==================================================

Sources (in priority order):
  1. Built-in defaults
  2. Global settings: (not found)
  3. TOML config: /path/to/shop/seomator.toml
  4. Local settings: /path/to/shop/.seomator/settings.json
```

---

## How-to guides

> **Type:** How-to

### How to create a config file from a preset

Write a `seomator.toml` for your project from one of the four presets.

#### Prerequisites

- SEOmator installed: `seomator --version` prints `8.0.1`.
- A terminal open in your project's directory.

#### Steps

1. Pick a preset from [Presets](#presets).
2. Run `init` with `-y`. Without `-y`, `--preset` and `--name` are ignored.

   ```bash
   seomator init --preset ecommerce --name shop -y
   ```

3. Edit `seomator.toml` to suit the site. A typed `-m` on `seomator audit`
   overrides `max_pages`.
4. Check the file:

   ```bash
   seomator config validate
   ```

#### Verification

For `ecommerce`, `config validate` prints `✓ Configuration is valid.` (for
`blog` and `ci` it adds warnings about keys that are not implemented).
`config show` lists the file as source 3, and the preset's values come back
from `config`:

```
$ seomator config show | head -9
Merged Configuration
==================================================

Sources (in priority order):
  1. Built-in defaults
  2. Global settings: (not found)
  3. TOML config: /path/to/shop/seomator.toml
  4. Local settings: (not found)

$ seomator config crawler.include
[
  "/products/**",
  "/categories/**",
  "/collections/**"
]
```

#### Troubleshooting

| Symptom | Fix |
|---|---|
| The file has only `[project]`, and `name` is the directory name | You ran `init` without `-y`. Run it again with `-y` and answer `y` to `Overwrite? (n)`. |
| `Overwrite? (n)` appears, then `Aborted.` | `seomator.toml` already exists. Answer `y`, or delete the file first. |
| `error: option '--preset <type>' argument '...' is invalid` | Use `default`, `blog`, `ecommerce` or `ci`. |
| `seomator audit --crawl` stops at 10 pages although the file says more | Check `seomator config path`: the file you edited may not be the one in use. A typed `-m` also wins over the file. |

### How to run only some rules

Make `seomator audit` and `seomator analyze` skip the rules you name, or run
only those rules.

#### Prerequisites

- A `seomator.toml`. `seomator init -y` creates one.
- The rule IDs you want, from [SEO Audit Rules](./SEO-AUDIT-RULES.md) or the
  `ruleId` fields of `--format json` output.

#### Steps

1. Add a `[rules]` section to `seomator.toml`. To skip rules, list them in
   `disable`:

   ```toml
   [rules]
   disable = ["cwv-*", "a11y-color-contrast"]
   ```

   To run only some rules, list them in `enable` instead:

   ```toml
   [rules]
   enable = ["security-*"]
   ```

2. Check the file. The `rules: a rule filter is in force` warning is expected.

   ```bash
   seomator config validate
   ```

3. Run the audit:

   ```bash
   seomator audit https://example.com
   ```

#### Verification

The audit prints `Note (<path>): a rule filter is in force, ...` on stderr, and
the skipped rules are missing from the report. With the `disable` list above:

```
$ seomator audit https://example.com --no-save --format json 2>/dev/null | grep -cE '"ruleId": "(cwv-|a11y-color-contrast)'
0
```

Without the `[rules]` section, the same command prints `6`. With
`enable = ["security-*"]`, `security` is the only category in the result.

#### Troubleshooting

| Symptom | Fix |
|---|---|
| `disable = ["perf-*"]` still reports `cwv-lcp` and the other Core Web Vitals | Their IDs start with `cwv-`. Add `"cwv-*"`. |
| A pattern matches nothing | Patterns match the whole ID, case included, and the separator is `-`. Start from a category ID such as `core` or `a11y`: `meta-tags/*` and `CORE-*` match nothing. |
| A category is missing from the report | Every rule in it was filtered out. Categories with no rules are dropped, and the overall score is averaged over the rest. |
| `compare` says the audits are not like-for-like | The two audits ran with different filters. Compare audits made with the same `[rules]`. |
| Audits started from `seomator serve` ignore the filter | The dashboard and the desktop app do not read `seomator.toml`. |

### How to write a JSON report in CI

Make every `seomator audit` in a pipeline write its report to
`reports/audit.json` and set the job's exit code from the score.

#### Prerequisites

- Node.js and SEOmator on the runner.
- Playwright's Chromium (`npx playwright install chromium`), if you pass
  `--cwv`.

#### Steps

1. In the repository root, create the config file and commit it:

   ```bash
   seomator init --preset ci -y
   ```

   It sets `[output] format = "json"` and `path = "reports/audit.json"`.
2. In the CI job, run the audit:

   ```bash
   seomator audit https://example.com
   ```

   For a crawl, add `--crawl`. `audit` takes `max_pages`, `concurrency` and
   `timeout_ms` from the file (the `ci` preset sets `max_pages = 100`), and a
   typed `-m`, `--concurrency` or `--timeout` overrides them:
   `seomator audit https://example.com --crawl -m 50 --concurrency 5`.
3. Let the exit code decide the job: `0` when every gate passed, `1` when one
   failed (a score below `[ci] fail_under` or `--fail-under`, default 70, or a
   `fail_ci` rule), `2` when the audit could not run (bad flag, invalid config,
   unreachable site), `130` when it was cancelled. Treat `1` as a finding and
   `2` as a broken job: the last stderr line of a `1` says which gate failed.
4. Keep `reports/audit.json` as a build artifact. Add `--no-save` if the runner
   should not store audit history in `$SEOMATOR_HOME/audits.db`.

#### Verification

Stdout stays empty. The `Report saved to` line goes to stderr:

```
$ seomator audit https://example.com --no-save
Report saved to: reports/audit.json
$ echo $?
0
$ jq '{url, overallScore}' reports/audit.json
{
  "url": "https://example.com",
  "overallScore": 88
}
```

#### Troubleshooting

| Symptom | Fix |
|---|---|
| Exit code 2, no file, JSON on stdout | The audit failed. Stdout carries `{ "error": true, "code", "message", "hint" }`, for example `"code": "dns"` for a host that does not resolve. Follow the `hint`. |
| The report went to stdout instead of the file | `--format` or `--json` on the command line cancels `[output] path`. Add `-o reports/audit.json`, or drop the flag. |
| A crawl stops at 10 pages | The `seomator.toml` in use sets no `max_pages` (check `seomator config path`), or a typed `-m` lowered it. |
| Exit code 2 with `"code": "playwright-missing"` | Run `npx playwright install chromium` on the runner, or audit without `--cwv`. |
| Exit code 2 with `"code": "config"` | The path given to `--config` does not exist, or `seomator.toml` has an error. `seomator config validate` names every problem. |
| A staging site scores 20 | The site is kept out of search on purpose (noindex, or robots.txt blocks Googlebot). Audit it with `--staging`. |

## Related

- [Quickstart](./quickstart.md): run a first audit
- [Introduction](./introduction.md): what SEOmator checks
- [SEO Audit Rules](./SEO-AUDIT-RULES.md): all 398 rules and their IDs
- [AI Agent Integration](./ai-agent-integration.md): drive SEOmator from an agent
- [Storage Architecture](./STORAGE-ARCHITECTURE.md): the databases under `$SEOMATOR_HOME`
- [The local dashboard](./WEB-DASHBOARD.md): `seomator serve`
- [Technical Architecture](./technical-architecture.md): how the engine fits together
