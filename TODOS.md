# TODOS

Deferred work, with the context needed to pick it up later. Items are added by review
passes; nothing here is lost scope, it is scope that was consciously not taken.

## From the design-system review (2026-09-03)

### P1 — must land before Release 2 of the design plan

- ~~**Two divergent in-repo `SKILL.md` copies, both claiming "Runs 261 audit rules"**
  while the tool has 332 … Resolve to one copy, extend the sync patterns, wire
  `check:docs` into CI.~~
  **Mostly fixed 2026-09-04.** `sync-docs.mjs` gained a `Runs N audit rules`
  pattern, `skill/SKILL.md` as a target (it was never one, which is how the
  second copy drifted freely), and a weight-table sync that rewrites the
  percentages *and* re-sorts the "fix in this order" list — it claimed
  12/12/4 against a registry saying 11/10/7, and with Accessibility at 7% the
  list was no longer in the order it promises. The two copies are now identical:
  the root one was additionally stale on 3.4.0, still telling agents to pass
  `--save` and never mentioning `seomator serve`.
  **Still open:** the copies are kept in step by `check:docs`, not by structure —
  resolving to genuinely one file (symlink, or generate one from the other) is a
  layout decision left to the maintainer. Wiring `check:docs` into CI is moot
  while the repo has no CI, which was a deliberate call.
- ~~**The installed skill clone** at `~/.claude/skills/seo-audit/SKILL.md` advertises 287
  rules. `check:docs` cannot reach it. Decide: sync it, or state that the clone is out
  of scope and stop it drifting silently.~~
  **Fixed 2026-09-03** (outside `/qa`, on request). The clone is a separate git checkout
  of this same repo (`~/.agents/skills/seo-audit`, symlinked from
  `~/.claude/skills/seo-audit`), 24 commits behind `origin/main` — `git pull --ff-only`
  brought it to `af5e851`, matching this repo's `main`. Both `SKILL.md` and
  `skill/SKILL.md` in that clone now say 332. `check:docs` still cannot reach it — this
  was a manual pull, not a mechanism, so it can drift again. The clone picks up the
  item above once this branch reaches `main` and it is pulled again.

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
- **Per-status page counts on `RuleSummary`.** It carries the worst measured
  status plus a total affected-page count, so a rule that fails on one page and
  warns on 999 ranks as if all 1,000 were failures. `rulePriority()`'s
  affected-share is a reasonable approximation of urgency today; splitting into
  `failPages` / `warnPages` / `passPages` / `notMeasuredPages` would make it
  exact and let the evaluation ledger be derived from the summaries alone
  instead of a second query.
- **Persist one `audit_rule_summaries` row per rule at save time**, so dashboard reads
  and exports stop rescanning raw history.

## From earlier work

- **Electron release.** `electron-builder` targets exist (dmg/zip/nsis); nothing is
  published.
- **Engine SSRF hardening.** The audit engine fetches URLs the user supplies; there is
  no allowlist or private-range guard.
- **`db prune`.** Nothing removes old audits; the database grows without bound.
