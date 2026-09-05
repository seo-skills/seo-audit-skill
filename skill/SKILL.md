---
name: seo-audit
description: Audit websites for SEO, technical, content, security, JS rendering, and AI readiness using SEOmator CLI. Returns LLM-optimized reports with health scores across 332 rules and 20 categories, and can diff two audits to show what a deploy changed. Use when analyzing websites, debugging SEO issues, checking site health, or comparing a site before and after a change.
license: MIT
compatibility: Requires Node.js 20.3+ and npm. Chrome/Chromium optional for Core Web Vitals and JS rendering.
metadata:
  author: seomator
  version: "4.1.0"
allowed-tools: Bash(seomator:*)
---

# SEO Audit Skill

Audit websites for SEO, technical, content, performance, security, JavaScript rendering, and AI readiness using the SEOmator CLI.

SEOmator provides comprehensive website auditing by analyzing website structure and content against **332 rules** across **20 categories**.

It provides a list of issues with severity levels, affected URLs, and actionable fix suggestions.

## Links

* SEOmator npm package: [npmjs.com/package/@seomator/seo-audit](https://www.npmjs.com/package/@seomator/seo-audit)
* GitHub repository: [github.com/seo-skills/seo-audit-skill](https://github.com/seo-skills/seo-audit-skill)
* Web UI: [seomator.com/free-seo-audit-tool](https://seomator.com/free-seo-audit-tool)

## What This Skill Does

This skill enables AI agents to audit websites for **332 rules** in **20 categories**, including:

- **Core SEO** (24 rules): Canonical URLs, indexing directives, title uniqueness, canonical conflicts/loops
- **Performance** (26 rules): LCP, CLS, FCP, TTFB, INP, compression, caching, minification, HTTP/2
- **Links** (24 rules): Broken links, redirect chains, anchor text, localhost/fragment links, plus click depth and inbound internal links from the site graph (`--crawl`)
- **Images** (14 rules): Alt text, dimensions, lazy loading, modern formats, alt length, background images
- **Security** (23 rules): HTTPS, HSTS, CSP, external link safety, leaked secrets, SSL expiry/protocol, cookie flags and lifetime
- **Technical SEO** (17 rules): robots.txt, sitemap.xml, URL structure, 404 pages, soft 404s, error codes
- **Crawlability** (35 rules): Sitemap conflicts, indexability signals, canonical chains, pagination issues, sitemap lastmod quality
- **Structured Data** (13 rules): Schema.org markup, Article, Organization, FAQ, Product, Breadcrumb
- **JavaScript Rendering** (16 rules): Rendered DOM checks, raw vs rendered mismatches, SSR detection, console errors, failed resource requests
- **Accessibility** (31 rules): ARIA labels, color contrast, form labels, landmarks, touch targets
- **Content** (19 rules): Word count, readability, keyword density, duplicate detection, pixel widths
- **Social** (9 rules): Open Graph tags, Twitter cards, share buttons, profile links
- **E-E-A-T** (14 rules): Author bylines, citations, trust signals, about/contact pages, YMYL detection
- **URL Structure** (14 rules): Keyword slugs, stop words, uppercase, underscores, session IDs, tracking params
- **Redirects** (11 rules): Redirect loops, types (301/302), meta refresh, JavaScript redirects, broken redirects
- **Mobile** (12 rules): Font sizes, horizontal scroll, interstitials, viewport, mobile-first parity (content, title, canonical, structured data, links) via `--mobile`
- **Internationalization** (13 rules): lang attribute, hreflang validation (return links, conflicts, mismatches)
- **HTML Validation** (11 rules): Doctype, charset, head structure, lorem ipsum, multiple titles/descriptions
- **AI/GEO Readiness** (5 rules): Semantic HTML, AI bot access, llms.txt, schema drift
- **Legal Compliance** (1 rule): Cookie consent

The audit crawls the website, analyzes each page against audit rules, and returns a comprehensive report with:
- Overall health score (0-100) with letter grade (A-F)
- Category breakdowns with pass/warn/fail counts
- Specific issues with affected URLs grouped by rule
- Actionable fix recommendations

## When to Use

Use this skill when you need to:
- Analyze a website's SEO health
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
- Node.js version (18+ recommended)
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

If there is no `seomator.toml` in the directory, CREATE ONE with `seomator init` before running audits.

## Usage

### AI Agent Best Practices

**YOU SHOULD always prefer `--format llm`** - it provides token-optimized XML output specifically designed for AI agents (50-70% smaller than JSON).

When auditing:
1. **Prefer live websites** over local dev servers for accurate performance and rendering data
2. **Use `--no-cwv` for faster audits**, but know what it costs: it skips the
   browser render, so Core Web Vitals, the JavaScript rendering rules,
   `js-console-errors`, `js-failed-requests` and all `mobile-parity-*` rules
   report unmeasured rather than passing or failing
3. **Match the flags to the question.** Rules that need more than one page or
   more than one render are unmeasured without the right flag:

   | To check | Run with |
   |----------|----------|
   | Click depth, inbound internal links | `--crawl` (builds the site graph) |
   | Mobile-first indexing parity | `--mobile` (second render at a phone viewport) |
   | JS errors, failed subresources, Core Web Vitals | default (omit `--no-cwv`) |
   | What a deploy changed | run before and after, then `seomator compare <domain>` |

4. **Scope fixes as concurrent tasks** when implementing multiple fixes
5. **Run typechecking/formatting** after implementing fixes (tsc, eslint, prettier, etc.)

### Website Discovery

If the user doesn't provide a website to audit:
1. Check for local dev server configurations (package.json scripts, .env files)
2. Look for Vercel/Netlify project links
3. Check environment variables for deployment URLs
4. Ask the user which URL to audit

If you have both local and live websites available, **suggest auditing the live site** for accurate results.

### Basic Workflow

```bash
# Quick single-page audit with LLM output
seomator audit https://example.com --format llm --no-cwv

# Multi-page crawl (up to 50 pages)
seomator audit https://example.com --crawl -m 50 --format llm --no-cwv

# Full audit with Core Web Vitals + JS rendering analysis
seomator audit https://example.com --crawl -m 20 --format llm
```

### Advanced Options

Audit specific categories only:
```bash
seomator audit https://example.com -c core,security,js --format llm --no-cwv
```

Save HTML report for sharing:
```bash
seomator audit https://example.com --format html -o report.html
```

Verbose output for debugging:
```bash
seomator audit https://example.com --format llm -v
```

## Command Reference

### Audit Command Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--format <fmt>` | `-f` | Output format: console, json, html, markdown, llm | console |
| `--max-pages <n>` | `-m` | Maximum pages to crawl | 10 |
| `--crawl` | | Enable multi-page crawl | false |
| `--categories <list>` | `-c` | Comma-separated categories to audit | All |
| `--no-cwv` | | Skip Core Web Vitals + JS rendering | false |
| `--mobile` | | Render mobile viewport + mobile-first parity (single-page) | false |
| `--verbose` | `-v` | Show progress | false |
| `--output <path>` | `-o` | Output file path | |
| `--config <path>` | | Config file path | |
| `--no-save` | | Do not store this audit in ~/.seomator | |

Audits are stored by default, so `compare` and `report` always have history.

### Dashboard

`seomator serve` runs a local web dashboard over the stored audits (history,
per-rule detail, comparisons, exports). For scripted access, read the token
from `~/.seomator/serve.json` and send it as `X-SEOmator-Token`; `GET /api`
lists every route. See `docs/WEB-DASHBOARD.md`.

### Compare Command Options

`seomator compare <domain>` diffs two stored audits of the same site. Every
audit is stored unless it ran with `--no-save`.

| Option | Description | Default |
|--------|-------------|---------|
| `--against <auditId>` | Compare against a specific audit instead of the previous run | latest-but-one |
| `--trend` | Show score history for the domain instead of a two-run diff | false |
| `--json` / `-j` | Machine-readable diff | false |
| `--fail-on-regression` | Exit 1 when the score dropped or new failures appeared | false |

Rules are diffed by ID, so a rule that broke and a different one that was fixed
are reported separately rather than cancelling out in a count.

### Other Commands

```bash
seomator init              # Create config file
seomator self doctor       # Check system setup
seomator config --list     # Show all config values
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
- Issues sorted by severity (critical first)
- Fix suggestions included for each issue
- Clean stdout for piping to AI tools

## Examples

### Example 1: Quick Audit with LLM Output

```bash
# User asks: "Check example.com for SEO issues"
seomator audit https://example.com --format llm --no-cwv
```

### Example 2: Deep Crawl for Large Site

```bash
# User asks: "Do a thorough audit with up to 100 pages"
seomator audit https://example.com --crawl -m 100 --format llm --no-cwv
```

### Example 3: Fresh Audit After Changes

```bash
# User asks: "Re-audit the site, ignore cached results"
# Every run fetches every page fresh — there is no cache to bypass.
seomator audit https://example.com --format llm --no-cwv
```

### Example 4: Generate Shareable Report

```bash
# User asks: "Create an HTML report I can share"
seomator audit https://example.com --crawl -m 20 --format html -o seo-report.html
```

### Example 5: Focus on Specific Areas

```bash
# User asks: "Just check my JavaScript rendering and redirects"
seomator audit https://example.com -c js,redirect --format llm
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
# so do NOT pass --no-cwv here.
seomator audit https://example.com -c js --format llm
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
| 70-79 | C | Needs Work - Priority fixes required |
| 50-69 | D | Poor - Multiple critical issues |
| 0-49 | F | Critical - Major problems to resolve |

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
is the weighted average of category scores using the weights above.

**Unmeasured checks carry weight 0 and do not affect the score.** A check whose
input was unavailable is reported so the gap is visible, but scores neither for
nor against the site — you cannot score what you did not measure. This is why:

- `cwv-inp` always reports unmeasured. INP requires real user interaction, which
  an automated crawl does not perform. For real INP use field data (CrUX or RUM).
- Running `--no-cwv` reports the Core Web Vitals rules and most JavaScript
  rendering rules as unmeasured rather than passing or failing them. **A site
  audited with `--no-cwv` is not directly comparable to one audited without it**,
  because a different set of rules contributed to the score.
- `links-depth` and `links-orphan-pages` need the site-wide link graph, which
  only exists in crawl mode. **Run with `--crawl` to measure them**; a
  single-page audit reports them unmeasured because click distance and inbound
  links cannot be known from one page.
- The `mobile-parity-*` rules need a second render at a mobile viewport. **Run
  with `--mobile`** (and without `--no-cwv`) to measure them.

> **Scores changed in v3.1.0.** Earlier versions weighted failing rules 100×
> less than passing ones, which inflated scores. If comparing against a report
> generated before 3.1.0, re-run the baseline rather than treating the drop as a
> regression.

## Output Summary

After implementing fixes, give the user a summary of all changes made.

When planning scope, organize tasks so they can run concurrently as sub-agents to speed up implementation.

## Troubleshooting

### seomator command not found

If you see this error, seomator is not installed or not in your PATH.

**Solution:**
```bash
npm install -g @seomator/seo-audit
```

### Core Web Vitals not measured

If CWV metrics are missing, Chrome/Chromium may not be available.

**Solution:**
1. Install Chrome, Chromium, or Edge
2. Run `seomator self doctor` to verify browser detection
3. Use `--no-cwv` to skip CWV if not needed

### Crawl timeout or slow performance

For large sites, audits may take several minutes.

**Solution:**
- Use `--verbose` to see progress
- Limit pages with `-m 20` for faster results
- Use `--no-cwv` to skip browser-based measurements

### Invalid URL

Ensure the URL includes the protocol:

```bash
# Wrong
seomator audit example.com

# Correct
seomator audit https://example.com
```

## How It Works

1. **Fetch**: Downloads the page HTML and measures response time
2. **Parse**: Extracts DOM, meta tags, links, images, structured data
3. **Enrich**: Fetches robots.txt and sitemap once per audit
4. **Render** (if CWV enabled): Captures rendered DOM via Playwright, plus console errors and failed resource requests
5. **Crawl** (if enabled): Discovers and fetches linked pages
6. **Analyze**: Runs 332 audit rules against each page
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

- **Full rules reference**: See `docs/SEO-AUDIT-RULES.md` for all 332 rules
- **Storage architecture**: See `docs/STORAGE-ARCHITECTURE.md` for database details
- **CLI help**: `seomator --help` and `seomator <command> --help`
