<!-- /autoplan restore point: ~/.gstack/projects/seo-skills-seo-audit-skill/feat-dashboard-runs-autoplan-restore-20260903-110754.md -->

# PRD — One verdict, one ordering, six surfaces

**Status:** v2, reviewed by `/autoplan` (CEO → Design → DX → Eng)
**Author's direction (verbatim):** "the design and ui ux is so bad we need to improve
it on ui side and also electron app side and static html sides"

**What the review changed:** the direction named three surfaces and a visual problem.
Six surfaces render an audit, the most-used one was not in the list, and the measured
defects are not visual. The plan keeps the author's goal — the product should stop
looking bad — and reorders the work so that the visual pass is cheap instead of
cosmetic. Two challenges to the author's framing are listed in §12 for decision.

---

## 1. The surfaces, measured

Every surface below was opened on a real 8-page audit of growthmarketing.ai
(score 94, 332 rules, 2,656 rule-page results).

| # | Surface | Code | Users reach it by | State |
|---|---|---|---|---|
| 1 | **Terminal** | `terminal.ts` + `progress.ts` + `banner.ts` (889 lines) | `seomator audit <url>` — **the default** | Best-behaved: sorts categories worst-first, ranks issues by severity, counts not-measured separately, resolves rule names from the registry |
| 2 | Static HTML report | `html-reporter.ts` (2,352 lines, 34 KB inline CSS) | `--format html` | Best-looking, worst-ordered. 54,683 px tall |
| 3 | Web dashboard | `ui/` (3,552 lines) | `seomator serve` | Functional; weak empty states |
| 4 | Electron app | same `ui/` + 704 lines of chrome | the desktop app | Inherits 3; its front door is the emptiest screen |
| 5 | Markdown report | `markdown-reporter.ts` (215) | `--format markdown` | Not reviewed by the author |
| 6 | LLM report | `llm-reporter.ts` (238) | `--format llm`, the Claude Code skill | Not reviewed by the author |

`src/commands/audit.ts:57` — `options.format ?? (options.json ? 'json' : 'console')`.
Console is the default. Nobody sees the HTML report without passing `--format html`.

## 2. What is actually wrong (verified, not asserted)

### 2.1 The product disagrees with itself about the verdict — CRITICAL

Three score-to-grade scales, verified by running them:

| Score | Terminal (`banner.ts:57`) | LLM report (`llm-reporter.ts:29`) | HTML / dashboard (`getScoreLabel`) |
|---|---|---|---|
| 65 | D | D | Needs Work |
| **55** | **D** | **F** | Needs Work |
| 45 | F | F | Poor |

A site scoring 50–59 is graded **D in the terminal and F in the report handed to an
LLM**. `getScoreLabel` is copy-pasted verbatim into `html-reporter.ts:156`,
`markdown-reporter.ts:17` and `ui/lib/format.ts:27`. No token file fixes this.

### 2.2 The report orders by severity and nothing else, and renders everything expanded — HIGH

Corrected during design review; the first draft of this section overstated the defect.
`html-reporter.ts:1977` builds the issues table as `[...failures, ...warnings]`, so it
**is** severity-ordered at the top level. Two separate problems remain:

- **Unordered within severity.** Its only `sort()` is `uniqueUrls.sort()` (line 1964).
  Inside "failures" and inside "warnings", findings appear in registry order, so a
  weight-250 Core Web Vitals warning sits below a weight-1 one.
- **Everything renders expanded.** All 332 rules, all pages, all fix text. This — not
  ordering — is what makes the page 54,683 px. Ordering removes no pixels.

Keeping these separate matters: an implementer who ships ordering alone will measure
54,000 px afterwards and conclude they failed.

### 2.3 The ordering data already exists — nobody uses it

`AuditRule.weight` spans 13 distinct values (1–25) across the 332 rules, and the 20
categories carry weights summing to 100. Multiplying them ranks every rule today,
with no new field and no rule edits:

```
250  cwv-lcp        250  cwv-cls        200  cwv-inp
200  perf-render-blocking               160  images-alt-present
150  cwv-ttfb       150  cwv-fcp        150  perf-dom-size
```

That is the right answer for an SEO tool, produced from data the registry already has.

**But it is the wrong first screen for the surfaces this plan is about.** The dashboard
and Electron app default to `measureCwv: false` (`AuditRunner.tsx:36`), so on a default
GUI audit five of those seven resolve to *not-measured*. A naive top-10 would open with
"we didn't measure this" five times. (The CLI is the opposite: `--no-cwv` is opt-out, so
a terminal audit does measure them.)

Therefore `rulePriority()` returns **0 for not-measured**, and unmeasured checks get
their own block — a prompt, not a finding:

> *6 checks could not run. Re-run with Core Web Vitals enabled to include them.*

### 2.4 `not-measured` is a status inferred from a magic number — HIGH

`notMeasured()` returns `status: 'warn', weight: 0`; `isNotMeasured()` recovers it by
testing `weight === 0`. It is not a `RuleStatus` variant. Consequences found:

- `markdown-reporter.ts:107` and `llm-reporter.ts:174` treat those results as ordinary
  warnings, so the LLM report can propose fixes for checks that never ran.
- Audits stored before 3.4.0 have `weight = NULL`, read back as measured, so every
  not-measured check in old history resurfaces as a warning. This is deliberate and
  documented, but it means the dashboard is inconsistent with its own history.
- The same bug class has been fixed three times already (`26e6519`, `2b4bc2d`,
  and the 3.4.0 weight column), each time in one surface.

### 2.5 The HTML report is not self-contained — HIGH

`html-reporter.ts:2153` loads IBM Plex from `fonts.googleapis.com`. The report is
emailed and archived; offline it loses its typography, and every reader's browser
makes a request to Google. The identical bug was fixed in `ui/styles/tailwind.css`
hours earlier — the reporter's copy was missed, which is the duplication thesis in
one line.

### 2.6 The token copies have already drifted — MEDIUM

Light mode is identical; dark mode is not.

| Token | HTML report | `ui/` |
|---|---|---|
| `--color-bg` | `#000000` | `#09090b` |
| `--color-bg-elevated` | `#0a0a0a` | `#18181b` |
| `--color-bg-hover` | `#161616` | `#27272a` |
| `--color-border` | `#1a1a1a` | `#27272a` |
| `--color-neutral` | `#64748b` | *missing* |

One product, two dark themes: pure black versus zinc.

### 2.7 Counting: the units are right, the label is missing — MEDIUM

The HTML report shows 4 / 42 / 278 / 8 not-measured = **332**; the dashboard shows
27 / 246 / 2312 / 71 = **2,656** = 332 × 8 pages. Both sum correctly. Neither says
which it is counting. Separately, `html-reporter.ts:105` groups by `ruleId + status`,
so a rule with mixed status across pages produces two rows and the row count can
exceed the rule count.

### 2.8 Layout defects — MEDIUM

- HTML report: category sidebar disappears below the breakpoint with no replacement;
  the audited URL drops from the mobile header; header says "8 pages" while the page
  filter says "All Pages (7)".
- Dashboard: the trend chart draws a full-height empty box for two points; compare with
  no changes is a heading in an empty viewport; the run screen is a form and 600 px of
  nothing — and it is the Electron app's front door.

### 2.9 Accessibility: the tokens fail WCAG AA, and one is not valid CSS — CRITICAL

Measured, not asserted. Light theme, normal text (AA needs 4.5:1):

| Pair | Ratio | |
|---|---|---|
| `--color-warn` #f59e0b on white | **2.15:1** | the warning counts |
| `--color-pass` #10b981 on white | **2.54:1** | the passed counts |
| `--color-text-muted` #94a3b8 on white | **2.56:1** | every secondary line |
| `--color-fail` #ef4444 on white | 3.76:1 | fails normal text |
| warn on `--color-warn-bg` | **1.93:1** | the status badges |
| pass on `--color-pass-bg` | **2.24:1** | the status badges |
| fail on `--color-fail-bg` | 3.08:1 | the status badges |

