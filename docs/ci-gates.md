# How to gate CI on an SEOmator audit

> **Type:** How-to

Make a CI job fail when a site gets worse in a way you care about, pass
otherwise, and tell "the site has a problem" apart from "the audit could not
run". This page covers the score gate, per-rule gates, the coverage gate for
crawls, checking the config before the audit, and a GitHub Actions job that
puts them together. Every key it uses is listed in
[Configuration](./configuration.md).

The output below comes from SEOmator 8.0.0 run against a small test site on
`127.0.0.1:8080`: four pages, one of them (`/products/gadget`) without a
canonical link, plus `/busy`, which always answers 429. Long reports are
trimmed and file paths shortened; nothing else is changed.

## What the exit code means

| Code | Meaning | Treat it as |
|---|---|---|
| `0` | Every gate passed. | Pass. |
| `1` | A gate failed: the score is below `fail_under`, a `fail_ci` rule failed or could not be measured, a `fail_ci` custom search failed or could not run, or a crawl measured too few pages. | A finding about the site. |
| `2` | The run could not happen: a bad flag, an invalid config, a site that does not answer (single page or crawl alike), a start page that stays rate-limited. | A broken job. |
| `130` | The run was cancelled (Ctrl-C, or SIGTERM from the runner). | Cancelled. |

On exit 1 the last line on stderr starts with `Exit 1:` and names every
reason, including the score when the score was not one of them:

```
Exit 1: core-canonical-present failed (fail_ci); score 89 passed fail-under 80
```

On exit 2 nothing is scored. With `--format json` or `--format llm`, stdout
carries the error document, for example `{ "error": true, "code": "unreachable", ... }`,
and no report file is written even with `-o`. Without them, the error goes to
stderr.

## Prerequisites

- SEOmator 8.0 on the runner: `seomator --version` prints `8.0.0`.
- A URL the runner can reach: a staging or preview deploy, or the live site.
- Optional: a `seomator.toml` in the repository root.
  `seomator init --preset ci -y` writes one that sends a JSON report to
  `reports/audit.json`, with the `[ci]` and `[rules.override]` examples below
  commented out.

## Gate on the score

1. Pick a threshold. The default is 70. Pass it as a flag, or set it in
   `seomator.toml`; the flag wins over the key.

   ```toml
   [ci]
   fail_under = 80
   ```

   ```bash
   seomator audit https://staging.example.com --fail-under 80
   ```

2. Run the audit and read the exit code.

```
$ seomator audit http://127.0.0.1:8080/ --no-save --fail-under 95
...
Health Score: 89/100 (B)
...
252 passed • 28 warnings • 18 failed • 98 not measured
Exit 1: score 89 is below fail-under 95
$ echo $?
1
```

- `fail_under = 0` (or `--fail-under 0`) never fails on the score. The other
  gates still apply.
- The score is capped while a page cannot rank: `noindex` or a robots.txt
  block caps it at 20, an empty page at 30, fewer than 20 words of main content
  at 49, no `<title>` at 69. A staging site that blocks search engines on
  purpose scores 20 and fails the score gate; audit it with `--staging`, which
  waives the noindex and robots.txt caps.
- `seomator analyze` reads `[ci] fail_under` and `--fail-under` too, with the
  same exit codes.

## Gate on rules that must never fail

A score gate lets one broken page through if the rest of the site is good. A
`fail_ci` rule does not: a `fail` from that rule on any page exits 1, whatever
the score.

1. Find the rule id. `seomator explain` prints the lines to paste:

   ```
   $ seomator explain core-canonical-present
   core-canonical-present: Canonical URL Present
   Category: Core (core, 11% of the score)
   Weight: 10 within the category
   ...
   Configure it in seomator.toml:
   [rules.override]
   "core-canonical-present" = { priority = "low" }    # high | normal | low | ignore
   # "core-canonical-present" = { fail_ci = true }  # exit 1 when it fails, at any score
   ```

   `seomator explain --list` prints every id, and `seomator explain --list core`
   the ids in one category.

2. Add the rule to `[rules.override]`:

   ```toml
   [ci]
   fail_under = 80

   [rules.override]
   "core-canonical-present" = { fail_ci = true }
   ```

3. Run the audit. The page without a canonical stops the build although the
   score passes:

```
$ seomator audit http://127.0.0.1:8080/products/gadget --no-save
...
Core (2 errors, 2 warnings, 4 not measured)
  core-canonical-present Canonical URL Present (error)
    ✗ core-canonical-present: No <link rel="canonical"> tag found in the document
      → /products/gadget
...
Exit 1: core-canonical-present failed (fail_ci); score 89 passed fail-under 80
```

