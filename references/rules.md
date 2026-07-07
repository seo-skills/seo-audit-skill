# SEOmator Audit Rules Reference (v3.0.0)

<!-- Updated: 2026-07-07 — matches @seomator/seo-audit v3.0.0 -->

SEOmator v3.0.0 ships **251 rules across 20 weighted categories**. Category weights
sum to exactly 100. Each rule returns `pass` (100), `warn` (50), or `fail` (0);
category score is the weighted average of its rules, and the overall score is the
weighted average of category scores.

## Categories & Weights

| Category ID | Name | Weight | Rules | Covers |
|-------------|------|--------|-------|--------|
| `core` | Core | 12% | 19 | Title, meta description, canonical, viewport, favicon, H1, lang |
| `perf` | Performance | 12% | 22 | LCP, INP, CLS, TTFB, FCP, render-blocking resources, compression |
| `links` | Links | 8% | 19 | Broken links, anchor text, internal linking, nofollow, page depth |
| `images` | Images | 8% | 14 | Alt text, dimensions, lazy loading, WebP/AVIF, srcset, file size |
| `security` | Security | 8% | 16 | HTTPS, HSTS, CSP, X-Frame-Options, mixed content, cookies |
| `technical` | Technical SEO | 7% | 13 | robots.txt, sitemap, URL hygiene, www redirect, custom 404 |
| `crawl` | Crawlability | 5% | 18 | noindex, robots directives, sitemap coverage, redirect chains |
| `schema` | Structured Data | 5% | 13 | JSON-LD presence/validity, required fields, deprecated types |
| `content` | Content | 5% | 17 | Word count, thin content, readability, duplicate content |
| `js` | JavaScript Rendering | 5% | 13 | CSR vs SSR, rendered-DOM diff, JS-dependent content |
| `a11y` | Accessibility | 4% | 12 | ARIA, contrast, form labels, skip links, focus management |
| `social` | Social | 3% | 9 | Open Graph, Twitter Card, og:image validity |
| `eeat` | E-E-A-T | 3% | 14 | Author bylines, dates, about/contact pages, external citations |
| `url` | URL Structure | 3% | 14 | Lowercase, hyphens, length, parameters, trailing slash |
| `redirect` | Redirects | 3% | 8 | Chains, loops, 302-vs-301, meta refresh |
| `mobile` | Mobile | 2% | 5 | Viewport, touch targets, font sizes, tap spacing |
| `i18n` | Internationalization | 2% | 10 | hreflang validity, x-default, lang attributes |
| `htmlval` | HTML Validation | 2% | 9 | Duplicate IDs, deprecated tags, DOCTYPE, encoding |
| `geo` | AI/GEO Readiness | 2% | 5 | AI crawler access, llms.txt, citability structure |
| `legal` | Legal Compliance | 1% | 1 | Privacy policy presence |

## Rule ID Convention

Rule IDs follow `<category>-<descriptive-name>`, e.g. `core-canonical-conflicting`,
`perf-lcp`, `security-hsts`, `geo-llms-txt`. IDs are self-describing; the LLM report
format includes the rule message and a fix suggestion alongside each failing rule.

## Score Interpretation

| Overall Score | Grade | Meaning |
|---------------|-------|---------|
| 90–100 | A | Excellent — minor optimizations only |
| 80–89 | B | Good — address warnings |
| 70–79 | C | Fair — several issues to fix |
| 60–69 | D | Needs work — priority fixes required |
| <60 | F | Poor — critical issues to resolve |

## Listing Rules at Runtime

The authoritative rule list lives in the installed package. To enumerate rules for a
category, read the category's `index.ts` in the SEOmator source
(`src/rules/<category>/index.ts`) or run an audit and inspect per-rule results in
`--format json` output.

## Core Web Vitals Thresholds (used by `perf` rules)

| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| LCP | ≤2.5s | 2.5–4s | >4s |
| INP | ≤200ms | 200–500ms | >500ms |
| CLS | ≤0.1 | 0.1–0.25 | >0.25 |
| TTFB | ≤800ms | 800–1800ms | >1800ms |
| FCP | ≤1.8s | 1.8–3s | >3s |

INP is the sole interactivity metric (FID removed from all Chrome tooling
September 2024). Never reference FID.