8 of 13 text pairs fail. Dark mode is fine (6.9–8.3:1); **the light theme is the
problem**, and consolidating tokens without fixing this standardises the failure.

Worse, one composition is invalid CSS. `getScoreColor()` returns `'var(--color-pass)'`;
`ScoreCircle.tsx:59` and `CategorySection.tsx:70` then write
`` backgroundColor: `${color}15` `` → `"var(--color-pass)15"`. Verified in the browser:
computed background is `rgba(0, 0, 0, 0)`. The "Excellent" pill under the main score has
**no tint at all** — green text on a white card at 2.54:1. It is the highest-hierarchy
element on the page and it is a live bug that a token audit would not catch, because the
token values are correct and the composition is not.

Also unaddressed today: `<tr onClick>` in `IssuesTable.tsx:108` is mouse-only (no
`tabIndex`, no key handler) while `AuditList` does it correctly with a real link;
`AuditRunner`'s `sr-only` checkboxes have no `:focus-within` style; `prefers-reduced-motion`
is claimed in a comment but covers only the skip link; `aria-live` wraps the whole
20-category grid, so every category re-announces the entire region.

### 2.10 Out-of-band: the installed skill clone is stale — MEDIUM

`~/.claude/skills/seo-audit/SKILL.md` advertises **287 rules**; `skill/SKILL.md` in the
repo says **332**. `scripts/sync-docs.mjs --check` does not reach the installed clone.

## 3. Approach

### Alternatives considered

```
APPROACH A: Restyle each surface in place
  Effort: M   Risk: Med   Completeness: 3/10
  Pros:   smallest diff per surface; no new shared code
  Cons:   fixes none of 2.1-2.5; guarantees the next drift
  Reuses: nothing

APPROACH B: Shared tokens + shared pure TypeScript, renderer-native components
  Effort: L   Risk: Low   Completeness: 9/10
  Pros:   kills grade drift, status drift, colour drift at the source; each renderer
          stays idiomatic (string builder for HTML, React for ui/, chalk for terminal)
  Cons:   two component implementations remain; parity needs fixture tests
  Reuses: ui/lib/format.ts, src/dashboard/aggregate.ts, the rule registry's weights

APPROACH C: Render the HTML report from the React components (react-dom/server)
  Effort: L   Risk: High  Completeness: 9/10
  Pros:   one renderer, drift structurally impossible
  Cons:   ELIMINATED — requires react + react-dom in package.json `dependencies`,
          which CLAUDE.md forbids in bold (npm CLI users would pull ~15 MB).
          Not an open question; it was closed before this PRD was written.
  Reuses: ui/ wholesale
```

**Chosen: B.** C is not available. A does not touch a single verified defect.

Note for the record: `dist/web` (318 KB of built React) already ships to every npm CLI
user via `files: ["dist"]`. The dependency firewall protects `node_modules`, not the
payload. That is intended — `seomator serve` needs it — but it means "the CLI must stay
small" is an argument about install size, not about shipped bytes.

### Sequence

**Release 1 — one verdict (the foundation; makes the visual pass cheap)**

0. **`schemaVersion` on `AuditResult` and `schema=` on `<seo-audit>`, before anything
   else.** `--format json` is a raw `JSON.stringify` of the internal type
   (`json.ts:21`) and the LLM XML carries no version. Every change below is a breaking
   change to an unversioned public contract; without a version number, consumers cannot
   branch and we cannot deprecate.

0b. **Promote the run config onto `AuditResult`.** It is already persisted in
   `run_json`, and **nothing reads it**: `compare.ts` references `engineChanged` three
   times and the run config zero times. Because the CLI defaults CWV on and the GUI
   defaults it off, and both write to the same database, `seomator compare
   --fail-on-regression` can fail a CI build whose only change is that the baseline
   came from the desktop app. One field on the result, read by `compare` and rendered
   in every surface header ("CWV: not measured"), removes that whole class.

1. `not-measured` becomes a first-class `RuleStatus`, changed **atomically** across
   scoring, storage, all six reporters, the dashboard API and IPC, and both in-repo
   skill copies. Legacy rows keep their current meaning — pre-3.4.0 `weight = NULL`
   stays *measured*, which is the opposite of what a naive migration would do.
2. One `scoreToVerdict()` shared by all six surfaces; delete the three copies of
   `getScoreLabel` and reconcile the D/F boundary.
3. `rulePriority()` derived from `rule.weight × category.weight × affected-page ratio ×
   status severity`. No new field, no rule edits.
4. One counting DTO — `rulesEvaluated`, `rulePageEvaluations`, `affectedRules`,
   `affectedPages`, `notMeasured` — produced once and labelled on every surface.
5. Contract tests: the same `AuditResult` through all six reporters must agree on
   verdict, counts and top-10 ordering.

**Release 2 — the visual pass (now cheap)**

6. HTML report: order by `rulePriority()`, lead with the top findings, collapse passed
   and not-measured by default, inline the font, restore mobile category navigation,
   fix "8 pages" vs "All Pages (7)".
7. Dashboard and Electron: the four empty states (run, compare, trend, first-launch);
   dark-mode token parity.
8. One token source consumed by both `html-reporter.ts` and `ui/`; CI fails on a hex
   literal outside it.
9. Markdown and LLM reporters — the agent surface, which is the product's actual
   differentiator and got one line in v2:
   - Honour `not-measured` and the shared ordering.
   - **Group like the terminal already does.** `llm-reporter.ts:180` emits one
     `<issue>` per rule *per page* with no dedupe and no cap — on the 8-page fixture
     that is ~2,300 elements. `terminal.ts:74-166` already groups by rule and truncates
     page lists; reuse it.
   - **Page attribution as an attribute**, not buried in free-text `<details>`.
   - **An error envelope on stdout.** A failure under `--format llm` currently writes
     coloured English to stderr and leaves stdout empty — and the skill tells agents to
     prefer `--format llm`. The recommended agent invocation is the one with no
     parseable failure.
   - Success criterion: the LLM report on the 8-page fixture is under 50 KB.

## 3a. The migration: there are three encodings, not two

Found in eng review and **confirmed against a live database**. The author's own
`~/.seomator/audits.db` contains two of the three right now:

| Encoding | Written by | Rows in the live DB | Means |
|---|---|---|---|
| A | pre-3.4.0 | **15,979** (`weight IS NULL`) | measured — deliberately, and it must stay that way |
| B | 3.4.0–3.5.0 | **142** (`status='warn'`, `weight=0`) | not measured |
| C | after this plan | — (`status='not-measured'`, `weight=0`) | not measured |

v2 of this plan considered A and C and missed B — the encoding every current user's
database is full of. A change that keys on `status` alone would re-read every 3.4.0 and
3.5.0 unmeasured check as a real warning: exactly the bug §2.4 says has been fixed three
times already, reintroduced by the fix for it.

Hence DD-16: one predicate, everywhere, no backfill. `weight` stays authoritative and
`status` is consulted only for the new encoding. This also keeps an older `npx` binary
safe against a newer database — `rule-diff.ts:52,77` and `results.ts:367` already gate on
weight, not status.

**The highest-value test in the release:** an audit stored in encoding B compared against
the same site in encoding C must produce an *empty* `RuleDiff`. Without it, the first
`compare --fail-on-regression` after upgrading turns every CWV rule into a `removed` and
fails CI on the upgrade itself.

## 4. Success criteria (falsifiable)

- One grade function; a test asserts all six surfaces return the same verdict for
  0–100.
