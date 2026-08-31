# PRD — Instant Web Vitals, Lighthouse Parity & Rule Coverage Expansion

| | |
|---|---|
| **Product** | `@seomator/seo-audit` (audit-cli) |
| **Current version** | 3.1.1 — 261 rules / 20 categories |
| **Target version** | 3.2.0 |
| **Status** | Phase 1 implemented; Phases 1b–4 open |
| **Date** | 2026-08-31 |

---

## 1. Background

Two SEOmator surfaces exist today with divergent capabilities:

| | **audit-cli** (this repo) | **geo-audit-free** (Cloudflare Worker) |
|---|---|---|
| Checks | 256 rules / 20 categories | 171 checks / 16 categories |
| Categories missing | — | `technical`, `crawl`, `js`, `legal` |
| Lighthouse | **None** | 4 scores + full audit list via PSI API |
| Rendering | Playwright (local) | Browser Rendering binding |
| Report extras | — | Heading tree, SERP/social preview, key-metrics strip |

The CLI has the deeper rule engine but the thinner report. The gap is concentrated in
three places: **no Lighthouse data at all**, **accessibility coverage at 12 rules versus
Lighthouse's 76**, and **no Best-Practices-class security/runtime checks**.

### 1.1 Decision — PSI is too slow to be the primary path

PageSpeed Insights returns in 10–30s. That is acceptable for a web report that streams a
section in late; it is not acceptable as the default path for a CLI, and it cannot reach
`localhost`, staging behind auth, or intranet hosts at all.

**The primary path is therefore local measurement**, using the same library tinyanalytics
uses, injected into the Playwright page we already launch. PSI is demoted to an opt-in
extra for users who specifically want Google's official scores.

### 1.2 Reference finding — tinyanalytics Web Vitals (`web-vitals` 4.2.4)

`apps/api/src/tracker/script/web-vitals.ts` subscribes to `onLCP/onCLS/onINP/onFCP/onTTFB`,
buffers into one payload, and flushes exactly once — whichever comes first: all five
reported, a 20s cap, or `visibilitychange → hidden` / `pagehide`.

**What we can copy: the library. What we cannot: the delivery mechanism.** That collector
runs in real visitors' browsers on a site you control — RUM field data. A CLI audits a
third-party URL from the outside and has no script to install. The observers, however,
port directly into Playwright.

**Why this is "instant":** the metrics are collected *during the page load we already
perform* for rendered-DOM capture. Measured effect is not zero but **negative** — the audit
gets faster; see §5 Phase 1.

### 1.3 Reference finding — how geo-audit-free gets Lighthouse "instantly"

It does not run Lighthouse. It proxies **Google PageSpeed Insights API v5**, which runs
Lighthouse on Google's infrastructure and returns the full report as JSON.

- **Endpoint:** `GET https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed`
- **Params:** `url`, `key`, and a repeated `category` param
  (`PERFORMANCE`, `ACCESSIBILITY`, `BEST_PRACTICES`, `SEO`)
- **Bounded wait:** `AbortSignal.timeout(90_000)` — degrades a hang to clean JSON rather
  than an opaque platform timeout
- **Payload:** `psi.lighthouseResult.{ finalUrl, fetchTime, categories, audits }`;
  scores are `categories[key].score` on a 0–1 scale
- **Perceived speed comes from orchestration, not latency.** The PSI call is dispatched as
  a detached promise in parallel with the HTML audit. The on-page report renders from the
  fast Cheerio parse; the Lighthouse block fills in 10–30s later under its own
  loading/error state.

Two gaps in the reference worth correcting in our implementation:
1. It never sends `strategy`, so every run is **mobile-only**. Desktop is one extra param.
2. It discards `loadingExperience` / `originLoadingExperience` — **free CrUX field data**
   returned in the same response.

**Dependency cost: zero.** No `lighthouse` npm package (~30MB), no `chrome-launcher`, no
Chrome binary. One `fetch`.

---

## 2. Problem statement

1. CLI users get no Lighthouse Performance / Accessibility / Best-Practices scores, which
   are the industry-standard numbers clients ask for by name.
