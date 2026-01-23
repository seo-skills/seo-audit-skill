# SEOmator Audit Skill

A Claude Code skill for running comprehensive SEO audits on websites.

## Overview

**SEOmator** is an SEO audit CLI tool that analyzes websites against **55 audit rules** across **9 categories**:

- **Meta Tags** - Title, description, canonical URLs, viewport, favicon
- **Headings** - H1 presence, hierarchy, content quality
- **Technical SEO** - robots.txt, sitemap, URL structure, redirects
- **Core Web Vitals** - LCP, CLS, INP, TTFB, FCP measurement
- **Links** - Broken links, anchor text, internal linking depth
- **Images** - Alt text, dimensions, lazy loading, modern formats
- **Security** - HTTPS, HSTS, CSP, security headers
- **Structured Data** - JSON-LD validation, required fields
- **Social** - Open Graph, Twitter cards

## Features

- **Single Page & Crawl Mode** - Audit one page or crawl entire sites
- **JSON Output** - Machine-readable results for AI parsing
- **Core Web Vitals** - Real browser measurement with Playwright
- **CI/CD Friendly** - Exit codes for automation pipelines
- **Concurrent Crawling** - Fast multi-page audits

## Installation

```bash
npm install -g @seomator/seo-audit
npx playwright install chromium
```

## Quick Start

```bash
# Basic audit with JSON output
seomator https://example.com --json

# Audit specific categories
seomator https://example.com --categories meta-tags,security --json

# Crawl multiple pages
seomator https://example.com --crawl --max-pages 20 --json
```

## Links

- **npm**: https://www.npmjs.com/package/@seomator/seo-audit
- **GitHub**: https://github.com/seo-skills/seo-audit-skill
- **Web UI**: https://seomator.com/free-seo-audit-tool
