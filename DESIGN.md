---
# gstack: design-md-format=spec
name: SEOmator audit
description: >-
  "The Fix Brief". A zero-chroma measurement console for the dashboard, the
  desktop app and the HTML report: the largest thing on a report is the first
  fix, every number is one the engine can prove, and the only colour that moves
  is the orange agent pointing at what to do next.

# Tokens are canonical on the LIGHT theme. Dark overrides are tabled in ## Colors.
# Code reads colour from src/design/tokens.ts only; this file is the intent that
# module implements. Approved 2026-11-18 (/design-consultation); preview and its
# generator in ~/.gstack/projects/seo-skills-seo-audit-skill/designs/design-system-20261118/.
colors:
  page: "#FAFAFA"
  surface: "#FFFFFF"            # tables, fields, menus, the app header
  hover: "#F4F4F4"
  line: "#E5E5E5"               # every rule, row line and table border
  line-strong: "#D4D4D4"        # control borders
  text: "#171717"               # ink, 17.9:1 on surface
  text-secondary: "#525252"     # 7.8:1
  text-muted: "#5E5E5E"         # 6.5:1, labels, meta, rank numbers
  accent: "#171717"             # selection, focus ring, links, checkboxes: ink, never orange
  on-accent: "#FFFFFF"
  fail: "#BE1212"               # 6.4:1; on the status shape and on scores under 70
  warn: "#92400E"               # 7.1:1; on the status shape and on scores 70-79
  improved: "#167A34"           # 5.4:1; ONLY for change since the last run (fixed, up)
  agent: "#FE5000"              # the emblem, its progress line, the lead-fix flag, the one primary action
  agent-hover: "#E64800"
  agent-text: "#B83800"         # the agent speaking, 5.8:1 on surface
  on-agent: "#FFFFFF"           # text on an orange fill: white, as seomator.com; 3.3:1, AA large only (owner call)
  strip: "#E5E5E5"              # the kept part of a points-strip column

typography:
  lead-fix:                     # the first fix on a report; the live phase on the run screen
    fontFamily: Geist
    fontWeight: 600
    fontSize: 2.5rem            # 40px; 32px under 900px
    lineHeight: 2.75rem
    letterSpacing: "-0.02em"
  section:                      # Fix queue, Where the points went, ...
    fontFamily: Geist
    fontWeight: 600
    fontSize: 1.25rem
    lineHeight: 1.75rem
    letterSpacing: "-0.01em"
  page-title:                   # the audited host; smaller than the lead fix on purpose
    fontFamily: Geist
    fontWeight: 600
    fontSize: 1.25rem
    lineHeight: 1.75rem
  body:
    fontFamily: Geist
    fontWeight: 400
    fontSize: 0.875rem
    lineHeight: 1.25rem
    fontFeature: '"rlig" 1, "calt" 1'
  reading:                      # what we saw / why it matters
    fontFamily: Geist
    fontWeight: 400
    fontSize: 1rem
    lineHeight: 1.5rem
  small:
    fontFamily: Geist
    fontWeight: 400
    fontSize: 0.8125rem
    lineHeight: 1.125rem
  label:                        # column headers, category tags, section meta
    fontFamily: Geist Mono
    fontWeight: 500
    fontSize: 0.6875rem
    lineHeight: 1rem
    letterSpacing: "0.06em"
    textTransform: uppercase
  data:                         # every number, URL, rule id, delta
    fontFamily: Geist Mono
    fontWeight: 400
    fontFeature: tnum
  score:
    fontFamily: Geist Mono
    fontWeight: 500
    fontSize: 3.5rem
    lineHeight: 3.5rem
    letterSpacing: "-0.03em"
    fontFeature: tnum
  points:                       # the lead fix's "+0.6"
    fontFamily: Geist Mono
    fontWeight: 500
    fontSize: 1.75rem
    lineHeight: 2rem
    fontFeature: tnum
  agent-voice:
    fontFamily: Geist Mono
    fontWeight: 400
    fontSize: 0.8125rem
    lineHeight: 1.125rem