- **Two named ledgers, not one.** `ruleCounts` (of ~332) and `evaluationCounts` (of
  rule × page) each carry pass/warn/fail/notMeasured/total and each sums internally.
  "The four counters sum to the rule total" was unachievable as written: the stored
  `totalRules` is actually `resultInputs.length` (332,000 on a 1,000-page crawl), while
  `AuditDetail.categoryResults[].results` holds ~332 summaries beside page-level
  counters. `affectedPages` is a distinct-URL union (`COUNT(DISTINCT page_url_hash)`),
  never a sum of per-rule counts.
- The HTML report's first screen contains the top 10 findings by `rulePriority()`.
- The report renders identically with the network disabled.
- No hex literal outside the token file (CI), per DD-12.
- The report's height on the 8-page fixture drops below 10,000 px with passed and
  not-measured collapsed.
- **Every token pair used as text-on-background passes 4.5:1 in both themes**, asserted
  by a test over the token file. (8 of 13 fail today; see §2.9.)
- Every interactive element is reachable and operable by keyboard, asserted per surface.
- `prefers-reduced-motion` suppresses every animation and smooth scroll, not just the
  skip link.
- **A 1,000-page audit is a budget, not a hope**: report file size, render time, heap
  growth and DOM-node count are all asserted. The 8-page height check is necessary and
  nowhere near sufficient — today the reporter emits `data-urls` twice per rule with up
  to 1,000 URLs each, which is tens of MB before any styling is considered.
- An encoding-B audit compared against an encoding-C audit of the same site yields an
  empty `RuleDiff` (see §3a).

## 4b. Design decisions taken here, so the implementer does not have to guess

Each of these is a one-way door that the first draft left open.

| # | Decision | Chosen | Why |
|---|---|---|---|
| DD-1 | Document order in the report body | **Flat priority order.** Category grouping becomes a filter, not a layout | A top-10 widget above 332 category-grouped cards satisfies the letter of "lead with the top findings" and none of its intent |
| DD-2 | Severity multiplier in `rulePriority()` | `fail = 1.0, warn = 0.5, not-measured = 0` | Without a number this is unspecified; every fixture bakes it in |
| DD-3 | Tie-break | rule weight, then category weight, then rule id | 13 weights × 20 categories collide often (three rules already tie at 150); otherwise the long tail is unordered |
| DD-4 | Letters vs words | **Keep both, from one bucket set.** `scoreToVerdict()` returns `{ grade, label, colorToken }`; the terminal prints the grade, visual surfaces print the label | Dropping letter grades changes CLI output people may script against |
| DD-5 | The D/F boundary | **D at ≥50**, matching the terminal | It is the default surface; the LLM report is the outlier |
| DD-6 | Colour is part of the verdict | `scoreToVerdict()` returns the token name | Otherwise `getScoreColor`'s 90/70/50 boundaries are a fourth grade scale and the contract test passes while colours disagree |
| DD-7 | Dark theme | **Zinc** (`#09090b` / `#18181b`), not pure black | `#000000` with `#0a0a0a` elevation is 1.03:1 — card edges vanish on OLED, which is part of the reported "looks bad" |
| DD-8 | Collapsing | `<details>`, driven by the filter bar | Browser find works inside `<details>` and not inside `display:none`; this report is archived and searched. Keyboard and screen-reader behaviour come free |
| DD-9 | Default filter state | Failures + warnings open; passed and not-measured collapsed with visible counts | The counts stay honest while the page stops being 54,000 px |
| DD-10 | Not-measured | A prompt block, never a finding | See §2.3 |
| DD-11 | Token mechanism | `src/design/tokens.ts` as the source; a `toCss()` the reporter inlines; a generated `ui/styles/tokens.css` written by a prebuild step and committed | The reporter emits a CSS string, `ui/` uses Tailwind `@theme`. One of them has to be generated, and Vite should stay dumb |
| DD-13 | `not-measured` score | **Keep `50`.** Reversed during eng review | `audit_results.score` is `INTEGER NOT NULL` (`schema.ts:45,65`). Since the GUI defaults CWV off, *every* desktop audit produces not-measured rows, so `score: null` would throw `NOT NULL constraint failed` on every save. The status now carries the meaning; the number does not have to |
| DD-16 | The not-measured predicate | `weight IS NOT NULL AND (weight = 0 OR status = 'not-measured')` in SQL; `r.status === 'not-measured' \|\| r.weight === 0` in TypeScript. **No backfill.** | There are **three** encodings, not two — see §3a |
| DD-17 | Where `rulePriority()` runs | Server-side only. `priority: number` travels on `RuleSummary`; `ui/` never imports it | Rule weights only exist after `rules/loader.ts` static-imports all 20 category indexes. `@core` resolves from `ui/`, so importing a registry-backed helper would pull the entire 332-rule engine into the browser bundle. Only `scoreToVerdict()` — a pure leaf — crosses over |
| DD-18 | Tailwind's `@theme` block | Generated tokens land as plain unlayered `:root{}` / `[data-theme='dark']{}`. The `@theme` alias block stays byte-identical | `ui/styles/tailwind.css:17` is `--color-pass: var(--color-pass)` — self-referential, and it works *only* because unlayered CSS outranks cascade layers. Emitting the generated file into a layer, or giving `@theme` real values, makes every custom property invalid and the UI loses all colour at once |
| DD-14 | The five verdict buckets | Excellent / Good / Fair / Needs Work / Poor, at 90 / 80 / 70 / 50 | Letters have 5 buckets, labels have 4. "One bucket set" forces a fifth word; naming it here stops the implementer collapsing B and C |
| DD-15 | Breaking-change handling | Ship behind the `schemaVersion` from Release 1 item 0; keep `weight === 0` on not-measured so old predicates still work; CHANGELOG **Breaking** entry naming the exact predicate that changes | The repo already has precedent — `skill/SKILL.md` carries a "Scores changed in v3.1.0" callout |
| DD-12 | The hex-literal CI rule | No hex or `rgb()` outside `src/design/tokens.ts` and `ui/styles/globals.css`; `#fff`/`#000` replaced by `--color-on-accent`. Modelled on `ui/no-raw-html.test.ts` | Stated loosely it fails on day one — there are already four `'#fff'` literals in `ui/` |

## 4c. Interaction states — the matrix the plan owes the implementer

"The four empty states" was one bullet covering two surfaces. The real set, from reading
the code:

| Surface / screen | State | Today | Required |
|---|---|---|---|
| Home | read error that is not `serverGone` | renders **"No audits found"** — tells the user their history is empty when the read failed | third branch: error + retry |
| Detail | audit passes everything | the "Issues to fix" section is removed silently | a success state; this is the one moment the product could feel good |
| Detail | filter matches nothing | `CategorySection` returns `null`; heading over empty space | empty state naming the active filter |
| Detail | delete | immediate, no confirmation, no `catch` | confirm (native dialog under Electron, two-step inline on web) + failure branch |
| Detail | export | no busy state, no failure state | disabled/busy label, persistent success or failure |
| Run | in flight | a bar and 20 circles, no elapsed time, no ETA anywhere | elapsed timer from the first event; ETA from the running mean after page 2 |
| Run (Electron) | first launch | `EmptyHistory` tells a GUI user to run a terminal command, two inches below a "New audit" button | host-aware copy: a primary button to `/run` |
| Trend | exactly two points | draws a valid but meaningless chart; `TrendChart`'s own "need two audits" branch is unreachable | require three points before drawing |
| Everywhere | reveal a finding | sets category and scrolls, but `defaultExpanded` is read only at mount, so the target can stay collapsed; focus never moves | one atomic action: clear filter, expand, reveal, update the URL, scroll, move focus |

## 4d. Every call site the `not-measured` status breaks

