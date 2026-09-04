# The local dashboard

`seomator serve` runs a small web server on your machine that shows every audit
you have run — which sites you audit, how their scores moved, what changed
between two runs, the full detail of any single audit — and runs new ones.

```bash
seomator serve
#   SEOmator dashboard → http://127.0.0.1:7360
```

It opens your browser. Nothing leaves your machine: the server binds to
`127.0.0.1`, reads the same `~/.seomator/audits.db` the CLI writes, and makes
no outbound requests.

## First run

```bash
seomator audit https://example.com     # stored automatically since 3.4.0
seomator audit https://example.com     # again, after a change
seomator serve                         # see both, and what moved
```

If you have never run an audit, the dashboard says so and shows you the command
to run. Audits are stored by default; `--no-save` opts a run out.

## Options

```
seomator serve [options]
  -p, --port <n>         Port on 127.0.0.1 (default: 7360; 0 picks a free one and prints it)
      --no-open          Do not open a browser (BROWSER=none does the same)
  -v, --verbose          Log one line per request
      --audit <url>      Audit this URL as soon as the server starts
      --crawl            With --audit: crawl the site
  -m, --max-pages <n>    With --audit: page ceiling
      --no-cwv           With --audit: skip the browser render
  -c, --categories <l>   With --audit: only these categories
      --mobile           With --audit: also render at a phone viewport
      --simulate-interaction   With --audit: click and scroll so INP can be measured
```

`--audit` starts a run as the server comes up and prints the URL to follow it
on, so a script can hand someone a link to an audit already in progress.

`SEOMATOR_HOME` relocates the data directory (database, settings, the token
file) for CI runners, read-only home directories, and separate profiles.

## For agents and scripts

Every `/api` request needs the per-launch token. `serve` prints it once and
writes it to `$SEOMATOR_HOME/serve.json` (mode 0600), which it deletes on
shutdown:

```bash
TOKEN=$(jq -r .token ~/.seomator/serve.json)
PORT=$(jq -r .port  ~/.seomator/serve.json)

curl -s -H "X-SEOmator-Token: $TOKEN" "http://127.0.0.1:$PORT/api/audits" | jq '.[0]'
```

The browser does not need this: the page response sets the token as an
`HttpOnly; SameSite=Strict` cookie, so the dashboard's own fetches carry it.

`GET /api` returns the route index — method, path and purpose for every
endpoint — derived from the same table the router dispatches on, so it cannot
drift from what the server actually does.

### Endpoints

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api` | The route index |
| `GET` | `/api/info` | Version, rule and category counts, capabilities, database path |
| `GET` | `/api/audits?domain=&limit=&offset=` | Stored audits, newest first (`limit` ≤ 200) |
| `GET` | `/api/audits/:id` | One audit, **one row per rule** with its worst page, counts and up to five sample pages |
| `GET` | `/api/audits/:id/rules/:ruleId/pages` | Every page one rule ran on |
| `GET` | `/api/audits/:id/compare?against=<id>` | Score, category and per-rule differences |
| `GET` | `/api/audits/:id/export?format=html\|markdown\|json\|llm` | A downloadable report |
| `DELETE` | `/api/audits/:id` | `204` |
| `GET` | `/api/domains` | One row per audited domain: latest score, movement, sparkline |
| `GET` | `/api/domains/:domain/trend?limit=` | Score history, oldest first |
| `POST` | `/api/runs` | Start an audit — `202 { runId, run }`, or `409` when one is running |
| `GET` | `/api/runs/current` | `200 { run: RunState \| null }` — never `204`, so `.json()` always works |
| `DELETE` | `/api/runs/current` | Cancel — `202`, or `204` when idle |
| `GET` | `/api/runs/:runId` | The state of the current or most recent run |
| `GET` | `/api/runs/:runId/result` | A finished run's detail from memory, for a result that was not saved |
| `GET` | `/api/runs/:runId/export?format=` | Download an unsaved run |
| `POST` | `/api/runs/:runId/save` | Store a finished run whose save failed |
| `GET` | `/api/events` | Live run progress (SSE) |

### Running an audit

```bash
curl -s -X POST "http://127.0.0.1:$PORT/api/runs" \
  -H "X-SEOmator-Token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","crawl":true,"maxPages":25}'
# 202 { "runId": "2026-09-03-a1b2c3", "run": { ... } }
```

Options may be top level or nested under `options`; both read naturally from a
shell. Every option is validated and nothing is clamped:

| Option | Type | Range |
|---|---|---|
| `crawl` | boolean | |
| `maxPages` | integer | 1–1000 |
| `concurrency` | integer | 1–20 |
| `timeout` | integer | 1000–120000 ms |
| `measureCwv` | boolean | |
| `mobile` | boolean | needs `measureCwv` and the capability |
| `simulateInteraction` | boolean | needs `measureCwv` and the capability |
| `categories` | string[] | known category ids |
| `save` | boolean | default `true` |

An unknown key or an out-of-range value is a `400` naming the option, what was
allowed, and what arrived. Options the shell cannot support (`mobile` under
the desktop app) are turned off rather than failing the run — `GET /api/info`
reports `capabilities` so a client can hide them.

Only one audit runs at a time. A second `POST` is:

```json
{ "error": { "code": "run-in-progress", "message": "An audit is already running.",
  "hint": "Cancel it with DELETE /api/runs/current, or wait for it to finish.",
  "details": { "currentRun": { "runId": "…", "url": "…", "phase": "crawling" } } } }