rounded:
  none: 0px                     # tables, rows, bands, the points strip
  control: 4px                  # buttons, fields, chips, segmented controls
  panel: 6px                    # menus, dialogs, popovers: the cap

spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "6": 24px
  "8": 32px
  "10": 40px
  "12": 48px

components:
  button-primary:
    backgroundColor: "{colors.agent}"
    textColor: "{colors.on-agent}"
    rounded: "{rounded.control}"
    height: 32px                # 40px for the run form's "Run audit"
  button-primary-hover:
    backgroundColor: "{colors.agent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line-strong}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  button-secondary-hover:
    borderColor: "{colors.text}"
  button-ghost:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
  field:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line-strong}"
    rounded: "{rounded.control}"
    height: 40px
  field-focus:
    borderColor: "{colors.text}"
  table:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.none}"
  menu:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.panel}"
  lead-flag:
    backgroundColor: "{colors.agent}"
    width: 2px
---

# SEOmator audit

## Overview

**Creative North Star:** *It told me exactly what to fix first.* A zero-chroma
measurement console (the seomator.com v3 "clean console, living agent" system,
applied to a working tool) where the first fix owns the headline, the queue is
ranked by score points the engine can prove, and colour marks only what is
wrong, what got better, and where the agent is pointing.

**Product context:** `@seomator/seo-audit`, a local SEO audit engine (398 rules,
20 weighted categories). Readers are SEO practitioners, technical marketers and
developers deciding what to fix first. Peers: Sitebulb, Ahrefs and Semrush Site
Audit, Lighthouse/PageSpeed Insights, Screaming Frog. Every one of them ranks by
severity tier and paints health as a red-to-green gauge; SEOmator can do what
they can't, because its score is a linear weighted average with recorded caps.

**Mode per surface:**
- History and the run form: Operate.
- The audit detail page and the HTML report: Read, built to be acted on.
- Compare and trend: Read.
- No surface is Persuade. The website does the persuading.

**Hosts:** the local dashboard (`seomator serve`) and the Electron app render the
same React code in `ui/`; the single-file HTML report shares `src/design/tokens.ts`
and follows this file in its own markup.

**Reference sites (2026-11-18):** sitebulb.com/features/prioritized-hints,
ahrefs.com/site-audit, semrush.com/siteaudit, vercel.com/geist. The brand source
is `~/Desktop/github/seomator-website` (`design.md`, `wiki/design/*`,
`.claude/skills/seomator-agent-style`), and the owner's 2026-10-24 SEO-report
design there (mono deltas, states by shape, the agent docked with one sentence,
a 2px flag on the row that matters, "where every number comes from").

**Key characteristics (first five seconds):**
- The biggest words on a report are a verb: "Reduce DOM size".
- One orange stripe, one orange agent, one orange button. Nothing else is orange.
- The score is a plain number in the corner, with what's missing written under it.
- Problems are red or amber shapes. Fine is quiet. Green means "better than last time".
- A single table of fixes, already in order, each with what it is worth.

## Colors

**Strategy:** Restrained. Zero-chroma neutrals and one orange `#FE5000`, the
emblem's own colour. Status colours carry meaning and never decoration, and are
never orange.

**Light or dark:** both, following the system setting, with a toggle. The use
scene is a desk during the working day, in the browser or the desktop app beside
a code editor, so neither theme is a costume; light is canonical because the
HTML report is emailed and printed.

**Who may be orange (the whole budget):** the agent emblem; its 2px progress
line while a run is live; the 2px flag on the lead fix, once per screen; the one
primary action on a screen ("Run again", "Run audit"); the agent's sentence, as
`agent-text`. Selection, focus, links, checkboxes and the active filter are ink.

**Colour only where it's wrong:**
- Passing results are an open square in `text-muted`. No green pass chips, no green bars.
- Scores are ink at 80 and above, `warn` from 70 to 79, `fail` under 70. The grade word ("Excellent", "Good", "Fair", "Needs Work", "Poor") is always ink.
- The D-grade orange `#c2410c` is retired. Nothing in the ladder is orange.
- `improved` (green) appears only for change since the previous run: "fixed", "▲5", a score that went up. Regressions use `fail`.
- No score ring, gauge or donut on any surface.

