# QA Report — SEOmator CLI, deep pass

**Date:** 2026-09-01
**Branch:** `main` (from `d00c331`, after the first QA pass)
**Tier:** Standard
**Scope:** correctness of the audit engine under adversarial input, rather than
the command surface covered by the first pass.

## Summary

| | |
|---|---|
| Issues found | 6 |
| Fixed and verified | 4 |
| Flagged, not fixed | 2 |
| Reverts | 0 (1 self-caught regression, corrected before commit) |
| Tests | 580 → 609 (+29) |
| Health score | 58 → 94 |

**PR summary:** Deep QA found 6 issues, fixed 4, health score 58 → 94.

The first pass asked "do the commands work". This one asked **"does the engine
give correct answers"** — and twice it did not.

## Method

Built an adversarial fixture server with ~30 routes: redirect chains and loops,
4xx/5xx/204, gzip and brotli, latin-1 and charset mismatches, malformed and
empty bodies, non-HTML content types, a 1.2MB page, protocol-relative and
`javascript:` links, duplicate titles, a robots-disallowed path, and a
sitemap-only orphan. Deterministic and hostile in ways a live site is not.

Prior learnings applied: all 3 from the first pass (`sqlite-datetime-now-parsed-local`,
`seomator-notmeasured-weight0`, `seomator-cli-qa-harness`).

Coverage map that drove the targeting:

| Area | Source files | Test files |
|---|---|---|
| commands | 10 | **0** |
| reporters | 9 | 1 |
| storage | 26 | 4 |
| crawler | 8 | 2 (now 4) |

---

## Fixed

### ISSUE-010 — Piped JSON truncated at 64KB — **critical**
`seomator audit --format json | jq` — the primary machine-readable path —
silently produced invalid JSON.

```
to file : 119040 bytes, valid
to pipe :  65536 bytes, cut mid-token
          jq: parse error: Unfinished string at EOF
```

`process.exit()` discards whatever is still buffered on stdout. Writes to a file
are synchronous on POSIX; writes to a pipe are not. The forced exit raced the
flush and won, at exactly the pipe buffer boundary. Silent data corruption in CI.

**Fix:** set `process.exitCode` and let the loop drain. Same shape in `analyze
--json` and `compare --json/--trend`. In `compare` those exits sat inside a
`try/finally`, and `process.exit()` **skips finally** — so `closeAuditsDatabase()`
had never run on the success path. It does now.
**Commit:** `691e475` · **Verified:** file and pipe both 119,040 bytes; `jq` parses;
exit codes unchanged.

### ISSUE-013 — The crawler ignored robots.txt entirely — **high**
`respect_robots` was declared in the schema, defaulted to `true`, validated,
documented, set to `false` by the `ci` preset — and **read by no code**. There
was no robots parsing in the crawler at all; `sitemap.ts` only ever pulled
`Sitemap:` lines out of the file.

Proven against a fixture whose robots.txt disallows `/blocked`: the crawler
fetched it.

This is not just a dead config flag. Disallowed paths are disallowed for a
reason — admin endpoints, search pages that explode into infinite URL space,
staging areas. Hitting them gets a user's IP blocked and trips WAFs, while the
tool reports it is being polite.

**Fix:** RFC 9309 parsing and matching — group selection with the most specific
user-agent winning, Allow/Disallow with longest-match precedence and Allow
breaking ties, `*` and `$` wildcards, comments, multi-agent groups. **No new
dependency**: this ships to npm, and the matcher is a bounded pure function
cheaper to own than to depend on. Wired through `Auditor` and both commands.
**Commit:** `266ed37` · **Verified:** 17 pages with the default (blocked path
excluded), 18 with `respect_robots = false`. 17 unit tests.

### ISSUE-011 — Empty and non-HTML responses were scored as pages — **high**
Nothing checked what came back before handing it to Cheerio:

```
zero-byte body        84/100
text/plain response   83/100
application/json      83/100
```

