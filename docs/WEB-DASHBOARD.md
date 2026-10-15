# How to use the local dashboard

> **Type:** How-to

Run `seomator serve` to browse your stored audits in a browser, start new
audits, compare two runs of a site, and do the same from a script over a local
HTTP API.

This page has two parts: four tasks, then the [Reference](#reference) for every
`serve` flag, the token, and each API route.

## Prerequisites

- SEOmator 6.0.0 on Node.js 20.3 or later: `npm install -g @seomator/seo-audit`.
  In a source checkout, run `node dist/cli.js serve` instead of `seomator serve`.
- Stored audits to look at. `seomator audit <url>` stores each audit by default
  (`--no-save` skips it), and the dashboard can run audits itself.
- `curl`, for the scripting task. The examples parse JSON with `node`, which
  SEOmator already needs.

## Start the dashboard

1. Start the server:

   ```bash
   seomator serve
   ```

   ```
     SEOmator dashboard → http://127.0.0.1:7360
     Token: <token>
     Agents: read it from ~/.seomator/serve.json, send it as X-SEOmator-Token.
     Press Ctrl-C to stop.
   ```

   Your default browser opens that URL. Add `--no-open` to skip the browser, or
   `--port 0` to take any free port; the first line prints the port you got.

2. Keep the terminal open while you use the dashboard. Press Ctrl-C to stop it.
   Stopping cancels any audit in progress and deletes `serve.json`.

**Verification.** The **History** view lists your stored audits, newest first,
under a strip of the sites you have audited. With no audits it says "No audits
yet" and shows the command to run one. From a shell, the page answers without a
token:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:7360/
# 200
```

## Run an audit from the dashboard

1. Click **New audit** in the toolbar, or open `http://127.0.0.1:7360/run`.
2. Type the URL. The form adds `https://` when you leave out the scheme.
3. Pick the options. The form remembers them for the next audit.
   - **Core Web Vitals** opens the page in a real browser to measure speed. It is
     off by default in this form, unlike `seomator audit`, and adds about a
     minute.
   - **Crawl the whole site** audits linked pages as well. **Crawl settings**
     then sets "Pages to audit, at most" (2 to 100) and "Pages fetched at once"
     (1 to 10).
   - **Mobile parity** and **Simulate interaction** appear only while Core Web
     Vitals is on.
4. Click **Run audit**. A crawl shows pages being discovered, then each page as
   it is scored. **Cancel** stops the run.
5. When the run finishes, the dashboard opens the stored audit.

To start an audit as the server comes up, give `serve` the URL. The banner then
prints the address to follow the run at, `http://127.0.0.1:7360/run`:

```bash
seomator serve --audit https://example.com --no-cwv
```

**Verification.** The audit page's subtitle lists the date, the number of
categories, the source `dashboard` and the engine version. The audit also shows
up in **History** and in `seomator compare <domain>`.

## Compare two runs of a site

1. Audit the same site at least twice. Audits from the dashboard and from the
   CLI go into the same history.
2. In **History**, open the newer audit.
3. Click **Compare with previous**. It compares the audit with the most recent
   earlier audit of the same domain. To choose the baseline yourself, open
   `http://127.0.0.1:7360/compare/<auditId>/<baselineAuditId>`.
4. Read the result: the score before and after, **Categories that moved**, then
   the rules under **Regressed**, **Improved**, **New in this audit** and **No
   longer measured**.

**Verification.** With two audits of the site, the page shows both scores with
an arrow between them. With only one, it says "Nothing to compare yet".

**Check that the two runs are comparable.** The compare page warns only when the
audits ran on different engine versions. It does not check whether they were
measured the same way. `seomator compare <domain>` does: it lists each
difference, and when one of them can move the score on its own (Core Web Vitals
on for one audit and off for the other, for example) it says the diff is not
like-for-like and `--fail-on-regression` does not fail.

An audit started from the dashboard records its rule filter as an empty list,
and one from `seomator audit` records `*`. Both mean every rule, and `seomator
compare` reads them as the same filter, so a dashboard audit and a CLI audit of
the same site with the same settings are like-for-like.

## Script the dashboard over HTTP

Every `/api` request needs the token of the running server, even from the same
machine.

1. Start the server without a browser:

   ```bash
   seomator serve --no-open
   ```

2. In another shell, read the port and token from `serve.json`:

   ```bash
   SERVE="${SEOMATOR_HOME:-$HOME/.seomator}/serve.json"
   PORT=$(node -p "require('$SERVE').port")
   TOKEN=$(node -p "require('$SERVE').token")
   API="http://127.0.0.1:$PORT/api"
   ```

3. List the newest stored audit, sending the token as a header:

   ```bash
   curl -s -H "X-SEOmator-Token: $TOKEN" "$API/audits?limit=1"
   ```

   ```json
   [{"id":2,"auditId":"2026-10-15-be6048","domain":"example.com","projectName":null,
     "startUrl":"https://example.com/","overallScore":87,"pagesAudited":1, ...
     "status":"completed","source":"cli","engineVersion":"6.0.0"}]
   ```

4. Start an audit and keep its run id:

   ```bash
   RUN=$(curl -s -X POST "$API/runs" -H "X-SEOmator-Token: $TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"url":"https://example.com","measureCwv":false}' \
     | node -p 'JSON.parse(require("fs").readFileSync(0)).runId')
   ```

   The server answers `202` with `{ "runId": "...", "run": { "status": "running", ... } }`.
   [Run options](#run-options) lists everything the body accepts.

5. Wait for the run to finish, then read the id of the stored audit:

   ```bash
   state() { curl -s -H "X-SEOmator-Token: $TOKEN" "$API/runs/$RUN" \
     | node -p "JSON.parse(require('fs').readFileSync(0)).$1"; }
   while [ "$(state status)" = running ]; do sleep 2; done
   AUDIT=$(state auditId)
   ```

   `status` ends as `complete`, `error` or `cancelled`. The `runId` and the
   stored `auditId` are different ids.

6. Read the result, or download it as a report:

   ```bash
   curl -s -H "X-SEOmator-Token: $TOKEN" "$API/audits/$AUDIT" \
     | node -p 'JSON.parse(require("fs").readFileSync(0)).audit.overallScore'
   curl -s -OJ -H "X-SEOmator-Token: $TOKEN" "$API/audits/$AUDIT/export?format=markdown"
   ```

   The second command saves `seo-report-<auditId>.md` in the current directory.

**Verification.** `curl -s -H "X-SEOmator-Token: $TOKEN" "$API"` returns the
route index. The same request without the header returns `401` with the code
`unauthorized`.

A browser tab needs none of this: every page response sets the token as a
cookie.

## Troubleshooting

<a id="port-in-use"></a>
### Port already in use

```
Port 7360 is in use.
  Try: seomator serve --port 7361
  See: https://github.com/seo-skills/seo-audit-skill/blob/main/docs/WEB-DASHBOARD.md#port-in-use
```

`serve` exits with code 1. Pass another `--port`, or `--port 0` to take any free
port.

<a id="missing-web-assets"></a>
### Web assets are missing

The dashboard UI ships in the package as `dist/web`.

- **Installed package.** `serve` prints "Web assets are missing from this
  install" with the path, and exits with code 1. Reinstall:
  `npm install -g @seomator/seo-audit@6.0.0`.
- **Source checkout.** `serve` warns that the web assets are not built, keeps
  running, and answers `/api` only. Every other path returns `503` with "The
  dashboard UI is not built in this install." Build the UI with
  `npm run web:build`, or the CLI and the UI together with `npm run build`.

`npm run web:dev` (Vite on port 7361, proxying `/api` to `serve` on 7360) does
not work with this server. The proxy forwards `Host: localhost:7361`, so `serve`
answers every API call with `403 bad-origin`, and the page Vite serves never
receives the token cookie. Use `npm run web:build` and `serve`.

<a id="data-directory"></a>
### The data directory cannot be used

```
Cannot use the data directory /System/seomator-docs-test:
  EPERM: operation not permitted, mkdir '/System/seomator-docs-test'
  Set SEOMATOR_HOME to a writable path.
```

`serve` exits with code 1 instead of starting a dashboard that cannot read
anything. Point `SEOMATOR_HOME` at a writable directory:

```bash
SEOMATOR_HOME=/tmp/seomator seomator serve
```

`seomator self doctor` checks the data directory and whether the dashboard
assets are present.

<a id="startup"></a>
### Anything else at startup

`serve` prints "Could not start the dashboard:" with the reason, and exits with
code 1. Run `seomator self doctor -v`. Start with `--verbose` to log one line
per request:

```
  GET /api/audits?limit=1 → 200 (7ms)
  GET /api/info → 401 (0ms)
```

### The page says "The dashboard was restarted"

Each launch mints a new token, and the open tab still holds the old cookie, so
every read fails with `401`. Click **Reload**.

### The page says "The dashboard server stopped"

Nothing is answering on that port. Run `seomator serve` again, then click
**Retry**.

### A script gets `401 unauthorized`

The token is missing or belongs to an earlier launch. Read `serve.json` again
after every start. A server stopped with `kill -9` leaves its `serve.json`
behind; if the `pid` in it is not running, the token is dead.

### A script gets `403 bad-origin`

The request failed one of the [request checks](#request-checks). The `details`
field names the value that was rejected. Call `http://127.0.0.1:<port>`
directly, without an `Origin` header from another site.

### A second audit is refused with `409 run-in-progress`

The server runs one audit at a time. Wait for it, or cancel it:

```bash
curl -s -X DELETE -H "X-SEOmator-Token: $TOKEN" "$API/runs/current"
# {"cancelled":true}
```

### A low score with no explanation

A score cap holds the overall score down when, for example, the page is
`noindex`. A stored audit keeps the capped score but not the cap, so the audit
page, `GET /api/audits/<auditId>` and its exports never say which cap applied.
For 15 minutes after a run, `GET /api/runs/<runId>/result` and
`/api/runs/<runId>/export` still include it. After that, run
`seomator audit <url> --no-save`, which prints the cap.

---

## Reference

> **Type:** Reference

`seomator serve` is a local HTTP server on `127.0.0.1`. It serves the dashboard
UI from the package's `dist/web` directory and a JSON API under `/api` over the
audit history in `$SEOMATOR_HOME/audits.db`. It runs at most one audit at a
time. Apart from the audits you start, it makes no network requests.

### Synopsis

```
seomator serve [options]
```

### Options

| Option | Value | Default | Description |
|---|---|---|---|
| `-p, --port <n>` | integer, 0 to 65535 | `7360` | Port on `127.0.0.1`. `0` takes a free port and prints it. |
| `--no-open` | | browser opens | Do not open a browser. A browser opens only when the web assets are present. |
| `-v, --verbose` | | off | Log one line per request: method, path, status, time. |
| `--audit <url>` | absolute http(s) URL | none | Start an audit as soon as the server listens. A URL without a scheme is an error that suggests the `https://` form. |
| `--crawl` | | off | With `--audit`: crawl the site. |
| `-m, --max-pages <n>` | integer, 1 to 1000 | `10` | With `--audit` and `--crawl`: most pages to audit. |
| `--no-cwv` | | measured | With `--audit`: skip the browser render, so no Core Web Vitals. |
| `-c, --categories <list>` | comma-separated category ids | every category | With `--audit`: categories to run. An unknown id is an error that lists the valid ids. |
| `--mobile` | | off | With `--audit`: also render at a mobile viewport. Ignored with `--no-cwv`. |
| `--simulate-interaction` | | off | With `--audit`: click and scroll so INP can be measured. Ignored with `--no-cwv`. |
| `-h, --help` | | | Print help. |

The `--audit` options are ignored without `--audit`. An audit started this way
takes the [run option](#run-options) defaults for everything else: 3 pages at a
time when crawling, a 30000 ms timeout, and the result is stored.

### Environment

| Variable | Effect |
|---|---|
| `SEOMATOR_HOME` | Data directory for `audits.db` and `serve.json`. Default `~/.seomator`. Surrounding whitespace is ignored; an empty value means the default. |
| `BROWSER=none` | Same as `--no-open`. |

### Exit codes

| Code | When |
|---|---|
| `0` | Stopped with Ctrl-C or `SIGTERM`. |
| `1` | Did not start: an invalid option value, a data directory that cannot be written, web assets missing from an installed package, a port in use, or another listen error. |
| `130` | A second Ctrl-C or `SIGTERM` arrived while the server was stopping. |

### Files

| File | Contents |
|---|---|
| `$SEOMATOR_HOME/audits.db` | The audit history. `seomator audit`, `seomator compare` and the desktop app use the same file. Created on first use. |
| `$SEOMATOR_HOME/serve.json` | `{ port, token, pid, startedAt }`, mode `0600`. Written once the server listens, replacing any earlier file. Deleted on Ctrl-C or `SIGTERM`; a process killed any other way leaves it behind. |

A stored audit keeps the URLs it visited, query strings included. A
`user:password@` part is removed before anything is stored.

```json
{
  "port": 65058,
  "token": "<43 characters>",
  "pid": 64678,
  "startedAt": "2026-10-15T11:35:31.640Z"
}
```

### Token

- 32 random bytes, base64url-encoded (43 characters). New on every launch.
- Required on every `/api` request, as the header `X-SEOmator-Token: <token>` or
  the cookie `seomator_token=<token>`. When both are sent, the header is used.
  Compared in constant time.
- Every response that serves `index.html` sets
  `Set-Cookie: seomator_token=<token>; HttpOnly; SameSite=Strict; Path=/`.
- Static files do not need the token.

### Request checks

Every request, static or API, passes these checks before the token is read. A
failure is `403 bad-origin`.

| Header | Rejected when |
|---|---|
| `Sec-Fetch-Dest` | `iframe`, `embed`, `object` or `frame` |
| `Host` | The hostname is not `127.0.0.1`, `localhost`, `[::1]` or `::1`, or it carries a port other than the server's |
| `Origin` | Present, not `null`, and not `http://<one of those hosts>:<port>` |
| `Sec-Fetch-Site` | Present and neither `same-origin` nor `none` |

The server sends no CORS headers.

### Response headers

| Response | Headers |
|---|---|
| JSON from `/api` | `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` |
| `index.html` | `Cache-Control: no-store`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'`, and the token cookie |
| Hashed assets (`name-<8 or more characters>.<ext>`) | `Cache-Control: public, max-age=31536000, immutable` |
| Other static files | `Cache-Control: no-cache` |

### Static paths

- Any path outside `/api` is a file from `dist/web`.
- A path with no file extension that matches no file returns `index.html`. The
  UI's own paths are `/`, `/run`, `/audits/<auditId>`, `/compare/<auditId>` and
  `/compare/<auditId>/<baselineAuditId>`.
- A missing file with an extension, a `..` segment, an encoded separator (`%2e`,
  `%2f`, `%5c`) or a NUL byte returns `404`.
- Without web assets, every static path returns `503` (plain text).

### Routes

`GET /api` returns this list at runtime: `{ name, version, routes: [{ method, path, purpose }] }`.
An `:id` is an audit id: a date, a hyphen, then 1 to 12 lowercase letters or
digits (`2026-10-15-be6048`). A `:runId` has the same shape but is not an audit
id.

| Method | Path | Parameters | Success |
|---|---|---|---|
| `GET` | `/api` | | `200` route index |
| `GET` | `/api/info` | | `200` [build facts](#apiinfo) |
| `GET` | `/api/audits` | `domain`, `status`, `limit` (1 to 200, default 50), `offset` (0 to 1000000, default 0) | `200` [audit summaries](#audit-summary), newest first |
| `GET` | `/api/audits/:id` | | `200` [audit detail](#audit-detail) |
| `DELETE` | `/api/audits/:id` | | `204`, no body |
| `GET` | `/api/audits/:id/rules/:ruleId/pages` | `limit` (1 to 200, default 100), `offset` (0 to 1000000, default 0) | `200` `{ total, pages: [{ pageUrl, status, score, message, notMeasured }] }` |
| `GET` | `/api/audits/:id/export` | `format`: `html` (default), `markdown`, `json`, `llm` | `200` file download |
| `GET` | `/api/audits/:id/compare` | `against`: an audit id (optional) | `200` [comparison](#comparison) |
| `GET` | `/api/domains` | | `200` [domain summaries](#domain-summary) |
| `GET` | `/api/domains/:domain/trend` | `limit` (1 to 100, default 10) | `200` `[{ auditId, score, date, engineVersion }]`, oldest first |
| `POST` | `/api/runs` | JSON body, see [Run options](#run-options) | `202` `{ runId, run }` with `Location: /api/runs/current` |
| `GET` | `/api/runs/current` | | `200` `{ run: RunState }`, or `{ run: null }` when nothing is running |
| `DELETE` | `/api/runs/current` | | `202` `{ cancelled: true }`, or `204` when nothing is running |
| `GET` | `/api/runs/:runId` | | `200` [RunState](#runstate) |
| `GET` | `/api/runs/:runId/result` | | `200` [audit detail](#audit-detail) built from memory |
| `GET` | `/api/runs/:runId/export` | `format`, as for audits | `200` file download |
| `POST` | `/api/runs/:runId/save` | | `200` `{ auditId, domain }` |
| `GET` | `/api/events` | | `200` [event stream](#event-stream) |

Route details:

- `GET /api/audits`: `domain` must equal the stored domain exactly, which is the
  hostname of the start URL (`www.example.com` and `example.com` are different
  domains). `status` is `completed`, `running` or `failed`; any other value
  returns `[]`.
- `GET /api/audits/:id` and the routes under it: `400 invalid-id` for a
  malformed id, `404 not-found` when the audit does not exist.
- `GET /api/audits/:id/rules/:ruleId/pages`: a rule the audit does not have
  returns `{ "total": 0, "pages": [] }`.
- `GET /api/audits/:id/export`: saved as `seo-report-<id>.<html|md|json|txt>`
  with `Content-Type` `text/html`, `text/markdown`, `application/json` or
  `text/plain`. `json` is the audit detail, the same object
  `GET /api/audits/:id` returns.
- `GET /api/audits/:id/compare`: without `against`, the baseline is the most
  recent completed audit of the same domain that started earlier. `404
  not-found` when there is none.
- `GET /api/runs/:runId`: answers for the current run or the most recent one;
  any other id is `404`.
- `GET /api/runs/:runId/result` and `/export`: a finished run stays in memory
  for 15 minutes after it ends, or until the next run starts. A cancelled or
  failed run has no result. Both include `scoreCap` when a cap applied.
- `GET /api/runs/:runId/export`: `Content-Type: application/octet-stream`,
  saved as `seo-report-<runId>.<ext>`. `json` is the raw audit result, one
  entry per rule per page, not the aggregated detail.
- `POST /api/runs/:runId/save`: stores a retained run that is not stored yet,
  because it was started with `"save": false` or its save failed. `404` when it
  is already stored or no longer retained; `500 internal` when the save fails
  again.

<a id="apiinfo"></a>
### `GET /api/info`

| Field | Type | Meaning |
|---|---|---|
| `version` | string | Package version |
| `ruleCount`, `categoryCount` | number | Rules and categories in this build |
| `categories` | `[{ id, name, weight }]` | Every category |
| `dbPath` | string | Path of `audits.db`, with the home directory shown as `~` |
| `capabilities` | `{ browserRender, mobileParity, simulateInteraction, persistence }` | What this server can run. All `true` for `serve`. |
| `invocation` | `npx` or `global` | How the CLI was started |
| `uptimeSeconds` | number | Seconds since the server started |

### Run options

`POST /api/runs` takes a JSON object of at most 65536 bytes with
`Content-Type: application/json`. Options go at the top level or inside an
`options` object; when `options` is an object, only that object is read. Any
other key is `400 invalid-option`. Nothing is clamped.

| Key | Type | Default | Constraint |
|---|---|---|---|
| `url` | string | required | An absolute `http` or `https` URL, at most 2048 characters |
| `crawl` | boolean | `false` | |
| `maxPages` | integer | `10` | 1 to 1000. Used when `crawl` is true. |
| `concurrency` | integer | `3` | 1 to 20. Used when `crawl` is true. |
| `timeout` | integer, ms | `30000` | 1000 to 120000 |
| `measureCwv` | boolean | `true` | |
| `mobile` | boolean | `false` | Turned off unless `measureCwv` is true |
| `simulateInteraction` | boolean | `false` | Turned off unless `measureCwv` is true |
| `categories` | string array | every category | Unknown ids are dropped without an error. If none remain, every category runs. |
| `save` | boolean | `true` | `false` keeps the result in memory only |

A run started over HTTP does not read `seomator.toml`: no rule filters, no
`[crawler]` settings, no `[output] save`.

Failures: `400 invalid-option` with `details: { option, allowed, received }`;
`409 run-in-progress` with `details.currentRun: { runId, url, phase }` and
`Location: /api/runs/current`; `413 payload-too-large`;
`415 unsupported-media-type`.

### RunState

| Field | Type | Meaning |
|---|---|---|
| `status` | `idle`, `running`, `complete`, `error`, `cancelled` | |
| `runId` | string or null | Identifies the run. Not the stored audit id. |
| `url` | string or null | The URL being audited |
| `args` | object or null | The options after defaults were applied, including `save` |
| `phase` | `starting`, `crawling`, `auditing`, `saving`, `done` | |
| `startedAt`, `finishedAt` | ISO string or null | |
| `crawl` | `{ crawled, total, discovered, maxPages, currentUrl, done }` or null | Page discovery; null without `crawl` |
| `pages` | `{ completed, total, currentUrl }` | Pages scored so far |
| `firstPageAt`, `lastPageAt` | ISO string or null | When the first and the latest page finished scoring |
| `categories` | `[{ categoryId, categoryName, score, passCount, warnCount, failCount, notMeasuredCount, pages }]` | One row per category, however many pages it was scored on |
| `recentRules` | `[{ ruleId, ruleName, status, message }]` | The last 50 rule results |
| `auditId` | string or null | Set once the result is stored |
| `error` | `{ code, message, hint? }` or null | `code` is one of `dns`, `unreachable`, `tls`, `timeout`, `http-error`, `non-html`, `playwright-missing`, `no-pages`, `config`, `aborted`, `unknown` |

### Event stream

`GET /api/events` is a Server-Sent Events stream (`text/event-stream`).

| Event | `data` | When |
|---|---|---|
| `snapshot` | RunState | Once, on connect |
| `state` | RunState | On every change. A `state` with the same content can follow the snapshot at once. |
| `heartbeat` | `{}` | Every 15 seconds |

- There is no replay. A client that reconnects is caught up by the snapshot.
- At most 8 streams at once; the next one gets `429 too-many-streams`.
- A stream whose socket is still full after three heartbeats is closed.
- The stream never carries the audit result. Once `auditId` is set, fetch
  `GET /api/audits/<auditId>`.

### Audit summary

`id`, `auditId`, `domain`, `projectName`, `startUrl`, `overallScore`,
`pagesAudited`, `passedCount`, `warningCount`, `failedCount`, `startedAt`,
`completedAt`, `status`, `source` and `engineVersion`. `source` is `cli`,
`dashboard`, `desktop` or `api`. `source` and `engineVersion` are null for
audits stored before 3.4.0.

### Audit detail

`{ audit, result, ruleMetadata }`:

- `audit`: the audit summary plus `totalRules` and `run`, the options the audit
  ran with (null for audits stored before 3.4.0).
- `result`: `url`, `overallScore`, `categoryResults`, `timestamp`,
  `crawledPages` and `coverage: { pages, detail }`. Each category holds one
  entry per rule, not per page: the rule's worst result plus `ruleName`,
  `priority`, `totalPages`, `measuredPages`, `affectedPages`, `notMeasured` and
  up to 5 `samplePages`. `weight` is `0` for a rule that was not measured.
- `ruleMetadata`: `{ "<ruleId>": { name, description, fix } }`.

A stored audit's `overallScore` is the capped score, and its `result` has no
`scoreCap`.

### Domain summary

`domain`, `auditCount`, `latest` (an audit summary), `scoreDelta`,
`regressedRules`, `improvedRules` and `sparkline` (up to the last 10 scores,
oldest first). The three deltas are null for a domain with one audit. Only
completed audits count.

### Comparison

`current` and `previous` (audit summaries), `scoreDelta`, `categoryDeltas`
(`[{ categoryId, categoryName, previousScore, currentScore, delta }]`),
`engineChanged` (true when both engine versions are known and differ), and
`rules: { regressed, improved, added, removed }`. Each rule change is
`{ ruleId, ruleName, categoryId, from, to, message, affectedPages, totalPages }`.

### Errors

Every failure has the same shape:

```json
{
  "error": {
    "code": "invalid-option",
    "message": "\"limit\" must be an integer between 1 and 200.",
    "details": { "option": "limit", "allowed": "1–200", "received": "9999" }
  }
}
```

`hint` (what to do) and `details` (structured context) appear when there is
something to say.

| Code | Status | When |
|---|---|---|
| `unauthorized` | 401 | The token is missing or wrong |
| `bad-origin` | 403 | A [request check](#request-checks) failed |
| `unknown-route` | 404 | No route has this path (`400` when the URL cannot be parsed) |
| `method-not-allowed` | 405 | The path exists, the method does not |
| `invalid-id` | 400 | A malformed audit id |
| `invalid-option` | 400 | A bad query value, run option, URL, export format or JSON body |
| `not-found` | 404 | The audit, a previous audit, the run or its retained result does not exist |
| `unsupported-media-type` | 415 | A `POST /api/runs` body that is not `application/json` |
| `payload-too-large` | 413 | A body over 65536 bytes |
| `run-in-progress` | 409 | An audit is already running |
| `too-many-streams` | 429 | 8 event streams are already open |
| `internal` | 500 | An unexpected server error, or a retried save that failed |

### Examples

These assume `API` and `TOKEN` from [Script the dashboard over HTTP](#script-the-dashboard-over-http).

```bash
curl -s -H "X-SEOmator-Token: $TOKEN" "$API/audits/2026-10-15-c5ffea/compare?against=2026-10-15-be6048"
curl -s -H "X-SEOmator-Token: $TOKEN" "$API/domains/example.com/trend?limit=5"
curl -s -H "X-SEOmator-Token: $TOKEN" "$API/audits/2026-10-15-c5ffea/rules/core-title-present/pages"
# {"total":1,"pages":[{"pageUrl":"https://example.com/","status":"pass","score":100,"message":"Title tag is present","notMeasured":false}]}
curl -s -N -H "X-SEOmator-Token: $TOKEN" "$API/events"
# event: snapshot
# data: {"status":"idle","runId":null,"url":null,"args":null,"phase":"starting",...}
```

A request with an unknown run option:

```bash
curl -s -X POST "$API/runs" -H "X-SEOmator-Token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"url":"https://example.com","maxpages":5}'
```

```json
{"error":{"code":"invalid-option","message":"\"maxpages\" is not valid.","details":{"option":"maxpages",
  "allowed":["crawl","maxPages","concurrency","measureCwv","mobile","simulateInteraction","categories","timeout","save"],"received":5}}}
```

## Related

- [Quickstart](quickstart.md)
- [Configuration](configuration.md)
- [Desktop app](ELECTRON-APP.md)
- [Storage architecture](STORAGE-ARCHITECTURE.md)
- [AI agent integration](ai-agent-integration.md)
- [Technical architecture](technical-architecture.md)
