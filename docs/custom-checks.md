# How to add your own checks

> **Type:** How-to

Test every audited page for something only your site cares about, and pull a
value out of every page, from `seomator.toml`. A `[[custom.search]]` passes or
fails each page on a piece of text, a regular expression or a CSS selector. A
`[[custom.extract]]` collects the text or an attribute of the elements a
selector matches. Both run beside the rules, appear in a "Custom checks"
section of every report, are stored with the audit, and **never change the
score**. A search can fail CI.

`seomator audit`, `seomator analyze` and `seomator mcp` read them. Audits
started from `seomator serve` or the desktop app do not read `seomator.toml`,
so they run no custom checks; both still show the custom results of audits
the CLI or MCP stored. The key reference is under
[Configuration: [custom]](./configuration.md#custom).

The output below comes from SEOmator 8.0.0 run against a small test site on
`127.0.0.1:8081`: a home page, an about page and two product pages. Both
product pages have a SKU; only `/products/widget` has a price, and
`/products/gadget` still names the old brand, "Acme Old Works". Long reports
are trimmed and file paths shortened; nothing else is changed.

## Prerequisites

- SEOmator 8.0: `seomator --version` prints `8.0.0`.
- A `seomator.toml` in the directory you run from, or a parent of it.
  `seomator init -y` writes one.

## Write a search

Each `[[custom.search]]` table is one check, run on every page in its scope.

| Key | Default | Valid values | Effect |
|---|---|---|---|
| `name` | required | Any non-empty string | Shown in reports and in the CI exit line. |
| `where` | `"text"` | `text`, `html`, `head`, `body`, `selector` | What is searched. `text` is the text of `<body>`; `html` the whole HTML document; `head` and `body` the HTML inside those elements; `selector` the elements `selector` matches. |
| `selector` | | A CSS selector | Required with `where = "selector"`, ignored otherwise. |
| `text` | | A string | What to find. Required unless `where = "selector"`. With `where = "selector"`, leaving it out tests that the selector matches at least one element; giving it searches the text of each matched element. |
| `match` | `"literal"` | `literal`, `regex` | `literal` finds `text` as an exact, case-sensitive substring. `regex` reads both `text` and `scope` as JavaScript regular expressions. |
| `expect` | `"present"` | `present`, `absent` | What a passing page shows. |
| `severity` | `"warn"` | `warn`, `fail` | How a failing page is shown. It does not decide whether CI fails. |
| `fail_ci` | `false` | `true`, `false` | Exit 1 when the search fails on any page, checks no page at all, or is stopped by the time limit on any page. |
| `scope` | every page | A string | Only pages whose URL path starts with this. With `match = "regex"`, a regular expression tested against the path. The path excludes the host and query string. |

Things to know before you write one:

- **The HTML as the server sent it.** Searches and extractions read the
  fetched HTML, never the rendered DOM, with or without `--render`. Text a
  script adds after load is not found.
- **Regular expressions take no flags** and are case-sensitive. Use a
  character class such as `[Aa]cme` for either case. Write them in TOML
  literal strings, between single quotes, so a backslash reaches the pattern
  unchanged: `text = '\d{3}-\d{4}'`.
- **Pages that failed to load are not checked.** A rate-limited or
  unreachable page in a crawl is left out of `checked`.

## Write an extraction

Each `[[custom.extract]]` table collects one value, or several, from every
page.

| Key | Default | Effect |
|---|---|---|
| `name` | required | Shown in reports. |
| `selector` | required | CSS selector. |
| `attribute` | `""` | Read this attribute of each match. Empty reads the element's text. |
| `multiple` | `false` | `true` reads every match on the page; `false` only the first. |

Each value has control characters removed and runs of whitespace collapsed to
one space. Empty values are dropped, and a page with no value is not listed.

## A worked example

1. Add the checks to `seomator.toml`:

   ```toml
   [[custom.search]]
   name = "Old brand name"
   text = "Acme Old"
   expect = "absent"
   severity = "fail"
   fail_ci = true

   [[custom.search]]
   name = "Products show a price"
   where = "selector"
   selector = "[itemprop=price]"
   scope = "/products/"
   severity = "fail"

   [[custom.search]]
   name = "Phone number in the footer"
   where = "selector"
   selector = "footer"
   text = '\d{3}-\d{4}'
   match = "regex"

   [[custom.extract]]
   name = "SKU"
   selector = "[itemprop=sku]"

   [[custom.extract]]
   name = "Price"
   selector = "[itemprop=price]"
   attribute = "content"

   [[custom.extract]]
   name = "Nav links"
   selector = "nav a"
   attribute = "href"
   multiple = true
   ```

2. Check the file. Every selector and regular expression is compiled here,
   so a typo fails now rather than passing every page later:

   ```
   $ seomator config validate
   Validating configuration...
   Config file: /path/to/seomator.toml

   ✓ Configuration is valid.
   ```

3. Run the audit. A crawl runs each search on every page it measured:

   ```bash
   seomator audit http://127.0.0.1:8081/ --crawl
   ```

The console report ends with a "CUSTOM CHECKS" section, and the failing
`fail_ci` search sets the exit code:

```
CUSTOM CHECKS (not scored)
  ✗ Old brand name: 1 of 4 pages fail (expected absent)
      → /products/gadget
  ✗ Products show a price: 1 of 2 pages fail (expected present)
      → /products/gadget
  ✓ Phone number in the footer: 4 pages pass (expected present)
  ⇢ SKU: values from 2 pages
      RK-2002
      SP-1001
  ⇢ Price: values from 1 page
      49.00
  ⇢ Nav links: values from 4 pages
      /, /products/widget, /products/gadget
      /, /products/widget, /products/gadget
      /, /products/widget, /products/gadget
...
Exit 1: custom search "Old brand name" failed on 1 page (fail_ci); score 89 passed fail-under 70
```

"Products show a price" checked 2 pages, because only two paths start with
`/products/`. It failed on one and did not stop the build: it has no
`fail_ci`. The overall score is 89 with or without these checks.

The markdown report lists the searches, the failing pages, and one row per
extracted value, so the table pastes into a spreadsheet (Nav links rows
trimmed):

```
$ seomator audit http://127.0.0.1:8081/ --crawl --format markdown -o report.md
```

```markdown
## Custom checks

From `[[custom.search]]` and `[[custom.extract]]` in seomator.toml. Not scored.

| Search | Result | Pages |
|--------|--------|-------|
| Old brand name | fail | 1 of 4 pages fail \(expected absent\) |
| Products show a price | fail | 1 of 2 pages fail \(expected present\) |
| Phone number in the footer | pass | 4 pages pass \(expected present\) |

**Old brand name** fails on:

- http://127\.0\.0\.1:8081/products/gadget

**Products show a price** fails on:

- http://127\.0\.0\.1:8081/products/gadget

| Extraction | Page | Value |
|------------|------|-------|
| SKU | http://127\.0\.0\.1:8081/products/gadget | RK\-2002 |
| SKU | http://127\.0\.0\.1:8081/products/widget | SP\-1001 |
| Price | http://127\.0\.0\.1:8081/products/widget | 49\.00 |
| Nav links | http://127\.0\.0\.1:8081/about | / |
| Nav links | http://127\.0\.0\.1:8081/about | /products/widget |
...
```

JSON carries the same results in `extras.custom`, and a failing `fail_ci`
search in `gate.failedCustomSearches`:

```
$ seomator audit http://127.0.0.1:8081/ --crawl --format json -o report.json
$ jq '.extras.custom.searches[0], .extras.custom.extractions[0], .gate.failedCustomSearches' report.json
{
  "name": "Old brand name",
  "expect": "absent",
  "severity": "fail",
  "failCi": true,
  "checked": 4,
  "failing": 1,
  "stopped": 0,
  "failingPages": [
    "http://127.0.0.1:8081/products/gadget"
  ],
  "stoppedPages": []
}
{
  "name": "SKU",
  "pages": [
    {
      "url": "http://127.0.0.1:8081/products/gadget",
      "values": [
        "RK-2002"
      ]
    },
    {
      "url": "http://127.0.0.1:8081/products/widget",
      "values": [
        "SP-1001"
      ]
    }
  ]
}
[
  {
    "name": "Old brand name",
    "failing": 1,
    "checked": 4,
    "stopped": 0
  }
]
```

## Gate CI on a search

`fail_ci = true` makes a search a CI gate, whatever its `severity`. The run
exits 1 when the search:

- fails on any page;
- checks no page, usually a `scope` that matches nothing. A gate that never
  looked must not pass;
- is stopped by the regular expression time limit on any page.

The `Exit 1:` line says which. Both of the last two, from one run:

```toml
[[custom.search]]
name = "Blog posts name an author"
where = "selector"
selector = "[rel=author]"
scope = "/blog/"
fail_ci = true

[[custom.search]]
name = "Body is only words"
text = '^\s*(\w+\s*)+$'
match = "regex"
expect = "absent"
fail_ci = true
```

```
$ seomator audit http://127.0.0.1:8081/ --crawl --format json -o r.json
Report saved to: r.json
Exit 1: custom search "Blog posts name an author" checked 0 pages (fail_ci); check its scope; custom search "Body is only words" was stopped by the regex time limit on 4 pages (fail_ci); score 89 passed fail-under 70
```

The second pattern backtracks without end on any text that is not only words
and spaces, so it is stopped on every page. The rest of the CI setup is in
[How to gate CI on an SEOmator audit](./ci-gates.md).

## Where the results go

| Surface | What it shows |
|---|---|
| Console | Each search with its result; the first 3 failing pages. Each extraction with the first 3 values of its first 3 pages. |
| Markdown | Every search, the failing pages, and one table row per extracted value. |
| HTML | A "Custom checks (not scored)" section: each search with up to 10 failing pages, and every extracted value. |
| LLM | `<custom-checks scored="false">`: each search, and for each extraction the first 20 pages with up to 5 values each, values cut at 200 characters. |
| JSON | `extras.custom`: every search with its counts, and every extracted value. `gate.failedCustomSearches` for failing `fail_ci` searches. |
| Stored audit | The search results with the audit; every extracted value in the `audit_custom_values` table, one row per value. See [Storage](./STORAGE-ARCHITECTURE.md). |
| Dashboard and desktop app | A "Custom checks" section at the end of the audit page, marked "From seomator.toml. Not scored.": each search with its failing pages behind a "Failing pages" toggle, and each extraction as a table of page and values, the first 50 pages. Export markdown or HTML for the rest. |

A stored audit read back through `seomator serve` keeps them all:

```
$ curl -s -H "X-SEOmator-Token: $TOKEN" http://127.0.0.1:7360/api/audits/<auditId> \
    | jq '.result.extras.custom | {searches: [.searches[] | {name, checked, failing}], extractions: [.extractions[] | {name, pages: (.pages|length)}]}'
{
  "searches": [
    { "name": "Old brand name", "checked": 4, "failing": 1 },
    { "name": "Products show a price", "checked": 2, "failing": 1 },
    { "name": "Phone number in the footer", "checked": 4, "failing": 0 }
  ],
  "extractions": [
    { "name": "SKU", "pages": 2 },
    { "name": "Price", "pages": 1 },
    { "name": "Nav links", "pages": 4 }
  ]
}
```

(Output reformatted onto one line per entry; the dashboard ran on another port
for this check.)

## Limits

- **Regular expression time limit: 50 ms** per page, for each `text` and
  `scope` pattern. A pattern that runs longer is stopped on that page and
  counted in `stopped`; the crawl carries on. `severity` does not apply to a
  stopped page: it neither passes nor fails.
- **Listed pages: 50 per search.** `failingPages` and `stoppedPages` keep the
  first 50; `checked`, `failing` and `stopped` count every page.
- **Extracted values are not capped** in JSON, markdown, HTML or storage. The
  console, LLM and dashboard views show a part, as the table above says.
- **No weight.** Custom checks never change a category score or the overall
  score.
- **Unknown keys are ignored.** `config validate` checks names, values,
  selectors and patterns, but a misspelt key passes it and is ignored. With
  `expcet = "absent"`, the search falls back to `expect = "present"`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Exit 2 with `custom.search[0] ("..."): selector "div[" is not valid CSS` | Fix the selector. The index counts `[[custom.search]]` tables from 0, in file order. |
| Exit 2 with `text is not a valid regular expression` | Fix the pattern. With `match = "regex"` the `scope` is a pattern too, and is checked the same way. |
| Exit 2 with `needs a name`, `needs text to search for` or `needs a selector` | Add the missing key. `text` is required unless `where = "selector"`. |
| A search reports `no page in scope` | `scope` matched no page path. It is a prefix of the path such as `/products/`, not a full URL. With `fail_ci` this exits 1. |
| A search passes or fails every page the wrong way | Check the spelling of `expect`: a misspelt key is ignored, and the default is `present`. Check that the text is in the HTML the server sends, not added by a script. |
| A backslash in a pattern does not match | Use a TOML literal string, `'\d+'`. In a double-quoted string, write `"\\d+"`. |
| `stopped by the time limit` | Rewrite the pattern without nested repetition such as `(\w+\s*)+`, or use `match = "literal"`. |
| The dashboard shows no Custom checks section | The audit was started from the dashboard or desktop app, which do not read `seomator.toml`. Run it with `seomator audit`. |

## Related

- [Configuration: [custom]](./configuration.md#custom): the key reference
- [How to gate CI on an SEOmator audit](./ci-gates.md): exit codes and the other gates
- [Use the local dashboard](./WEB-DASHBOARD.md): browsing stored audits
- [Storage](./STORAGE-ARCHITECTURE.md): where audits and extracted values are kept
