# Introduction

> CLI Website Audits for Humans, Agents & LLMs

A comprehensive SEO audit tool with **148 rules** across **16 categories** that fits into your AI workflow. Built with Node.js, works with your system browser.

## Quick Links

- **npm**: https://www.npmjs.com/package/@seomator/seo-audit
- **GitHub**: https://github.com/seo-skills/seo-audit-skill
- **Web UI**: https://seomator.com/free-seo-audit-tool
- **Skills**: `npx skills add seo-skills/seo-audit-skill`

## Three Ways to Use SEOmator

### CLI for Humans

Run audits directly in your terminal with beautiful, human-readable output:

```bash
seomator audit https://example.com
```

Perfect for:
- Manual audits during development
- Quick site health checks
- Terminal-first workflows

### Pipe to AI

Pipe clean, LLM-optimized output to any AI assistant:

```bash
seomator audit https://example.com --format llm | claude
```

Perfect for:
- Ad-hoc AI assistance with audits
- Custom AI workflows and scripts
- Agents without skill support

### AI Agent Skills

Install the skill for fully autonomous AI workflows:

```bash
npx skills add seo-skills/seo-audit-skill
```

Then prompt your AI agent:

```
Use the seo-audit skill to audit this site and fix all issues
```

Perfect for:
- Autonomous fixing of SEO/accessibility issues
- Multi-step AI workflows with plan mode
- Continuous monitoring and regression detection

## Why SEOmator?

### AI-Native Design
Built for coding agents. LLM-optimized output works seamlessly with Claude Code, Cursor, and any AI assistant.

### Developer-First CLI
npm package with zero config needed. Works with your system Chrome/Chromium for Core Web Vitals.

### 148 Rules, 16 Categories
Comprehensive coverage across SEO, accessibility, performance, security, and E-E-A-T signals.

### Smart Incremental Crawling
SQLite-based storage with content hashing. Skip unchanged pages. Resume interrupted crawls.

### E-E-A-T Auditing
Dedicated rules for Experience, Expertise, Authority, and Trust—Google's top ranking signals.

### Multiple Output Formats
Console, JSON, HTML reports, Markdown, LLM-friendly output. Export exactly what you need.

## Works Where You Work

| Environment | Integration |
|-------------|-------------|
| **Terminal** | Run anywhere with a single command |
| **Claude Code** | Install the seo-audit skill for autonomous workflows |
| **Cursor** | Native skill integration with composer mode |
| **Any AI Agent** | Pipe text/JSON/markdown/llm to any LLM |
| **CI/CD** | Fail pipelines on audit errors with exit codes |
| **Shell Scripts** | Integrate into your automation workflows |

## Rule Categories

SEOmator runs **148 rules** across **16 categories**:

| Category | Weight | Rules | Description |
|----------|--------|-------|-------------|
| **Core SEO** | 11% | 19 | Meta tags, canonical, H1, indexing directives |
| **Performance** | 10% | 23 | Core Web Vitals + performance optimization hints |
| **Links** | 8% | 19 | Broken links, anchor text, internal linking, nofollow |
| **Images** | 8% | 14 | Alt text, dimensions, lazy loading, WebP/AVIF, srcset |
| **Security** | 8% | 23 | HTTPS, security headers, CSP strength, mixed content, SSL |
| **Accessibility** | 7% | 31 | WCAG, ARIA validity, landmarks, list/table structure, contrast |
| **Technical SEO** | 7% | 13 | robots.txt, sitemap, URL hygiene, www redirect, custom 404 |
| **Crawlability** | 5% | 19 | Indexability signals, sitemap coverage, pagination |
| **Structured Data** | 5% | 13 | JSON-LD presence/validity, required fields |
| **Content** | 5% | 17 | Word count, thin content, readability, duplicates |
| **JavaScript Rendering** | 5% | 16 | CSR vs SSR, rendered-DOM diff, console errors, document.write |
| **Social** | 3% | 9 | Open Graph, Twitter Card, og:image validity |
| **E-E-A-T** | 3% | 14 | Author bylines, dates, about/contact pages, citations |
| **URL Structure** | 3% | 14 | Lowercase, hyphens, length, parameters, trailing slash |
| **Redirects** | 3% | 8 | Chains, loops, 302-vs-301, meta refresh |
| **Mobile** | 2% | 10 | Viewport, font sizes, tap spacing, mobile-first parity |
| **Internationalization** | 2% | 10 | hreflang validity, x-default, lang attributes |
| **HTML Validation** | 2% | 9 | DOCTYPE, charset, head structure, duplicate meta |
| **AI/GEO Readiness** | 2% | 5 | AI crawler access, llms.txt, citability structure |
| **Legal Compliance** | 1% | 1 | Cookie consent, privacy policy presence |

**Total: 100% weight, 303 rules across 20 categories.**

## Resources

- **GitHub**: https://github.com/seo-skills/seo-audit-skill - View source, report issues, contribute
- **npm**: https://www.npmjs.com/package/@seomator/seo-audit - Package details and versions
- **Website**: https://seomator.com - Learn more about SEOmator
