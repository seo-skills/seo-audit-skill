# TODOS

Deferred work, with the context needed to pick it up later. Items are added by review
passes; nothing here is lost scope, it is scope that was consciously not taken.

## From the design-system review (2026-09-03)

### P1 — must land before Release 2 of the design plan

- **Two divergent in-repo `SKILL.md` copies, both claiming "Runs 261 audit rules"**
  while the tool has 332. `scripts/sync-docs.mjs` targets `SKILL.md`, `README.md`,
  `CLAUDE.md`, `docs/SEO-AUDIT-RULES.md` — its rewrite patterns are anchored on
  "N rules across N categories" and never match "Runs N audit rules". The skill also
  hardcodes a category-weight table (Core 12% / Performance 12% / Accessibility 4%)
  that the registry contradicts today (11 / 10 / 7) and that `rulePriority()` will
  contradict explicitly. Resolve to one copy, extend the sync patterns, wire
  `check:docs` into CI.
- **The installed skill clone** at `~/.claude/skills/seo-audit/SKILL.md` advertises 287
  rules. `check:docs` cannot reach it. Decide: sync it, or state that the clone is out
  of scope and stop it drifting silently.

### P2 — CLI correctness, outside the design blast radius

- **`--config`, `--refresh` and `--resume` are accepted and ignored.** `cli.ts:144`
  exposes them; `runAudit` forwards none. Either wire them or remove them.
- **`output.format` / `output.path` in `seomator.toml` are documented and ignored**,
  because format resolves before config is read (`audit.ts:56`). Config also accepts
  `text`, which `audit` does not. One `resolveAuditOptions()` layer with explicit
  precedence, and one shared format enum.
- **`http-error` is declared, hinted, and never thrown.** A 404 start URL is fetched,
  parsed, scored and reported as a normal audit. Throw on `>= 400` in single-page mode
  with the status and the final URL after redirects.
- **`--fail-under <n>`** instead of the hardcoded `score >= 70` exit code
  (`audit.ts:274`). Lighthouse CI separates collection from assertion; every team whose
  site scores 68 currently has to wrap the CLI in `jq`.
- **`html` and `markdown` write a file even without `-o`**, so piping them yields an
  empty pipe and a stray `seo-report-<id>.html` in the cwd. Four formats stream, two do
  not, and nothing documents the asymmetry.
- **Exit code 130 is undocumented.** The README table lists 0/1/2; SIGINT also emits 130.
- **Deprecation notices have no removal version**, and `--save`'s notice is suppressed in
  JSON mode — the only users affected are the ones scripting it.

### P3 — deferred design work

- **Hand-tuned impact values per rule.** `rule.weight × category.weight` ranks well
  enough to ship; bespoke per-rule impact is a separate exercise.
- **Visual regression / screenshot diffing.** New infrastructure; the contrast and
  token lint tests cover the drift that actually happened.
- **Print / PDF stylesheet for the HTML report.** Consultants print these. Downstream of
  ordering and collapsing.
- **Deleting a reporter.** The markdown reporter (215 lines) and JSON (33) may have
  near-zero usage; six surfaces at this team size is the root cause of drift. Needs
  usage data nobody has.
- **Close the fix loop.** Nothing marks a finding handled, and nothing answers "did my
  fix land" except a manual compare. A "since last audit" strip on the detail page is
  composition over `getScoreTrend` + `compare`, not new plumbing.
- **Persist one `audit_rule_summaries` row per rule at save time**, so dashboard reads
  and exports stop rescanning raw history.

## From earlier work

- **Electron release.** `electron-builder` targets exist (dmg/zip/nsis); nothing is
  published.
- **Engine SSRF hardening.** The audit engine fetches URLs the user supplies; there is
  no allowlist or private-range guard.
- **`db prune`.** Nothing removes old audits; the database grows without bound.
