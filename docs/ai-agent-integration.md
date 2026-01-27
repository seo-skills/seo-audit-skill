# AI Agent Integration

> Use SEOmator with Claude Code, Cursor, and other AI coding assistants

SEOmator is built for autonomous AI workflows. This guide shows you how to integrate SEOmator with AI coding agents to audit websites and implement fixes automatically.

## Three Ways to Use SEOmator

| Method | Description |
|--------|-------------|
| **CLI for Humans** | Run audits directly from your terminal with human-readable output |
| **Pipe to Agent** | Pipe audit reports to Claude or other AI assistants using `--format llm` |
| **Skill Integration** | Install the SEOmator skill so agents can run audits autonomously |

## Install the Skill

The SEOmator skill enables AI agents to run audits, analyze results, and implement fixes without manual intervention.

### Installation

```bash
npx skills add seo-skills/seo-audit-skill
```

This installs the `seo-audit` skill for:

- **Claude Code** - Desktop and CLI
- **Cursor** - AI-first code editor
- **Any agent** supporting Claude Code skills

The skill is a thin wrapper that calls the SEOmator CLI. Install both the CLI and skill for full functionality.

For best results, use the skill in **plan mode** if your agent supports it. This lets the agent analyze all issues and create a comprehensive implementation plan before making changes to your codebase.

### Verify Installation

After installing, verify the skill is available:

```bash
npx skills list
```

You should see `seo-audit` in the output.

## Using with Claude Code

### Basic Audit Workflow

The easiest way to run an audit is with a slash command:

```
/seo-audit
```

This triggers the skill directly. Claude will detect your project's website (from config, environment, or code) and run an audit.

You can also specify a URL explicitly:

```
/seo-audit https://example.com
```

Or use natural language:

```
Use the seo-audit skill to audit example.com
```

Claude will:

1. Run the audit using SEOmator CLI
2. Parse the results
3. Summarize issues by severity
4. Suggest next steps

### Example Prompts

**Audit and summarize issues:**

```
/seo-audit example.com and summarize the top 5 most critical issues
```

**Audit with specific focus:**

```
/seo-audit mysite.com focusing on accessibility and performance issues
```

**Audit and fix all issues:**

```
/seo-audit this site and fix all errors and warnings
```

**Audit local development site:**

```
/seo-audit http://localhost:3000 and create a prioritized fix list
```

### Plan Mode for Comprehensive Fixes

For larger fix efforts, use Claude's plan mode to create an implementation strategy:

#### Step 1: Trigger plan mode

Ask Claude to enter plan mode before starting work:

```
Enter plan mode. Use the seo-audit skill to audit example.com,
then create a comprehensive plan to fix all high and medium severity issues.
```

#### Step 2: Review the plan

Claude will:
- Run the audit
- Analyze all issues
- Group fixes by category
- Create an ordered implementation plan
- Identify dependencies between fixes

Review and approve the plan.

#### Step 3: Execute the plan

Once approved, Claude will implement fixes systematically, checking off completed items.

### Using Subagents for Parallel Fixes

For complex sites with many issues, prompt Claude to use subagents:

```
Use the seo-audit skill to audit example.com.
Then spawn subagents to fix issues in parallel:
- Subagent 1: Fix all accessibility issues
- Subagent 2: Fix all SEO meta tag issues
- Subagent 3: Fix all performance issues
```

This parallelizes work across independent issue categories.

## Piping to Claude (Alternative Method)

If you prefer not to use skills, pipe audit output directly to Claude:

### Using Report Formats

Pipe audit results directly to Claude in LLM-optimized format:

```bash
seomator audit https://example.com --format llm | claude
```

Or run the audit and export later:

```bash
# Run audit (stores results)
seomator audit https://example.com --save

# Export and pipe to Claude
seomator report --latest --format llm | claude
```

**LLM Format Benefits:**

- Compact structured output (50-70% smaller than JSON)
- Token-optimized for API costs and context limits
- Includes actionable fix suggestions
- Works with any LLM (Claude, GPT, etc.)

### Example Workflows

