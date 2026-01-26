# SEOmator Documentation

> Comprehensive SEO audit CLI tool with 148 rules across 16 categories

## Getting Started

| Document | Description |
|----------|-------------|
| [Introduction](./introduction.md) | Overview, features, and why SEOmator |
| [Quickstart](./quickstart.md) | Installation and first audit |
| [Configuration](./configuration.md) | Config files, presets, and options |

## Integration

| Document | Description |
|----------|-------------|
| [AI Agent Integration](./ai-agent-integration.md) | Claude Code, Cursor, and LLM workflows |

## Reference

| Document | Description |
|----------|-------------|
| [Technical Architecture](./technical-architecture.md) | How SEOmator works under the hood |
| [SEO Audit Rules](./SEO-AUDIT-RULES.md) | All 148 rules with examples and fixes |
| [Storage Architecture](./STORAGE-ARCHITECTURE.md) | SQLite database schema and internals |

## Quick Links

```bash
# Install
npm install -g @seomator/seo-audit

# Run audit
seomator audit https://example.com

# Multi-page crawl
seomator audit https://example.com --crawl -m 20

# Create config
seomator init

# AI-optimized output
seomator audit https://example.com --format llm | claude
```

## External Resources

- **npm**: https://www.npmjs.com/package/@seomator/seo-audit
- **GitHub**: https://github.com/seo-skills/seo-audit-skill
- **Web UI**: https://seomator.com/free-seo-audit-tool
- **Skills**: `npx skills add seo-skills/seo-audit-skill`