Found by reading, not by guessing. TypeScript will not catch most of these, because
several declare their own local copy of the status union.

| File | What breaks |
|---|---|
| `ui/components/RuleCard.tsx:119` | `pass ? … : warn ? … : fail` — a new value falls through to **red fail styling** |
| `ui/lib/format.ts:41,49` | exhaustive switches over a *locally declared* union; returns `undefined` at runtime for the new value |
| `ui/components/IssuesTable.tsx:64` | `rule.status as 'fail' \| 'warn'` — a cast that launders the new value past the checker |
| `ui/components/FilterTabs.tsx:5` | no not-measured tab, so DD-9's "collapsed with visible counts" has no affordance in the dashboard |
| `src/storage/types.ts:393` | a second, independent status union for the DB layer |
| `src/storage/audits-db/schema.ts:64` | `status TEXT NOT NULL` with no CHECK; two encodings will coexist and `idx_results_status` indexes a mixed vocabulary |
| `src/reporters/llm-reporter.ts:180` | `status === 'warn'` currently *includes* not-measured while `<summary warnings>` *excludes* it (`scoring.ts:115`) — the counts and the issue list already disagree on every audit that skipped CWV |

| `src/storage/save-audit.ts:164` | `status: ruleResult.status as RuleResultStatus` — a cast bridging the two unions, which launders the new value silently |
| `src/storage/audits-db/results.ts:512` | `getResultCounts` buckets by status alone, so `pass + warn + fail < total` without warning |
| `src/storage/audits-db/issues.ts:323` | `WHERE status = 'warn'` — **already today** promotes not-measured rows into `issues` at warning severity, changing `priority_score` ordering |
| `src/reporters/llm-reporter.ts:188` | the `else` branch files anything that is not fail/warn under `<passed>` — a naive change makes the LLM report claim unmeasured checks *passed*, strictly worse than today |
| `src/reporters/progress.ts:178` | another local union |
| `src/commands/doctor.ts:16` | the same union for an unrelated purpose — **must not be widened** |

Every one of these imports `RuleStatus` from `src/types.ts` afterwards; the local unions
and the cast are deleted. `doctor.ts` is the exception and is named here so a global
search does not catch it. Add to §4: *for each surface,
`count(issue[severity=warning]) === summary.warnings`.*

## 5. Not in scope

| Item | Why | Where it goes |
|---|---|---|
| Hand-tuning impact values for 332 rules | Derived priority (2.3) is good enough to ship; bespoke values are a separate exercise | TODOS.md |
| Visual regression / screenshot diffing | New infrastructure, not a design fix | TODOS.md |
| Deleting the markdown or JSON reporter | Needs usage data nobody has | TODOS.md |
| Print / PDF stylesheet for the report | Real, but downstream of ordering | TODOS.md |
| Fixing the stale installed skill clone (2.9) | A docs-sync bug, not a design one | TODOS.md — extend `check:docs` |
| Rewriting `ui/` on a component library | Would discard work shipped this week | Not planned |
| `--fail-under <n>` instead of the hardcoded `score >= 70` exit code | A real CI-ergonomics defect, but not a design one | TODOS.md |
| `--config`, `--refresh`, `--resume` are accepted and ignored | Same — CLI correctness, outside this blast radius | TODOS.md |
| `http-error` is declared, hinted, and never thrown; a 404 start URL is scored normally | Same | TODOS.md |
| `html`/`markdown` write a file even without `-o`, so piping them yields an empty pipe | Same | TODOS.md |
| Two divergent in-repo `SKILL.md` copies, both claiming "Runs 261 audit rules" while the tool has 332 | Docs tooling. Upgraded from "flagged" to "must fix before release": `rulePriority()` will contradict the skill's hardcoded category-weight table the day it ships | TODOS.md, before Release 2 |

## 6. What already exists (leverage map)

| Sub-problem | Existing code | Action |
|---|---|---|
| Priority ordering | `terminal.ts:175,187` already ranks correctly | Extract; it is the reference implementation |
| Per-rule aggregation | `src/dashboard/aggregate.ts`, `getRuleSummaries()` | Reuse; html-reporter's own grouping folds into it |
| Status/colour helpers | `ui/lib/format.ts` | Promote to shared, drop the copies |
| Fix suggestions | `fix-suggestions.ts` — 332 keys for 332 rules | Already complete; surface it in the ordering |
| Rule + category weights | the registry | Source of `rulePriority()` |
| Not-measured accounting | `notMeasuredCount`, `isNotMeasured()` | Promote to a real status |

## 12. Challenges to the author's direction — for decision

Both models, in both the CEO and DX phases, independently recommended changing the
direction the author gave. Neither is auto-decided. The author's original direction is
the default; the models have to make the case.

### UC-1 — Put the terminal and the machine reporters in scope

**You said:** improve the design on "the ui side, the electron app side, and the static
html sides" — three surfaces.

**Both models recommend:** six. Specifically, adding the terminal UI (`terminal.ts` +
`progress.ts` + `banner.ts`, 889 lines) and the machine reporters (markdown, LLM).

**Why:** `audit.ts:57` makes console the *default* output; nobody sees the HTML report
without passing `--format html`. The terminal is also already the best-behaved surface —
it is the only one that sorts by severity, counts not-measured separately, and resolves
rule names from the registry. The plan's proposed ordering is, in effect, "do what the
terminal already does, everywhere else." Excluding it means excluding the reference
implementation from a consistency project.

**What we might be missing:** you may have meant "the surfaces people look at", and a
terminal is not something anyone calls ugly. You may also already consider the terminal
finished.

**If we're wrong, the cost is:** a wider release than you asked for, and time spent on a
surface you are happy with.

### UC-2 — Reframe from "make it prettier" to "one verdict, one ordering"

**You said:** the design and UI/UX is bad.

**Both models recommend:** treat the visual work as the *second* half, after a data-model
pass — status taxonomy, one grade function, derived ordering, one counting model.

**Why:** the measured defects are not visual. A site scoring 55 is graded D in the
terminal and F in the LLM report. The report's height comes from rendering all 332 rules
expanded, not from styling. Eight of thirteen colour pairs fail WCAG AA, so a purely
visual pass that consolidates tokens would standardise an accessibility failure. Codex
put it as: a prettier checklist still loses to a tool that says what to fix first.

**What we might be missing:** you have looked at this product far more than either model
has, and "it looks bad" may be about craft-level polish that no amount of data
correctness fixes. The plan as written spends its first release on things a user cannot
see.

**If we're wrong, the cost is:** a release lands with the semantics fixed and the product
still looking the way it looks today, and the complaint that started this is unanswered.

**Note on urgency, not preference:** the accessibility failures in §2.9 are a
correctness issue rather than a taste one — amber text at 1.93:1 is not legible for a
meaningful share of readers. That part is worth doing regardless of how UC-2 is decided.

---

# /autoplan Review Record

Mode: **SELECTIVE EXPANSION**. Every intermediate decision auto-resolved by the six
principles; challenges to the author's direction are queued for §12.

## Phase 1 — CEO Review

### 0A. Premise challenge

| # | Premise in v1 | Verdict | Evidence |
|---|---|---|---|
| P1 | "three surfaces" | **False** | Six render an audit (§1). The omitted default is the terminal |
| P2 | "the static HTML report is the best-looking" | **Half true, misleading** | Best-styled, but the only surface with no severity sort (§2.2), and the only one that loses all navigation on mobile |
| P3 | "the dashboard is the weaker surface" | **False as ranked** | Its defects are whitespace; the report's are functional |
| P4 | implicit: this is a visual problem | **False** | None of 2.1–2.5 is visual. Restyling fixes none of them |
| P5 | "the report is emailed and archived, so keep it one file" | **Constraint already violated** | It fetches a webfont from Google (§2.5). The premise is right; the code does not honour it |
| P6 | "the two counting models need reconciling" | **Overstated** | Both sum correctly; they measure different things. What is missing is a label, plus the `ruleId+status` grouping caveat |

