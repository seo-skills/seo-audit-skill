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
| **Core** | 14% | 14 | Meta tags, canonical, H1, indexing |
| **Performance** | 14% | 12 | Core Web Vitals + performance hints |
| **Links** | 9% | 13 | Internal/external links |
| **Images** | 9% | 12 | Image optimization |
| **Security** | 9% | 12 | HTTPS, headers, mixed content |
| **Technical SEO** | 8% | 8 | Robots.txt, sitemap, SSL |
| **Crawlability** | 6% | 6 | Sitemap, indexability signals |
| **Structured Data** | 5% | 13 | JSON-LD, Schema.org |
| **Accessibility** | 5% | 12 | WCAG, ARIA compliance |
| **Content** | 5% | 11 | Text quality, readability, headings |
| **Social** | 4% | 9 | Open Graph, Twitter Cards |
| **E-E-A-T** | 4% | 14 | Trust signals, expertise |
| **URL Structure** | 3% | 2 | Slug keywords, stop words |
| **Mobile** | 3% | 3 | Font size, horizontal scroll |
| **Internationalization** | 1% | 2 | Language, hreflang |
| **Legal Compliance** | 1% | 1 | Cookie consent |

## Resources

- **GitHub**: https://github.com/seo-skills/seo-audit-skill - View source, report issues, contribute
- **npm**: https://www.npmjs.com/package/@seomator/seo-audit - Package details and versions
- **Website**: https://seomator.com - Learn more about SEOmator
