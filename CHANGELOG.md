# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