Did the author's pain exist? Yes — the author used the product and disliked it. The
complaint is real; v1 misdiagnosed the cause.

### 0C. Dream state

```
  CURRENT                        THIS PLAN                    12-MONTH IDEAL
  6 surfaces, 3 grade scales,    1 verdict, 1 ordering,       one findings model;
  2 token copies (drifted),      shared tokens, contract      any new surface (PDF,
  1 surface that prioritises     tests across all 6           CI annotation, Slack)
  and 1 that does not                                         renders from it
```

Delta after this plan: the semantic layer is unified and enforced by tests; the
component layer stays deliberately per-renderer (Approach C is unavailable).

### 0E. Temporal interrogation

- **Hour 1** — which columns and names: is `not-measured` a status or a weight? Decided: a status.
- **Hour 2** — one grade function's boundary: D at ≥50 (terminal) or ≥60 (LLM)? Decided: ≥50, matching the surface users see by default.
- **Hour 6+** — the report's first screen. If ordering lands and the top-10 view does not, the report is still 54,000 px and the release reads as cosmetic.

### 0.5 Dual voices

**CODEX SAYS (CEO — strategy challenge).** 9 findings. Top: (1) the plan solves
presentation, not decision-making — no ranking model, every failure labelled the same;
(2) the 332/2,656 split is a broken data contract, not a label choice — storage writes
rule-page evaluations into a field named `totalRules`; (3) "three surfaces" is the wrong
product map — scope four experience classes and make terminal triage phase one;
(4) markdown and LLM reporters already misrepresent not-measured results; (5) React SSR
is eliminated by the dependency contract; (6) "shared visual primitives" is not a
credible boundary without an intermediate abstraction — share semantics, not components;
(7) the competitive risk is commoditisation, not dark-theme drift; (8) the UX premise is
under-validated (one site, no users); (9) pagination would damage the report's
distribution job.

**CLAUDE SUBAGENT (CEO — strategic independence).** 9 findings. Top: (F3, the 10x
reframe) one score renders three different verdicts, and no surface can sort because
there is no impact data — "colour drift is cosmetic; grade drift is the product lying
about its own verdict"; (F5) console is the default and `terminal.ts` is already the
reference implementation the plan should port outward; (F2) React SSR is closed, and
`dist/web` already ships to npm; (F4) the "best-looking" ranking is contradicted by the
plan's own defect list, and the self-contained claim is already violated by the webfont;
(F6) the agent surface is the differentiator and got zero words; (F7) six-month regret:
a tokens file exists and surfaces still disagree; (F1) v1's prose omitted the
not-measured bucket; (F8) four alternatives never evaluated; (F9) no success criteria.

**Corrections applied to both voices before folding in:**

- The subagent's F1 claims the totals do not sum and that the plan "does not know" a
  fourth status exists. Verified false about the product: 4+42+278+**8** = 332 and
  27+246+2312+**71** = 2,656. The not-measured bucket exists, is rendered, and was
  built deliberately. What is true is that **v1's prose omitted it**. Recorded as a
  documentation defect, not a counting bug — sending this to eng review as a phantom
  arithmetic failure would have wasted the phase.
- Both voices recommend a new `impact` field on `AuditRule`. Rejected: `rule.weight ×
  category.weight` already ranks all 332 rules and puts LCP/CLS/INP first (§2.3).
  A new field on 332 rules is work the registry has already done.

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                             Claude  Codex  Consensus
  ───────────────────────────────────── ─────── ────── ─────────
  1. Premises valid?                    NO      NO     CONFIRMED (both: false)
  2. Right problem to solve?            NO      NO     CONFIRMED (both: reframe)
  3. Scope calibration correct?         NO      NO     CONFIRMED (terminal missing)
  4. Alternatives sufficiently explored? NO     NO     CONFIRMED (C never eliminated)
  5. Competitive/market risks covered?  NO      NO     CONFIRMED (agent surface)
  6. 6-month trajectory sound?          NO      NO     CONFIRMED (tokens ≠ verdicts)
═══════════════════════════════════════════════════════════════
6/6 CONFIRMED. Zero disagreements — unusually strong signal that v1 was wrong.
Two items rise to User Challenges (§12); the rest are folded into the body.
```

### 0D. Scope decisions (SELECTIVE EXPANSION cherry-pick)

| # | Candidate | Blast radius | Decision | Principle |
|---|---|---|---|---|
| E1 | Terminal + markdown + LLM in scope | the surfaces themselves | **USER CHALLENGE** (§12) | not auto-decidable |
| E2 | One shared `scoreToVerdict()` | 4 files, <1d | **ACCEPT** | P2 in-radius |
| E3 | `not-measured` as a first-class status | ~8 files, root cause | **ACCEPT** | P2, P1 completeness |
| E4 | `rulePriority()` from existing weights | 2 files, <1d | **ACCEPT** | P4 DRY — reuses the registry |
| E5 | Hand-tuned impact per rule | 332 rules | **DEFER** | P3 — derived ordering ships now |
| E6 | CI guard: no hex outside the token file | 1 file | **ACCEPT** | P2 |
| E7 | Visual regression harness | new infra | **DEFER** | outside radius |
| E8 | Delete a reporter | needs usage data | **DEFER** | one voice only, destructive |
| E9 | Fix the stale installed skill clone | docs tooling | **DEFER** | outside radius, flagged |
| E10 | Print/PDF stylesheet | report | **DEFER** | downstream of ordering |

### Error & Rescue Registry

| Failure | Trigger | Today | After this plan |
|---|---|---|---|
| Grade disagreement | any score 50–59 | silent; two surfaces print different letters | one function, asserted by test |
| Not-measured shown as a warning | markdown / LLM report, any audit | silent; LLM proposes fixes for checks that never ran | status is explicit; reporters branch on it |
| Legacy audit re-labels its own history | opening a pre-3.4.0 audit | silent; `weight NULL` reads as measured | documented limitation; surfaced in the UI as "engine unknown" |
| Report degrades offline | archived report, no network | silent; typography falls back | font inlined |
| Token drift | any future colour edit | silent until someone screenshots both | CI fails on a stray hex |
| Report row count ≠ rule count | any rule with mixed status across pages | silent | counting DTO names each metric |

### Failure Modes Registry

| Mode | Severity | Detection | Mitigation |
|---|---|---|---|
| Ordering change alters a user's familiar report layout | Medium | none today | changelog; the old order was registry order, defensible to change |
| Collapsing passed rules hides something a user relied on | Medium | none | collapsed, not removed; one click, and the count stays visible |
| Shared verdict function changes a stored audit's displayed grade | Low | contract test | grade is derived at render time, not stored |
| Inlining the font grows the report | Low | size assertion | subset to the weights used, or accept the system stack |
| A sixth surface is added later and skips the shared layer | Medium | contract test enumerates reporters | the test fails when a reporter is added without registration |

**PHASE 1 COMPLETE.** Codex: 9 concerns. Claude subagent: 9 findings.
Consensus 6/6 confirmed, 0 disagreements, 2 items raised to User Challenges.
2 reviewer claims corrected against the code before folding in. Passing to Phase 2.

## Phase 2 — Design Review

### Step 0 — design scope

Completeness of v2 as a design specification before this phase: **4/10**. It named
defects accurately but specified almost no interaction, no states, no accessibility, and
left six one-way doors open. No `DESIGN.md` exists in the repo. Existing patterns mapped:
`ui/components/` (17 components), `html-reporter.ts`'s inline CSS, `globals.css` tokens.

### 0.5 Dual voices

**CODEX SAYS (design — UX challenge).** 9 findings. "This is an engineering-consistency
plan, not a finished UI/UX specification. Its hierarchy still serves the rule/category
model more than the person deciding what to fix." Critical: one ordering never reaches
the dashboard hierarchy — detail shows nav, score, actions and category scores before the
work queue. High: collapsing is not an interaction design; loading/error/empty/partial
states unspecified; keyboard access broken in both renderers; **shared tokens will
standardise inaccessible contrast**; responsive behaviour deletes navigation rather than
replacing it; reveal/filter/scroll/focus undefined. Medium: destructive and async action
states unspecified; motion requirements missing.

**CLAUDE SUBAGENT (design — independent review).** 27 findings across hierarchy, states,
journey, specificity and accessibility. Critical: the top-10 example is mostly
not-measured on a default GUI audit; flat priority versus category grouping is
unresolved; every status badge fails WCAG AA. High: a non-server read error renders as
"no audits"; a clean audit has no success state; delete is destructive with no
confirmation and no failure path; the run screen has no elapsed time or ETA; Electron's
first-launch tells a GUI user to open a terminal; `--color-text-muted` fails AA in both
themes. Plus §2.2's causal claim was wrong, and the plan carried a dangling reference to
a §12 that did not exist.

**Verified before folding in** (each was checked against the code, not taken on trust):

| Claim | Verdict |
|---|---|
| GUI defaults `measureCwv: false`, so the top-10 example is mostly not-measured | **Confirmed** (`AuditRunner.tsx:36`). CLI is the opposite — `--no-cwv` is opt-out. Both stated in §2.3 now |
| The report *does* order by severity (`[...failures, ...warnings]`) | **Confirmed** (`html-reporter.ts:1977`). §2.2 was overstated and is corrected |
| `` `${color}15` `` produces invalid CSS | **Confirmed in the browser**: computed background `rgba(0, 0, 0, 0)` |
| Status badges fail AA | **Confirmed**: warn 1.93:1, pass 2.24:1, fail 3.08:1 |
| 8 of 13 token pairs below 4.5:1 | **Confirmed** by computing every pair |
| `canRunAudits` hardcoded true and the web build cannot run audits | **Half true**: the value is right since Phase 3 of the dashboard work — the *doc comment* is stale. Logged as a comment fix, not a behaviour bug |

```
DESIGN LITMUS SCORECARD — CONSENSUS
═══════════════════════════════════════════════════════════════════
  Dimension                          Claude  Codex  Consensus
  ────────────────────────────────── ─────── ────── ──────────────
  1. Information hierarchy            2/10    2/10   CONFIRMED weak
  2. Interaction states specified     1/10    1/10   CONFIRMED absent
  3. Responsive strategy              3/10    2/10   CONFIRMED afterthought
  4. Accessibility specified          0/10    0/10   CONFIRMED absent
  5. Specificity vs generic patterns  3/10    3/10   CONFIRMED hand-waving
  6. Motion / reduced-motion          1/10    1/10   CONFIRMED missing
  7. Destructive-action safety        1/10    2/10   CONFIRMED missing
