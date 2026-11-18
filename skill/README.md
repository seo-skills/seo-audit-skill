# SEOmator Audit Skill for Claude Code

A Claude Code skill for running comprehensive SEO audits and providing actionable recommendations.

## What This Skill Does

When you ask Claude to audit a website, this skill:

1. **Runs the SEOmator CLI** with appropriate options
2. **Parses the JSON results** to identify issues
3. **Evaluates findings** by severity and category
4. **Provides recommendations** with specific fixes
5. **Prioritizes actions** based on SEO impact

## Capabilities

- **398 SEO Rules** across 20 categories
- **Core Web Vitals** measurement (LCP, CLS, FCP, TTFB, INP)
- **Multi-page crawling** for site-wide audits
- **Actionable fixes** for every issue found

## Categories Analyzed

| Category | Weight | What It Checks |
|----------|--------|----------------|
| Core | 11% | Essential SEO: meta tags, canonical, H1, indexing directives, title uniqueness |
| Performance | 10% | Core Web Vitals, compression, caching, minification, and performance optimization |
| Links | 8% | Analyzes internal and external links, anchor text, broken links, and link quality |
| Images | 8% | Checks alt attributes, dimensions, lazy loading, formats, and optimization |
| Security | 8% | Validates HTTPS, security headers, mixed content, and SSL configuration |
| Technical SEO | 7% | Validates robots.txt, sitemap, SSL, status codes, and other technical aspects |
| Accessibility | 7% | Checks for WCAG compliance, screen reader support, and keyboard navigation |
| Crawlability | 5% | Validates sitemap, pagination, indexability signals, and crawl configuration |
| Structured Data | 5% | Checks for valid JSON-LD, Schema.org markup, and rich snippets |
| Content | 5% | Analyzes text quality, readability, duplicate content, and heading structure |
| JavaScript Rendering | 5% | Checks JS-rendered content, SSR detection, and raw vs rendered DOM consistency |
| Social | 3% | Validates Open Graph, Twitter Cards, and social sharing metadata |
| E-E-A-T | 3% | Experience, Expertise, Authority, Trust signals for content quality |
| URL Structure | 3% | Analyzes URL formatting, length, parameters, session IDs, and slug quality |
| Redirects | 3% | Validates redirect types, chains, loops, meta refresh, and JS redirects |
| Mobile | 2% | Mobile-friendliness: font size, viewport, horizontal scroll, and interstitials |
| Internationalization | 2% | Language declarations, hreflang validation, and multi-region support |
| HTML Validation | 2% | Validates HTML structure: DOCTYPE, charset, head integrity, and document size |
| AI/GEO Readiness | 2% | Generative Engine Optimization: semantic HTML, content structure, AI bot access |
| Legal Compliance | 1% | Privacy policy and legal compliance signals: cookie consent |

## Example Prompts

```
"Run an SEO audit on https://example.com"
"Audit https://mysite.com and tell me what to fix first"
"Check the SEO health of https://example.com with a 20-page crawl"
"What SEO issues does https://example.com have?"
```

## Installation

The skill will guide Claude to install the CLI if needed:

```bash
npm install -g @seomator/seo-audit
npx playwright install chromium
```

## Output

Claude will provide:

- **Overall Score** (0-100)
- **Category Breakdown** with individual scores
- **Priority Fixes** sorted by impact
- **Specific Instructions** for each issue

## Links

- **npm**: https://www.npmjs.com/package/@seomator/seo-audit
- **GitHub**: https://github.com/seo-skills/seo-audit-skill
- **Web UI**: https://seomator.com/free-seo-audit-tool