**Dark overrides** (same roles, the same orange):

| Token | Light | Dark |
|---|---|---|
| page | `#FAFAFA` | `#0A0A0A` |
| surface | `#FFFFFF` | `#171717` |
| hover | `#F4F4F4` | `#262626` |
| line | `#E5E5E5` | `#262626` |
| line-strong | `#D4D4D4` | `#404040` |
| text | `#171717` | `#EDEDED` (15.3:1) |
| text-secondary | `#525252` | `#A1A1A1` (6.9:1) |
| text-muted | `#5E5E5E` | `#8B8B8B` (5.3:1) |
| fail | `#BE1212` | `#F87171` (6.5:1) |
| warn | `#92400E` | `#FBBF24` (10.7:1) |
| improved | `#167A34` | `#34D399` (9.3:1) |
| agent / agent-hover / on-agent | `#FE5000` / `#E64800` / `#FFFFFF` | same |
| agent-text | `#B83800` | `#FE5000` (5.4:1) |
| strip | `#E5E5E5` | `#262626` |

Dark surfaces keep hierarchy by stepping lightness (page → surface → hover), not
by shadow or glow. Every text pair above clears WCAG AA in both themes; the
contrast test in `src/design/tokens.test.ts` stays the gate.

## Typography

Geist for words, Geist Mono for numbers and for the agent. Both are OFL-1.1,
already bundled with the dashboard and the desktop app
(`@fontsource-variable/geist`, `@fontsource-variable/geist-mono`), and the HTML
report embeds the same two Latin variable files as base64 (about 70 KB) so it
reads in brand type offline. Nothing is fetched at runtime.

**Why Geist for headings and not Degular:** Degular Display is the website's
heading face and the wordmark's, but the website licenses it through an Adobe
Fonts kit that forbids self-hosting. OH no Type Co. sells perpetual Desktop, Web
and App licences ($519 for the family at the default selection), but whether an
App licence covers an npm-distributed dashboard and an emailed HTML file is
unconfirmed, and the HTML report could not carry it either way. One face on all
three hosts beats the brand face on two. Degular stays in the wordmark, which
ships as outlines. Geist is normally an overused display voice; it is justified
here because this is an Operate/Read surface with no marketing moment, and the
largest type on the page is a fix, not a slogan.

**Scale:** 11 label · 13 small · 14 body · 16 reading · 20 section and page title ·
28 points · 40 lead fix · 56 score. Levels differ by size, not just weight.
Labels are the only uppercase. Every figure is tabular. Thousands take a
separator (`19,403`).

## Layout

One 1200px container, 12 columns, 24px gutters (16px under 900px). Bands are
separated by a hairline and 40px of space. No stacked rounded cards: a surface
is a table, a field or a menu, never a box around a section.

