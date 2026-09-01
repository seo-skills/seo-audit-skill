# PRD — Hint Coverage Expansion: Parity with the Reference Audit Catalog

| | |
|---|---|
| **Product** | `@seomator/seo-audit` (audit-cli) |
| **Current version** | 3.2.0 — 287 rules / 20 categories |
| **Target version** | 3.3.0 |
| **Status** | Draft — gap analysis complete, no rules implemented |
| **Date** | 2026-09-01 |
| **Inputs** | Public "Hints" documentation crawl of a benchmark desktop SEO auditor (256 pages, all 15 hint sections); our rule inventory from `src/rules/` and `docs/SEO-AUDIT-RULES.md` |

---

## 1. Background

A benchmark desktop SEO crawler organises its audit output around
**Hints** — ~300 named checks, each carrying an **Importance** level
(Critical / High / Medium / Low / Insight) and a **Warning Type**
(Issue / Potential Issue / Opportunity / Insight / Diagnostic), grouped into 15
sections (Indexability, Links, On-Page, Redirects, Internal, Search Traffic,
XML Sitemaps, Security, International, Accessibility, AMP, Duplicate Content,
Mobile Friendly, Performance, Rendered).

We crawled that tool's public hint documentation (the complete published
specification of what each Hint checks) and extracted every hint programmatically
(`scripts/extract-hints.mjs` → `reports/hints-catalog.json`), then
classified each against our 287-rule inventory
(`scripts/hints-mapping.mjs` → `reports/hints-mapping.json`).

**Extraction is fully validated:** 240 hint pages, every one with title, importance,
and warning type parsed. Importance was cross-checked two independent ways (per-page
metadata block vs. the sidebar's importance-grouped listing) with zero mismatches.

### 1.1 Coverage summary

| Reference section | Hints | Covered | Partial | Missing | Skipped |
|---|---|---|---|---|---|
| Indexability | 50 | 20 | 13 | 17 | — |
| Links | 18 | 13 | 2 | 3 | — |
| On-Page | 22 | 19 | 0 | 3 | — |
| Redirects | 13 | 7 | 4 | 2 | — |
| Internal | 18 | 9 | 5 | 2 | 2 |
| Search Traffic | 8 | — | — | — | 8 |
| XML Sitemaps | 9 | 1 | 1 | 7 | — |
| Security | 6 | 6 | — | — | — |
| International | 25 | 11 | 8 | 6 | — |
| Accessibility | 1¹ | — | — | — | — |
| AMP | 19 | — | — | — | 19 |
| Duplicate Content | 7 | 5 | 1 | 1 | — |
| Mobile Friendly | 13 | 7 | 2 | 4 | — |
| Performance | 20 | 11 | 7 | 2 | — |
| Rendered | 12 | 11 | 1 | — | — |
| **Total** | **240** | **120** | **44** | **47** | **29** |

¹ The Accessibility section contained only its index page in this crawl — the
reference tool publishes its accessibility checks elsewhere. Our a11y coverage was already expanded
to 31 rules against Lighthouse's set (see the Lighthouse PRD, Phase 2a).

**Reading the numbers:** 120 hints (50%) have a genuinely equivalent rule. 44 (18%)
are partially covered — we check something related but miss the nuance. 47 (20%) are
real gaps. 29 (12%) are deliberately skipped (see §6). The gaps cluster in four
places: **cross-page crawl-level checks** (SiteContext carries only link graph +
depths today — no per-URL status codes, canonicals, robots state, or discovery
source), **sitemap cross-referencing**, **canonical edge cases**, and
**viewport/directive minutiae**.

## 2. Problem statement

1. The reference catalog catches whole classes of indexability bugs we miss: canonical chains and
   loops across pages, canonical targets that are noindex/disallowed, canonical
   elements misplaced or carrying invalid attributes. These are Critical/High hints.
2. Our XML Sitemap coverage checks noindex-in-sitemap only; the catalog cross-references
   sitemap membership against status code, redirect, canonical, robots.txt, and
   timeout state per URL (7 uncovered hints, 2 of them Critical).
3. Our hreflang checks are page-level; the catalog's highest-value international hints
   are crawl-level (incoming annotation conflicts, reciprocity, target-side
   noindex/disallowed). 14 of 25 international hints are not fully covered.
4. Several trivial static checks are simply absent (title outside `<head>`, `<base>`
   validation, form GET methods, duplicate GA/GTM snippets, image maps, viewport
   initial-scale) — cheap wins.
5. The catalog's Discovery-model hints (isolated URLs found only via canonicals or
   redirects) require the crawler to record *how* each URL was found, which ours
   does not.

