---
name: seo-audit
description: Run the SEOmator CLI on a site and score it against 398 rules across 20 categories (SEO, technical, content, security, JS rendering, AI readiness), with reports an LLM can act on. It can also diff two audits to show what a deploy changed. Reach for it to find out why a site underperforms in search, to review a site's health, or to check a release before and after.
license: MIT
compatibility: Requires Node.js 20.18.1+ and npm. Chrome/Chromium optional for Core Web Vitals and JS rendering.
metadata:
  author: seomator
  version: "8.0.1"
allowed-tools: Bash(seomator:*)
---

# SEO Audit Skill

SEOmator is a command-line auditor. Point it at a URL and it fetches the page (or crawls the site), checks it against **398 rules** across **20 categories**, and prints every problem it finds with a severity, the URLs involved, and a fix.

## Links

* SEOmator npm package: [npmjs.com/package/@seomator/seo-audit](https://www.npmjs.com/package/@seomator/seo-audit)
* GitHub repository: [github.com/seo-skills/seo-audit-skill](https://github.com/seo-skills/seo-audit-skill)
* Web UI: [seomator.com/free-seo-audit-tool](https://seomator.com/free-seo-audit-tool)

## Coverage

The CLI runs **398 rules** in **20 categories**:

- **Core SEO** (27 rules): Canonical URLs, indexing directives, title uniqueness, canonical conflicts/loops
- **Performance** (30 rules): LCP, CLS, FCP, TTFB, INP, compression, caching, minification, HTTP/2
- **Links** (27 rules): Broken links, redirect chains, anchor text, localhost/fragment links, plus click depth and inbound internal links from the site graph (`--crawl`)
- **Images** (15 rules): Alt text, dimensions, lazy loading, modern formats, alt length, background images
- **Security** (26 rules): HTTPS, HSTS, CSP, external link safety, leaked secrets, SSL expiry/protocol, cookie flags and lifetime
- **Technical SEO** (19 rules): robots.txt, sitemap.xml, URL structure, 404 pages, soft 404s, error codes
- **Crawlability** (39 rules): Sitemap conflicts, indexability signals, canonical chains, pagination issues, sitemap lastmod quality
- **Structured Data** (19 rules): Schema.org markup, Article, Organization, FAQ, Product, Breadcrumb
- **JavaScript Rendering** (17 rules): Rendered DOM checks, raw vs rendered mismatches, SSR detection, console errors, failed resource requests
- **Accessibility** (46 rules): ARIA labels, color contrast, form labels, landmarks, touch targets
- **Content** (27 rules): Word count, readability, keyword density, duplicate detection, pixel widths
- **Social** (13 rules): Open Graph tags, Twitter cards, share buttons, profile links
- **E-E-A-T** (16 rules): Author bylines, citations, trust signals, about/contact pages, YMYL detection
- **URL Structure** (14 rules): Keyword slugs, stop words, uppercase, underscores, session IDs, tracking params
- **Redirects** (11 rules): Redirect loops, types (301/302), meta refresh, JavaScript redirects, broken redirects
- **Mobile** (13 rules): Font sizes, horizontal scroll, interstitials, viewport, mobile-first parity (content, title, canonical, structured data, links) via `--cwv --mobile`
- **Internationalization** (13 rules): lang attribute, hreflang validation (return links, conflicts, mismatches)
- **HTML Validation** (12 rules): Doctype, charset, head structure, lorem ipsum, multiple titles/descriptions
- **AI/GEO Readiness** (13 rules): Semantic HTML, AI bot access, llms.txt, schema drift
- **Legal Compliance** (1 rule): Cookie consent

A report contains:
- A score out of 100 and a letter grade (A-F) for the whole site
- Pass, warn and fail counts for each category
- Every issue, grouped by rule, with the URLs it affects
- A concrete fix for each issue

## Typical Requests

Load this skill for requests such as:
- A general SEO health check of a site
- Debug technical SEO issues
- Check for broken links and redirect chains
- Validate meta tags, canonical URLs, and structured data
- Audit security headers, SSL, and HTTPS
- Check accessibility compliance
- Analyze JavaScript rendering and SSR compatibility
- Evaluate AI/GEO readiness (semantic HTML, llms.txt, bot access)
- Detect duplicate content across pages
- Validate hreflang and internationalization setup
- Check HTML document structure and validation
- Generate site audit reports in multiple formats
- Compare site health before/after changes

## Prerequisites

This skill requires the SEOmator CLI to be installed.

### Installation

```bash
npm install -g @seomator/seo-audit
```

### Verify Installation

Check that seomator is installed and the system is ready:

```bash
seomator self doctor
```

This checks:
- Node.js version (20.18.1 or later required)
- npm availability
- Chrome/Chromium for Core Web Vitals and JS rendering
- Write permissions for ~/.seomator
- Local config file presence

## Setup

Running `seomator init` creates a `seomator.toml` config file in the current directory.

```bash
seomator init                    # Interactive setup
seomator init -y                 # Use defaults
seomator init --preset blog      # Blog-optimized config
seomator init --preset ecommerce # E-commerce config
seomator init --preset ci        # Minimal CI config
```

If there is no `seomator.toml` in the directory, CREATE ONE with `seomator init -y` before running audits.
Plain `seomator init` asks questions, and without a terminal it exits 0 without writing a file.

## Usage

### AI Agent Best Practices

**YOU SHOULD always prefer `--format llm`** - it provides token-optimized XML output specifically designed for AI agents (50-70% smaller than JSON).

When auditing:
1. **Prefer live websites** over local dev servers for accurate performance and rendering data
2. **Add `--cwv` when you need the browser render.** Audits skip it by default
   because it is slow, so without `--cwv` Core Web Vitals, the JavaScript
   rendering rules, `js-console-errors`, `js-failed-requests`, the
   rendered-asset checks and all `mobile-parity-*` rules report unmeasured
   rather than passing or failing
3. **Match the flags to the question.** Rules that need more than one page or
   more than one render are unmeasured without the right flag:

   | To check | Run with |
   |----------|----------|
   | Click depth, inbound internal links | `--crawl` (builds the site graph) |
   | Mobile-first indexing parity | `--cwv --mobile` (second render at a phone viewport) |
   | JS errors, failed subresources, Core Web Vitals | `--cwv` (renders the page in a browser) |
   | What a deploy changed | run before and after, then `seomator compare <domain>` |

4. **Scope fixes as concurrent tasks** when implementing multiple fixes
5. **Run typechecking/formatting** after implementing fixes (tsc, eslint, prettier, etc.)

### Website Discovery

No URL in the request? Work one out before asking:
1. Read the project for a deployed address: `package.json` homepage, `.env` files, hosting config
2. Read the project for a dev server: the `dev` or `start` script and its port
3. Only then ask which URL to audit

When both a deployed site and a local dev server exist, **prefer the deployed site**: only there do real headers, redirects, CDN caching and TLS show up.

### Basic Workflow

```bash
# Quick single-page audit with LLM output
seomator audit https://example.com --format llm

# Multi-page crawl (up to 50 pages)
seomator audit https://example.com --crawl -m 50 --format llm

# Full audit with Core Web Vitals + JS rendering analysis
seomator audit https://example.com --crawl -m 20 --format llm --cwv
```

### Advanced Options

Audit specific categories only:
```bash
seomator audit https://example.com -c core,security,js --format llm
```

Save HTML report for sharing:
```bash
seomator audit https://example.com --format html -o report.html
```

Verbose output for debugging:
```bash
seomator audit https://example.com --format llm -v
```

## MCP server

`seomator mcp` serves the same engine as MCP tools over stdio, registered as
`seomator-audit`:

```bash
claude mcp add seomator-audit -- npx -y @seomator/seo-audit mcp                  # public sites
claude mcp add seomator-audit -- npx -y @seomator/seo-audit mcp --allow-private  # also local and intranet sites
```

Tools: `audit_url` (returns a `runId` at once, `waitS` up to 25), `audit_status`,
`cancel_run`, `list_audits`, `get_audit`, `get_findings` (paged), `compare_audits`,
`list_rules`, `explain_rule`. Failures are `isError` with `{ code, message, hint }`.
See `docs/ai-agent-integration.md` for the full contract.

## Exit codes

An agent must be able to tell "the audit failed" from "the site scored badly".
`audit`, `analyze` and `compare` use these codes (other commands, such as
`self doctor`, or `config <key>` for a key that does not exist, exit `1` on an
error of their own):

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | The run worked, and a gate failed: `audit`/`analyze` scored under `--fail-under` (default 70), a `[rules.override]` rule with `fail_ci = true` failed or could not be measured, a crawl measured less than `--min-coverage`, or `compare --fail-on-regression` found a regression. The last stderr line starts with `Exit 1:` and says which; JSON carries it in `gate` |
| `2` | The command failed: bad flag, invalid config (including an unknown rule id in `[rules.override]`), unreachable URL, HTTP error, a start page that stays rate-limited, missing crawl, bad `--config` path |
| `130` | Cancelled with Ctrl-C |

**A non-zero exit is not automatically a failure.** `1` means the tool worked
and is telling you something about the site. Only `2` means it could not do the
job. Under `--format json`, a `2` also puts a structured error on stdout with a
stable `code` field (`hint` appears only when there is one):

```json
{ "error": true, "code": "http-error", "message": "...", "hint": "...", "timestamp": "..." }
```

Under `--format llm` the same error is XML:
`<seo-audit ok="false"><error code="http-error"><message>…</message><hint>…</hint></error></seo-audit>`.

A command line the parser rejects (an unknown flag, an invalid URL or option
value) exits `2` with the reason on stderr, starting `error:`, and nothing on
stdout. Treat that as a usage error to fix, not as a failed site; `1` always
means a gate failed.

`code` is one of `dns`, `unreachable` (nothing answered: refused, reset or no
route), `tls` (certificate rejected), `timeout`, `http-error`, `non-html`,
`rate-limited` (the start page kept answering 429 or 503), `private-address`
(a request resolved to a loopback, private or link-local address and was
refused), `playwright-missing`, `no-pages`, `config`, `aborted` or `unknown`.

## Command Reference

### `audit` Flags

| Flag | Short | What it does | Default |
|--------|-------|-------------|---------|
| `--format <fmt>` | `-f` | Output format: console, json, html, markdown, llm | console |
| `--max-pages <n>` | `-m` | Maximum pages to crawl | 10 |
| `--crawl` | | Enable multi-page crawl | false |
| `--categories <list>` | `-c` | Comma-separated categories to audit | All |
| `--cwv` | `--render` | Render in a browser: Core Web Vitals, JS rendering, axe-core accessibility, unused JS/CSS and image sizing | false |
| `--mobile` | | Render mobile viewport + mobile-first parity (single-page); implies `--cwv` | false |
| `--verbose` | `-v` | Show progress | false |
| `--output <path>` | `-o` | Output file path | |
| `--config <path>` | | Config file path | |
| `--no-save` | | Do not store this audit in ~/.seomator | |
| `--staging` | | Audit a staging site: waive the noindex and robots.txt caps and crawl past robots.txt; the waived caps are listed | false |
| `--fail-under <n>` | | Exit 1 when the score is below n (overrides `[ci] fail_under`) | 70 |
| `--min-coverage <pct>` | | With `--crawl`: exit 1 when fewer than pct% of the attempted pages were measured | 0 |
| `--max-duration <s>` | | With `--crawl`: stop requesting pages after s seconds and score what was fetched | no limit |
| `--ignore-crawl-delay` | | With `--crawl`: do not honour the site's robots.txt `Crawl-delay` | false |
| `--refresh` | `-r` | Check every external link again instead of using the link cache | false |

Audits are stored by default, so `compare` and `report` always have history.

### Dashboard

`seomator serve` runs a local web dashboard over the stored audits (history,
per-rule detail, comparisons, exports). For scripted access, read the token
from `~/.seomator/serve.json` and send it as `X-SEOmator-Token`; `GET /api`
lists every route. See `docs/WEB-DASHBOARD.md`.

Each audit opens on its score, then one fix queue ranked by the score points
each fix returns. In `GET /api/audits/:id`, every failing or warning rule
summary carries `points`: what the score gains when that rule passes. An
audit's points add up to what its score is missing, so they rank fixes
exactly; the detail also carries `categoryWeights`.

### Compare Command Options

`seomator compare <domain>` diffs two stored audits of the same site. Every
audit is stored unless it ran with `--no-save`.

| Option | Description | Default |
|--------|-------------|---------|
| `--against <auditId>` | Compare against a specific audit instead of the previous run | latest-but-one |
| `--trend` | Show score history for the domain instead of a two-run diff | false |
| `--json` / `-j` | Machine-readable diff | false |
| `--fail-on-regression` | Exit 1 when the score dropped or any rule's status got worse. Two audits measured differently (Core Web Vitals, scoring model, rule filters, rule options, staging) are reported as not like-for-like and never fail | false |

Rules are diffed by ID, so a rule that broke and a different one that was fixed
are reported separately rather than cancelling out in a count.

### Other Commands

```bash
seomator init              # Create config file
seomator self doctor       # Check system setup
seomator config --list     # Show all config values
seomator explain <rule-id> # What a rule checks, its weight, the fix and override lines
seomator report --list     # List past reports
seomator compare <domain>  # Diff the two most recent saved audits
seomator db stats          # Show database statistics
```

## Output Formats

| Format | Flag | Best For |
|--------|------|----------|
| console | `--format console` | Human terminal output (default) |
| json | `--format json` | CI/CD, programmatic processing |
| html | `--format html` | Standalone reports, sharing |
| markdown | `--format markdown` | Documentation, GitHub |
| llm | `--format llm` | **AI agents** (recommended) |

The `--format llm` output is a compact XML format optimized for token efficiency:
- **50-70% smaller** than JSON output
- Issues sorted with failures first, then by impact (rule and category weight,
  share of pages, `[rules.override]` priority); the dashboard and the HTML report
  rank one fix queue by score points instead
- Fix suggestions included for each issue
- Clean stdout for piping to AI tools

## Examples

### Example 1: One page, report for the agent

```bash
# Request: "Any SEO problems on example.com?"
seomator audit https://example.com --format llm
```

### Example 2: Crawl up to 100 pages

```bash
# Request: "Go through the whole site, up to 100 pages"
seomator audit https://example.com --crawl -m 100 --format llm
```

### Example 3: Re-check after a deploy

```bash
# Request: "Run it again and re-check every external link"
# Pages are always fetched fresh. External link answers are kept in a link
# cache for 7 days by default; --refresh checks every external link again.
seomator audit https://example.com --format llm --refresh
```

### Example 4: Generate Shareable Report

```bash
# Request: "Create an HTML report I can share"
seomator audit https://example.com --crawl -m 20 --format html -o seo-report.html
```

### Example 5: Focus on Specific Areas

```bash
# Request: "Just check my JavaScript rendering and redirects"
seomator audit https://example.com -c js,redirect --format llm --cwv
```

### Example 6: Did This Deploy Make Anything Worse?

```bash
# A baseline before the change (stored automatically)
seomator audit https://example.com

# ... deploy ...

seomator audit https://example.com
seomator compare example.com --json
```

`compare` reports which specific rules changed status, which is more useful than
a score delta on its own: a score can hold steady while one thing broke and
another was fixed. Use `--fail-on-regression` to make this a CI gate.

### Example 7: Diagnosing a Page That Renders Empty

```bash
# js-console-errors and js-failed-requests need a real browser render,
# so pass --cwv here.
seomator audit https://example.com -c js --format llm --cwv
```

An uncaught exception halts the script that threw it, so content, structured
data or canonical tags that script would have written never appear to a
rendering crawler. A 404 on a script is invisible to static HTML analysis: the
tag is present and well-formed, and only a real fetch reveals nothing came back.

## Evaluating Results

### Score Ranges

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent - Minor optimizations only |
| 80-89 | B | Good - Address warnings |
| 70-79 | C | Fair - Several issues to fix |
| 50-69 | D | Needs Work - Priority fixes required |
| 0-49 | F | Poor - Critical issues to resolve |

### Priority Order (by category weight)

Fix issues in this order for maximum impact:

1. **Core** (11%) - Meta tags, canonical, H1, indexing
2. **Performance** (10%) - Core Web Vitals + optimization
3. **Links** (8%) - Internal linking structure
4. **Images** (8%) - Performance + accessibility
5. **Security** (8%) - Trust signals, SSL
6. **Technical SEO** (7%) - Crawling foundation
7. **Accessibility** (7%) - WCAG compliance
8. **Crawlability** (5%) - Indexability, pagination
9. **Structured Data** (5%) - Rich snippets
10. **JavaScript Rendering** (5%) - Rendered DOM, SSR
11. **Content** (5%) - Text quality + duplicates
12. **Social** (3%) - Social sharing
13. **E-E-A-T** (3%) - Trust, expertise
14. **URL Structure** (3%) - URL hygiene
15. **Redirects** (3%) - Redirect chains
16. **Mobile** (2%) - Viewport, fonts
17. **Internationalization** (2%) - Hreflang
18. **HTML Validation** (2%) - Document structure
19. **AI/GEO Readiness** (2%) - Semantic HTML, AI bots
20. **Legal Compliance** (1%) - Cookie consent

### Fix by Severity

1. **Failures (status: "fail")** - Must fix immediately
2. **Warnings (status: "warn")** - Should fix soon
3. **Passes (status: "pass")** - No action needed

### How Scoring Works

A category score is the average of its rule results — `pass` 100, `warn` 50,
`fail` 0 — weighted by each rule's declared weight, so a heavy rule such as
`security-https` moves the category far more than a minor one. The overall score
is the weighted average of category scores using the weights above. Advisory
rules (new checks, marked "Advisory" in every report) are listed but never count
toward a score.

**A page-level condition can cap the overall score.** An average cannot say
"nothing else matters", so while one of these holds, the overall score stays at
or under its ceiling whatever the categories average. A crawl takes only the
first two, read from its start page:

| Condition | Ceiling |
|-----------|---------|
| `noindex` for Google (robots meta tag or `X-Robots-Tag`) | 20 |
| robots.txt disallows the page for Googlebot | 20 |
| No `<title>` and fewer than 20 words of main content | 30 |
| Fewer than 20 words of main content | 49 |
| No `<title>` | 69 |

The JSON result then carries `scoreCap: { uncappedScore, caps: [{ id, ceiling,
reason }] }`, and `--format llm` a `<score-cap>` element. **Fix the cap first:**
no other fix moves the score while it holds.

**Audit a staging site with `--staging`.** It waives the noindex and robots.txt
caps (the content caps stay), and a crawl ignores robots.txt so a `Disallow: /`
site is crawled past its first page. What it waived is in `waivedCaps`, and in a
`<waived-caps>` element under `--format llm`: that list is what must change at
launch. Never compare a staging audit to a production one as like-for-like;
`compare` flags the difference.

**Unmeasured checks carry weight 0 and do not affect the score.** A check whose
input was unavailable is reported so the gap is visible, but scores neither for
nor against the site — you cannot score what you did not measure. This is why:

- `cwv-inp` always reports unmeasured. INP requires real user interaction, which
  an automated crawl does not perform. For real INP use field data (CrUX or RUM).
- Running without `--cwv` reports the Core Web Vitals rules and most JavaScript
  rendering rules as unmeasured rather than passing or failing them. **A site
  audited with `--cwv` is not directly comparable to one audited without it**,
  because a different set of rules contributed to the score.
- `links-depth` and `links-orphan-pages` need the site-wide link graph, which
  only exists in crawl mode. **Run with `--crawl` to measure them**; a
  single-page audit reports them unmeasured because click distance and inbound
  links cannot be known from one page.
- The `mobile-parity-*` rules need a second render at a mobile viewport. **Run
  with `--cwv --mobile`** to measure them.
- Checks that compare a page with the rest of the site (`core-title-unique`,
  `content-duplicate-description`, `content-duplicate-exact`,
  `content-duplicate-near`, `crawl-sitemap-orphan-urls`) report unmeasured on a
  single page. A page with no title or no meta description still fails
  `core-title-unique` or `content-duplicate-description`: that is a missing
  field, not a uniqueness question. **Run with `--crawl`** to measure them.
- A check with nothing to grade reports unmeasured rather than passing: the
  JSON-LD validators on a page without JSON-LD (`schema-present` reports the
  absence), `eeat-author-expertise` when the page has no author, and
  `a11y-color-contrast` when every colour comes from a stylesheet.

> **Scores changed in v3.1.0.** Earlier versions weighted failing rules 100×
> less than passing ones, which inflated scores. If comparing against a report
> generated before 3.1.0, re-run the baseline rather than treating the drop as a
> regression.

## Reporting Back

Once the fixes are in, tell the user what changed and which issue each change resolves. Independent fixes can be split into separate tasks and handed to sub-agents in parallel.

## Troubleshooting

### `seomator: command not found`

The CLI is missing, or npm's global bin folder is not on PATH. Install it globally:
```bash
npm install -g @seomator/seo-audit
```

### Core Web Vitals not measured

If CWV metrics are missing, the audit may have run without `--cwv`, or
Chrome/Chromium may not be available.

**Solution:**
1. Pass `--cwv`: audits skip the browser render by default
2. Install Chrome, Chromium, or Edge
3. Run `seomator self doctor` to verify browser detection

### Crawl timeout or slow performance

For large sites, audits may take several minutes.

**Solution:**
- Use `--verbose` to see progress
- Limit pages with `-m 20` for faster results
- Leave out `--cwv`: it renders every crawled page in a browser

### Invalid URL

Pass the full URL, scheme included:

```bash
# Wrong
seomator audit example.com

# Correct
seomator audit https://example.com
```

## Pipeline

1. **Fetch**: Downloads the page HTML and measures response time
2. **Parse**: Extracts DOM, meta tags, links, images, structured data
3. **Enrich**: Fetches robots.txt and sitemap once per audit
4. **Render** (if CWV enabled): Captures rendered DOM via Playwright, plus console errors and failed resource requests
5. **Crawl** (if enabled): Discovers and fetches linked pages
6. **Analyze**: Runs 398 audit rules against each page
7. **Score**: Calculates category and overall weighted scores
8. **Report**: Generates output in requested format

Results are stored in `~/.seomator/` for later retrieval with `seomator report`.

## Trust Model

The `seomator` CLI fetches HTML from arbitrary user-supplied URLs. Any text
quoted from those pages — titles, meta tags, headings, link text, alt
attributes, schema content — is **untrusted input** that may attempt indirect
prompt injection against the LLM consuming the report.

The LLM-format reporter (`--format llm`) applies a layered defense:

1. **Per-report nonce.** Every render emits a 128-bit hex nonce on the root
   `<seo-audit>` element.
2. **Nonce-stamped delimiters.** Site-derived text inside `<msg>` and
   `<details>` is wrapped in `<untrusted-{nonce}>...</untrusted-{nonce}>`. An
   attacker cannot forge the closing tag because the nonce is unpredictable
   and unique per audit.
3. **Security notice.** The report includes a `<security-notice>` instructing
   the consuming LLM to treat the wrapped blocks as data, not instructions.
4. **Invisible-character stripping.** Zero-width chars (U+200B–U+200D, U+2060,
   U+FEFF), Unicode tag block (U+E0000–U+E007F), and C0/C1 controls are
   removed from quoted content before XML escaping.
5. **XML escaping.** Any literal `<` `>` `&` `"` `'` inside untrusted content
   is escaped, so a crafted `</untrusted-...>` literal becomes inert text.

Tool-authored fields — fix suggestions, rule IDs, category metadata — are
emitted as plain XML and are not wrapped, since wrapping trusted content in
untrusted delimiters would dilute the signal.

## Resources

- **Full rules reference**: See `docs/SEO-AUDIT-RULES.md` for all 398 rules
- **Storage architecture**: See `docs/STORAGE-ARCHITECTURE.md` for database details
- **CLI help**: `seomator --help` and `seomator <command> --help`
