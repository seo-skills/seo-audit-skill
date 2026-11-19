# Quickstart: your first SEO audit

> **Type:** Tutorial

In this tutorial you install SEOmator, audit one web page, read the report, and
then compare two audits of the same site. SEOmator checks a page against
**398 rules** across **20 categories** and gives it a score out of 100.

You will audit https://example.com, a public page reserved for documentation
examples. When you are done, swap in the URL of your own site.

It takes about five minutes.

## What you'll need

- Node.js 20.18.1 or later. Check with `node --version`.
- npm, which comes with Node.js.
- An internet connection.
- Google Chrome, Chromium or Microsoft Edge, if you want Core Web Vitals
  (`--cwv`). SEOmator uses the browser to load the page the way a visitor
  would. Without one, the audit still runs and reports Core Web Vitals and the
  other checks that need a browser as "not measured".

## 1. Install SEOmator

Install the package globally. It adds the `seomator` command:

```bash
npm install -g @seomator/seo-audit
```

On npm 11 you may see an `install-scripts` warning about `better-sqlite3`. The
install still completes.

Check the version:

```bash
seomator --version
```

```
8.0.0
```

Then check your setup:

```bash
seomator self doctor
```

```
SEOmator Doctor
Checking system setup...

  ✓ Node.js: Node.js v24.21.0 installed
  ✓ npm: npm v11.19.0 installed
  ✓ Chrome/Chromium: Browser found (Google Chrome 158.0.8127.36)
  ...

All 7 checks passed. Ready to audit!
```

Your versions will differ. If the `Chrome/Chromium` line is a warning, carry
on: only the browser checks are affected.

## 2. Audit a page

Run an audit of example.com:

```bash
seomator audit https://example.com --cwv
```

`--cwv` (the same flag as `--render`) also loads the page in a browser. The
render measures Core Web Vitals and runs the other checks that need the
rendered page, such as accessibility with axe-core. Leave it out for a faster
audit: those checks are then reported as not measured, and the report says
how many of them a render would add.

SEOmator prints a banner, then one line per category as each finishes. The
audit takes five to ten seconds. You will see output like this (trimmed):

```
 ███████╗███████╗ ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ██████╗
 ██╔════╝██╔════╝██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗
 ███████╗█████╗  ██║   ██║██╔████╔██║███████║   ██║   ██║   ██║██████╔╝
 ╚════██║██╔══╝  ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║██╔══██╗
 ███████║███████╗╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██║  ██║
 ╚══════╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝

  v8.0.0  •  https://seomator.com
──────────────────────────────────────────────────
Config: (none, using defaults)
Auditing: example.com


  ✗ Core                  75 16 passed, 3 warnings, 4 failed, 4 not measured
  ✗ Technical SEO         93 12 passed, 2 warnings, 4 failed, 1 not measured
  ⚠ Performance           99 25 passed, 1 warnings, 3 not measured
  ⚠ Links                 98 17 passed, 2 warnings, 8 not measured
  ...
  ✗ AI/GEO Readiness      45 5 passed, 4 warnings, 2 failed, 2 not measured

✓ Audited 1 page in 5.2s
  Saved as 2026-11-18-140ca2 — compare with: seomator compare example.com

──────────────────────────────────────────────────
SEOMATOR REPORT
example.com • 1 page • 84/100 (B)
──────────────────────────────────────────────────

Health Score: 84/100 (B)
```

That is your first result: example.com scores 84 out of 100, a B. Your numbers
may differ, because some checks time the page on every run and the page itself
can change.

The `Saved as` line tells you the audit was stored on your machine. You will use
that in step 4.

## 3. Read the report

The report continues below the score. Read it from the top.

**The score and grade.** The grade comes from the score: A is 90 or more, B is
80 or more, C is 70 or more, D is 50 or more, and F is below 50. A score of 70
or more also passes in scripts. Check the exit status of the audit you just ran:

```bash
echo $?
```

```
0
```

An audit that scores below 70 exits with `1`, and one that could not run at all
exits with `2`.

**The category breakdown.** Each category gets its own score, worst first
(trimmed):