What counts:

- Only `fail` trips the gate. A `warn` from the same rule never does.
- Every page counts. In a crawl, a rule that fails on one page of fifty has
  failed, and the exit line says on how many pages.
- A page where the rule had nothing to look at (for example, a page with no
  canonical, for `core-canonical-fragment`) does not count against the gate.
- A gated rule that could not take a reading exits 1. A gate that cannot run
  must not pass silently. The commonest case is a check that needs a browser
  render on a run without `--render`:

  ```
  $ seomator audit http://127.0.0.1:8080/ --no-save --format json -o r.json
  Report saved to: r.json
  Exit 1: fail_ci rule cwv-lcp was not measured (Needs a browser render: rerun with --render); fix what stopped it or drop fail_ci; score 89 passed fail-under 70
  ```

  Add `--render` (and install the browser, see [the example job](#example-github-actions)),
  or drop `fail_ci` for that rule. A check that compares pages (duplicates,
  orphans, canonical chains, inbound links) needs `--crawl` the same way;
  gated on a single-page run, it exits 1:

  ```
  Exit 1: fail_ci rule content-duplicate-exact was not measured (Duplicate content detection needs other pages to compare against - run with --crawl); fix what stopped it or drop fail_ci; score 88 passed fail-under 70
  ```

- A gated rule that the run would never execute is a config error, reported
  before the first request with exit 2. That covers a rule removed by
  `[rules] enable` or `disable`, and one whose category `--categories` leaves
  out:

  ```
  $ seomator audit http://127.0.0.1:8080/ --no-save -c core
  Error: Invalid configuration (/path/to/seomator.toml): fail_ci rule cwv-lcp is in category "perf", which --categories leaves out, so its gate can never run
    Run `seomator config validate` to check the config without auditing.
  $ echo $?
  2
  ```

- `seomator analyze` applies `fail_ci` the same way. `seomator mcp` has no
  exit code, so `fail_ci` does nothing there.

## Re-rank findings without changing the score

`priority` in the same table moves a finding in the "what to fix first" order.
It never changes a status, a score or a weight.

| `priority` | Effect |
|---|---|
| `high` | Ranks the finding higher (its priority is multiplied by 4). |
| `normal` | No change. |
| `low` | Ranks it lower (multiplied by 0.25). |
| `ignore` | Takes it out of every findings list. Reports name it once in a collapsed "Ignored by config" line, and JSON keeps the result. |

```toml
[rules.override]
"core-canonical-present" = { fail_ci = true }
"social-og-image"        = { priority = "ignore" }
"security-hsts"          = { priority = "low" }
```

The console marks the re-ranked finding and lists the ignored one at the end:

```
  security-hsts HSTS Header (warning) [priority: low · seomator.toml]
    ⚠ security-hsts: HSTS only applies to HTTPS URLs; site is currently served over HTTP
...
Ignored by config (1): social-og-image
```

JSON marks every overridden result:

```
$ jq '[.categoryResults[].results[] | select(.overridden) | {ruleId, status, overridden}]' reports/seo.json
[
  { "ruleId": "core-canonical-present", "status": "fail", "overridden": { "failCi": true } },
  { "ruleId": "security-hsts", "status": "warn", "overridden": { "priority": "low" } },
  { "ruleId": "social-og-image", "status": "fail", "overridden": { "priority": "ignore" } }
]
```

(Output reformatted onto one line per result.) The page scored 89 with this
table and 89 without it. `priority = "ignore"` together with `fail_ci = true`
hides a finding from reports and still gates CI on it.

## Gate a crawl on coverage

A crawl reports how many of the pages it attempted it could measure. Pages
that stayed rate-limited, failed to load, or were left unfetched by
`--max-duration` count against it. Without a gate, a crawl that measured less
than 90% says so on stderr and exits 0:

```
$ seomator audit http://127.0.0.1:8080/ --crawl --no-save --format json -o c.json
127.0.0.1:8080 rate-limited 1 page. Space requests out with crawler.per_host_delay_ms = 1000, or lower --concurrency.
Measured 4 of 5 pages (80%). Set --min-coverage to make CI fail on this.
Report saved to: c.json
$ echo $?
0
```

To fail the job instead, set a minimum percentage. The flag wins over the key:

```toml
[ci]
min_coverage = 90
```

```
$ seomator audit http://127.0.0.1:8080/ --crawl --no-save --min-coverage 90
...
Health Score: 89/100 (B)
  Measured 4 of 5 pages · 1 rate-limited
...
127.0.0.1:8080 rate-limited 1 page. Space requests out with crawler.per_host_delay_ms = 1000, or lower --concurrency.
Exit 1: measured 4 of 5 pages; min-coverage 90; score 89 passed fail-under 70
```

- The percentage is rounded down: 4 of 5 is 80.
- A single-page audit has no coverage, so `min_coverage` and `--min-coverage`
  do nothing there. `analyze` does not read `min_coverage`.
- `0`, the default, turns the gate off.
- JSON says the same in `coverage` and `completionState`:

  ```
  $ jq '{completionState, coverage: (.coverage | {attempted, measured, rateLimited, failed, notFetched})}' c.json
  {
    "completionState": "completed-with-gaps",
    "coverage": {
      "attempted": 5,
      "measured": 4,
      "rateLimited": 1,
      "failed": 0,
      "notFetched": 0
    }
  }
  ```

## Check the config before the audit

`audit` and `analyze` check `seomator.toml` before the first request and stop
with exit 2 on any error. Running `seomator config validate` as its own step
makes a config mistake fail fast and read as a config problem in the job log.
It exits 0 when the file is valid (warnings allowed) and 2 when it has errors,
and prints to stderr:

```toml
[ci]
fail_under = 80

[rules.override]
"core-canonical-presnt" = { fail_ci = true }
"url-underscores"       = { priority = "hide" }
```

```
$ seomator config validate
Validating configuration...
Config file: /path/to/seomator.toml

✗ rules.override."core-canonical-presnt": unknown rule id "core-canonical-presnt". Did you mean "core-canonical-present"? Run `seomator explain --list` for every id.
✗ rules.override."url-underscores".priority: priority must be one of: high, normal, low, ignore
  Value: "hide"

✗ Configuration has 2 errors
$ echo $?
2
```

An audit with the same file stops the same way, before it requests anything:

```
$ seomator audit http://127.0.0.1:8080/ --no-save

Error: Invalid configuration (/path/to/seomator.toml): rules.override."core-canonical-presnt": unknown rule id "core-canonical-presnt". Did you mean "core-canonical-present"? Run `seomator explain --list` for every id. (and 1 more)
  - rules.override."url-underscores".priority: priority must be one of: high, normal, low, ignore
Run `seomator config validate` to check the config without auditing.

$ echo $?
2
```

- `--config <path>` checks a file other than the `seomator.toml` the search
  finds.
- `--json` prints `{ valid, configPath, errors, warnings }` to stdout for a
  script to read. Each error has a `path` and a `message`, and a `value` when
  one was given.
- `config validate` is stricter than a run in one place: a `[rule_options]`
  entry for an unknown rule id is an error there, and only a warning when a
  run starts.
- A misspelt key inside a `[rules.override]` entry is an error
  (`unknown override key "failci". Did you mean "fail_ci"?`). A misspelt key
  anywhere else is kept and ignored without a word: `fail-under = 95` under
  `[ci]` passes `config validate` and leaves the gate at 70.
  `seomator config ci` prints the values in force:

  ```
  $ seomator config ci
  {
    "fail_under": 70,
    "min_coverage": 0,
    "fail-under": 95
  }
  ```

## Read the verdict from JSON

The other formats leave the verdict to the exit code and the `Exit 1:` line.
JSON also carries it, in the `gate` object:

```
$ jq .gate reports/seo.json
{
  "failUnder": 80,
  "score": 89,
  "failedCiRules": [
    {
      "ruleId": "core-canonical-present",
      "pages": [
        "http://127.0.0.1:8080/products/gadget"
      ]
    }
  ],
  "unevaluated": [],
  "exitCode": 1,
  "reason": "core-canonical-present failed (fail_ci); score 89 passed fail-under 80"
}
```

| Field | Present | Meaning |
|---|---|---|
| `failUnder`, `score` | Always | The threshold in force and the overall score. |
| `failedCiRules` | Always | `fail_ci` rules that failed, each with the pages it failed on. |
| `unevaluated` | Always | `fail_ci` rules that could not be measured, each with the reason. |
| `coverage` | With a coverage gate on a crawl | `minCoverage`, `measured`, `attempted`, `percent`, `passed`. |
| `failedCustomSearches` | When a `fail_ci` custom search failed | `name`, `failing`, `checked`, `stopped` for each. See [Custom checks](./custom-checks.md). |
| `exitCode` | Always | `0` or `1`. |
| `reason` | Exit 1 only | The same text as the `Exit 1:` line. |

## Example: GitHub Actions

This job checks the config, crawls the site, fails on any gate, and keeps the
report whether the job passed or not. Put a `seomator.toml` with your gates in
the repository root:

```toml
[ci]
fail_under = 80
min_coverage = 90

[rules.override]
"core-canonical-present" = { fail_ci = true }
"social-og-image"        = { priority = "ignore" }
```

and the workflow in `.github/workflows/seo.yml`:

```yaml
name: SEO gate

on:
  pull_request:
  workflow_dispatch:

jobs:
  seo:
    runs-on: ubuntu-latest
    env:
      SITE_URL: https://staging.example.com
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install SEOmator
        run: npm install -g @seomator/seo-audit@8

      - name: Check seomator.toml
        run: seomator config validate

      - name: Audit
        run: |
          set +e
          seomator audit "$SITE_URL" --crawl -m 50 --no-save --format json -o reports/seo.json
          code=$?
          if [ "$code" -eq 1 ]; then echo "::error::$(jq -r .gate.reason reports/seo.json)"; fi
          if [ "$code" -eq 2 ]; then echo "::error::SEOmator could not run the audit (exit 2)"; fi
          exit "$code"

      - name: Keep the report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: seo-report
          path: reports/seo.json
```

- SEOmator needs Node.js 20.18.1 or later.
- GitHub runs `run:` steps with `bash -eo pipefail`, so `set +e` keeps the
  step alive long enough to turn the exit code into an annotation. The step
  still exits with SEOmator's code.
- `--no-save` keeps the runner from writing audit history. Drop it, and set
  `SEOMATOR_HOME` to a cached directory, if you want `seomator compare` across
  runs.
- To gate on a rule that needs a browser render, add `--render` to the audit
  and a step before it that runs `npx playwright install chromium`.
- A site that blocks search engines on purpose needs `--staging`.

Run under `bash --noprofile --norc -eo pipefail` against the test site, with
`SITE_URL` pointing at it and `seomator` on the `PATH` running 8.0.0, the
audit step printed:

```
Report saved to: reports/seo.json
Exit 1: core-canonical-present failed (fail_ci); score 89 passed fail-under 80
::error::core-canonical-present failed (fail_ci); score 89 passed fail-under 80
```

and exited 1. GitLab CI needs no annotation step; keep the report with
`when: always`:

```yaml
seo:
  image: node:22
  script:
    - npm install -g @seomator/seo-audit@8
    - seomator config validate
    - seomator audit "$SITE_URL" --crawl -m 50 --no-save --format json -o reports/seo.json
  artifacts:
    when: always
    paths:
      - reports/seo.json
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Exit 1 while the score passed | Read the `Exit 1:` line, or `gate.reason` in JSON. It names the rule, custom search or coverage gate that failed. |
| `fail_ci rule <id> was not measured (Needs a browser render: rerun with --render)` | Add `--render` and install Chromium on the runner, or drop `fail_ci` for that rule. |
| `fail_ci rule <id> was not measured (... run with --crawl)` | The rule compares pages. Add `--crawl`, or drop `fail_ci` for that rule. |
| Exit 2, `Invalid configuration ... so its gate can never run` | A `fail_ci` rule is removed by `[rules] enable`/`disable` or by `--categories`. Keep its category in the run, or drop the gate. |
| Exit 2, `unknown rule id "..."` | The id in `[rules.override]` is not a rule. Use the id the "Did you mean" names, or `seomator explain --list`. |
| `Exit 1: measured 4 of 5 pages; min-coverage 90` | The site rate-limited or dropped pages. Space requests out with the `crawler.per_host_delay_ms` value the warning suggests, lower `--concurrency`, or lower the gate. |
| A staging site scores 20 | It is kept out of search on purpose (noindex, or robots.txt blocks Googlebot). Audit it with `--staging`. |
| The job says nothing about why it failed | The reason is on stderr. If your CI hides stderr, read `gate.reason` from the JSON report. |

## Related

- [Configuration](./configuration.md): `[ci]`, `[rules.override]` and every
  other key
- [Custom checks](./custom-checks.md): your own searches, and gating CI on them
- [Upgrading to 8.0](./upgrading-to-8.md): what changed in exit codes and
  config checks
- [Use SEOmator from an AI agent](./ai-agent-integration.md): `seomator compare
  --fail-on-regression` for checking what a deploy changed