```

with `Location: /api/runs/current`.

### Watching a run

`GET /api/events` is a Server-Sent Events stream:

| Event | Data | When |
|---|---|---|
| `snapshot` | `RunState` | Immediately on connect |
| `state` | `RunState` | On every change |
| `heartbeat` | `{}` | Every 15 s |

There is no event replay and none is needed: `RunState` is the reduced form of
everything that came before it — phase, crawl and page counters, per-category
progress, and the terminal status with its `auditId` — so a stream that
reconnects is caught up by the snapshot alone. `EventSource` reconnects on its
own.

```
RunState = {
  runId, status: 'idle' | 'running' | 'complete' | 'error' | 'cancelled',
  url, args, phase: 'starting' | 'crawling' | 'auditing' | 'saving' | 'done',
  startedAt, finishedAt,
  crawl: { crawled, total, discovered, maxPages, currentUrl, done } | null,
  pages: { completed, total, currentUrl },
  categories: [{ categoryId, categoryName, score, passCount, warnCount, failCount, notMeasuredCount, pages }],
  recentRules: [...last 50],
  auditId,   // set once stored
  error: { code, message, hint } | null,
}
```

The state is bounded: one row per category however many pages it is scored on,
and the last fifty rule results. The full audit result never travels over the
stream — a 1,000-page audit is around 100 MB of rule results — so when a run
completes, fetch `/api/audits/:auditId`.

**Limits.** At most 8 concurrent streams per server (`429 too-many-streams`
beyond that), and a consumer that stops reading across three heartbeats is
disconnected. The dashboard closes its stream when its tab is hidden and opens
a new one when it comes back, because six background tabs each holding a
stream would starve its own fetches on HTTP/1.1.

### When a run cannot be saved

A finished run is kept in memory for 15 minutes, or until the next run starts.
Within that window its result is still available:

```bash
curl -H "X-SEOmator-Token: $TOKEN" ".../api/runs/$RUN_ID/result"     # the detail
curl -H "X-SEOmator-Token: $TOKEN" ".../api/runs/$RUN_ID/export?format=html" -O
curl -X POST -H "X-SEOmator-Token: $TOKEN" ".../api/runs/$RUN_ID/save"   # try again
```

A 1,000-page audit stores around 332,000 result rows. `/api/audits/:id`
aggregates them in SQL to roughly 330, so the response stays a sensible size
whether the audit covered one page or a thousand. Use the per-rule `pages`
endpoint to drill into one rule.

### Errors

Every failure has the same shape:

```json
{
  "error": {
    "code": "invalid-option",
    "message": "\"limit\" must be an integer between 1 and 200.",
    "hint": "GET /api lists every route and its method.",
    "details": { "option": "limit", "allowed": "1–200", "received": "9999" }
  }
}
```

| Code | Status | Means |
|---|---|---|
| `unauthorized` | 401 | No token, or the wrong one |
| `bad-origin` | 403 | The request did not come from the local dashboard |
| `unknown-route` | 404 | No such path — `GET /api` lists them |
| `method-not-allowed` | 405 | Right path, wrong method |
| `not-found` | 404 | The audit does not exist |
| `invalid-id` | 400 | Not an audit id (`2026-09-03-a1b2c3`) |
| `invalid-option` | 400 | A query or body value is out of range or unknown |
| `unsupported-media-type` | 415 | A POST body was not `application/json` |
| `payload-too-large` | 413 | A request body over 64 kB |
| `run-in-progress` | 409 | An audit is already running |
| `too-many-streams` | 429 | More than 8 dashboards streaming at once |

Options are rejected, never clamped: a typo fails loudly rather than quietly
returning a different page of results than you asked for.

## Security

Loopback is not an authorization boundary. A sandbox, a forwarded port
(`ssh -L`) or a host-network container can all reach `127.0.0.1`, so the
dashboard does not assume that reaching it means being allowed to use it.

- **A per-launch token** on every `/api` request, compared in constant time.
- **`Host`, `Origin` and `Sec-Fetch-Site`** must all say this server. A page you
  happen to have open in another tab cannot drive the API.
- **No framing.** A request with `Sec-Fetch-Dest: iframe` is refused, and the
  document sends `X-Frame-Options: DENY` and a `frame-ancestors 'none'` CSP —
  otherwise a site could frame the dashboard and overlay Delete.
- **No CORS.** There is no cross-origin access to grant; the dev loop proxies
  through Vite, which is same-origin from the browser's point of view.
- **Static files** resolve inside the build directory only. Traversal is
  rejected before resolution, including encoded and NUL-byte forms, and a
  missing hashed asset returns 404 rather than falling back to `index.html`.

Do not audit URLs that carry secrets in the query string: an audit stores the
URLs it visited. Credentials in the userinfo of a URL
(`https://<user>:<pass>@host/`) are stripped before anything is stored.

<a id="port-in-use"></a>
## Port already in use

```
Port 7360 is in use.
  Try: seomator serve --port 7361
```

`--port 0` binds a free port and prints it.

<a id="missing-web-assets"></a>
## Web assets are missing

The dashboard UI ships in the package as `dist/web`. In a **source checkout**
it has to be built:

```bash
npm run build          # CLI + web assets
npm run web:dev        # or: the API and Vite together, with hot reload
```

`serve` keeps running without them and answers `/api` only, so the Vite dev
server has something to proxy to.

In an **installed package**, missing assets mean a broken install:

```bash
npm install -g @seomator/seo-audit@latest
```

<a id="data-directory"></a>
## The data directory

Audits live in `~/.seomator/audits.db`, or `$SEOMATOR_HOME/audits.db`. If that
path is not writable, `serve` says so and exits rather than starting a
dashboard that cannot read anything:

```bash
SEOMATOR_HOME=/tmp/seomator seomator serve
```

`seomator self doctor` checks the directory, its permissions, and whether the
web assets are present.

<a id="startup"></a>
## Anything else at startup

Run with `--verbose` for one line per request, and check
`seomator self doctor -v`.
