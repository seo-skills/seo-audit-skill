# Upgrading to 8.0

8.0 changes what exit codes mean, what a bad config does, how crawls treat a
site that asks them to slow down, and how scores are computed. Most setups
need no change. This page lists what can break a script or CI job, why scores
move, and what to do about each.

## What can break a script or CI job

| Change | What you see | What to do |
|---|---|---|
| A bad flag or argument exits 2, not 1 | A typo in a flag fails with exit 2 | Exit 1 now always means a gate failed. If your CI treats any non-zero exit as "the site failed", split 1 (gate) from 2 (the run could not happen). |
| A config that does not mean what it says stops the run | `audit` and `analyze` exit 2 with error code `config` before the first request | Run `seomator config validate`. It names each bad value, an unknown rule id in `[rules.override]` with a "Did you mean", a `fail_ci` rule a filter removes, and every bad `[[custom.*]]` entry. These used to run and silently ignore the bad part. |
| `config validate` exits 2 on an error and prints to stderr | It exited 1 and printed to stdout | Read stderr, or pass `--json`. |
| A start page answering 503 is retried, then fails as `rate-limited` | Error code `rate-limited` (still exit 2) where you saw `http-error` | Nothing, unless you matched the code. A 503 that clears within the retries is now scored normally. |
| The browser render is opt-in | No Core Web Vitals, rendered-DOM or accessibility-engine results without a flag | Add `--render` (or `--cwv`) where you want them. The console says how many checks a render would add. |
| Node.js 20.18.1 or later | Install fails on older Node | Upgrade Node. |

## Why scores move

Scores from 8.0 use scoring model 5. `compare` reads an audit from before it
as a different model, not a regression, and `--fail-on-regression` does not
fail on that pair. Expect movement from:

- **Soft-404 detection** stops failing real pages that merely mention "error"
  or "404" somewhere.
- **Duplicate checks** compare the whole crawl, so the first page of a group
  is flagged like the others, and only pages a search engine would index are
  compared.
- **External links** count as broken only when the target is gone (404, 410,
  another 5xx, a domain that does not resolve). A 401, 403, 429, 999 or a
  timeout used to warn; it is now "could not verify".
- **`social-og-image-size`** compares declared dimensions with the real image
  and no longer warns when they are missing.
- **`a11y-color-contrast` and `a11y-touch-targets`** take axe-core's measured
  verdict when the page is rendered, and fail a serious violation.
- **A check that crashes** is not measured instead of failing at full weight.

## Behaviour that changed without breaking anything

- **Crawls are polite.** A 429 or 503 is retried with backoff, `Crawl-delay`
  is honoured (capped at 10 s), `crawler.per_host_concurrency` (default 2)
  now applies, and a host that keeps failing is given up on. A default crawl
  is a little slower; raise `per_host_concurrency` and `concurrency` together
  to go faster, or pass `--ignore-crawl-delay`.
- **robots.txt groups match the crawler's product token.** `User-agent: bot`
  no longer governs `SEOmatorBot`; `User-agent: SEOmator` still does.
- **`crawler.max_pages` defaults to 10** (was 100), the same as `-m`.
- **25 new rules are advisory.** They are reported in every format with an
  "Advisory" mark and never change the score. They start counting in a later
  release, once their verdicts are checked on real sites.
- **The JSON schema version is 4.** New fields: `gate`, `warnings`,
  `completionState`, `coverage` counts, `RuleResult.reason`, `advisory` and
  `overridden`, and `extras` (`externalLinks`, `linkScores`, `custom`,
  `crawl`).

## New things worth turning on

- `[ci] fail_under` and `--fail-under`, `[rules.override]` with `fail_ci`,
  and `--min-coverage` for CI gates. See [Configuration](./configuration.md).
- `[[custom.search]]` and `[[custom.extract]]` for your own checks.
- `seomator mcp` for AI agents. See [AI agent integration](./ai-agent-integration.md).
- `seomator explain <rule-id>` for what a rule checks and how to configure it.
