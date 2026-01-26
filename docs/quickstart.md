# Quickstart

> Install SEOmator and run your first SEO audit

## Installation

```bash
npm install -g @seomator/seo-audit
```

This installs the `seomator` command globally.

**Requirements:**
- Node.js 18+
- Chrome, Chromium, or Edge (for Core Web Vitals - auto-detected)

After installation, run `seomator self doctor` to verify everything is set up correctly.

## Three Ways to Use SEOmator

### CLI for Humans

Run audits directly with human-readable terminal output:

```bash
seomator audit https://example.com
```

### AI Agent Skill

Install the skill for autonomous AI workflows:

```bash
npx skills add seo-skills/seo-audit-skill
```

Then run `/seo-audit` or prompt your AI agent:

```
Use the seo-audit skill to audit this site and fix all issues
```

For best results, use the skill in **plan mode** if your agent supports it. This lets the agent analyze issues and create an implementation plan before making changes.

### Pipe to AI

Export reports to Claude or other AI assistants:

```bash
seomator audit https://example.com --format llm | claude
```

See [AI Agent Integration](./ai-agent-integration.md) for detailed guidance on using SEOmator with Claude Code, Cursor, and other AI coding assistants.

## Run Your First Audit

Audit a website with a single command:

```bash
seomator audit https://example.com
```

You'll see output like:

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   ███████╗███████╗ ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ██████╗
║   ██╔════╝██╔════╝██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗
║   ███████╗█████╗  ██║   ██║██╔████╔██║███████║   ██║   ██║   ██║██████╔╝
║   ╚════██║██╔══╝  ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║██╔══██╗
║   ███████║███████╗╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██║  ██║
║   ╚══════╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
║                                                                       ║
║   v2.2.0  •  148 rules  •  16 categories                              ║
║   https://seomator.com                                                ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

Auditing: https://example.com
Max pages: 10

✓ Audited 5 pages in 3.2s

──────────────────────────────────────────────────
SEOMATOR REPORT
https://example.com • 5 pages • 85/100 (B)
──────────────────────────────────────────────────

Category Breakdown:
--------------------------------------------------
Core SEO             ████████░░ 82%
Performance          █████████░ 91%
Links                █████████░ 88%
Images               ███████░░░ 75%
Security             ██████████ 100%
...

ISSUES

Core SEO (1 error, 2 warnings)
  core/meta-description (error)
    ✗ Missing meta description
      → /about
      → /contact

  core/og-tags (warning)
    ⚠ Missing og:image
      → /

Images (3 warnings)
  images/alt-text (warning)
    ⚠ Missing alt attribute
      → /products (3 images)

──────────────────────────────────────────────────
125 passed • 15 warnings • 8 failed
──────────────────────────────────────────────────
```

## Common Options

### 1. Multi-page crawl

Crawl multiple pages instead of just the homepage:

```bash
seomator audit https://example.com --crawl -m 20
```

### 2. Skip Core Web Vitals

For faster audits without browser-based metrics:

```bash
seomator audit https://example.com --no-cwv
```

### 3. Export to JSON

Output machine-readable JSON for CI/CD or AI processing:

```bash
seomator audit https://example.com --format json -o report.json
```

### 4. Generate HTML report

Create a visual HTML report:

```bash
seomator audit https://example.com --format html -o report.html
```

### 5. Fresh crawl

Ignore cache and fetch all pages fresh:

```bash
seomator audit https://example.com --refresh
```

### 6. Filter categories

Audit specific categories only:

```bash
seomator audit https://example.com -c core,perf,security
```

## Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| `console` | (default) | Human-readable terminal output |
| `json` | `--format json` | CI/CD pipelines, programmatic processing |
| `html` | `--format html` | Visual reports for sharing |
| `markdown` | `--format markdown` | Documentation, GitHub |
| `llm` | `--format llm` | Compact AI-optimized (50-70% smaller) |

## Configuration

Create a `seomator.toml` config file for consistent settings:

```bash
seomator init              # Interactive setup
seomator init -y           # Use defaults
seomator init --preset blog # Use blog preset
```

Example configuration:

```toml
[project]
name = "my-website"
domains = ["example.com", "www.example.com"]

[crawler]
max_pages = 100
concurrency = 3
timeout_ms = 30000
exclude = ["/admin/**", "/api/**"]

[rules]
enable = ["*"]
disable = ["perf-inp"]

[output]
format = "console"
```

## Exit Codes

SEOmator uses exit codes for CI/CD integration:

| Code | Meaning |
|------|---------|
| `0` | Passed (score >= 70) |
| `1` | Failed (score < 70) |
| `2` | Error |

## Using with AI Agents

SEOmator is designed for AI workflows. Two primary methods:

### 1. Install the Skill (Recommended)

```bash
npx skills add seo-skills/seo-audit-skill
```

Then use with Claude Code, Cursor, or any skill-compatible agent:

```
Use the seo-audit skill to audit example.com and fix all issues
```

### 2. Pipe Output to AI

```bash
# Audit and pipe directly to Claude
seomator audit https://example.com --format llm | claude "analyze and prioritize fixes"
```

The `--format llm` provides compact, token-optimized output designed specifically for AI agents.

See [AI Agent Integration](./ai-agent-integration.md) for advanced workflows including plan mode, subagents, and continuous monitoring.

## Next Steps

- Run `seomator --help` for all available commands
- See the main [README](../CLAUDE.md) for full CLI reference
- Check the [GitHub repo](https://github.com/seo-skills/seo-audit-skill) for updates
