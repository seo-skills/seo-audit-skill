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

- **55 SEO Rules** across 9 categories
- **Core Web Vitals** measurement (LCP, CLS, FCP, TTFB, INP)
- **Multi-page crawling** for site-wide audits
- **Actionable fixes** for every issue found

## Categories Analyzed

| Category | Weight | What It Checks |
|----------|--------|----------------|
| Meta Tags | 15% | Title, description, canonical, viewport |
| Technical SEO | 15% | robots.txt, sitemap, URL structure |
| Core Web Vitals | 15% | LCP, CLS, FCP, TTFB, INP |
| Security | 10% | HTTPS, HSTS, CSP, headers |
| Links | 10% | Broken links, anchor text, depth |
| Images | 10% | Alt text, dimensions, formats |
| Headings | 10% | H1, hierarchy, uniqueness |
| Structured Data | 8% | JSON-LD validation |
| Social | 7% | Open Graph, Twitter cards |

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