═══════════════════════════════════════════════════════════════════
7/7 CONFIRMED, 0 disagreements. Both voices independently reached
"the plan diagnoses well and specifies nothing".
Resolved into §4b (12 decisions) and §4c (the state matrix).
```

### Passes 1–7, after amendment

| Pass | Before | After §4b/§4c | Remaining |
|---|---|---|---|
| 1. Hierarchy | 2 | 8 | DD-1 needs a mock before implementation |
| 2. States | 1 | 8 | copy for each state not written |
| 3. Responsive | 3 | 6 | 320/375/768/1024 behaviour named, not drawn |
| 4. Accessibility | 0 | 8 | contrast fixes specified; the new token values need picking |
| 5. Specificity | 3 | 8 | DD-11 names the mechanism |
| 6. Motion | 1 | 8 | one global reduced-motion block |
| 7. Destructive safety | 1 | 8 | confirm + failure path specified |

Deliberately still open, and marked as such rather than hidden: the exact replacement
values for the failing tokens (an afternoon's work against the contrast test), and
whether the report's flat ordering needs a visual mock before code.

**PHASE 2 COMPLETE.** Codex: 9 concerns. Claude subagent: 27 findings.
Consensus 7/7 confirmed, 0 disagreements. 6 claims verified against code, 2 corrected.
Passing to Phase 2.5.

## Phase 2.5 — DX Review

Mode: **DX POLISH**. Product type: developer tool (npm CLI + Claude Code skill + desktop
app + local dashboard). Persona: a developer or SEO consultant who runs the CLI in a
terminal or in CI, and an AI agent consuming `--format llm`.

### Developer journey map

| # | Stage | Today | After this plan |
|---|---|---|---|
| 1 | Discover | README leads with `npm install -g`; `npx` appears in **zero** docs despite being a stated shipping surface | `npx` is the first code block |
| 2 | Install | contradictory: README:59 says no browser install needed, README:929 says run `playwright install` | one sentence, plus `self doctor` |
| 3 | First run | `seomator audit <url>` — genuinely fast, faster than Lighthouse CI or Sitebulb's wizard | unchanged, plus a TTHW criterion |
| 4 | Read the result | 332 findings, unordered within severity | ordered by `rulePriority()`, top findings first |
| 5 | Act on it | fix text exists for all 332 rules; nothing marks a finding handled | unchanged (deferred) |
| 6 | Re-run and compare | `compare` warns on engine change but **not** on measurement-mode change | reads the run config; refuses or annotates cross-profile diffs |
| 7 | Automate in CI | exit 1 below a hardcoded 70, not configurable | deferred to TODOS |
| 8 | Consume as an agent | `--format llm`: ungrouped, no page attribution, no cap, no error envelope, no schema version | grouped, attributed, capped, versioned |
| 9 | Upgrade | no schema version anywhere; a status change would silently drop rows from `filter(r => r.status === 'warn')` | `schemaVersion` first, then the change, with a Breaking CHANGELOG entry |

### Developer empathy narrative

*I run `npx @seomator/seo-audit audit https://mysite.com` — except I can't, because no
doc mentions npx, so I install globally first. It works, and fast. I get a 94 and a wall
of 332 checks; the four that actually failed are in there somewhere. I pipe
`--format markdown` into my clipboard and get an empty pipe and a mystery file in my
cwd. I wire `compare --fail-on-regression` into CI. It goes red. Nothing changed on the
site — my baseline came from the desktop app, which doesn't measure Core Web Vitals, and
nothing told me the two runs weren't comparable. I ask Claude to read the audit; it
recommends fixing things the tool never measured, because the LLM report files
unmeasured checks under passed and stamps them `severity="warning"` anyway.*

That narrative is six verified defects, and only one of them is visual.

### 0.5 Dual voices

**CODEX SAYS (DX — developer experience challenge).** 10 findings, 4 critical:
documented flags that do nothing (`--config`, `--refresh`, `--resume` accepted and
ignored; `output.format` in TOML ignored because format resolves before config); the
CLI/GUI CWV split makes audits incomparable and `compare` never reads the stored
profile; the two-release sequence temporarily tells agents that unmeasured checks
passed; status/grade/counts/ordering are an unversioned public breaking change; the
proposed legacy migration is impossible as phrased; the six-surface contract test has no
executable seam because the dashboard consumes `AuditDetail`, not reporter output.

**CLAUDE SUBAGENT (DX — independent review).** 27 findings, 4 critical: no versioned
contract on any format; the CWV trap (with the additional detail that `run` is persisted
and unread); `not-measured` is a silent breaking change to JSON consumers; the LLM
reporter emits one issue per rule-per-page with no cap — ~2,300 elements on the 8-page
fixture. High: `http-error` is declared, hinted, and never thrown, so a 404 start URL is
scored normally; `--format llm` has no machine-readable error path; the summary counts
and the issue list already disagree; two divergent in-repo `SKILL.md` copies, both
claiming 261 rules; the skill's hardcoded category-weight table (12/12/4) contradicts
the registry (11/10/7) today and will contradict `rulePriority()` on day one.

