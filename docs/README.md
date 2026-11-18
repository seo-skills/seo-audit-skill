# SEOmator Documentation

SEOmator audits web pages against 398 rules across 20 categories, from the
command line, a local dashboard, a desktop app, or an AI agent.

These docs follow [Diataxis](https://diataxis.fr/). Every page states its type
at the top, so you can tell at a glance whether it teaches, solves a task,
lists facts or explains a design:

| Type | Use it when you want to | Pages |
|------|-------------------------|-------|
| **Tutorial** | learn by doing, from nothing to a working result | [Quickstart](./quickstart.md) |
| **How-to** | get a specific job done | [Gate CI on an audit](./ci-gates.md) · [Add your own checks](./custom-checks.md) · [Use SEOmator from an AI agent](./ai-agent-integration.md) · [Use the local dashboard](./WEB-DASHBOARD.md) · [Run and package the desktop app](./ELECTRON-APP.md) · [Upgrade to 8.0](./upgrading-to-8.md) |
| **Reference** | look up an exact fact: a rule, a flag, a key, a column | [SEO audit rules](./SEO-AUDIT-RULES.md) · [Configuration](./configuration.md) · [Storage](./STORAGE-ARCHITECTURE.md) |
| **Explanation** | understand why it works the way it does | [Introduction](./introduction.md) · [Technical architecture](./technical-architecture.md) |

## Start here

New to SEOmator? Read the [Introduction](./introduction.md) for what an audit
measures and how the score is built, then follow the [Quickstart](./quickstart.md)
to run your first audit and compare two of them.

## By task

| I want to | Go to |
|-----------|-------|
| Run my first audit | [Quickstart](./quickstart.md) |
| Let an AI agent run audits and read the results | [Use SEOmator from an AI agent](./ai-agent-integration.md) |
| Check whether a deploy made anything worse | [Use SEOmator from an AI agent: check what a deploy changed](./ai-agent-integration.md) |
| Browse stored audits in a browser, or script against them | [Use the local dashboard](./WEB-DASHBOARD.md) |
| Run only some rules, or write a JSON report in CI | [Configuration: how-to](./configuration.md) |
| Fail a CI job on the score, on rules that must pass, or on crawl coverage | [Gate CI on an audit](./ci-gates.md) |
| Check every page for my own text, pattern or element, or pull a value from every page | [Add your own checks](./custom-checks.md) |
| Find out what a rule checks and how to fix it | [SEO audit rules](./SEO-AUDIT-RULES.md) |
| Work on the desktop app | [Run and package the desktop app](./ELECTRON-APP.md) |
| Understand where audits are stored and how `compare` reads them | [Storage](./STORAGE-ARCHITECTURE.md) |
| Upgrade from 7.x, and see what can break a script or CI job | [Upgrading to 8.0](./upgrading-to-8.md) |

Some pages hold two types in clearly separated parts: the dashboard guide ends
with an API reference, the desktop app guide with a design explanation, and the
configuration reference with a short how-to section.

## All pages

| Page | What it covers |
|------|----------------|
| [Introduction](./introduction.md) | What an audit measures, how the score is built, and where it can mislead. |
| [Quickstart](./quickstart.md) | Install, run a first audit, read the report, compare two audits. |
| [Gate CI on an audit](./ci-gates.md) | Exit codes, `fail_under`, `fail_ci` rules, `min_coverage`, `config validate`, and a GitHub Actions job. |
| [Add your own checks](./custom-checks.md) | `[[custom.search]]` and `[[custom.extract]]`: writing them, where results show up, and their limits. |
| [Use SEOmator from an AI agent](./ai-agent-integration.md) | The agent skill, `--format llm`, failed runs, deploy diffs, and the MCP server. |
| [Use the local dashboard](./WEB-DASHBOARD.md) | `seomator serve`: browse, run and compare audits in a browser, and its HTTP API. |
| [Run and package the desktop app](./ELECTRON-APP.md) | The Electron app from a source checkout: running, rebuilding the native module, packaging. |
| [Upgrading to 8.0](./upgrading-to-8.md) | What 8.0 changed that can break a script or CI job, and why scores move. |
| [SEO audit rules](./SEO-AUDIT-RULES.md) | Every rule: its ID, weight, result and what it checks. |
| [Configuration](./configuration.md) | Every `seomator.toml` key, the `init` and `config` commands, and the flags that override keys. |
| [Storage](./STORAGE-ARCHITECTURE.md) | Where audits, crawls and the link cache are stored, with every table and column. |
| [Technical architecture](./technical-architecture.md) | How the engine turns a URL into findings and a score, and the trade-offs behind it. |

## Quick commands

```bash
npm install -g @seomator/seo-audit             # install the CLI (Node.js 20.18.1+)
seomator self doctor                           # check the setup
seomator audit https://example.com             # audit one page
seomator audit https://example.com --format llm            # compact output for AI agents
seomator audit https://example.com --crawl -m 20           # crawl up to 20 pages
seomator compare example.com                   # diff the two latest stored audits
seomator serve                                 # local dashboard on 127.0.0.1:7360
seomator init -y                               # write a seomator.toml with defaults
```

## External resources

- **npm:** https://www.npmjs.com/package/@seomator/seo-audit
- **GitHub:** https://github.com/seo-skills/seo-audit-skill
- **Web UI:** https://seomator.com/free-seo-audit-tool
- **Agent skill:** `npx skills add seo-skills/seo-audit-skill`
