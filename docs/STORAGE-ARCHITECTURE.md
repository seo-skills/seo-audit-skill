# Storage Architecture

> **Type:** Reference

SEOmator keeps audit history in SQLite databases under one data directory, and keeps crawls and legacy reports as JSON files in the directory you run it from. This page lists every location, table, column and stored field, the `seomator db` commands, and the storage functions the package exports, as `src/storage/` defines them.

## Data directory

The data directory is `$SEOMATOR_HOME` when that variable holds a non-blank value, and `~/.seomator` otherwise (`getGlobalDir()` in `src/storage/paths.ts`). It is created on first use.

| Path | Format | Written by | Read by |
|---|---|---|---|
| `audits.db` | SQLite | `audit`, `analyze`, `seomator serve` and the desktop app, unless saving is off (see [When an audit is stored](#when-an-audit-is-stored)); `db migrate` for legacy reports | `report`, `compare`, `seomator serve`, the desktop app, `db stats` |
| `audits.db-wal`, `audits.db-shm` | SQLite write-ahead log | SQLite, while a connection is open | SQLite |
| `projects/<domain>/project.db` | SQLite | `db migrate` only | `db stats --verbose` only |
| `link-cache.db` | SQLite | No command. See [Link cache](#link-cache-link-cachedb). | `db stats` prints its size if the file exists |
| `settings.json` | JSON | `seomator config <key> <value> --global` | Every command that loads config |
| `serve.json` | JSON, mode `0600` | `seomator serve` at start-up, removed on shutdown | Scripts and agents that need the dashboard's port and token |

`<domain>` is the hostname of the crawl's start URL, lowercased, with a leading `www.` removed (`extractDomain()`). It is then made safe for a directory name: characters other than `a-z`, `0-9`, `.` and `-` become `_`, runs of `.` or `_` collapse to one, and leading or trailing `.`, `_` and `-` are trimmed (`sanitizeDomain()`).

### Project directory

These paths are relative to the current working directory.

| Path | Written by | Read by |
|---|---|---|
| `.seomator/crawls/<crawl-id>.json` | `seomator crawl` (relative to `--output <path>` when given) | `seomator analyze`, `db migrate` |
| `.seomator/reports/<report-id>.json` | `audit` or `analyze` with `--json-report` (also the deprecated `--save`) | `seomator report` when the audits database has no match, `db migrate` |
| `.seomator/settings.json` | `seomator config <key> <value>` without `--global` | Every command that loads config |
| `.seomator/crawls.bak/`, `.seomator/reports.bak/` | `db migrate --archive` | `db restore` |

### Identifiers

Audit, crawl and report ids have the form `YYYY-MM-DD-xxxxxx`: the UTC date, then six hex characters from three random bytes (`generateId()` in `src/storage/utils/hash.ts`). Example: `2026-10-15-d182f9`.

### Timestamps

Every `_at` column in `audits.db` and `project.db` defaults to `datetime('now')`. SQLite writes that as UTC text in the form `YYYY-MM-DD HH:MM:SS`, with no `T` and no zone designator. `parseSqliteUtc()` in `src/storage/sqlite-time.ts` reads these values as UTC. The link cache's `checked_at` is an ISO 8601 string instead.

## When an audit is stored

`audit` and `analyze` decide with `resolvePersistence()` in `src/commands/persistence.ts`. The first matching row wins.

| Condition | Stored in `audits.db` | Legacy JSON report written |
|---|---|---|
| `--no-save` | No | Only with `--json-report` |
| `--save` (deprecated, prints a notice) | Yes, even when `[output] save = false` | Yes |
| `[output] save = false` in `seomator.toml` | No | Only with `--json-report` |
| Default | Yes | Only with `--json-report` |

`seomator serve` and the desktop app store every finished run unless the run request sets `"save": false`. The dashboard's `POST /api/runs` accepts that field; the run form in the UI never sends it.

`saveAuditToDatabase()` in `src/storage/save-audit.ts` writes one audit in a single transaction, in this order:

1. Insert the `audits` row (`status = 'running'`, `overall_score = 0`).
2. Insert one `audit_categories` row per category that ran.
3. Insert one `audit_results` row per rule per page.
4. Complete the `audits` row: status, score, counts, `completed_at`.
5. Find the previous completed audit of the same `domain` and, if there is one, insert an `audit_comparisons` row.

A write that fails with `SQLITE_BUSY`, `SQLITE_BUSY_SNAPSHOT` or `SQLITE_LOCKED` is retried up to 20 times, 500 ms apart (about 10 seconds), before the error surfaces. When storing fails, `audit` prints `Could not store this audit in <path>` to stderr and still prints the full report. The exit code does not change.

## Audits database (`audits.db`)

Every connection sets `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON` and `PRAGMA busy_timeout = 500` (`initializeAuditsSchema()` in `src/storage/audits-db/schema.ts`). Deleting an `audits` row deletes its categories, results, issues and comparisons through `ON DELETE CASCADE`. The dashboard (`DELETE /api/audits/:id`) and the desktop app are the only callers that delete.

### Table `audits`

One row per stored audit.

| Column | Type | Constraint, default | Contents |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Row id. The other tables reference this, not `audit_id`. |
| `audit_id` | TEXT | NOT NULL, UNIQUE | Public id, such as `2026-10-15-d182f9`. `report <id>`, `compare --against` and the dashboard take this value. |
| `domain` | TEXT | NOT NULL | Hostname of the audited URL as given, with `www.` kept (`domainOf()`). `compare`, score trends and the domain list group by this value, so `www.example.com` and `example.com` are separate histories. Rows created by `db migrate` have a leading `www.` removed. |
| `project_name` | TEXT | | `[project] name`, or `default` when it is empty, for `audit`. The crawl's project for `analyze`, with the same fallback. NULL for the dashboard and the desktop app. |
| `crawl_id` | TEXT | | The legacy report's crawl id on rows created by `db migrate`. NULL otherwise. |
| `start_url` | TEXT | NOT NULL | The audited URL, with any `user:password@` removed. |
| `overall_score` | INTEGER | NOT NULL | Overall score after any score cap. The cap itself is not stored. |
| `total_rules` | INTEGER | DEFAULT 0 | Number of `audit_results` rows written for this audit: one per rule per page, unmeasured results included. On migrated rows, the legacy report's own total. |
| `passed_count` | INTEGER | DEFAULT 0 | Passing results, summed over categories. Unmeasured results are not counted here. |
| `warning_count` | INTEGER | DEFAULT 0 | Warnings, counted the same way. |
| `failed_count` | INTEGER | DEFAULT 0 | Failures, counted the same way. |
| `pages_audited` | INTEGER | DEFAULT 1 | Pages the audit covered. |
| `config_json` | TEXT | | The fully resolved config as JSON, for `audit` and `analyze`. NULL for the dashboard and the desktop app. |
| `started_at` | TEXT | DEFAULT `datetime('now')` | When the row was inserted. The insert happens after the audit has run, so this is the save time. On migrated rows it is the time of the migration, not of the original report. |
| `completed_at` | TEXT | | Set in the same transaction as the insert. |
| `status` | TEXT | DEFAULT `'running'` | `running`, `completed` or `failed`. The save transaction leaves `completed`. `failed` is written only by `AuditsDatabase.failAudit()`, which no command calls. `compare`, score trends and the domain list read `completed` rows only. |
| `source` | TEXT | | The surface that saved the audit: `cli`, `dashboard`, `desktop` or `api`. `saveAuditToDatabase()` writes `cli` when the caller passes no source. No SEOmator surface writes `api`. NULL on rows written before 3.4.0 and on migrated rows. |
| `engine_version` | TEXT | | SEOmator version that wrote the row, read from `package.json`. NULL on rows written before 3.4.0 and on migrated rows. |
| `run_json` | TEXT | | The run profile. See [The run profile](#the-run-profile-run_json). NULL on rows written before 3.4.0 and on migrated rows. |

### Table `audit_categories`

One row per category that ran. A category left out with `-c`, or whose rules were all filtered out by `[rules]`, does not run and gets no row.

| Column | Type | Constraint, default | Contents |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Row id. |
| `audit_id` | INTEGER | NOT NULL, references `audits(id)` | The audit. |
| `category_id` | TEXT | NOT NULL | Category id, such as `core`. UNIQUE together with `audit_id`. |
| `category_name` | TEXT | NOT NULL | Category display name, such as `Core`. On migrated rows, the category id. |
| `score` | INTEGER | NOT NULL | Category score, 0 to 100. |
| `weight` | INTEGER | NOT NULL | The category's weight in the overall score. On migrated rows, 100 divided by the number of categories in the legacy report. |
| `pass_count` | INTEGER | DEFAULT 0 | Passing results in this category. Unmeasured results are not counted. |
| `warn_count` | INTEGER | DEFAULT 0 | Warnings, counted the same way. |
| `fail_count` | INTEGER | DEFAULT 0 | Failures, counted the same way. |

### Table `audit_results`

One row per rule per page. A single-page audit writes one row per rule that ran. A crawl writes that many for every page, so a crawl of a few hundred pages writes tens of thousands of rows.

| Column | Type | Constraint, default | Contents |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Row id. Readers return rows in `id` order, which is the order the engine produced them. |
| `audit_id` | INTEGER | NOT NULL, references `audits(id)` | The audit. |
| `category_id` | TEXT | NOT NULL | Category of the rule. |
| `rule_id` | TEXT | NOT NULL | Rule id, such as `core-title-present`. |
| `rule_name` | TEXT | NOT NULL | Rule name from the registry. Falls back to the rule id when the rule is not registered (and on migrated rows). |
| `page_url` | TEXT | NOT NULL | The page this result is for, with any `user:password@` removed. |
| `page_url_hash` | TEXT | NOT NULL | First 16 hex characters of the SHA-256 of `page_url` (`hashUrl()`). Page filters match on this column. |
| `status` | TEXT | NOT NULL | `pass`, `warn`, `fail` or `not-measured`. |
| `score` | INTEGER | NOT NULL | 100 for `pass`, 50 for `warn`, 0 for `fail`, 50 for `not-measured`. |
| `message` | TEXT | NOT NULL | The rule's message. |
| `details_json` | TEXT | | The result's `details` object as JSON, including the `pageUrl` the engine adds to every result. |
| `executed_at` | TEXT | DEFAULT `datetime('now')` | When the row was inserted. |
| `weight` | INTEGER | | The rule's weight for this result. `0` marks a result that took no reading. NULL on rows written before 3.4.0, which readers treat as weight 1. |

A row counts as unmeasured when `weight = 0 OR status = 'not-measured'` (`NOT_MEASURED_SQL` in `src/storage/audits-db/results.ts`). Three encodings exist in stored data:

| Written by | `status` | `weight` | Read as |
|---|---|---|---|
| Before 3.4.0 | `warn` | NULL | Measured warning |
| 3.4.0 to 3.5.0 | `warn` | `0` | Unmeasured |
| 3.6.0 onward | `not-measured` | `0` | Unmeasured |

Unmeasured rows count toward a rule's page total in `getRuleSummaries()` and toward `total_rules`, but never toward a status count, an issue, or a rule diff.

### Table `issues`

Rule failures and warnings grouped per rule, with a priority. Only `db migrate` writes this table, through `generateIssuesFromResults()`. Audits saved by `audit`, `analyze`, the dashboard and the desktop app have no `issues` rows.

| Column | Type | Constraint, default | Contents |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Row id. |
| `audit_id` | INTEGER | NOT NULL, references `audits(id)` | The audit. |
| `rule_id` | TEXT | NOT NULL | Rule id. |
| `category_id` | TEXT | NOT NULL | Category id. |
| `severity` | TEXT | NOT NULL | `critical` for grouped `fail` rows, `warning` for grouped `warn` rows. `info` is a valid value that the generator never writes. |
| `title` | TEXT | NOT NULL | The rule name. |
| `description` | TEXT | | The result message. Rows of one rule with different messages become separate issues. |
| `affected_pages_count` | INTEGER | DEFAULT 1 | Number of pages in `affected_pages_json`. |
| `affected_pages_json` | TEXT | | JSON array of page URLs. |
| `fix_suggestion` | TEXT | | NULL. The generator does not set it. |
| `priority_score` | INTEGER | DEFAULT 0 | `round(base * log10(affected_pages_count + 1))`, where base is 100 for `critical`, 50 for `warning` and 10 for `info`. |

### Table `audit_comparisons`

One row per saved audit that had an earlier completed audit of the same `domain`. "Earlier" means an earlier `started_at`, with `id` breaking ties.

| Column | Type | Constraint, default | Contents |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Row id. |
| `current_audit_id` | INTEGER | references `audits(id)` | The audit being saved. |
| `previous_audit_id` | INTEGER | references `audits(id)` | The audit it was compared with. |
| `domain` | TEXT | NOT NULL | The shared domain. |
| `score_delta` | INTEGER | NOT NULL | Current `overall_score` minus previous `overall_score`. |
| `category_deltas_json` | TEXT | | JSON array, one entry per category of the current audit: `{ categoryId, categoryName, previousScore, currentScore, delta }`. `previousScore` is 0 for a category the previous audit did not have. |
| `new_issues_count` | INTEGER | DEFAULT 0 | Rules with a `fail` row in the current audit that have a non-`fail` row, or no row, in the previous audit. |
| `fixed_issues_count` | INTEGER | DEFAULT 0 | The same count in the other direction. |
| `compared_at` | TEXT | DEFAULT `datetime('now')` | When the row was inserted. |

The domain list in the dashboard and the desktop app (`listDomains()` in `src/dashboard/queries.ts`) reads `score_delta`, `new_issues_count` and `fixed_issues_count` from the row whose `current_audit_id` is each domain's latest audit. `seomator compare` and the dashboard's compare view do not read this table: they recompute with `buildComparison()` and `diffRules()`.

### Indexes

| Index | Columns |
|---|---|
| `idx_audits_domain` | `audits(domain)` |
| `idx_audits_started` | `audits(started_at DESC)` |
| `idx_audits_score` | `audits(overall_score)` |
| `idx_audits_status` | `audits(status)` |
| `idx_categories_audit` | `audit_categories(audit_id)` |
| `idx_results_audit` | `audit_results(audit_id)` |
| `idx_results_rule` | `audit_results(audit_id, rule_id)` |
| `idx_results_status` | `audit_results(audit_id, status)` |
| `idx_results_page` | `audit_results(audit_id, page_url_hash)` |
| `idx_issues_audit` | `issues(audit_id)` |
| `idx_issues_severity` | `issues(audit_id, severity)` |
| `idx_issues_priority` | `issues(audit_id, priority_score DESC)` |
| `idx_comparisons_current` | `audit_comparisons(current_audit_id)` |
| `idx_comparisons_domain` | `audit_comparisons(domain)` |

### Schema changes

There is no version table. Opening the database runs `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for everything above, then adds any missing later column with `ALTER TABLE ... ADD COLUMN` (`ensureColumn()`):

| Column | Type |
|---|---|
| `audit_results.weight` | INTEGER |
| `audits.source` | TEXT |
| `audits.engine_version` | TEXT |
| `audits.run_json` | TEXT |

The changes are additive, so an older SEOmator can keep writing to a database a newer one has opened. When two processes add the same column at once, the second `duplicate column name` error is ignored.

### Not stored

These parts of an `AuditResult` (`src/types.ts`) have no column:

- `scoreCap` (the uncapped score and the caps that applied) and `waivedCaps`. Only the capped `overall_score` is stored, so `report <id>`, the dashboard and the desktop app show a capped score without its reason.
- `page` (the page snapshot), `coverage` and `schemaVersion`.
- `timestamp`. `started_at` holds the save time instead.

## The run profile (`run_json`)

`audits.run_json` records how the audit was measured, as an `AuditRunOptions` object (`src/types.ts`).

| Field | Type | Contents | `compare` label | Material |
|---|---|---|---|---|
| `crawl` | boolean | The audit crawled the site (`--crawl`). | crawl mode | No |
| `maxPages` | number | The page limit. For `audit`, the resolved `-m` value (10 by default), stored even for a single-page audit. For `analyze`, the number of stored pages. | page limit | No |
| `concurrency` | number | Concurrent requests. | Not compared | |
| `measureCwv` | boolean | The page was rendered in a browser and Core Web Vitals measured. `false` after `--no-cwv`. | Core Web Vitals | Yes |
| `mobile` | boolean | A second render at a mobile viewport ran (`--mobile`). | mobile parity | Yes |
| `simulateInteraction` | boolean | A synthetic interaction ran so INP could be measured (`--simulate-interaction`). | simulated interaction | Yes |
| `categories` | string[] | The `-c` category filter. `[]` means every category. | categories | Yes |
| `scoringVersion` | number, optional | The scoring model that produced the score, `SCORING_VERSION` in `src/scoring.ts`. Currently `4`. | scoring model | Yes |
| `enableRules` | string[], optional | `[rules] enable` patterns in force. The CLI default is `["*"]`. | enabled rules | Yes |
| `disableRules` | string[], optional | `[rules] disable` patterns in force. | disabled rules | Yes |
| `staging` | boolean, optional | The audit ran with `--staging`. Written only when true. | staging mode | Yes |
| `timeout` | number | Request timeout in milliseconds. | Not compared | |

Example, from `seomator audit https://example.com --no-cwv --staging`:

```json
{"crawl":false,"maxPages":10,"concurrency":3,"measureCwv":false,"mobile":false,"simulateInteraction":false,"categories":[],"scoringVersion":4,"enableRules":["*"],"disableRules":[],"staging":true,"timeout":30000}
```

### How the profile is assembled

The engine records its own profile on `AuditResult.run`. `saveAuditToDatabase()` stores `{ ...result.run, ...options.run }`: the caller's values win, and the engine supplies the fields the caller left out.

| Surface | Fields the surface sets | Fields that come from the engine |
|---|---|---|
| `seomator audit` | `crawl`, `maxPages`, `concurrency`, `measureCwv`, `mobile`, `simulateInteraction`, `categories`, `timeout` | `scoringVersion`, `enableRules`, `disableRules`, `staging` |
| `seomator analyze` | All fields. `measureCwv`, `mobile` and `simulateInteraction` are always `false`. | None |
| `seomator serve` and the desktop app | `crawl`, `maxPages`, `concurrency`, `measureCwv`, `mobile`, `simulateInteraction`, `categories`, `timeout` | `scoringVersion`, and `enableRules` and `disableRules` as `[]`. These surfaces do not apply `[rules]` filters and do not offer `--staging`. |

Older rows written by `audit`, the dashboard or the desktop app can lack `scoringVersion`, `enableRules` and `disableRules`, because those surfaces used to store only the fields they set themselves.

## How `compare` reads run profiles

`seomator compare` passes the two audits' `run_json` to `compareRunProfiles()` in `src/storage/audits-db/run-profile.ts`. The dashboard's compare view does not check run profiles.

- **No profile.** If either audit has no `run_json`, there is no known difference and the audits count as comparable.
- **Fields compared.** Every field in the table above except `concurrency` and `timeout`.
- **How values are shown.** A missing field reads `not recorded`. A missing `staging` reads `false`, so audits that never used `--staging` compare equal. An empty list reads `all`, except an empty `disableRules`, which reads `none`; an `enableRules` of `["*"]` also reads `all`. Other lists are joined with `, `.
- **Material differences.** A difference in a field marked Material makes the pair not like-for-like. `crawl mode` and `page limit` differences are listed as coverage differences only.
- **Effect on `--fail-on-regression`.** When the pair is not like-for-like, `--fail-on-regression` prints `Not failing on regression: ...` and exits 0, whatever the score did. With `--json` that note goes to stderr, so stdout is the JSON document alone. Otherwise it exits 1 when the score dropped or any rule's worst status got worse.
- **Engine version.** Separate from the profile: when both `engine_version` values are known and differ, `compare` prints an `Engine changed` note. It does not affect the exit code.
- **List spelling.** `enableRules` of `[]` (the dashboard and desktop app) and `["*"]` (the CLI) both read `all`, so audits from different surfaces with the same settings compare as like-for-like.

With `--json`, the output carries `comparable` (boolean) and `runDifferences`, an array of `{ option, previous, current, material }`.

Example: a production audit, then the same site with `--staging`:

```text
$ seomator compare example.com --fail-on-regression

Comparing example.com
  previous  2026-10-15-d182f9  2026-10-15 14:41  score 88
  current   2026-10-15-1022d7  2026-10-15 14:41  score 87

  Overall  88 → 87  ▼ -1
  These audits were not measured the same way, so this diff is not a like-for-like comparison:
    staging mode: false → true
...
  Not failing on regression: the two audits were measured differently, so any difference is not attributable to the site.
```

The exit code is 0. Against an audit stored without a scoring version, the JSON output lists `{ "option": "scoring model", "previous": "not recorded", "current": "4", "material": true }`.

## Project databases (`projects/<domain>/project.db`)

One SQLite file per domain, written only by `db migrate` from `.seomator/crawls/*.json`. No command reads crawls back out of these files: `analyze` reads the JSON. Every connection sets `journal_mode = WAL` and `foreign_keys = ON` (`initializeProjectSchema()` in `src/storage/project-db/schema.ts`).

### Table `projects`

| Column | Type | Constraint, default | Contents |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Row id. |
| `domain` | TEXT | NOT NULL, UNIQUE | The domain the file belongs to. |
| `name` | TEXT | | Project name from the crawl. |
| `created_at` | TEXT | DEFAULT `datetime('now')` | Insert time. |
| `updated_at` | TEXT | DEFAULT `datetime('now')` | Last update time. |
| `config_json` | TEXT | | Project config as JSON. |

### Table `crawls`

| Column | Type | Constraint, default | Contents |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Row id. |
| `crawl_id` | TEXT | NOT NULL, UNIQUE | The crawl's public id, from the JSON file. |
| `project_id` | INTEGER | NOT NULL, references `projects(id)` | The project. |
| `start_url` | TEXT | NOT NULL | The crawl's start URL. |
| `status` | TEXT | NOT NULL, DEFAULT `'running'` | `running`, `completed`, `failed` or `cancelled`. Migrated crawls are `completed`. |
| `started_at` | TEXT | DEFAULT `datetime('now')` | Insert time. |
| `completed_at` | TEXT | | Completion time. |
| `config_json` | TEXT | | The crawl's config as JSON. |
| `stats_json` | TEXT | | `{ totalPages, duration, errorCount }`. |
| `error_message` | TEXT | | Failure message, when there is one. |

### Table `pages`

| Column | Type | Constraint, default | Contents |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Row id. |
| `crawl_id` | INTEGER | NOT NULL, references `crawls(id)` | The crawl. UNIQUE together with `url_hash`. |
| `url` | TEXT | NOT NULL | Page URL. |
| `url_hash` | TEXT | NOT NULL | First 16 hex characters of the SHA-256 of `url`. |
| `status_code` | INTEGER | DEFAULT 0 | HTTP status. |
| `depth` | INTEGER | DEFAULT 0 | Depth as recorded in the JSON crawl. `seomator crawl` records 0 for every page. |
| `content_type` | TEXT | | Content type. |
| `html` | BLOB | | Page HTML, deflated (zlib, level 6) when it is 10 KB or larger and compression makes it smaller. |
| `html_compressed` | INTEGER | DEFAULT 0 | `1` when `html` is deflated. |
| `html_size` | INTEGER | | Uncompressed size in bytes. |
| `headers_json` | TEXT | | Response headers as JSON. |
| `load_time_ms` | INTEGER | | Load time. |
| `ttfb_ms` | INTEGER | | Time to first byte. |
| `cwv_lcp`, `cwv_cls`, `cwv_inp`, `cwv_fcp`, `cwv_ttfb` | REAL | | Core Web Vitals, when the crawl measured them. |
| `error_message` | TEXT | | Fetch error, when there was one. |
| `crawled_at` | TEXT | DEFAULT `datetime('now')` | Insert time. |

`db migrate` fills `url`, `url_hash`, `status_code`, `depth`, the three `html` columns, `headers_json`, `load_time_ms` and the Core Web Vitals columns. It leaves `content_type`, `ttfb_ms` and `error_message` NULL. `seomator crawl` does not store pages that failed to load, so the JSON has none to migrate.

### Tables `links`, `images` and `frontier`

These tables are created in every project database, and no SEOmator command writes rows to them in 6.0.0.

| Table | Columns |
|---|---|
| `links` | `id` INTEGER PRIMARY KEY, `page_id` INTEGER NOT NULL references `pages(id)`, `href` TEXT NOT NULL, `href_hash` TEXT NOT NULL, `anchor_text` TEXT, `is_internal` INTEGER DEFAULT 0, `is_nofollow` INTEGER DEFAULT 0, `rel_value` TEXT, `target_status_code` INTEGER, `target_error` TEXT |
| `images` | `id` INTEGER PRIMARY KEY, `page_id` INTEGER NOT NULL references `pages(id)`, `src` TEXT NOT NULL, `src_hash` TEXT NOT NULL, `alt` TEXT, `has_alt` INTEGER DEFAULT 0, `width` TEXT, `height` TEXT, `is_lazy_loaded` INTEGER DEFAULT 0, `loading_attr` TEXT, `srcset` TEXT, `file_size` INTEGER, `format` TEXT |
| `frontier` | `id` INTEGER PRIMARY KEY, `crawl_id` INTEGER NOT NULL references `crawls(id)`, `url` TEXT NOT NULL, `url_hash` TEXT NOT NULL, `depth` INTEGER DEFAULT 0, `priority` INTEGER DEFAULT 0, `status` TEXT DEFAULT `'pending'`, `discovered_at` TEXT DEFAULT `datetime('now')`, UNIQUE(`crawl_id`, `url_hash`) |

Indexes: `idx_crawls_project`, `idx_crawls_status`, `idx_crawls_started` (`started_at DESC`), `idx_pages_crawl`, `idx_pages_status` (`crawl_id, status_code`), `idx_pages_url_hash`, `idx_links_page`, `idx_links_internal` (`page_id, is_internal`), `idx_images_page`, `idx_frontier_crawl`, `idx_frontier_status` (`crawl_id, status`).

## Link cache (`link-cache.db`)

`src/storage/link-cache.ts` defines a cache of external link checks. No command, rule or surface opens it in 6.0.0, so the file is never created by normal use. `[external_links] cache_ttl_days` in `seomator.toml` is read into the config but has no effect: `seomator config validate` checks that it is between 0 and 365, and warns that it is not implemented when it differs from its default.

| Column | Type | Constraint | Contents |
|---|---|---|---|
| `url` | TEXT | PRIMARY KEY | The checked URL. |
| `status_code` | INTEGER | NOT NULL | HTTP status, `0` on error. |
| `error` | TEXT | | Error message. |
| `checked_at` | TEXT | NOT NULL | ISO 8601 time of the check. Indexed as `idx_checked_at`. |

`LinkCache` options: `ttlDays` (default 7), after which an entry reads as expired, and `dbPath` (default `$SEOMATOR_HOME/link-cache.db`). The connection sets `journal_mode = WAL`.

## `seomator db` commands

`seomator db` has three subcommands. They read and write the data directory and `.seomator/` in the current directory.

### `seomator db migrate`

Moves JSON crawls and legacy reports from `.seomator/` in the current directory into SQLite. It exits 0 even when individual files fail, so check the `Errors` block of its output.

| Option | Default | Effect |
|---|---|---|
| `--dry-run` | `false` | Count the files and print where they would go. Writes nothing. The destination lines always read `~/.seomator/...`, even when `SEOMATOR_HOME` is set. |
| `--archive` | `false` | After migrating, rename `.seomator/crawls` to `.seomator/crawls.bak` and `.seomator/reports` to `.seomator/reports.bak`, replacing any existing `.bak` directory. Each directory moves only when at least one of its files migrated. `analyze` and `report` cannot see archived files until `db restore`. |
| `--no-backup` | | Deprecated. Accepted and ignored: files stay in place unless `--archive` is given. |

What it writes:

- **Each crawl file** becomes a `projects` row (if the domain has none yet), a `crawls` row with `status = 'completed'`, and one `pages` row per stored page. A crawl id already present in the project database is skipped and counted under `Crawls skipped`.
- **Each report file** becomes an `audits` row with the report's id, then `audit_categories` and `audit_results` rows (every result filed under the report URL, with weight 1), then `issues` rows. `source`, `engine_version` and `run_json` stay NULL. A report already migrated fails with `UNIQUE constraint failed: audits.audit_id`, is listed under `Errors`, and the other files still migrate. `Reports skipped` is always 0.
- **`audits.db`** is opened, and created if missing, even when there are no report files.

```text
$ seomator db migrate --dry-run
SEOmator Database Migration

Files to migrate:
  Crawl files: 1
  Report files: 0

Dry run mode - no changes will be made

Would migrate to:
  Crawls → ~/.seomator/projects/<domain>/project.db
  Reports → ~/.seomator/audits.db
```

With nothing to migrate, it prints `No JSON files found to migrate.` and the two paths it looks for.

### `seomator db stats`

Prints the project databases with their file sizes, the size of `audits.db`, the size of `link-cache.db` (or `Not created yet`), and a `Pending Migration` block when `.seomator/crawls/` or `.seomator/reports/` in the current directory hold JSON files. The pending check counts files, so it still appears after a migration that left the files in place. When the data directory does not exist, it prints `No SEOmator data found.` and the expected location.

| Option | Default | Effect |
|---|---|---|
| `-v`, `--verbose` | `false` | Also print row counts: crawls, pages, links and images per project database, and audits, results, issues and comparisons for `audits.db`. |

```text
$ seomator db stats --verbose
SEOmator Database Statistics

Project Databases:
  No project databases found

Audits Database:
  Size: 356.0 KB
  Audits: 2
  Results: 746
  Issues: 0
  Comparisons: 1

Link Cache:
  Not created yet
```

### `seomator db restore`

Renames `.seomator/crawls.bak` back to `.seomator/crawls` and `.seomator/reports.bak` back to `.seomator/reports` in the current directory, deleting any directory already at the target name. SQLite data is left in place. With no `.bak` directory it prints `No backup found to restore.` It takes no options.

## Programmatic API

The package root (`@seomator/seo-audit`) exports these storage functions and types:

| Export | Signature or shape |
|---|---|
| `saveAuditToDatabase` | `(result: AuditResult, options?: SaveAuditOptions) => { auditId, id, domain, previousAuditId }`. Options: `projectName`, `config`, `source` (default `'cli'`), `run`, `db` (default the shared instance) and `retry` (`attempts`, default 20; `delayMs`, default 500; `sleep`). All are optional. |
| `getAuditsDatabase` | `() => AuditsDatabase`, the shared instance at `$SEOMATOR_HOME/audits.db`. |
| `closeAuditsDatabase` | `() => void`, closes the shared instance. |
| `AuditsDatabase` | Class. `AuditsDatabase.open(path)` opens a separate connection that the caller must `close()`. Methods cover audits (`createAudit`, `getAudit`, `getAuditById`, `getLatestAudit`, `getPreviousAudit`, `listAudits`, `completeAudit`, `failAudit`, `deleteAudit`, `getAuditCount`, `getAuditedDomains`), categories (`insertCategories`, `getCategories`, `getCategory`), results (`insertResults`, `getResults` (limit 1000 by default), `getAllResults`, `getRuleSummaries` (up to 5 sample pages per rule), `getAuditPages`, `getResultsByRule`, `getResultsByStatus`, `getResultsByPage`, `getFailedResults`, `getResultCounts`, `getFailedRules`), issues (`insertIssues`, `getIssues`, `getIssuesBySeverity`, `getCriticalIssues`, `getTopPriorityIssues`, `getIssueCounts`, `generateIssuesFromResults`), comparisons (`buildComparison`, `recordComparison`, `getComparison`, `getComparisonsByDomain`, `getScoreTrend`), plus `getStats()`, `getDb()` and `close()`. |
| `diffRules` | `(previous: HydratedAuditResult[], current: HydratedAuditResult[]) => RuleDiff`. `RuleDiff` has `regressed`, `improved`, `added` and `removed`, each a list of rules compared by worst measured status. |
| `listAudits`, `getAuditDetail`, `compareStored`, `getTrend`, `listDomains` | The read queries the dashboard and the desktop app share, from `src/dashboard/queries.ts`. Each takes an `AuditsDatabase` first. |
| `AuditRunOptions`, `AuditSource` | Types for `run_json` and `source`. |

`listAudits()` returns 50 rows by default, newest first, and filters on `domain`, `projectName`, `minScore`, `maxScore`, `since`, `until`, `status`, `limit` and `offset`.

## Examples

Keep a throwaway history while you experiment:

```bash
export SEOMATOR_HOME=$(mktemp -d)
seomator audit https://example.com --no-cwv
ls "$SEOMATOR_HOME"
# audits.db
```

Read the scoring model and staging flag of stored audits:

```text
$ sqlite3 -header -column "$SEOMATOR_HOME/audits.db" "SELECT audit_id, source, overall_score, json_extract(run_json, '$.scoringVersion') AS scoring, json_extract(run_json, '$.staging') AS staging FROM audits ORDER BY id;"
    audit_id       source  overall_score  scoring  staging
-----------------  ------  -------------  -------  -------
2026-10-15-d182f9  cli                88        4
2026-10-15-1022d7  cli                87        4        1
```

Run an audit without storing it:

```bash
seomator audit https://example.com --no-cwv --no-save
```

## Explanation: design notes

### Why stored runs carry a profile

A score only means something next to another score produced the same way. The surfaces that write to `audits.db` do not share defaults: the CLI measures Core Web Vitals unless `--no-cwv`, while the run form shared by the dashboard and the desktop app starts with Core Web Vitals off. A run without a browser render leaves dozens of checks unmeasured, and the score moves for reasons that have nothing to do with the site. Rule filters, staging mode and scoring-model changes do the same. Before `run_json` was read, `compare --fail-on-regression` could fail a CI build whose only change was which surface produced the baseline. Storing the profile lets `compare` say why two scores differ, and refuse to call a measurement change a regression.

### Why unmeasured results are stored at score 50 with weight 0

`audit_results.score` is `INTEGER NOT NULL`, and every desktop audit with Core Web Vitals off carries unmeasured rows, so a NULL score would fail the insert. The status says the result is unmeasured; weight 0 keeps it out of every average. The weight is written alongside the status so that an older SEOmator reading a newer database still recognises the row.

## Related

- [Technical Architecture](./technical-architecture.md): how an audit runs, how it is scored, and where saving fits.
- [Configuration](./configuration.md): `[output] save`, `[rules]`, `[crawler]` and the other `seomator.toml` keys.
- [Web Dashboard](./WEB-DASHBOARD.md): `seomator serve`, its API and `serve.json`.
- [Desktop App](./ELECTRON-APP.md): the Electron app that shares `audits.db`.
- [Quickstart](./quickstart.md): install SEOmator and run a first audit.
- [AI Agent Integration](./ai-agent-integration.md): reading stored audits and `compare` output from an agent.
- [Documentation index](./README.md): all SEOmator docs.