```bash
# Audit and ask Claude to prioritize fixes
seomator audit https://example.com --format llm | claude "Prioritize these issues and create a fix plan"

# Audit and implement high-severity fixes
seomator audit https://example.com --format llm | claude "Fix all high-severity issues"

# Audit and explain issues to non-technical stakeholder
seomator audit https://example.com --format markdown | claude "Explain these issues in simple terms"
```

### Output Formats for AI

| Format | Flag | Best For |
|--------|------|----------|
| `llm` | `--format llm` | Compact XML for AI agents (50-70% smaller, token-optimized) |
| `json` | `--format json` | Custom AI processing scripts |
| `markdown` | `--format markdown` | AI agents that prefer markdown |
| `console` | (default) | Human-readable terminal output |

## Using with Other AI Coding Assistants

### Cursor

Cursor supports Claude Code skills natively:

1. Install the skill:
   ```bash
   npx skills add seo-skills/seo-audit-skill
   ```

2. Run with slash command:
   ```
   /seo-audit
   ```

3. Or use composer mode for multi-file fixes:
   ```
   /seo-audit then fix all issues across the codebase
   ```

### Windsurf / Aider / Other Agents

For agents without skill support, use piping:

```bash
# Windsurf (Cascade)
seomator audit https://example.com --format llm | windsurf

# Aider
seomator audit https://example.com --format llm | aider

# Generic LLM API - save to file then send
seomator audit https://example.com --format llm > audit.xml
# Then send audit.xml content to your LLM
```

## Advanced Agent Patterns

### Pre-Deploy Audits

In your deployment workflow:

```
Before I deploy, use seo-audit skill to audit
http://localhost:3000 and ensure there are no high-severity
issues introduced since the last deployment.
```

### Automated Regression Detection

After making changes:

```
I just updated the homepage. Use seo-audit skill to audit
the site and verify I didn't introduce any SEO or accessibility
regressions.
```

### Continuous Monitoring

Set up regular audits:

```
Every week, use seo-audit skill to audit production and compare
against last week's scores. Alert me if any category drops more
than 5 points.
```

## Configuration for Agents

### Project-Scoped Config

Create `seomator.toml` in your project so agents use consistent settings:

```toml
[project]
name = "my-website"
domains = ["example.com"]

[crawler]
max_pages = 50
respect_robots = true
exclude = ["/admin/**", "/api/**"]

[rules]
disable = ["perf-inp"]

[output]
format = "llm"
```

Now when agents run audits, they'll use these settings automatically.

### Limiting Crawl Scope

For large sites, configure agents to audit specific sections:

```toml
[crawler]
max_pages = 20
include = ["/blog/**"]
exclude = ["/admin/**", "/api/**"]
```

## Skill vs Piping: Which to Use?

### Use the skill when:

- Working in Claude Code, Cursor, or skill-compatible editors
- You want agents to discover and use SEOmator autonomously
- Building multi-step workflows where the agent decides when to audit
- The agent needs to run audits as part of a larger task

### Use piping when:

- Working with agents that don't support skills
- You want explicit control over when audits run
- Integrating into shell scripts or automation
- Using SEOmator with non-coding LLMs

## Troubleshooting

### Skill not found

Verify installation:

```bash
npx skills list | grep seo-audit
```

Reinstall if missing:

```bash
npx skills add seo-skills/seo-audit-skill --force
```

### Agent can't run audits

Ensure SEOmator CLI is installed:

```bash
seomator --version
```

If not installed:

```bash
npm install -g @seomator/seo-audit
```

### Core Web Vitals failing

SEOmator uses your system browser for Core Web Vitals. Check browser availability:

```bash
seomator self doctor
```

Or skip CWV for faster audits:

```bash
seomator audit https://example.com --no-cwv
```

### Piping produces no output

Check the output format:

```bash
seomator audit https://example.com --format llm
```

Ensure you're using `--format llm` for LLM-optimized output.

## Next Steps

- [Quickstart](./quickstart.md) - Installation and first audit
- [Introduction](./introduction.md) - Overview and features
- [GitHub](https://github.com/seo-skills/seo-audit-skill) - Source code and issues
