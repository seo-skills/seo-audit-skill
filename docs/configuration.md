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
  audit with exit code 2 and error code `config`. No other command accepts
  `--config`.
- Tables merge key by key. Any other value, a list included, replaces the
  earlier one whole: an `exclude` list in local settings replaces the list in
  `seomator.toml`.
- `.seomator/settings.json` and `[output] path` are relative to the current
  directory, not to the directory that holds `seomator.toml`.
- Only `seomator config validate` checks types and ranges. `audit`, `crawl` and
  `analyze` use whatever they read.
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
| `seomator audit` | `[project] name`, `[crawler]`, `[rules]`, `[output]`. A single-page audit uses only `user_agent` from `[crawler]`; the other `[crawler]` keys apply with `--crawl`. `max_pages`, `concurrency` and `timeout_ms` are replaced by flag values: see [Known gap](#known-gap-audit-replaces-three-crawler-keys). |
| `seomator crawl` | `[project] name` and every implemented `[crawler]` key. `-m` replaces `max_pages` only when you pass it. |
| `seomator analyze` | `[rules]` and `[output] save`. It takes the project name from the stored crawl, ignores `[output] format` and `path` (use `--json`), and fetches nothing, so `[crawler]` has no effect. |
| `seomator config` | All sources. |
| `seomator serve` and the desktop app | Nothing. Their audits take settings from the run form (10 pages and concurrency 3 by default) and run every rule. |
| `seomator report`, `compare`, `db`, `self doctor` | Nothing. `self doctor` reports only whether `seomator.toml` exists in the current directory. |

### Known gap: audit replaces three [crawler] keys

`seomator audit` passes its `-m`, `--concurrency` and `--timeout` values to the
config loader as overrides, and all three flags have defaults. The values of
`max_pages`, `concurrency` and `timeout_ms` in `seomator.toml` or a settings
file therefore never reach `audit`, whether or not you type the flags. Set them
on the command line:

| Key | `audit` uses when the flag is absent | Flag | Flag range |
|---|---|---|---|
| `crawler.max_pages` | `10` | `-m, --max-pages <n>` | 1 to 1000 |
| `crawler.concurrency` | `3` | `--concurrency <n>` | 1 to 20 |
| `crawler.timeout_ms` | `30000` | `--timeout <ms>` | 1000 to 120000 |

`seomator crawl` reads all three from the file. With this `seomator.toml`:

```toml
[crawler]
max_pages = 3
concurrency = 1
timeout_ms = 5000
```

```
$ seomator audit https://example.com --crawl --no-cwv --no-save --format json | jq '.run | {maxPages, concurrency, timeout}'
{
  "maxPages": 10,
  "concurrency": 3,
  "timeout": 30000
}
$ seomator crawl https://example.com
Starting crawl...
  URL: https://example.com
  Max pages: 3
```

A related display gap: the `Config:` line of the `audit` console banner shows
only a `--config` path. It reads `(none, using defaults)` even when a
`seomator.toml` was found and loaded. Run `seomator config path` to see which
file is in use.

## seomator.toml keys

"Valid values" are what `seomator config validate` enforces. A value outside
them is an error, which makes `config validate` exit 1. A warning leaves the
file valid. Defaults are the built-in defaults, which apply to every key you
leave out.

### [project]

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `name` | string | `""` | Any string | Project name stored with each audit and crawl. `seomator report` shows it, and `report --project <name>` filters on it. Empty is stored as `default`. |
| `domains` | list of strings | `[]` | Strings. Warning for an entry that does not look like a domain name. | Read by no command. A crawl follows links on the start URL's hostname only, whatever this lists. `config validate` does not warn that the key has no effect. |

### [crawler]

Except for `user_agent`, these keys apply to crawls only: `seomator crawl` and
`seomator audit --crawl`.

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `max_pages` | integer | `100` | 1 to 10000. Warning above 5000. | Most pages one crawl fetches. `audit` replaces it with `-m`. |
| `concurrency` | integer | `3` | 1 to 20. Warning above 10. | Pages a crawl fetches at the same time. `audit` replaces it with `--concurrency`. |
| `timeout_ms` | integer | `30000` | 1000 to 300000 | Timeout in milliseconds for each page request and browser render, and for the crawl's robots.txt request. `audit` replaces it with `--timeout`. |
| `delay_ms` | integer | `100` | 0 to 60000 | Minimum gap in milliseconds between the starts of any two page requests. |
| `per_host_delay_ms` | integer | `200` | 0 to 60000 | Minimum gap in milliseconds between the starts of two page requests to one host. A crawl stays on one host, so the larger of the two delays sets the pace: 200 ms by default. |
| `respect_robots` | boolean | `true` | `true`, `false` | When `true`, a crawl does not follow URLs that robots.txt disallows for the configured user agent. The start URL is always fetched. `audit --staging` crawls past robots.txt whatever this says. The robots.txt score cap does not depend on this key: the cap always reads Googlebot's rules. |
| `user_agent` | string | `""` | Any string | `User-Agent` header on every request: pages, browser renders, robots.txt, sitemaps and the requests some rules make. It also picks the robots.txt group a crawl obeys. Empty means `SEOmatorBot/3.0 (+https://github.com/seo-skills/seo-audit-skill)`. The `--mobile` render always sends a fixed Android Chrome user agent. |
| `include` | list of strings | `[]` | Strings | Path patterns a crawl may follow. Empty means every path. See [URL patterns](#url-patterns). |
| `exclude` | list of strings | `[]` | Strings | Path patterns a crawl never follows. |
| `drop_query_prefixes` | list of strings | `["utm_", "gclid", "fbclid", "mc_", "_ga"]` | Strings | Query parameters whose names start with one of these are removed from each URL a crawl queues. Ignored while `allow_query_params` is not empty. See [Query parameters](#query-parameters). |
| `allow_query_params` | list of strings | `[]` | Strings | When not empty, a crawl keeps only these query parameters and removes all others. |
| `per_host_concurrency` | integer | `2` | 1 to 5 | Not implemented. Concurrency is global. |
| `breadth_first` | boolean | `true` | `true`, `false` | Not implemented. The queue is always breadth-first. |
| `follow_redirects` | boolean | `true` | `true`, `false` | Not implemented. Redirects are always followed. |
| `max_prefix_budget` | number | `0.25` | 0 to 1 | Not implemented. No prefix budget is applied. |

The four "Not implemented" keys are parsed and validated, and no code reads
them. Their defaults describe what the crawler does anyway. `config validate`
warns about each one you change, with a message that begins
`<key> is not implemented and has no effect`.

### [rules]

Read by `audit` and `analyze`.

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

### [output]

Read by `audit`. `analyze` reads `save` only.

| Key | Type | Default | Valid values | Effect |
|---|---|---|---|---|
| `format` | string | `"console"` | `console`, `text`, `json`, `html`, `markdown`, `llm` | Report format when you pass neither `--format` nor `--json`. `text` means `console`. |
| `path` | string | `""` | Any string | File the report is written to, for every format except `console`. Missing directories are created, and a `... saved to: <path>` line goes to stderr. Empty means stdout. Ignored when you pass `--format` or `--json`: the report then goes to stdout unless you also pass `-o`. |
| `save` | boolean | `true` | `true`, `false` | Store each result in `$SEOMATOR_HOME/audits.db`, which `compare`, `report` and the dashboard read. `--no-save` always skips storing. The deprecated `--save` flag stores even when this is `false`. |

### [external_links]

Not implemented. No command reads these keys, and the link cache is never
opened. `config validate` warns about each key you change from its default.

| Key | Type | Default | Valid values |
|---|---|---|---|
| `enabled` | boolean | `true` | `true`, `false` |
| `cache_ttl_days` | number | `7` | 0 to 365 |
| `timeout_ms` | number | `10000` | 1000 to 60000 |
| `concurrency` | number | `5` | 1 to 20 |

The `links` rules inspect the links in each page's HTML and do not request
them. `enabled = false` does not stop the `crawl-pdf-size` rule, which sends a
`HEAD` request to up to eight linked PDFs per page, on any host.

### [rule_options]

Not implemented. A table of tables keyed by rule, for example
`[rule_options."some-rule"]`. Default: empty. A value that is not a table is an
error. No rule receives these options, and `config validate` warns when the
table is not empty. The `blog` preset writes one entry.

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
| `blog` | `[crawler]`: `max_pages = 500`, `exclude = ["/wp-admin/**", "/wp-content/uploads/**", "*.pdf"]`. `[rule_options."meta-tags/description-length"]`: `min_length = 120`, `max_length = 160`. |
| `ecommerce` | `[crawler]`: `max_pages = 1000`, `include = ["/products/**", "/categories/**", "/collections/**"]`, `exclude = ["/cart/**", "/checkout/**", "/account/**", "*.pdf"]`, `allow_query_params = ["category", "sort", "filter", "page"]`. |
| `ci` | `[crawler]`: `max_pages = 100`, `delay_ms = 0`, `respect_robots = false`. `[external_links]`: `enabled = false`, `cache_ttl_days = 7`, `timeout_ms = 10000`, `concurrency = 5`. `[output]`: `format = "json"`, `path = "reports/audit.json"`. |

Preset values with limited or no effect:

- `max_pages` in `blog`, `ecommerce` and `ci`: `audit` replaces it (see
  [Known gap](#known-gap-audit-replaces-three-crawler-keys)). `seomator crawl`
  uses it.
- `"*.pdf"` in `blog` and `ecommerce`: it matches no path, and a crawl never
  follows `.pdf` links anyway.
- `delay_ms = 0` in `ci`: `per_host_delay_ms` still spaces a crawl's requests
  200 ms apart. Add `per_host_delay_ms = 0` to remove the delay.
- `[rule_options]` in `blog` and `[external_links]` in `ci`: not implemented.
  `config validate` warns about both.

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
| `seomator config validate` | Checks the merged configuration against the valid values on this page, then prints errors and warnings. | 0 with no errors (warnings allowed), 1 with errors |
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

✗ Configuration has errors

✗ crawler.max_pages: crawler.max_pages must be between 1 and 10000
  Value: 20000
✗ output.format: output.format must be one of: console, text, json, html, markdown, llm
  Value: "pdf"

Warnings:
⚠ crawler.concurrency: crawler.concurrency is high (>10), may cause performance issues
⚠ project.domains[1]: project.domains[1] may not be a valid domain name
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
| `-m, --max-pages <n>` | `audit` | `crawler.max_pages` | Always applied. Default 10, range 1 to 1000. |
| `--concurrency <n>` | `audit` | `crawler.concurrency` | Always applied. Default 3, range 1 to 20. |
| `--timeout <ms>` | `audit` | `crawler.timeout_ms` | Always applied. Default 30000, range 1000 to 120000. |
| `-f, --format <type>` | `audit` | `output.format` | `console`, `json`, `html`, `markdown` or `llm`. Also cancels `output.path`. |
| `-j, --json` | `audit` | `output.format` | Deprecated form of `--format json`. Also cancels `output.path`. |
| `-o, --output <path>` | `audit` | `output.path` | |
| `--no-save` | `audit`, `analyze` | `output.save` | |
| `--config <path>` | `audit` | Which `seomator.toml` is read | |
| `--staging` | `audit` | `crawler.respect_robots` | A crawl ignores robots.txt. Also waives the noindex and robots.txt score caps. No config key sets it. |
| `-m, --max-pages <n>` | `crawl` | `crawler.max_pages` | Applied only when given. Range 1 to 1000. |

These exist only as flags, with no config key: `--crawl`, `-c, --categories`,
`--no-cwv`, `--mobile`, `--simulate-interaction`, `--json-report` and
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
$ seomator audit https://example.com --crawl -m 25 --no-cwv
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

- SEOmator installed: `seomator --version` prints `6.0.0`.
- A terminal open in your project's directory.

#### Steps

1. Pick a preset from [Presets](#presets).
2. Run `init` with `-y`. Without `-y`, `--preset` and `--name` are ignored.

   ```bash
   seomator init --preset ecommerce --name shop -y
   ```

3. Edit `seomator.toml` to suit the site. Leave out `max_pages` if you only run
   `seomator audit`: it uses `-m` instead.
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
| `seomator audit --crawl` stops at 10 pages although the file says more | Pass `-m`. See [Known gap](#known-gap-audit-replaces-three-crawler-keys). |

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
   seomator audit https://example.com --no-cwv
   ```

#### Verification

The audit prints `Note (<path>): a rule filter is in force, ...` on stderr, and
the skipped rules are missing from the report. With the `disable` list above:

```
$ seomator audit https://example.com --no-cwv --no-save --format json 2>/dev/null | grep -cE '"ruleId": "(cwv-|a11y-color-contrast)'
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
- Playwright's Chromium (`npx playwright install chromium`), unless you pass
  `--no-cwv`.

#### Steps

1. In the repository root, create the config file and commit it:

   ```bash
   seomator init --preset ci -y
   ```

   It sets `[output] format = "json"` and `path = "reports/audit.json"`.
2. In the CI job, run the audit:

   ```bash
   seomator audit https://example.com --no-cwv
   ```

   For a crawl, set the limits with flags, because `audit` ignores
   `max_pages`, `concurrency` and `timeout_ms` in the file:
   `seomator audit https://example.com --crawl -m 50 --concurrency 5 --no-cwv`.
3. Let the exit code decide the job: `0` for a score of 70 or more, `1` below
   70, `2` when the audit failed, `130` when it was cancelled.
4. Keep `reports/audit.json` as a build artifact. Add `--no-save` if the runner
   should not store audit history in `$SEOMATOR_HOME/audits.db`.

#### Verification

Stdout stays empty. The `Report saved to` line goes to stderr:

```
$ seomator audit https://example.com --no-cwv --no-save
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
| A crawl stops at 10 pages | Pass `-m`. `audit` does not read `max_pages`. |
| Exit code 2 with `"code": "playwright-missing"` | Run `npx playwright install chromium` on the runner, or pass `--no-cwv`. |
| Exit code 2 with `"code": "config"` | The path given to `--config` does not exist. |
| A staging site scores 20 | The site is kept out of search on purpose (noindex, or robots.txt blocks Googlebot). Audit it with `--staging`. |

## Related

- [Quickstart](./quickstart.md): run a first audit
- [Introduction](./introduction.md): what SEOmator checks
- [SEO Audit Rules](./SEO-AUDIT-RULES.md): all 373 rules and their IDs
- [AI Agent Integration](./ai-agent-integration.md): drive SEOmator from an agent
- [Storage Architecture](./STORAGE-ARCHITECTURE.md): the databases under `$SEOMATOR_HOME`
- [The local dashboard](./WEB-DASHBOARD.md): `seomator serve`
- [Technical Architecture](./technical-architecture.md): how the engine fits together