2. Accessibility is our weakest category — 12 rules against Lighthouse's 76 — while
   carrying only 4% of the overall score.
3. We check for the *presence* of security headers but never grade their *strength*, and we
   miss the modern isolation headers entirely (COOP/COEP/CORP, Trusted Types).
4. Playwright is already launched for CWV but collects only 6 numbers. The highest-value
   performance signals (unused CSS/JS, main-thread work, third-party impact) are left on
   the table despite the browser already being open.

## 3. Goals

- **G1** — Report accurate, spec-compliant Core Web Vitals **without slowing the audit**,
  measured during the Playwright load we already perform. *(Achieved: 29.9% faster per
  page — the replaced code contained a redundant 1s wait.)*
- **G1b** — Offer Lighthouse's four category scores as an opt-in extra for public URLs.
- **G2** — Close the accessibility gap: 12 → ~31 rules, all statically checkable.
- **G3** — Add Best-Practices-class security and runtime checks currently absent.
- **G4** — Extract more value from the Playwright session already being launched.
- **G5** — Bring the report presentation to parity with geo-audit-free.

## 4. Non-goals

- **Bundling the `lighthouse` npm package.** ~30MB dependency, requires a Chrome binary,
  15–30s per page, and ~60% of its audits duplicate rules we already own. Rejected.
- Replacing local Playwright CWV with PSI. PSI cannot reach `localhost`, staging behind
  auth, or intranet hosts — a large share of CLI usage — and its 10–30s latency is
  unacceptable as a default. Local measurement is primary; PSI supplements.
- Shipping a synthetic-interaction INP by default (see Open Decision D3).
- Folding Lighthouse scores into the weighted 256-rule score (see Open Decision D1).
- Any change to `electron/` beyond consuming new fields.

---

## 5. Scope

### Phase 1 — Instant Web Vitals via injected `web-vitals` ✅ IMPLEMENTED

Replaces the hand-rolled collector in `measureCoreWebVitals`
(`src/crawler/playwright-fetcher.ts:268`). Default-on; no flag, no network call.

**Defects in the current collector this fixes**

| # | Defect | Detail |
|---|---|---|
| 1 | TTFB understated | Line ~251 computes `responseStart - requestStart`, excluding redirect + DNS + TCP + TLS. `web-vitals` uses `responseStart - activationStart`. We currently grade a different metric than CrUX/Lighthouse/PSI do. |
| 2 | LCP truncated | Fixed 1s window (line 337) resolves before LCP settles on slow pages |
| 3 | CLS truncated | Same 1s window; later shifts silently dropped |
| 4 | INP absent | Never assigned anywhere in `src/crawler/`; `perf/inp.ts:31` correctly returns `notMeasured()` |

**Implementation**

| Item | Detail |
|---|---|
| Dependency | `web-vitals` (~2KB gzipped) → `dependencies` (CLI-only, respects the split rule) |
| Injection | `page.addInitScript({ path: 'web-vitals/dist/web-vitals.attribution.iife.js' })`, then a second `addInitScript` registering the subscribers — both run before page scripts |
| Finalization | `reportAllChanges: true` on every subscriber, so the last reported value is read after settle. Removes any need to force a page-hide. |
| Attribution | The attribution build returns the LCP element selector and CLS culprit nodes — Lighthouse's "LCP breakdown" and "Layout shift culprits", locally |
| TBT | Additional `longtask` PerformanceObserver: sum of `(duration - 50)` for tasks after FCP |
| Bundling | Resolve the IIFE at runtime via `createRequire` + `readFileSync`; do not rely on esbuild inlining |

**New optional `CoreWebVitals` fields** — all optional, so existing rule tests that stub
context are unaffected:

```ts
tbt?: number;                   // Total Blocking Time (ms)
inpSynthetic?: boolean;         // INP came from a crawler-driven interaction
lcpElement?: string;            // CSS selector of the LCP element
clsLargestShiftTarget?: string; // CSS selector behind the largest single shift
```

**Correction to the original spec:** this listed `clsCulprits` as an array. `web-vitals`
attribution exposes only `largestShiftTarget` — the single worst shift, not a ranked list.
Building a full culprit list would mean parsing raw `layout-shift` entries ourselves;
deferred as unjustified for the value.