## 3. Goals

- **G1** — Close all Critical and High MISSING gaps that are statically checkable
  with data the crawler already collects (P0).
- **G2** — Extend crawl-level context (`SiteContext`) so sitemap and canonical
  cross-reference checks become possible, then implement them (P1).
- **G3** — Upgrade PARTIAL rules where the missing nuance is cheap (robots directive
  mismatch, multiple canonicals, nofollow render mismatch, URL parameter
  classification, viewport content).
- **G4** — Do not regress audit speed or the scoring contract: new crawl-level data
  must be optional on `AuditContext`/`SiteContext` so existing rule tests that stub
  context keep passing (same constraint as the Lighthouse PRD Phase 3).

## 4. Non-goals

- **Search Traffic parity.** All 8 hints require Google Search Console / GA4
  integration. The CLI has no authenticated API plumbing; adding it is a product
  decision, not a rule decision. Out of scope.
- **AMP parity.** All 19 AMP hints skipped. AMP is deprecated as a ranking concern
  since the 2021 page-experience update (no more AMP badge, Top Stories no longer
  requires AMP); building 19 checks for a dying format is negative ROI. Revisit only
  if users ask.
- **Analytics presence insights** ("URL contains no Google Analytics/Tag Manager
  code"). Not an SEO issue; would fire on deliberately tracker-free sites.
- **True rendered-viewport measurement** for "Content does not size correctly to
  viewport" — requires a full mobile render pass with layout overflow measurement;
  the mobile parity render already exists but layout comparison is a separate
  project.
- **No new rule category.** The catalog's 15 sections map onto our existing 20
  categories; no `amp`/`search-traffic` category is added.
- Any change to `electron/` beyond consuming new rule output.

---

## 5. Scope

Mapping conventions: proposed rule IDs follow our `<category>-<slug>` convention and
target an existing `src/rules/<category>/` directory. **Effort** assumes:
*trivial* = one static rule file + `registerRule()` line, data already in
`AuditContext`; *medium* = needs a cross-reference of already-collected crawl data or
a small context extension; *complex* = needs crawler changes or new per-URL crawl
state. Rules marked "(extend)" modify an existing rule rather than adding one.

### 5.1 Gap tables by category

Only MISSING and PARTIAL hints are listed; COVERED hints with their rule IDs are in
`reports/hints-mapping.json`. Effort/data notes flag checks needing
rendered DOM, response headers, or crawl-level aggregation.

#### Indexability (17 missing, 13 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| MISSING | Canonical outside of head | Critical | `core-canonical-outside-head` | core | trivial | Canonical placement never checked; `content-meta-in-body` covers meta tags only |
| MISSING | Disallowed image | Critical | `crawl-blocked-images` | crawl | medium | `crawl-blocked-resources` covers CSS/JS only; robots.txt already fetched |
| MISSING | Canonical contains invalid HTML attributes | Critical | `core-canonical-attributes` | core | trivial | `hreflang`/`lang`/`media`/`type` on canonical element not checked |
| PARTIAL | HTML file size exceeds Google's 2MB limit | Critical | `htmlval-size-limit` (extend) | htmlval | trivial | We fail at 500KB as a perf concern; the Googlebot 2MB crawl cutoff is never framed |
| MISSING | Canonical points to another canonicalized URL | High | `crawl-canonical-chain` | crawl | complex | Needs crawl-level canonical map (A→B→C) |
| MISSING | Canonical points to a disallowed URL | High | `crawl-canonical-to-disallowed` | crawl | medium | No canonical-target × robots.txt cross-reference |
| MISSING | Canonical points to a noindex URL | High | `crawl-canonical-to-noindex` | crawl | medium | `core-canonical-to-noindex` checks the page itself, not the target |
| MISSING | URL contains a form with a GET method | High | `technical-form-get-method` | technical | trivial | No form-method check exists |
| MISSING | Isolated URL — only found via a canonical | High | `crawl-isolated-url` | crawl | complex | Needs crawler discovery-source tracking (not recorded today) |
| MISSING | Isolated URL — only found via a redirect | High | `crawl-isolated-url` | crawl | complex | Same |
| MISSING | Isolated URL — only found via a noindex,follow | High | `crawl-isolated-url` | crawl | complex | Same |
| MISSING | Isolated URL — only linked from other isolated URLs | High | `crawl-isolated-url` | crawl | complex | Same, plus isolated-set graph analysis |
| MISSING | Canonical contains superfluous HTML attributes | High | `core-canonical-attributes` | core | trivial | Attributes other than rel/href; same rule as invalid-attributes |
| PARTIAL | Multiple, mismatched canonical tags | High | `core-canonical-multiple` | core | trivial | HTML-vs-header mismatch covered; multiple canonicals within HTML not counted |
| PARTIAL | Canonical loop | High | `crawl-canonical-loop` | crawl | complex | `core-canonical-loop` is a single-page heuristic; true A↔B loop needs crawl data |
| PARTIAL | Mismatched nofollow directives in HTML and header | High | `core-robots-directive-mismatch` | core | trivial | Both sources parsed; conflicts never flagged |
| PARTIAL | Mismatched noindex directives in HTML and header | High | `core-robots-directive-mismatch` | core | trivial | Same |
| PARTIAL | Multiple nofollow directives | Medium | `core-robots-directive-mismatch` | core | trivial | Multiplicity across locations not flagged |
| PARTIAL | Multiple noindex directives | Medium | `core-robots-directive-mismatch` | core | trivial | Same |
| PARTIAL | Noindex in HTML and HTTP header | Medium | `core-robots-directive-mismatch` | core | trivial | Redundant dual declaration not surfaced |
| PARTIAL | Nofollow in HTML and HTTP header | Medium | `core-robots-directive-mismatch` | core | trivial | Same |
| MISSING | Base URL malformed or empty | Low | `htmlval-base-url` | htmlval | trivial | No `<base>` validation |
| MISSING | Multiple, mismatched base URLs | Low | `htmlval-base-url` | htmlval | trivial | Same rule |
| MISSING | Multiple base URLs | Low | `htmlval-base-url` | htmlval | trivial | Same rule |
| PARTIAL | Multiple canonical tags | Low | `core-canonical-multiple` | core | trivial | Same rule as mismatched variant |
| MISSING | Canonical points to external URL | Insight | `core-canonical-external` | core | trivial | Cross-domain canonical not detected; insight value |
| MISSING | URL only has nofollow incoming internal links | Insight | `links-inbound-all-nofollow` | links | complex | Needs crawl-level inbound rel data |
| PARTIAL | Canonical points to a different internal URL | Insight | — | — | — | Detected implicitly; never surfaced as neutral info — acceptable |
| PARTIAL | Internal Disallowed URLs | Insight | — | — | — | Conflict detected; bare disallowed not surfaced — acceptable |
| PARTIAL | `<head>` contains a `<noscript>` tag | Insight | — | — | — | Only invalid contents flagged; bare presence is noise — acceptable |

#### Links (3 missing, 2 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| PARTIAL | Has link to a non-HTTP protocol | High | `links-non-http-protocol` | links | trivial | tel:/mailto: validated; ftp: etc. not flagged |
| PARTIAL | Pagination URL has no incoming internal links | Medium | `crawl-pagination-isolated` | crawl | medium | We check the inverse direction; needs link graph |
| MISSING | Only receives nofollow links or links from canonicalized URLs | Medium | `links-inbound-low-quality` | links | complex | Inbound link-quality data not in SiteContext |
| MISSING | URL receives both follow & nofollow internal links | Medium | `links-inbound-mixed-follow` | links | complex | Same |
| MISSING | Incoming followed links without descriptive anchor text | Medium | `links-inbound-anchor-text` | links | complex | We check outgoing anchors only |

#### On-Page (3 missing, 0 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| MISSING | HTML is missing or empty | Critical | `technical-empty-html` | technical | trivial | Empty/bodiless HTML response never flagged |
| MISSING | Title tag outside of head | Critical | `htmlval-title-outside-head` | htmlval | trivial | `<title>` placement not checked |
| MISSING | Title and meta description are the same | Low | `content-title-same-as-description` | content | trivial | We compare title↔H1, not title↔description |

#### Redirects (2 missing, 4 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| PARTIAL | External URL redirect broken (4XX/5XX) | High | — | — | — | Reachability checked via `links-external-valid`; redirect-chain breakage not distinguished — acceptable |
| PARTIAL | Resource URL redirect broken (4XX/5XX) | High | `redirect-resource-broken` | redirect | medium | Failed loads seen via `js-failed-requests`; resource redirect chains not traced |
| MISSING | Page resource URL redirects back to itself | High | `redirect-resource-loop` | redirect | medium | Resource redirect loops not traced |
| MISSING | Page resource URL in a chained redirect loop | High | `redirect-resource-loop` | redirect | medium | Same rule |
| PARTIAL | Redirected page resource URLs | Medium | `redirect-resource-chain` | redirect | medium | `redirect-resource` covers only HTTP→HTTPS references |
| PARTIAL | External redirected URLs | Insight | — | — | — | Traversed but not reported — acceptable |

#### Internal (2 missing, 5 partial, 2 skipped)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| MISSING | More than one Google Tag Manager code | Low | `technical-duplicate-gtm` | technical | trivial | No GTM snippet detection |
| MISSING | More than one Google Analytics code | Low | `technical-duplicate-ga` | technical | trivial | No GA snippet detection |
| PARTIAL | Query string contains a question mark | Low | `url-parameters` (extend) | url | trivial | Multiple literal `?` not flagged |
| PARTIAL | Query string contains repetitive parameters | Low | `url-parameters` (extend) | url | trivial | Duplicate param names counted, not flagged |
| PARTIAL | Paginated parameters | Insight | — | — | — | Param-based pagination not classified — acceptable |
| PARTIAL | Search or filter parameters | Insight | — | — | — | Filter params not classified — acceptable |
| PARTIAL | Sort parameters | Insight | — | — | — | Same — acceptable |

#### XML Sitemaps (7 missing, 1 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| MISSING | Error (5XX) URL in XML Sitemaps | Critical | `crawl-sitemap-non-200` | crawl | medium | Sitemap URLs never cross-referenced with crawled status codes; needs `SiteContext.statusByUrl` |
| MISSING | Not Found (4XX) URL in XML Sitemaps | Critical | `crawl-sitemap-non-200` | crawl | medium | Same rule |
| MISSING | Forbidden (403) URL in XML Sitemaps | High | `crawl-sitemap-non-200` | crawl | medium | Same rule |
| MISSING | Canonicalized URL in XML Sitemaps | High | `crawl-sitemap-non-canonical` | crawl | medium | Needs canonical state per sitemap URL |
| MISSING | Disallowed URL in XML Sitemaps | High | `crawl-sitemap-disallowed` | crawl | medium | robots.txt already fetched; needs per-URL disallow matching |
| MISSING | Redirect (3XX) URL in XML Sitemaps | Medium | `crawl-sitemap-non-200` | crawl | medium | 3xx branch |
| MISSING | Timed out URL in XML Sitemaps | Medium | `crawl-sitemap-non-200` | crawl | medium | Timeout branch |
| PARTIAL | URL in multiple XML Sitemaps | Insight | `crawl-sitemap-cross-duplicates` | crawl | medium | Within-sitemap dupes checked; cross-sitemap membership not |

#### International (6 missing, 8 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| MISSING | Outgoing hreflang annotations to noindex URLs | Critical | `crawl-hreflang-to-noindex` | crawl | medium | Target-side noindex needs crawl data |
| PARTIAL | Invalid incoming hreflang annotations | Critical | `i18n-hreflang-incoming-invalid` | i18n | complex | Outgoing validated; incoming needs hreflang graph |
| MISSING | Outgoing hreflang to disallowed URLs | High | `crawl-hreflang-to-disallowed` | crawl | medium | robots.txt cross-reference of targets |
| MISSING | Disallowed URL has incoming hreflang | High | `crawl-hreflang-disallowed-target` | crawl | medium | Incoming hreflang × robots.txt |
| MISSING | Conflicting incoming hreflang annotations | High | `crawl-hreflang-incoming-conflict` | crawl | complex | Needs crawl-level hreflang graph |
| MISSING | Hreflang annotations using relative URLs | High | `i18n-hreflang-relative-url` | i18n | trivial | Relative hrefs not flagged |
| PARTIAL | Outgoing hreflang to broken URLs | High | `i18n-hreflang-to-broken` (extend) | i18n | medium | Static malformed-URL check only; targets not fetched |
| PARTIAL | Conflicting outgoing hreflang annotations | High | `i18n-hreflang-conflicting` (extend) | i18n | trivial | Same-URL→multiple-languages not flagged |
| PARTIAL | Multiple self-referencing hreflang annotations | High | `i18n-hreflang-conflicting` (extend) | i18n | trivial | Duplicate conflicting self-references not flagged |
| PARTIAL | Missing reciprocal hreflang (no return-tag) | High | `crawl-hreflang-reciprocity` | crawl | complex | Self-reference checked; true return-tag reciprocity needs crawl graph |
| PARTIAL | Outgoing hreflang to redirecting URLs | High | `i18n-hreflang-to-redirect` (extend) | i18n | medium | Heuristic only; targets not fetched for 3xx |
| PARTIAL | Canonicalized URL has incoming hreflang | High | — | — | — | Outgoing direction covered — acceptable |
| PARTIAL | Missing hreflang annotations | High | — | — | — | We don't infer "should have hreflang" — acceptable (would false-positive on monolingual sites) |
| MISSING | Hreflang annotation also x-default | Insight | `i18n-hreflang-x-default` | i18n | trivial | Insight value |

#### Duplicate Content (1 missing, 1 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| PARTIAL | Technically duplicate URLs | High | — | — | — | Individual URL properties checked; no cross-URL equivalence clustering |
| MISSING | URLs with duplicate h1s | Medium | `content-duplicate-h1` | content | medium | `content-heading-unique` is within-document; cross-page H1 dupes untracked |

#### Mobile Friendly (4 missing, 2 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| MISSING | Has one or more image-map `<map>` tags | High | `mobile-image-maps` | mobile | trivial | No `<map>` detection |
| MISSING | Viewport meta tag does not have a width set | Medium | `mobile-viewport-content` | mobile | trivial | Viewport directive analysis |
| MISSING | Viewport initial-scale is incorrect | Medium | `mobile-viewport-content` | mobile | trivial | Same rule |
| MISSING | Viewport missing initial-scale | Medium | `mobile-viewport-content` | mobile | trivial | Same rule |
| PARTIAL | Content does not size correctly to viewport | High | — | — | — | True check needs mobile-render layout measurement — out of scope (§4) |
| PARTIAL | Viewport has a minimum-scale set | Medium | `mobile-viewport-content` | mobile | trivial | Bare minimum-scale not flagged |

#### Performance (2 missing, 7 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| PARTIAL | Serve static assets with an efficient cache policy | Critical | `perf-asset-cache-policy` | perf | medium | Page headers only; per-asset headers need the Playwright response listener |
| PARTIAL | Efficiently encode images | High | `perf-image-encoding` | perf | medium | Size estimated, not measured per image |
| PARTIAL | Minify JavaScript | High | `perf-minify-js` (extend) | perf | medium | Inline scripts only; external JS not analysed |
| PARTIAL | Minify CSS | High | `perf-minify-css` (extend) | perf | medium | Inline styles only |
| PARTIAL | Enable text compression | High | `perf-asset-compression` | perf | medium | Page response only; sub-resources not checked |
| PARTIAL | Properly size images | Medium | `perf-image-oversize` | perf | complex | Rendered vs intrinsic size needs layout measurement |
| PARTIAL | Transferred image size over 100KB | Medium | `perf-image-encoding` | perf | medium | Estimate-based at 200KB threshold |
| MISSING | Remove unused CSS | Medium | `perf-unused-css` | perf | complex | Needs CSS coverage API — already planned in Lighthouse PRD Phase 3, not yet implemented |
| MISSING | Remove unused JavaScript | Medium | `perf-unused-js` | perf | complex | Same |

#### Rendered (0 missing, 1 partial)

| Status | Hint | Importance | Proposed rule | Dir | Effort | Gap |
|---|---|---|---|---|---|---|
| PARTIAL | Nofollow only in the HTTP response HTML | High | `js-noindex-mismatch` (extend to nofollow) | js | trivial | noindex changes detected; nofollow-only changes not |

### 5.2 Prioritised phases

#### P0 — Critical/High static gaps (11 new rules, 5 extensions)

Everything checkable from `context.$`, `context.headers`, and data already in
`AuditContext`. One file + one `registerRule()` line each — no plumbing changes.

| Rule | Covers hints | Importance |
|---|---|---|
| `core-canonical-outside-head` | Canonical outside of head | Critical |
| `core-canonical-attributes` | Invalid + superfluous canonical attributes | Critical/High |
| `technical-empty-html` | HTML missing or empty | Critical |
| `htmlval-title-outside-head` | Title outside head | Critical |
| `htmlval-base-url` | 3 base-URL hints | Low |
| `technical-form-get-method` | Form with GET method | High |
| `links-non-http-protocol` | Non-HTTP protocol links | High |
| `i18n-hreflang-relative-url` | Relative hreflang URLs | High |
| `mobile-image-maps` | Image-map `<map>` tags | High |
| `mobile-viewport-content` | 4 viewport directive hints | Medium |
| `core-canonical-multiple` | Multiple/mismatched canonical tags | High/Low |
| extend `htmlval-size-limit` | Google 2MB crawl cutoff framing | Critical |
| extend `core-robots-meta` → `core-robots-directive-mismatch` | 6 robots directive location/multiplicity hints | High/Medium |
| extend `i18n-hreflang-conflicting` | 2 conflicting-annotation variants | High |
| extend `js-noindex-mismatch` to nofollow | Nofollow only in response HTML | High |
| extend `url-parameters` | Repetitive params, multiple `?` | Low |
| `technical-duplicate-gtm`, `technical-duplicate-ga` | Duplicate analytics snippets | Low |
| `content-title-same-as-description` | Title = description | Low |

#### P1 — Crawl-level cross-referencing (7 new rules + SiteContext extension)

All blocked on extending `SiteContext` (currently link graph + depths only) with
per-URL state the crawler already knows at crawl time:

```ts
/** One record per crawled URL, populated in crawl mode */
site.pages?: Map<string, {
  statusCode: number;           // final HTTP status (0 on timeout)
  canonical?: string | null;    // resolved canonical target
  noindex: boolean;
  nofollow: boolean;
  disallowed: boolean;          // matched by robots.txt (already fetched)
  hreflangOut: Map<string, string>;  // hreflang -> target URL
}>;
```

Optional field, so single-page audits and stubbed test contexts are unaffected.

| Rule | Covers hints | Importance |
|---|---|---|
| `crawl-sitemap-non-200` | 5 sitemap-status hints (5XX/4XX/403/3XX/timeout) | Critical ×2, High, Medium ×2 |
| `crawl-sitemap-non-canonical` | Canonicalized URL in sitemaps | High |
| `crawl-sitemap-disallowed` | Disallowed URL in sitemaps | High |
| `crawl-sitemap-cross-duplicates` | URL in multiple sitemaps | Insight |
| `crawl-canonical-to-noindex` | Canonical points to noindex URL | High |
| `crawl-canonical-to-disallowed` | Canonical points to disallowed URL | High |
| `crawl-hreflang-to-noindex` | Hreflang to noindex URLs | Critical |
| `crawl-hreflang-to-disallowed` + `crawl-hreflang-disallowed-target` | 2 hreflang/robots hints | High |
| extend `i18n-hreflang-to-broken` / `i18n-hreflang-to-redirect` | Real 4xx/5xx/3xx target status | High |
| `crawl-pagination-isolated` | Pagination URL with no incoming links | Medium |
| `content-duplicate-h1` | Cross-page duplicate H1s | Medium |

#### P2 — Crawler instrumentation + heavy per-resource checks

| Item | Covers hints | Effort |
|---|---|---|
| Crawler discovery-source tracking → `crawl-isolated-url` | 4 isolated-URL hints (High) | complex — record whether each URL was discovered via anchor, canonical, redirect, or sitemap |
| Crawl-level hreflang graph → `crawl-hreflang-incoming-conflict`, `crawl-hreflang-reciprocity`, `i18n-hreflang-incoming-invalid` | 4 international hints (Critical/High) | complex |
| Inbound link rel/anchor analysis → `links-inbound-all-nofollow`, `links-inbound-low-quality`, `links-inbound-mixed-follow`, `links-inbound-anchor-text` | 4 links/indexability hints (Medium/Insight) | complex — needs inbound anchor + rel per edge in SiteContext |
| Resource redirect tracing → `redirect-resource-broken`, `redirect-resource-loop`, `redirect-resource-chain` | 4 redirect hints (High/Medium) | medium — Playwright response listener extension |
| Per-asset perf analysis → `perf-asset-cache-policy`, `perf-image-encoding`, `perf-asset-compression`, external minify | 5 performance partials (Critical/High/Medium) | medium — same response listener |
| `perf-unused-css`, `perf-unused-js` | 2 performance hints (Medium) | complex — **owned by Lighthouse PRD Phase 3**; do not duplicate |
| True canonical loop/chain detection → `crawl-canonical-loop`, `crawl-canonical-chain` | 2 indexability hints (High) | medium once `site.pages.canonical` exists (P1) — can ship in P1 if the map lands early |
| `core-canonical-external`, `i18n-hreflang-x-default` | 2 Insight hints | trivial — bundle with P0 if convenient |

## 6. Deliberately skipped hints (29)

| Group | Count | Reason |
|---|---|---|
| Search Traffic | 8 | Every hint requires connected GSC/GA4 accounts ("per the connected Google Analytics and Google Search Console accounts"). The CLI has no API integration layer; this is a product decision, not a rule gap. |
| AMP | 19 | AMP no longer confers ranking or SERP-feature benefits since the 2021 page-experience update; Google has been dismantling AMP infrastructure. Building 19 checks for a deprecated format is negative ROI. Revisit only on user demand. |
| Analytics presence | 2 | "URL contains no GA/GTM code" is not an SEO issue and false-positives on deliberately tracker-free sites. |

Also noted as **acceptable partials** (no new rule planned): insight-level hints
whose underlying condition we already detect but don't surface as neutral info
(canonicalized URLs, internal disallowed URLs, bare `<noscript>` in head, external
redirects, sort/filter/pagination parameter classification, "missing hreflang"
inference on monolingual sites).

## 7. Out of scope

- GSC / GA4 / any third-party API integration.
- AMP rule category.
- axe-core-class rendered accessibility auditing (covered by the Lighthouse PRD).
- Lighthouse PSI integration (covered by the Lighthouse PRD, Phase 1b).
- Mobile-render layout measurement for viewport overflow.
- Changes to category weights: new rules slot into existing categories, which are
  already rebalanced (D2 in the Lighthouse PRD). If P0+P1 ship fully, re-examine
  whether `crawl` (5% weight, growing to ~30 rules) deserves a bump — open decision.

## 8. Success criteria

| # | Criterion |
|---|---|
| S1 | Every Critical/High MISSING hint that is statically checkable has a rule (P0 complete): rule count 287 → ~298 |
| S2 | After P1, all 9 XML Sitemap hints and all canonical-target hints are covered in crawl mode |
| S3 | New `SiteContext` fields are optional; `npm run test:run` stays green with existing stubbed contexts |
| S4 | No new runtime dependency; `npm pack --dry-run` still ships only `dist/` |
| S5 | Gap mapping (`reports/hints-mapping.json`) updated: MISSING count drops from 47 to ≤ 12 (the complex P2 remainder) |
| S6 | Each new rule cites its reference hint slug (from `reports/hints-catalog.json`) in a doc comment for traceability |

## 9. Risks

| Risk | Mitigation |
|---|---|
| `SiteContext.pages` balloons memory on large crawls | Store primitives only (status, canonical string, booleans); no per-URL HTML |
| Crawl-level rules silently no-op in single-page mode | Follow the `links-orphan-pages` precedent: return `notMeasured()` when `context.site` is absent |
| P0 trivial rules fire false positives (e.g. `core-canonical-attributes` on exotic-but-valid markup) | Match the catalog's documented trigger conditions exactly; each hint page lists "Examples that trigger this Hint" — use them as test fixtures |
| Overlap with Lighthouse PRD Phase 3 (`perf-unused-css/js`, resource listener work) | Those two rules are explicitly assigned to the Lighthouse PRD; per-asset perf rules here should reuse whatever listener extension Phase 3 lands |
| Rule dilution in `crawl` category | Re-examine category weights after P1 (see §7) |

## 10. Sequencing

**P0 first** — all static, no plumbing, highest importance-to-effort ratio, and it
clears every Critical gap except the sitemap/hreflang ones. **P1** follows once the
`SiteContext.pages` extension is designed; it is one context change plus a batch of
consumers. **P2** items are independent and can be picked off in any order; the
isolated-URL work (crawler discovery tracking) is the single largest lift and should
come last.

---

## Appendix — data artifacts

| Artifact | Path |
|---|---|
| Extraction script | `scripts/extract-hints.mjs` |
| Raw extraction (240 hints) | `reports/hints-catalog.json` |
| Coverage mapping (hand-authored) | `scripts/hints-mapping.mjs` |
| Joined mapping + stats generator | `scripts/map-hints.mjs` |
| Full per-hint mapping with rule IDs | `reports/hints-mapping.json` |
