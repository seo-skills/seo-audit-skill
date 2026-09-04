# The local dashboard

`seomator serve` runs a small web server on your machine that shows every audit
you have run: which sites you audit, how their scores moved, what changed
between two runs, and the full detail of any single audit.

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
  -p, --port <n>    Port on 127.0.0.1 (default: 7360; 0 picks a free one and prints it)
      --no-open     Do not open a browser (BROWSER=none does the same)
  -v, --verbose     Log one line per request
```

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