**Verified before folding in:**

| Claim | Verdict |
|---|---|
| `compare` never reads the run config | **Confirmed**: 0 references to `run`, 3 to `engineChanged` |
| LLM summary counts ≠ its issue list | **Confirmed**: `scoring.ts:115` skips not-measured; `llm-reporter.ts:180` includes it |
| `http-error` is never thrown | **Confirmed**: appears only in the union and the hint map |
| Two divergent in-repo SKILL.md copies, both saying 261 rules | **Confirmed** by diff and grep, while the tool has 332 |

```
DX DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                            Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ────── ──────────
  1. Getting started < 5 min?          YES*    YES*   CONFIRMED (fast, badly documented)
  2. API/CLI naming guessable?         NO      NO     CONFIRMED (guessable, partly inert)
  3. Error messages actionable?        PARTLY  PARTLY CONFIRMED (good where a code exists)
  4. Docs findable & complete?         NO      NO     CONFIRMED (findable, not trustworthy)
  5. Upgrade path safe?                NO      NO     CONFIRMED (no version to key off)
  6. Dev environment friction-free?    NO      NO     CONFIRMED (CWV split, inert flags)
═══════════════════════════════════════════════════════════════
6/6 CONFIRMED, 0 disagreements.
```

### DX scorecard

| # | Dimension | Before | After amendments | Note |
|---|---|---|---|---|
| 1 | Time to hello world | 7 | 7 | fast already; the plan adds a criterion, not speed |
| 2 | CLI ergonomics | 4 | 5 | inert flags deferred; the CWV trap is fixed |
| 3 | Error messages | 6 | 7 | `--format llm` gains an error envelope |
| 4 | Agent surface | 3 | 8 | grouping, attribution, cap, schema version |
| 5 | Upgrade path | 1 | 8 | `schemaVersion` before any semantic change |
| 6 | Docs trustworthiness | 3 | 4 | sync-docs gaps mostly deferred |
| 7 | Consistency across surfaces | 2 | 9 | the core of the plan |
| 8 | Escape hatches | 6 | 6 | unchanged |
| | **Overall** | **4.0** | **6.8** | |

**TTHW: ~2 minutes today** (global install then audit) **→ ~20 seconds** with an `npx`
first line. The plan does not change the tool's speed; it changes which command the
docs put first.

### DX implementation checklist

- [ ] `schemaVersion` on `AuditResult`; `schema=` on `<seo-audit>` — Release 1, item 0
- [ ] `run` config on `AuditResult`; `compare` reads it; every surface header shows it
- [ ] `not-measured` changed atomically across the 7 call sites in §4d
- [ ] Contract test: `count(issue[severity=warning]) === summary.warnings`, per surface
- [ ] LLM reporter: group, attribute pages, cap, error envelope on stdout
- [ ] CHANGELOG **Breaking** entry for the status enum and the D/F boundary
- [ ] `npx` as the first code block in README and the skill
- [ ] Resolve the two in-repo SKILL.md copies before Release 2 ships `rulePriority()`

**PHASE 2.5 COMPLETE.** DX overall 4.0/10 → 6.8/10. TTHW ~2 min → ~20 s (docs, not code).
Codex: 10 concerns. Claude subagent: 27 findings. Consensus 6/6 confirmed, 0
disagreements. 4 claims verified against code. Passing to Phase 3.

## Phase 3 — Eng Review (the required gate)

### Section 1 — architecture

```
                       AuditResult (live: 332 rules x N pages)
                                  |
     +----------------------------+----------------------------+
     |                            |                            |
  reporters/                saveAuditToDatabase          dashboard/aggregate.ts
  terminal  html                  |                            |
  markdown  llm  json      audit_results  <-- 3 status encodings|
     |                            |                            |
     |                   queries.getAuditDetail ---------> AuditDetail (RuleSummary)
     |                            |                            |
     +----------------------------+----------------------------+
                                  |
                     src/design/  scoreToVerdict()   <- pure leaf, crosses into ui/
                     src/rules/   rulePriority()     <- SERVER ONLY (DD-17)
                     src/design/  tokens.ts          <- zero imports, or the CLI
                                                        bundle grows a cycle
```

New coupling introduced, and the one rule that keeps it safe: `ui/` may import
`scoreToVerdict` from `@core` (a pure leaf), and may **not** import `rulePriority`,
because rule weights only exist after `rules/loader.ts` static-imports all 332 rule
modules — and `@core` resolves from `ui/`, so the import would silently pull the whole
engine into the browser bundle.

### 0.5 Dual voices

**CODEX SAYS (eng — architecture challenge).** 8 findings, 3 critical: the counting DTO
mixes rule and rule-page units so "four counters sum to the rule total" cannot hold; the
HTML report becomes tens of MB at 1,000 pages because `data-urls` is emitted twice per
rule with every URL; no viable SQLite migration is specified and DD-13 conflicts with the
schema. High: `rulePriority()` loses weights because aggregation overwrites them with 1;
both aggregation paths do work proportional to all rows; the six-surface contract test
has no real seam; ordering/collapsing adds unguarded rendering sinks (`og:image` is
emitted as a remote `src`).

**CLAUDE SUBAGENT (eng — independent review).** 27 findings. Critical: DD-13 throws
`NOT NULL constraint failed` on every GUI audit. High: the token generator never runs in
three of four build paths; `tailwind.css:17`'s self-referential `@theme` is load-bearing
and DD-12 rewrites exactly that file; `rulePriority()` must not be importable from `ui/`;
`terminal.ts:134` is O(n·m) and §6 names it the reference implementation; a 1,000-page
report is ~60 MB of attributes; the contract seam is half real; **three status encodings,
not two**; `compare --fail-on-regression` breaks on the upgrade itself; the cast at
`save-audit.ts:164` launders the new value; `getResultCounts` and `issues.ts:323` stop
summing.

**Verified before folding in:**

| Claim | Verdict |
|---|---|
| DD-13 `score: null` would throw | **Confirmed**: `score INTEGER NOT NULL` at `schema.ts:45,65`. **DD-13 reversed** |
| Three encodings exist | **Confirmed on the author's live database**: 15,979 rows `weight IS NULL`, 142 rows `warn`+`weight=0` |
| `@theme` is self-referential and load-bearing | **Confirmed**: `--color-pass: var(--color-pass)` at `tailwind.css:17` |
| `issues.ts:323` promotes not-measured into issues rows | **Confirmed** |

```
ENG DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                            Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ────── ──────────
  1. Architecture sound?               PARTLY  PARTLY CONFIRMED (sound, under-specified)
  2. Test coverage sufficient?         NO      NO     CONFIRMED (seam was unimplementable)
  3. Performance risks addressed?      NO      NO     CONFIRMED (10x unconsidered)
  4. Security threats covered?         PARTLY  PARTLY CONFIRMED (escaping ok, og:image not)
  5. Error paths handled?              NO      NO     CONFIRMED (nil paths unspecified)
  6. Deployment risk manageable?       NO      NO     CONFIRMED (migration was wrong)
═══════════════════════════════════════════════════════════════
6/6 CONFIRMED, 0 disagreements.
```

### Section 2 — code quality

DRY violations this plan removes: three `getScoreLabel` copies, two `RuleStatus` unions
plus three more local ones, two token sets, two grouping implementations. It **adds** one
if DD-11 is done carelessly — a generated file plus a hand-edited `globals.css` full of
`rgba()` is still two sources of colour. DD-12 is therefore extended: shadows and toolbar
materials move into `tokens.ts` too, leaving `globals.css` holding layout constants only.