An empty page scored **84** because **195 of 287 rules pass when the thing they
check is absent**. Six categories — images, url, mobile, legal, js, redirect —
scored a clean **100** on a page containing nothing. `technical-soft-404`
cleared a zero-byte page.

**Fix:** the auditor refuses to score a response that is empty, carries a
non-HTML content type, or has no markup when no type was sent. Error pages that
return real HTML still audit, since a custom 404 is worth checking.
**Commit:** `5f2f769` · **Verified:** 12 unit tests; real pages unaffected.

**Self-caught regression:** the guard first went into `fetchPage`, which is also
how rules retrieve robots.txt — that made `geo-ai-bot-access` silently pass on
every site by rejecting `text/plain`. The suite caught it; the check moved to
the auditor before commit.

### ISSUE-012 — `redirect-loop` and `redirect-broken` always passed — **medium**
Both gate on `context.redirectChain`, a field declared in `types.ts` and set by
**no code path**. Both returned "No redirect chain to check" and passed, on
every page, forever. At weight 15 each they are the two heaviest rules in the
category, which is why `redirect` scored 100 on everything.

The claim was also false: `fetchPage` follows redirects silently, so a page
reached through four hops is indistinguishable from one reached directly.

**Fix:** report unmeasured, so the gap is visible and the score stops counting a
check that never ran.
**Commit:** `3056472`

---

## Flagged, not fixed

**Vacuous passes are systemic, not local.** ISSUE-011 and ISSUE-012 are two
instances of one pattern: a rule whose subject is absent returns `pass()`. On an
empty page that is 195 rules. Converting them wholesale is a rule-design pass
across most of 287 rules — real work, and a scoring change for every user. The
guard stops the worst outcome (a confident score on garbage); the pattern itself
is worth a deliberate sweep.

**A 500 page still scores 86.** `technical-server-error` correctly fails, but one
failing rule out of 287 barely moves the total, so a broken server reports
86/100. Relatedly, nothing reports that the *audited page* is a 404:
`technical-4xx-non-404` defers to "dedicated 404 rules", and the only such rule
(`technical-404-page`) probes a random URL to test site-wide 404 handling, never
the page you asked about. **This needs a product decision** — whether page-level
fatal conditions should dominate the score — so I have not changed scoring.

**Electron typecheck fails** (pre-existing). `electron/electron-vite.config.ts`
errors on `outDir` under electron-vite v5. The file is byte-identical to the
3.2.0 release and my commits touch zero Electron files. Not fixed here because
verifying it needs `electron-rebuild` of better-sqlite3, which per CLAUDE.md
breaks the CLI tests.

**Redirect chains are never recorded.** `redirectChain` is an unimplemented Tier
2 capability; populating it needs manual redirect following in the fetcher.
Feature, not defect — ISSUE-012 makes the gap honest.

## Verified working

Worth stating, since these were probed and held:

- **LLM reporter prompt-injection hardening.** Against a page whose title, meta
  description, headings, and alt text all carried injection payloads: a fresh
  32-hex nonce per report, all site-derived text inside `<untrusted-{nonce}>`
  blocks, entities escaped, no closing-tag forgery, and no payload text outside
  a wrapper.
- **Redirect loops** terminate (exit 2) rather than hanging, though the message
  is a bare "fetch failed".
- Gzip, brotli, latin-1, charset mismatch, unicode, 1.2MB pages, malformed HTML,
  and protocol-relative links all handled without crashing.

## Verification

| Check | Result |
|---|---|
| Command sweep (41 invocations) | 41 pass / 0 fail |
| Unit suite | 609 pass (was 580; +29) |
| `tsc --noEmit` (CLI) | 0 errors |
| Programmatic API | audits, `respectRobots` accepted, guard fires |
| robots.txt | disallowed path excluded; opt-out honoured |
| JSON to pipe | 119,040 bytes, `jq` parses |

## Note

3.2.0 on npm carries all six of these plus the seven from the first pass. The
fixes sit unreleased on `main` and want a **3.2.1**.

robots.txt compliance changes crawl results on any site with a robots.txt —
fewer pages, by design. Worth calling out in release notes.