**The report, top to bottom:**
1. **Bar.** Left: "← {domain} history". Right: Compare (ghost), Export ▾ (HTML, Markdown, JSON, LLM text), ⋯ (copy link, open data folder, then Delete), Run again (the orange).
2. **Identity.** The host as the page title (20px), then one mono meta line: URL · date and time · pages · rendered or not · engine version · checks.
3. **Lead fix**, 8 columns, flagged by the 2px orange line on its left edge:
   - the docked agent (`focused`, 28px) and its sentence;
   - rank, status shape and word, category label;
   - the fix as the headline: the fix text up to its first colon or semicolon;
   - what we saw (the rule's message) and the rest of the fix text;
   - one mono facts line from the rule's details;
   - Show evidence, Copy for a developer, and the points on the right.
4. **Score**, 4 columns, divided by a hairline:
   - label, `91/100`, the grade word;
   - Missing / scored / not measured / advisory, each with its number;
   - "Since {time}": what was fixed (green), what regressed (red), and checks that are new since then.
5. **Fix queue** (rank · status · fix + what we saw · category · pages on a crawl only · points), from 02, eight rows, then "Show N more". A row opens in place to evidence (what we saw, a sample table, why it matters, how to fix, the rule id, its weight and its points). Filter: All / Fails / Warnings.
6. **Where the points went.** The points strip (below), and "Show as a table".
7. **What we could not measure.** Reasons with counts: needs a crawl, needs a mobile render, does not apply, could not check; then advisory. Site findings sit here as one quiet line.
8. **All checks.** Filters and search over every result, grouped by category, collapsed.
9. **Where the numbers come from.** How the score, the points and caps are computed, and the engine and scoring versions.

The report page has no category sidebar: the strip and the table replace it.

**The points strip:** one row of 20 columns in the engine's category order
(`src/categories`, the same between audits so two reports line up), each as
wide as its category weight, 168px tall. The kept part is `strip`; the empty top is what the category
costs the score, hatched `fail` when it has failures and `warn` when it only
warns, with its points ("−2.3") above when they reach 0.3. A column's area is
its lost points. Labels show where they fit; every column has an
`aria-label` and a title with name, score, weight and points, and the table
fallback lists them all. Clicking a column filters the queue.

**Run screen:** the same 8/4 split. Before a run, the left side is the form: a
labelled 40px URL field and "Run audit" (orange), then every option a run takes,
in four groups with their consequences written inline: **Measure** (Core Web
Vitals and the rendered page; nested, mobile parity and simulated interaction),
**Scope** (crawl; nested, pages at most, pages at once, a time limit and
ignoring crawl-delay; then staging), **Categories** (all 20 with their weights,
at least one) and **Run settings** (page timeout, checking external links
again, saving to history). An option that needs another first, or that the
host cannot do, stays visible and disabled with its reason. The right column
is a live summary of the run and the same run as a `seomator audit` command,
each flag kept whole when it wraps. During a run the headline becomes the phase ("Auditing
seomator.com"), the agent is `crawling` beside one sentence that updates per
step, a 2px orange line shows pages done, then elapsed time, the latest three
events and a full log on request. The right column is the run's scope and Stop.
The queue is not ranked live: it appears once, complete, when the run ends.

**History:** one ledger table (when · URL · score · pages · fails · warnings)
with ink counts and separators, and a **Site** menu in its header listing every
site with its latest score and change. Picking a site narrows the table and
opens that site's trend. No row of site cards above the table (owner,
2026-11-18: "i dont like the website list on top"), and no green or red count
columns.

**Under 900px:** lead fix, then score, then the queue as one block per fix (rank,
status and points on the first line; fix and what we saw under it). Other
tables scroll inside their own box. The strip keeps proportions and drops its
labels. Grid children set `min-width: 0`, so long URLs and selectors wrap
instead of pushing the page wide.

## Elevation & Depth

Flat. Depth comes from the surface step (page → surface) and hairlines. Menus and
dialogs, the only things that float, take `0 8px 24px rgba(0,0,0,.08)` in light
and nothing but the surface step in dark. No glow, no zero-offset halos, no
frosted panels.

## Shapes

0 for tables, rows, bands and the strip; 4px for controls; 6px is the cap, for
menus, dialogs and popovers. No pills, including the grade word, which is plain
text. The emblem keeps its own squircle and is never redrawn.

**Status shapes** (10px SVG, colour only on the shape, always beside its word):
fails ■ filled square · warning ◧ half-filled square · passes □ open square ·
not measured ⬚ dashed square · advisory ○ open circle.

## Components

- **Buttons.** Primary (orange, white label, as seomator.com), secondary (surface, `line-strong`), ghost (text only). 32px tall; 40px in the run form. A hover deepens the control's own colour and never switches hue; focus is a 2px ink ring at 2px offset; disabled is 45% opacity with a not-allowed cursor and is used only while a run is in flight or a submit is impossible.
- **Field.** 40px, surface, `line-strong`; focus turns the border ink and adds a 3px `text`/12% halo. Labels sit above in the label style.
- **Segmented control.** A `hover` track with the active segment on surface (dark: `line-strong`), for History/New audit and the queue filters.
- **Export and ⋯ menus.** 6px panels, 4px items; Delete is last, after a divider, in `fail`, and confirms before it acts.
- **Fix-queue row.** Hover is `hover`; an open row loses its line and shows evidence on `page` below it. Evidence is two columns (what we saw + sample table | why it matters, how to fix, rule id · weight · points).
- **Empty, loading and error states.** History empty: the house illustration (`ui/assets/audit-history-empty-*.webp`) with the agent `idle`. Zero fixes: the lead block reads "Nothing to fix in what we measured." with the not-measured count and what would measure it. A failed load says what failed and offers a retry; a stale dashboard token asks for a reload.

## The agent in the product

The agent is the logo emblem, drawn from the shipped SVG with its own eyes,
never enlarged. It has no mouth or limbs in the product. It is still by default.

| State | Where | Motion |
|---|---|---|
| `idle` | header, empty states | none |
| `crawling` | the run screen while a run is live | lean plus a 1.6s scan loop, the only loop, and only while the run runs |
| `focused` | docked on the lead fix | a resting pose |
| `alert` | once, when a run ends with failures | 260ms, once |
| `delighted` | once, when the score went up since the last run | 420ms hop, once |

**What it says:** one sentence, in Geist Mono and `agent-text`, written from the
data, never a slogan, never a claim the numbers don't support. Examples:
- "Start here. The first five fixes return 2.4 of the 8.8 points this page is missing."
- "Start here. Nothing else moves the score until this page can be indexed." (capped)
- "Reading /pricing. 12 of 40 pages done." (run)

`delighted` never means "published" or "done for you": the user fixes things.

## The numbers (the contract behind R1 and R2)

- **Points** for a fix = what the overall score gains if that check passes, from the weights that make the score: `(100 − result score) × rule weight ÷ Σ scored rule weights in its category × category weight ÷ 100`.
- Points add up. The 47 fixes on the 2026-11-18 seomator.com audit sum to 8.77, and 91.24 + 8.77 = 100.01. Show one decimal, say "tied" when two match, and never present points as traffic.
- **Ranking** is one queue by points, failures and warnings together, then rule weight, then rule id. A widespread heavy warning can outrank a narrow failure; the status shape still says which is which.
- **Caps.** While a cap holds, the fix that lifts it leads and is worth the gap between the ceiling and the uncapped average (`score-caps.ts` records both). Every other fix shows "+N once the cap is lifted".
- **Not measured and advisory** count for nothing and say so. The exact score (91.24) is shown in "Where the numbers come from"; everywhere else the score is the integer.
- **Crawls:** points use the same arithmetic on the aggregated result, and the Pages column ("214 / 300") appears before Points.

## Do's and Don'ts

- **Do** make the first fix the largest type on any report, on every host.
- **Do** compute every number on a report from the stored result, and show where it came from.
- **Do** pair every status colour with its shape and its word.
- **Do** keep the orange to the budget above. Count it: one primary per screen.
- **Do** design the zero-fix, capped, not-rendered and crawl variants of the report, not only the happy path.
- **Don't** add a score ring, gauge, donut or traffic-light grade.
- **Don't** paint passes green, or use green for anything but improvement.
- **Don't** add tiles: 20 equal category boxes is content of unequal weight in equal boxes. The strip and its table carry the categories.
- **Don't** put a card in a card, a coloured edge on a card (the lead flag is the one 2px stripe, on a block, once per screen), pills, or a kicker label above a heading.
- **Don't** fetch fonts or assets at runtime, and don't hand-write a hex in `ui/`.

## Motion

- **Approach:** minimal-functional, plus the agent.
- **Easing:** enter `cubic-bezier(.23,1,.32,1)`; move `cubic-bezier(.77,0,.175,1)`; exit the enter curve.
- **Duration:** micro 100–150ms (hover, press) · short 240–280ms (state entries, row open) · medium 420ms (the hop) · the scan loops at 1.6s while a run is live.
- **Progress** animates `transform: scaleX`, never width. No spinners anywhere.
- **The one authored moment:** a run ending. The progress line completes, the agent turns `alert` or `delighted` once, the phase headline is replaced by the lead fix, and the orange moves to "Run again".
- **Reduced motion:** every state shows its resting pose; nothing loops.

## Implementation notes

- **Tokens** (`src/design/tokens.ts`): `color-ink` / `color-ink-bg` are the verdict colour for 80 and above; `color-agent-text`, `color-strip` and `color-border-strong` were added; `color-orange` is gone. The terminal keys its colours on the grade (`banner.ts`), not on the visual token, and keeps green for good.
- **Points** come from `src/rules/points.ts` (`attachPoints` for summaries, `pointsByRule` for any result shape). The wording around them (fix headline, points format, cap headlines, the agent's sentence) lives once in `src/reporters/fix-brief.ts`, shared by `ui/` and the HTML report.
- **Report fonts** are inlined at build time: `tsup.config.ts` for the CLI and library, `scripts/vite-plugin-inline-assets.mjs` for the Electron main process and Vitest (Vite leaves `?inline` fonts as files in those builds). A test asserts both faces arrive as data URLs.
- **Radius** is clamped in `ui/styles/tailwind.css` (`--radius-lg` through `--radius-3xl` are 6px), so older `rounded-xl` utilities follow the cap.

**Open work**
- The compare page and the trend chart follow the tokens and the radius cap but have not been redrawn to this layout.
- The HTML report's sidebar badges and category cards keep their earlier styling; its header, score, lead fix and fix queue follow this file.
- The desktop app was built (`npm run electron:build`), not launched: run `npm run rebuild:electron && npm run electron:dev` to see it, then `npm run rebuild:cli`.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-18 | Initial design system created ("The Fix Brief") | /design-consultation. Memorable thing: "It told me exactly what to fix first." Research: Sitebulb, Ahrefs, Semrush, Vercel Geist (PageSpeed Insights refused the headless browser). Outside voices: Codex ("The Fix Brief") and a Claude subagent ("One-Bit Bench"), both completed |
| 2026-11-18 | R1: the first fix owns the headline | Both outside voices and the memorable thing; all 398 rules already carry imperative fix text |
| 2026-11-18 | R2: one queue ranked by score points, across fail/warn, with points shown | The score is linear with recorded caps, so points are exact (verified: gains sum to the missing 8.77). Codex argued against showing points; kept, labelled as score points, never traffic |
| 2026-11-18 | R3: colour only where it's wrong, no gauge; green only for improvement; D-grade orange retired | Today 20 green bars and 279 green passes are the loudest thing on a report |
| 2026-11-18 | R4: the weight-proportional points strip replaces the category tiles and the report sidebar | Subagent's idea, owner's pick; table fallback and aria labels required |
| 2026-11-18 | Geist headings; Degular only in the wordmark | Adobe kit can't self-host; OH no App licence terms for npm + HTML unconfirmed; the emailed report must match the app |
| 2026-11-18 | ~~Ink on orange (6.0:1)~~ → white on orange, as the website (3.3:1) | Owner, after seeing it: "the button text should be white color". AA for large text only; `BRAND_PAIRS` in tokens.ts holds it to a 3:1 floor |
| 2026-11-18 | Not adopted: Departure Mono as the agent's voice; ranking live during a run | The website's agent speaks Geist Mono; rows re-sorting mid-run fight "told me exactly" |
| 2026-11-18 | Implemented on `feat/fix-brief-design` | Owner: "okay i like it apply the design and ux changes into project" |
| 2026-11-18 | Caps handled in the UI, not by mapping caps to rules | A cap is a condition (an empty page needs a title *and* content), so points stay on the uncapped average and the lead becomes "lift the cap" |
| 2026-11-18 | History: the site cards above the table became a Site menu in its header | Owner: "i dont like the website list on top"; the cards pushed the audits down and gave every site equal weight |
| 2026-11-18 | Advisory findings stay out of the fix queue | They score nothing yet, so they cannot be what to fix first; they are counted with the measurement gaps and remain in All checks |