### Section 3 — tests

Test plan artifact written to
`~/.gstack/projects/seo-skills-seo-audit-skill/elbeyoglu-feat-dashboard-runs-test-plan-20260903-1146.md`
— 23 codepaths, 21 of them uncovered today, with the 2am-Friday failure modes and the
order of work. The single highest-value test: an encoding-B audit diffed against an
encoding-C audit of the same site must yield an empty `RuleDiff`.

The existing `src/auditor.baseline.test.ts` must stay green throughout; it pins every
category score and is the guard that this work changes presentation only.

### Section 4 — performance

| Path | 8 pages | 1,000 pages | Action |
|---|---|---|---|
| `terminal.ts:134` grouping | fine | ~10⁸ regex applications (O(n·m) with 8 replaces per comparison) | Map keyed once per result. **Prerequisite to extracting it, not a follow-up** |
| `html-reporter` `data-urls` | ~445 KB | tens of MB, emitted twice per rule | cap at 5 sample pages + a count; drop the attribute |
| `aggregate.ts` / `getRuleSummaries` | fine | linear in 332,000 rows on every read | one-pass accumulators; consider persisting one summary row per rule at save time |
| `rulePriority()` sort | fine | fine — it sorts ~332 summaries, not the rows | none |

### Failure modes registry (critical gaps flagged)

| Mode | Severity | Detection | Mitigation |
|---|---|---|---|
| **Migration re-reads 3.4.0/3.5.0 audits as real warnings** | **CRITICAL** | test #7 | DD-16's single predicate, no backfill |
| **`compare --fail-on-regression` fails CI on the upgrade** | **CRITICAL** | test #9 | same predicate; the B-vs-C empty-diff test |
| DD-13 throws on every GUI audit | CRITICAL | would have been immediate | **reversed before implementation** |
| Older `npx` binary ranks a not-measured row as a pass | High | invariant test | keep `weight === 0` alongside the new status |
| Token generator skipped in dev, app renders unstyled | High | none today | Vite `buildStart` hook in both configs, not `prebuild` |
| 1,000-page report unopenable | High | size budget | cap sample pages, drop `data-urls` |
| `@theme` self-reference broken by the token rewrite | High | lint test #16 | generated file stays unlayered |

**PHASE 3 COMPLETE.** Codex: 8 concerns. Claude subagent: 27 findings.
Consensus 6/6 confirmed, 0 disagreements. 4 claims verified against code and a live
database; **DD-13 reversed** and the migration rewritten as a result.
Passing to Phase 4 (Final Gate).

## Cross-phase themes

A concern raised independently in two or more phases is a high-confidence signal.

| Theme | Phases | Signal |
|---|---|---|
| **The plan diagnosed accurately and specified nothing** | CEO, Design, Eng | v1 ranked surfaces by screenshot impression; v2 left 6 one-way doors open; v2's own success criteria were unachievable as written. Resolved by §4b (18 decisions), §4c (state matrix), §3a (migration) |
| **The terminal is the omitted default and the existing reference** | CEO, DX, Eng | Console is the default output; `terminal.ts` already sorts, groups and counts correctly — and is O(n·m). It is both the model to copy and a thing to fix first |
| **No versioned contract anywhere** | DX, Eng | JSON is a raw stringify of the internal type; the LLM XML has no version. Every semantic change in this plan is a silent break. Now Release 1, item 0 |
| **The agent surface is the differentiator and got one line** | CEO, DX | `llm-reporter.ts` is the thing no competitor has, and the plan's original treatment of it was "honour not-measured" |
| **10x was never considered** | Eng (both voices) | Every claim in v2 was measured on an 8-page audit. At 1,000 pages the report is tens of MB and the grouping is quadratic |

## Decision Audit Trail

| # | Phase | Decision | Class | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Mode: SELECTIVE EXPANSION | Mechanical | — | autoplan default | — |
| 2 | CEO | Approach B (shared tokens + shared pure TS) | Mechanical | P1 | C is barred by the dependency constraint; A fixes no verified defect | A, C |
| 3 | CEO | Derived `rulePriority()` over a new `impact` field | Taste→auto | P4 DRY | `rule.weight × category.weight` already ranks all 332 and puts LCP/CLS/INP first | both reviewers' proposal |
| 4 | CEO | `not-measured` as a first-class status | Mechanical | P1, P2 | root cause of four verified bugs; in blast radius | — |
| 5 | CEO | Terminal + machine reporters in scope | **USER CHALLENGE** | — | both models, both phases | → §12 UC-1 |
| 6 | CEO | Reframe to "one verdict, one ordering" | **USER CHALLENGE** | — | both models, top finding | → §12 UC-2 |
| 7 | CEO | Hand-tuned impact per rule → defer | Mechanical | P3 | derived ordering ships now | — |
| 8 | CEO | Corrected the subagent's "totals don't sum" claim | Mechanical | evidence | 4+42+278+8=332 and 27+246+2312+71=2656 both hold; v1's *prose* omitted the bucket | the finding as stated |
| 9 | Design | DD-1 flat priority body, category as filter | Taste | P5 | a top-10 widget above 332 grouped cards satisfies the letter and not the intent | category-grouped body |
| 10 | Design | DD-2 severity multipliers 1.0 / 0.5 / 0 | Mechanical | P5 | unspecified otherwise; every fixture bakes it in | — |
| 11 | Design | DD-7 zinc dark theme | Taste | P5 | `#000` + `#0a0a0a` is 1.03:1; edges vanish on OLED | pure black |
| 12 | Design | DD-8 `<details>` over JS `display:none` | Mechanical | P5 | browser find works inside `<details>`; the report is archived and searched | JS toggling |
| 13 | Design | DD-10 not-measured is a prompt, not a finding | Mechanical | P1 | GUI defaults CWV off, so a naive top-10 opens with five "not measured" | ranking them |
| 14 | Design | Accessibility promoted to a success criterion | Mechanical | P1 | 8 of 13 pairs fail; consolidating tokens would standardise it | leaving it aspirational |
| 15 | DX | `schemaVersion` first, before any semantic change | Mechanical | P1 | every change is a break against an unversioned contract | shipping unversioned |
| 16 | DX | Promote `run` onto `AuditResult` | Mechanical | P2, P4 | already persisted, never read; kills the CWV trap for one field | leaving compare blind |
| 17 | DX | `--fail-under`, inert flags, `http-error` → defer | Mechanical | P3 | real defects, outside the design blast radius | in-scope |
| 18 | DX | Two in-repo SKILL.md copies → P1 in TODOS | Mechanical | P2 | `rulePriority()` contradicts the skill's hardcoded table on day one | leaving as P3 |
| 19 | Eng | **DD-13 reversed** — keep `score: 50` | Mechanical | evidence | `score INTEGER NOT NULL`; `null` throws on every GUI audit | `score: null` |
| 20 | Eng | DD-16 one predicate, three encodings, no backfill | Mechanical | P1 | live DB holds 15,979 rows of A and 142 of B | status-only predicate |
| 21 | Eng | DD-17 `rulePriority()` server-side only | Mechanical | P5 | `@core` resolves from `ui/`; importing it drags 332 rule modules into the browser | shared helper |
| 22 | Eng | DD-18 generated tokens stay unlayered | Mechanical | evidence | the `@theme` self-reference is load-bearing | layered import |
| 23 | Eng | Two count ledgers, not one sum | Mechanical | P1 | the original criterion was unachievable — stored `totalRules` is rule-page count | "four counters sum" |
| 24 | Eng | Fix `terminal.ts` O(n·m) before extracting it | Mechanical | P2 | extracting as-is propagates a quadratic to six surfaces | extract first |