**Implementation note:** the package's `exports` map blocks deep subpath resolution, so
`require.resolve('web-vitals/dist/...')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. The IIFE is
located relative to the resolved main entry instead (both live in `dist/`).

**Verified result — audit speed (median of 5 alternating runs, local server, warm browser):**

| | per page |
|---|---|
| Before | 3258ms |
| After | **2284ms** |
| **Delta** | **−973ms (−29.9%)** |

The old `measureCoreWebVitals` blocked a further 1000ms *inside* `page.evaluate` on top of
the existing settle, waiting for metrics the injected collectors already hold. Removing that
wait is where the time comes from. Metric parity was checked on the same page: the new path
returns everything the old one did, plus `lcpElement` and `tbt`.

`--simulate-interaction` adds roughly 600–1100ms depending on whether the page has anything
clickable — opt-in, so the default path is unaffected.

**Verified result — TTFB on `example.com`:**

| | value |
|---|---|
| Old formula (`responseStart - requestStart`) | 61ms |
| Spec TTFB (now reported) | 265ms |
| Previously hidden DNS + TCP + TLS | 204ms |

A 4.3× understatement on a fast, well-connected host. Live audit now reports 259ms.

### Phase 1b — PSI / Lighthouse (opt-in, secondary)

Unchanged in mechanism from §1.3, but explicitly **not** on the default path.

| Item | Detail |
|---|---|
| Flag | `--psi` (alias `--lighthouse`), off by default |
| Auth | `PAGESPEED_API_KEY` env var, or `psi.apiKey` in TOML config |
| Strategy | `--psi-strategy mobile\|desktop\|both` (default `mobile`) — the reference is mobile-only |
| Timeout | `AbortSignal.timeout(90_000)` |
| Concurrency | Dispatched in parallel with `fetchPage()`, never awaited before on-page rules run |
| Failure mode | Non-fatal. Missing/failed PSI omits the section; audit still exits 0 |
| Bonus capture | Persist `loadingExperience` (CrUX field data), which the reference discards |
| Preflight | Detect non-public hosts (`localhost`, RFC1918, `.local`) and skip with a clear message rather than a 4xx from Google |

**New `AuditContext` field** — optional, matching the `renderDiagnostics` precedent:

```ts
/** PageSpeed Insights / Lighthouse result (optional, requires --psi) */
psi?: {
  strategy: 'mobile' | 'desktop';
  finalUrl: string;
  fetchTime: string;
  categories: Record<string, { score: number; title: string }>;
  audits: Record<string, LighthouseAudit>;
  fieldData?: CruxMetrics;
};
```

**Rate limits.** With a free API key: 25,000 req/day and 240 req/min at time of writing —
re-verify before relying on it for batch crawls. Unkeyed requests are throttled hard. For
`crawl` runs, gate behind an explicit flag and cap concurrency.

### Phase 2 — Static rule expansion (~30 rules, no new plumbing)

Every rule below needs only `context.$` and `context.headers`. One file each, one
`registerRule()` line — no changes to `auditor.ts` or the scoring path.

**2a. Accessibility (12 → 31)**

`a11y/aria-labels.ts` already covers `button-name`, `link-name`, `select-name` and the ARIA
input/toggle name audits — those are **not** duplicated below.

| Rule ID | Covers Lighthouse audit |
|---|---|
| `a11y-iframe-title` | frame-title |
| `a11y-object-alt` | object-alt |
| `a11y-empty-heading` | empty-heading |
| `a11y-input-image-alt` | input-image-alt |
| `a11y-list-structure` | list, listitem, dlitem, definition-list |
| `a11y-duplicate-id-aria` | duplicate-id-aria |
| `a11y-aria-valid` | aria-valid-attr, aria-roles, aria-deprecated-role, aria-required-attr, aria-prohibited-attr |
| `a11y-aria-hidden-focusable` | aria-hidden-focus, aria-hidden-body |
| `a11y-tabindex-positive` | tabindex |
| `a11y-accesskey-unique` | accesskeys |
| `a11y-form-multiple-labels` | form-field-multiple-labels |
| `a11y-valid-lang-element` | valid-lang |
| `a11y-svg-img-alt` | svg-img-alt |
| `a11y-redundant-alt` | image-redundant-alt |
| `a11y-main-landmark` | main landmark (tighter than existing `a11y-landmark-regions`) |
| `a11y-presentation-role-conflict` | presentation-role-conflict |
| `a11y-table-caption` | table-fake-caption, td-has-header |
| `a11y-identical-links-purpose` | identical-links-same-purpose |
| `a11y-label-name-mismatch` | label-content-name-mismatch |

**2b. Security / Best Practices**

`security/hsts.ts` already grades strength correctly. `security/csp.ts` is
**presence-only** — it parses directives and checks a recommended list but never grades XSS
effectiveness.

| Rule ID | Rationale |
|---|---|
| `security-coop` | Cross-Origin-Opener-Policy — not checked anywhere today |
| `security-coep-corp` | COEP / CORP headers |
| `security-csp-xss` | Grade `unsafe-inline`/`unsafe-eval`, wildcard sources, missing `object-src`/`base-uri`, nonce/hash usage |
| `security-trusted-types` | `require-trusted-types-for` directive |
| `security-info-disclosure` | `Server`, `X-Powered-By`, `X-AspNet-Version` leakage |
| `security-paste-blocking` | `onpaste="return false"` on inputs |
| `technical-security-txt` | `/.well-known/security.txt` — Tier-2 fetch, same pattern as robots.txt |

**2c. JS / performance (static)**

`js-document-write`, `js-source-maps` (`sourceMappingURL`), `perf-legacy-javascript`
(core-js/babel polyfill markers), `js-permission-on-load` (geolocation +
`Notification.requestPermission` at load).

### Phase 3 — Playwright collector extension (~11 rules)

`playwright-fetcher.ts:166` already has a `page.on('response')` listener, making the first
group nearly free.

| Group | Rules | Mechanism |
|---|---|---|
| Cheap | `perf-third-party-impact`, `perf-resource-summary`, `perf-critical-request-chain` | Existing response listener |
| Metrics | `perf-tbt`, `perf-tti`, `perf-speed-index`, `perf-long-tasks`, `perf-main-thread-work` | Extend the `page.evaluate` block at `playwright-fetcher.ts:244` with a long-task observer |
| Coverage | `perf-unused-css`, `perf-unused-js`, `perf-duplicate-js-modules` | `page.coverage.startJSCoverage()` / `startCSSCoverage()` |
| CDP | `js-third-party-cookies`, `js-deprecated-apis`, `perf-non-composited-animations` | CDP session |

The coverage group is Lighthouse's highest-impact perf opportunity set and we currently
have none of it.

**Constraint:** every new `AuditContext` field must be optional, or every rule test that
builds a minimal context with `null as any` breaks.

### Phase 4 — Reporter parity

All data already exists in `AuditContext`; only `src/reporters/html-reporter.ts` changes.

- **Heading outline tree** (H1–H6) — derivable from `$`
- **SERP + social card preview** — title/description/`og:image` already parsed by `social/*`
- **Key metrics strip** — already computed by `links-external-count`,
  `content-word-count`, `content-text-html-ratio`
- **Lighthouse section** — four score gauges + audit detail, rendered only when `--psi` ran

---

## 6. Open decisions

### D1 — How do Lighthouse scores relate to our score? *(blocking Phase 1b)*

Three options:

- **(a) Fully separate.** PSI renders as its own section; the 256-rule score is untouched.
  Cleanest, no double-counting, but produces two headline numbers that can disagree
  confusingly.
- **(b) Displayed side-by-side, one blended headline.** Requires defining a blend weight
  and makes scores incomparable across runs with and without `--psi`.
- **(c) PSI as rule inputs.** Feed PSI audits into existing rule IDs when present,
  overriding local estimates. Most coherent single score, but scores silently change
  meaning depending on a flag.

**Recommendation: (a).** A score that shifts based on whether a network flag was passed is
not a score users can trend over time.

### D2 — Category weight rebalance *(blocking Phase 2a)*

Accessibility carries **4%** across 12 rules. Adding 19 more dilutes each to ~0.13% of the
overall score — nineteen new checks that barely move the number is a bad trade.

`validateCategoryWeights()` in `src/categories/index.ts` hard-fails unless the 20 weights
sum to exactly 100, so a11y cannot be raised without taking points from elsewhere.

Current weights:

```
core 12 · perf 12 · links 8 · images 8 · security 8 · technical 7 · crawl 5 · schema 5
content 5 · js 5 · a11y 4 · social 3 · eeat 3 · url 3 · redirect 3 · mobile 2 · i18n 2
htmlval 2 · geo 2 · legal 1
```

**Open:** a11y likely needs 6–8. Which categories give up the 2–4 points is a product call,
not a technical one.

---

### D3 — Should we synthesize interactions to produce INP? — **DECIDED: (c)**

INP requires a real interaction. With none, `web-vitals` never fires it and `perf/inp.ts`
returns `notMeasured()` — honest, but a permanent hole in a Core Web Vital.

- **(a) Leave as `notMeasured`.** Honest; INP stays absent from every CLI report.
- **(b) Synthesize** a scroll plus a click on the first interactive element, then report INP.
  Produces a number, but a synthetic click on an arbitrary element is not representative of
  real user interaction and could be actively misleading.
- **(c) Synthesize behind `--simulate-interaction`**, clearly labelled as synthetic in output.

**Decided: (c)** — implemented as `--simulate-interaction`.

The crawler suppresses navigation and form submission with capture-phase `preventDefault`
before clicking, so the click measures the site's own handlers without tearing down the
document being measured. The resulting INP is returned with `inpSynthetic: true`, and
`perf/inp.ts` reports it through `notMeasured()` — **weight 0**, so a manufactured number
never moves the score, however good it looks.

Verified on `example.com`: without the flag, INP is absent and the message points at the
flag; with it, `INP is 8ms from a synthetic interaction (indicative only - not real user
data)` at weight 0.

## 7. Success criteria

| # | Criterion |
|---|---|
| S1 | Core Web Vitals are collected via injected `web-vitals`; audit wall time does not increase versus 3.1.1 — **met: 973ms faster per page (−29.9%)** |
| S1b | TTFB matches PSI/CrUX for the same URL within tolerance (today it is systematically low by DNS + TCP + TLS) |
| S1c | LCP on a deliberately slow test page is no longer truncated by the removed 1s window |
| S1d | `--psi` prints 4 Lighthouse scores; the on-page report is not blocked waiting for it |
| S2 | PSI failure, timeout, missing key, or unreachable host → audit completes, exits 0, section omitted |
| S3 | `--psi` against `http://localhost:3000` fails with an actionable message, not a stack trace |
| S4 | Rule count 256 → ~286; a11y 12 → 31 |
| S5 | `validateCategoryWeights()` passes; `npm run test:run` green |
| S6 | `npm pack --dry-run` still ships only `dist/` — no new runtime dependency added to `dependencies` |
| S7 | HTML report renders heading tree, SERP preview, and key-metrics strip |

## 8. Risks

| Risk | Mitigation |
|---|---|
| PSI quota exhaustion on `crawl` runs | Gate behind explicit flag, cap concurrency, cache by URL |
| PSI unreachable for local/staging URLs | Detect non-public hosts up front and skip with a clear message |
| Google changes PSI response shape | Parse defensively; treat every field as optional |
| a11y static checks produce false positives vs. axe-core | These are heuristics on static HTML, not a substitute for axe — document the limitation |
| Rule dilution from +30 rules | Resolve D2 before merging Phase 2a |

## 9. Sequencing

**Phase 1 ships first.** It is a contained change to one function, needs no product
decision, fixes measurement defects that are wrong in shipped output today, and adds no
latency.

Phase 2 (static rules) follows — no dependencies, no network cost, no new plumbing — but
2a is gated on D2. Phase 1b (PSI) follows once D1 is decided. Phase 4 (reporter) can run in
parallel with any of them. Phase 3 is the largest lift and should come last.
