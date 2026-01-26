# Configuration

> Customize SEOmator behavior with config files and CLI options

SEOmator uses a layered configuration system. Settings can come from config files, CLI arguments, or built-in defaults.

## Quick Start

Create a config file in your project:

```bash
seomator init              # Interactive setup
seomator init -y           # Use defaults
seomator init --preset blog # Use blog preset
```

This creates `seomator.toml` in your current directory.

## Configuration File

### Full Example

```toml
[project]
name = "my-website"
domains = ["example.com", "www.example.com"]

[crawler]
max_pages = 100
concurrency = 3
timeout_ms = 30000
respect_robots = true
delay_ms = 100
user_agent = ""                 # Empty = random browser UA per crawl

# URL filtering (glob patterns)
include = []                    # Empty = crawl all
exclude = ["/admin/**", "/api/**", "/wp-json/**"]

# Query param handling
drop_query_prefixes = ["utm_", "gclid", "fbclid", "ref"]
allow_query_params = []         # Empty = keep all except dropped

# Crawl distribution
max_prefix_budget = 0.25        # Prevent over-crawling single paths (0-1)

[rules]
enable = ["*"]                  # Enable all rules by default
disable = ["perf-inp"]          # Disable specific rules (supports wildcards)

[external_links]
enabled = true
cache_ttl_days = 7
timeout_ms = 10000
concurrency = 5

[output]
format = "console"              # console, json, html, markdown, llm
path = ""                       # Output file path (optional)
```

## Configuration Sections

### [project]

Project identification and domain configuration.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `name` | string | - | Project name for reports |
| `domains` | string[] | - | Allowed domains (crawl stays within these) |

### [crawler]

Controls how SEOmator crawls websites.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `max_pages` | number | 10 | Maximum pages to crawl |
| `concurrency` | number | 3 | Concurrent requests |
| `timeout_ms` | number | 30000 | Request timeout in milliseconds |
| `respect_robots` | boolean | true | Honor robots.txt directives |
| `delay_ms` | number | 100 | Delay between requests |
| `user_agent` | string | "" | Custom user agent (empty = random browser UA) |
| `include` | string[] | [] | URL patterns to include (glob) |
| `exclude` | string[] | [] | URL patterns to exclude (glob) |
| `drop_query_prefixes` | string[] | ["utm_", "gclid", "fbclid"] | Query params to strip |
| `allow_query_params` | string[] | [] | Query params to keep (empty = all except dropped) |
| `max_prefix_budget` | number | 0.25 | Max fraction of crawl for single path prefix |

### [rules]