```
Category Breakdown:
--------------------------------------------------
Social               ██░░░░░░░░ 19%
  Passed: 0 | Warnings: 3 | Failed: 5 | Not measured: 5
AI/GEO Readiness     █████░░░░░ 45%
  Passed: 5 | Warnings: 4 | Failed: 2 | Not measured: 2
Security             ███████░░░ 71%
  Passed: 14 | Warnings: 5 | Failed: 5 | Not measured: 2
...
HTML Validation      ██████████ 100%
  Passed: 11

Total: 261 passed, 30 warnings, 28 errors, 67 not measured
```

Social scores lowest because example.com has no Open Graph or Twitter Card
tags.

**The issues.** Below the breakdown, every check that did not pass is listed,
grouped by category. The categories with the most failures come first
(trimmed):

```
ISSUES

Security (5 errors, 5 warnings, 2 not measured)
  security-https-redirect HTTP to HTTPS Redirect (error)
    ✗ security-https-redirect: HTTP version is accessible without redirecting to HTTPS
      → /
...
Core (4 errors, 3 warnings, 4 not measured)
  core-description-present Meta Description Present (error)
    ✗ core-description-present: No <meta name="description"> tag found in the document
      → /
...
  core-title-unique Title Uniqueness (not measured)
    – core-title-unique: Title uniqueness needs other pages to compare against - run with --crawl
      → /
```

Each issue shows the rule ID (`security-https-redirect`), the rule name, and
its result: `error` for a failed check, `warning` for one that needs attention,
or `not measured`. The next line says what was found, and the `→` line names
the page.

Some issues come from advisory rules: new checks that are reported but not
counted in the score yet. `seomator explain <rule-id>` says whether a rule is
one.

**Checks marked "not measured".** Lines that start with `–` are checks that
took no reading on this run. They do not count toward the score. The message
says why: either the check needs more than this run collected, or the page had
nothing for it to check. `core-title-unique` compares titles across pages, so
it needs a multi-page audit (`--crawl`).

## 4. Audit again and compare

Every audit is stored unless you pass `--no-save`, so SEOmator can tell you what
changed between two runs. Run the same audit again, with the same flags, then
compare:

```bash
seomator audit https://example.com --cwv
seomator compare example.com
```

`compare` matches the newest audit of example.com against the one before it:

```
Comparing example.com
  previous  2026-11-18-140ca2  2026-11-18 10:26  score 87
  current   2026-11-18-c56324  2026-11-18 10:28  score 87

  Overall  87 → 87  = 0

  No category scores changed.

  No rules changed status.
```

Nothing changed between these two runs. Yours may show a small change even
though the page is the same, because some checks time the page on every run.
`cwv-ttfb` times the server's first response: if it was under 800 ms on the
first run and between 800 and 1800 ms on the second, the rule is listed under
`Regressed` as `pass → warn`.

If `compare` says there is only one stored audit, run the audit command again.
Audits are stored by default, so no extra flag is needed.

On your own site, fix one issue from step 3, audit again, and compare. The rule
you fixed appears under `Improved`.

## What you built

You installed SEOmator, audited a page, read its score, categories and issues,
and compared two stored audits. From here:

- Learn why the score works the way it does, including caps and "not measured"
  checks: [Introduction](./introduction.md).
- Audit a whole site instead of one page with `--crawl`. Run
  `seomator audit --help` for every option.
- Add `--render` (the same as `--cwv`) when you want Core Web Vitals and the
  other checks that need a browser. Without it the report says how many checks
  a render would add.
- Ask what any rule checks and how to fix it with `seomator explain <rule-id>`,
  for example `seomator explain security-https-redirect`.
- Give the report to an AI assistant with `--format llm`:
  [AI Agent Integration](./ai-agent-integration.md).
- Keep project settings in a `seomator.toml` file:
  [Configuration](./configuration.md).
- Browse your stored audits in a browser with `seomator serve`:
  [Web dashboard](./WEB-DASHBOARD.md).
- Look up any rule ID from the report: [SEO Audit Rules](./SEO-AUDIT-RULES.md).

## Related

- [Introduction](./introduction.md)
- [Configuration](./configuration.md)
- [SEO Audit Rules](./SEO-AUDIT-RULES.md)
- [AI Agent Integration](./ai-agent-integration.md)
- [Web dashboard](./WEB-DASHBOARD.md)
- [Documentation index](./README.md)