Enable or disable specific audit rules.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enable` | string[] | ["*"] | Rules to enable (supports wildcards) |
| `disable` | string[] | [] | Rules to disable (supports wildcards) |

**Wildcard Examples:**

```toml
[rules]
enable = ["*"]                    # Enable all rules
disable = [
  "perf-*",                       # Disable all performance rules
  "a11y-color-contrast",          # Disable specific rule
  "content-word-count",
]
```

### [external_links]

External link checking configuration.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | true | Check external links |
| `cache_ttl_days` | number | 7 | Days to cache link check results |
| `timeout_ms` | number | 10000 | External link timeout |
| `concurrency` | number | 5 | Concurrent external link checks |

### [output]

Default output configuration.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `format` | string | "console" | Output format: console, json, html, markdown, llm |
| `path` | string | "" | Default output file path |

## Config Priority

Configuration is merged from multiple sources (highest to lowest priority):

1. **CLI arguments** (`--max-pages 50`)
2. **Local config** (`./seomator.toml`)
3. **Parent directory configs** (searches up the tree)
4. **Global config** (`~/.seomator/config.toml`)
5. **Built-in defaults**

## Presets

SEOmator includes presets for common use cases:

```bash
seomator init --preset blog       # Content sites
seomator init --preset ecommerce  # E-commerce sites
seomator init --preset ci         # Minimal CI/CD config
```

| Preset | Description |
|--------|-------------|
| `default` | Standard configuration |
| `blog` | Optimized for content sites - focuses on content, E-E-A-T |
| `ecommerce` | Optimized for e-commerce - focuses on structured data, performance |
| `ci` | Minimal config for CI/CD - fast, essential rules only |

## Config Commands

### View configuration

```bash
seomator config --list            # Show all config values
seomator config show              # Show merged config with sources
seomator config path              # Show config file paths
```

### Get/set values

```bash
seomator config crawler.max_pages         # Get value
seomator config crawler.max_pages 50      # Set value
seomator config --global                  # Modify global config
```

### Validate configuration

```bash
seomator config validate          # Check for errors/warnings
```

## CLI Options

CLI options override config file settings:

| Option | Config Equivalent | Description |
|--------|-------------------|-------------|
| `-m, --max-pages <n>` | `crawler.max_pages` | Max pages to crawl |
| `--concurrency <n>` | `crawler.concurrency` | Concurrent requests |
| `--timeout <ms>` | `crawler.timeout_ms` | Request timeout |
| `-c, --categories <list>` | - | Filter to specific categories |
| `-f, --format <type>` | `output.format` | Output format |
| `-o, --output <path>` | `output.path` | Output file path |
| `--no-cwv` | - | Skip Core Web Vitals |
| `-r, --refresh` | - | Ignore cache |
| `--resume` | - | Resume interrupted crawl |

## URL Filtering

### Include patterns

Only crawl URLs matching these patterns:

```toml
[crawler]
include = [
  "/blog/**",           # All blog pages
  "/products/**",       # All product pages
]
```

### Exclude patterns

Skip URLs matching these patterns:

```toml
[crawler]
exclude = [
  "/admin/**",          # Admin pages
  "/api/**",            # API endpoints
  "/wp-json/**",        # WordPress REST API
  "/**?*",              # URLs with query strings
  "/tag/**",            # Tag archives
  "/author/**",         # Author archives
]
```

### Glob pattern syntax

| Pattern | Matches |
|---------|---------|
| `*` | Single path segment |
| `**` | Multiple path segments |
| `?` | Single character |
| `[abc]` | Character class |

## Query Parameter Handling

### Drop tracking parameters

Remove common tracking parameters:

```toml
[crawler]
drop_query_prefixes = [
  "utm_",               # Google Analytics
  "gclid",              # Google Ads
  "fbclid",             # Facebook
  "ref",                # Referral tracking
  "source",
  "medium",
  "campaign",
]
```

### Allow specific parameters

Keep only specific query parameters:

```toml
[crawler]
allow_query_params = [
  "page",               # Pagination
  "sort",               # Sorting
  "category",           # Filtering
]
```

## Environment-Specific Config

### Development

```toml
[project]
name = "my-site-dev"

[crawler]
max_pages = 10
timeout_ms = 60000    # Longer timeout for slow dev server

[rules]
disable = ["security-*"]  # Skip security rules in dev
```

### CI/CD

```toml
[project]
name = "my-site-ci"

[crawler]
max_pages = 50
concurrency = 5

[output]
format = "json"

[rules]
disable = ["perf-inp", "perf-cls"]  # Skip flaky CWV rules in CI
```

### Production

```toml
[project]
name = "my-site"

[crawler]
max_pages = 500
respect_robots = true

[external_links]
enabled = true
cache_ttl_days = 1    # More frequent link checks
```

## Storage Locations

SEOmator stores data in these locations:

```
~/.seomator/                              # Global directory
├── projects/                             # Per-domain project databases
│   └── example.com/
│       └── project.db                    # Crawls, pages, links, images
├── audits.db                             # Centralized audit results
├── link-cache.db                         # External link check cache
└── config.toml                           # Global configuration
```

See [Storage Architecture](./STORAGE-ARCHITECTURE.md) for details.

## Next Steps

- [Quickstart](./quickstart.md) - Run your first audit
- [AI Agent Integration](./ai-agent-integration.md) - Use with Claude Code
- [Rules Reference](./SEO-AUDIT-RULES.md) - All 148 rules explained
