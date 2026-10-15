# How to run and package the desktop app

> **Type:** How-to

Run the SEOmator desktop app from a source checkout, switch its native database
module between the Electron and Node.js builds, and build or package the app.

This page has two parts: contributor tasks, then an
[Explanation](#explanation) of how the app reuses the engine and the UI, how
the IPC bridge works, and why the native module has to be rebuilt and
re-signed. The desktop app is not published to npm; only the CLI is.

## Prerequisites

- A clone of the repository with dependencies installed:

  ```bash
  git clone https://github.com/seo-skills/seo-audit-skill.git
  cd seo-audit-skill
  npm install
  ```

- Node.js 20.3 or later.
- On macOS, `codesign` from the Xcode command line tools. The rebuild scripts
  use it to re-sign the native module.

## Run the app in development

1. Build `better-sqlite3` for Electron:

   ```bash
   npm run rebuild:electron
   ```

   On macOS it ends with:

   ```
   resign-native: re-signed node_modules/better-sqlite3/build/Release/better_sqlite3.node
   resign-native: 1 module(s) signed.
   ```

2. Start the app:

   ```bash
   npm run electron:dev
   ```

   A window titled **SEOmator** opens with DevTools attached. It shows the same
   History view as the web dashboard, read from `~/.seomator/audits.db`.

3. Edit and watch. Changes under `ui/` reload in the window through Vite. Changes
   to `electron/main/` or `electron/preload/` need a restart, or start with
   `npm run electron:dev -- --watch` to have electron-vite rebuild them on save.

4. When you are done, put the CLI build back before you use the CLI or run the
   tests:

   ```bash
   npm run rebuild:cli
   ```

To keep test audits out of your own history, give the app its own data
directory: `SEOMATOR_HOME=$(mktemp -d) npm run electron:dev`.

**Verification.** In the window's DevTools console, `window.electronAPI` is an
object with methods such as `runAudit`, `listAudits` and `getAppInfo`. Click
**New audit**, run one, and the result opens when it finishes. Its subtitle
shows the source `desktop`.

To check the Electron build of the native module without opening a window,
load it under Electron's own Node.js. No output means it loaded:

```bash
ELECTRON_RUN_AS_NODE=1 npx electron -e "new (require('better-sqlite3'))(':memory:')"
```

## Switch the native module between Electron and the CLI

The checkout holds one compiled copy of `better-sqlite3`, built for either
Electron or Node.js. Rebuild it whenever you change which one you run.

| Before you run | Run first | What it does |
|---|---|---|
| `npm run electron:dev` | `npm run rebuild:electron` | `electron-rebuild -f -w better-sqlite3`, then `node scripts/resign-native.mjs` |
| The CLI, `npm run test:run`, `seomator serve` from the checkout | `npm run rebuild:cli` | `npm rebuild better-sqlite3`, then `node scripts/resign-native.mjs` |

1. Run the script from the table.
2. Check the result. For the CLI build:

   ```bash
   node -e "new (require('better-sqlite3'))(':memory:')"
   ```

   No output and exit code 0 means Node.js can load it. For the Electron build,
   use the `ELECTRON_RUN_AS_NODE` command above.

Use the npm scripts rather than `electron-rebuild` on its own. On Apple Silicon
the module `electron-rebuild` leaves behind is killed at load until it is
re-signed, and only the scripts re-sign it.

## Build and package the app

1. Build the three bundles:

   ```bash
   npm run electron:build
   ```

   | Output | From |
   |---|---|
   | `dist-electron/main/index.js` | `electron/main/index.ts` |
   | `dist-electron/preload/index.mjs` | `electron/preload/index.ts` |
   | `dist-electron/renderer/` | `ui/index.html` and the React app in `ui/` |

2. Package it. Each of these first runs `electron-builder install-app-deps` and
   `npm run electron:build`:

   | Script | Produces, in `release/` |
   |---|---|
   | `npm run electron:pack` | An unpacked app for this machine, for a quick check. On an Apple Silicon Mac: `release/mac-arm64/SEOmator.app`. |
   | `npm run electron:dist` | The installers for the current platform |
   | `npm run electron:dist:mac` | A universal (Intel and Apple Silicon) `.dmg`, `SEOmator-<version>-mac.dmg`, and a `.zip` |
   | `npm run electron:dist:win` | An NSIS installer for x64, `SEOmator-<version>-win-x64.exe` |

   On Linux, `npm run electron:dist` builds `SEOmator-<version>-linux-<arch>.AppImage`.

3. Rebuild the native module for what you run next. `install-app-deps` leaves
   `better-sqlite3` in your `node_modules` built for Electron and does not
   re-sign it. Run `npm run rebuild:cli` before the CLI, or
   `npm run rebuild:electron` before `npm run electron:dev`.

**Verification.** `release/` holds the app or installers. In the macOS app,
`better_sqlite3.node` sits outside the archive, in
`SEOmator.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/`,
because native modules cannot load from inside an asar file.

`electron-builder.yml` configures no signing identity and no notarization, so a
build is not ready to hand out: macOS Gatekeeper warns when it is opened on
another Mac.

### Regenerate the app icon

`electron/resources/icon.png` is rendered from the brand mark,
`electron/resources/brand/seomator-mark.svg`:

```bash
npm run gen:icons                  # write icon.png
node scripts/gen-icons.mjs --check # compare without writing
# gen-icons: icon.png is in sync with 1024px render of the brand mark.
```

Do not run `npm run electron:icon`. It runs an older generator,
`scripts/generate-icon.mjs`, which overwrites `icon.png` with a placeholder
design.

## Troubleshooting

### `npm run electron:dev` opens no window and prints no error (Apple Silicon)

The main process died while loading `better_sqlite3.node`. The only evidence is
a crash report in `~/Library/Logs/DiagnosticReports/Electron-*.ips`:

```
Exception:   EXC_BAD_ACCESS, SIGKILL (Code Signature Invalid)
Termination: CODESIGNING, code 2, "Invalid Page"
```

Run `npm run rebuild:electron`, which re-signs the module, then start again.
It can happen whenever the module was rebuilt for Electron without the re-sign
step: `electron-rebuild` on its own, or one of the packaging scripts.

### `was compiled against a different Node.js version using NODE_MODULE_VERSION`

The module is built for the other runtime. From Electron, run
`npm run rebuild:electron`. From the CLI or the tests, run `npm run rebuild:cli`.

### Electron prints the CLI help and exits

`main` in `package.json` must stay `./dist-electron/main/index.js`. Electron
starts whatever `main` names, and `./dist/cli.js` is the CLI.

### `resign-native: could not sign ...`

`codesign` is missing. Install the Xcode command line tools
(`xcode-select --install`) and run the rebuild script again. The CLI does not
need the signature; Electron does.

### Mobile parity and Simulate interaction never appear

Expected. The desktop app renders pages in a hidden Electron window, which
cannot emulate a mobile viewport or drive an interaction, so the form hides
both. Use `seomator audit <url> --mobile --simulate-interaction` or the web
dashboard.

### "Retry save is not available in the desktop app yet."

The desktop app cannot retry a failed save or export an unsaved audit. Run the
audit again. Audits run from the web dashboard have both actions.

### Compare with previous stays on "Comparing…"

For the first audit of a site there is nothing to compare with. The web
dashboard says "Nothing to compare yet"; the desktop app gets an empty answer
and keeps waiting. Audit the site again, then compare.

---

## Explanation

> **Type:** Explanation

### The problem

SEOmator has one audit engine and three ways to use it: the CLI, the web
dashboard (`seomator serve`) and this desktop app. The desktop app needs the
engine's runs, history and reports without becoming a second copy of them, and
it has to load `better-sqlite3`, a C++ addon compiled for one runtime, from the
same `node_modules` the CLI uses.

A second copy is what it used to be. Before commit `948f648` the desktop app
had its own run logic: it never stored a result, its Cancel button only stopped
the UI listening while the audit carried on, and its progress list grew one row
per category per page, so a 50-page crawl rendered a thousand rows.

### One UI, two hosts, one engine

```
                        ui/  (one React app)
                 ┌───────────────┴────────────────┐
         Electron window                     browser tab
         window.electronAPI                  no electronAPI
         (set by the preload)                → HTTP adapter, ui/lib/http-api.ts
                 │ IPC                            │ HTTP + Server-Sent Events
         electron/main/audit-bridge.ts       src/dashboard/server.ts
         electron/main/db-bridge.ts          src/dashboard/api.ts, run-api.ts
                 └───────────────┬────────────────┘
                 src/dashboard/audit-session.ts   one run at a time
                 src/dashboard/queries.ts         stored-audit reads
                                 │
                 src/auditor.ts, rules, scoring → ~/.seomator/audits.db
```

- **Electron code stays in `electron/`.** It reaches the engine through the
  `@core` alias, which points at `src/`. Nothing in `src/` knows about Electron.
- **The renderer is `ui/`, outside `electron/`.** Commit `d663be3` moved it out
  of `electron/renderer/` so the web dashboard could serve the same app.
  electron-vite builds `ui/` into `dist-electron/renderer/`; `vite.web.config.ts`
  builds the same sources into `dist/web` for `seomator serve`.
- **The host is picked at runtime.** `getHost()` in `ui/lib/api-client.ts`
  returns `electron` when the preload has put `electronAPI` on `window`, and
  `web` otherwise, so `getAPI()` in `ui/lib/ipc-client.ts` returns `null` in a
  browser. Under Electron the app uses a hash router, because a packaged build
  loads from `file://`; on the web it uses real paths.
- **Types are shared, channel names are not.** `electron/shared/ipc-types.ts`
  re-exports the shapes from `src/dashboard/contract.ts` and
  `src/dashboard/audit-session.ts`. Only the channel names belong to Electron.
- **Colours come from `src/design/tokens.ts`.** A Vite plugin regenerates
  `ui/styles/tokens.css` from it whenever `electron:dev` or `electron:build`
  starts, the same way the web build does.

The result: a rule fix, a scoring change or a new query reaches the CLI, the web
dashboard and the desktop app at once. A UI change in `ui/` ships to both
hosts, so it has to be checked in both.

### The IPC bridge

`AuditSession` owns the run: one at a time, real cancellation, bounded state,
and storage with `source: 'desktop'`. The bridge is only transport.

```
renderer                    preload (contextBridge)        main
useAudit() ──runAudit()────► invoke 'audit:run' ─────────► session.start(args)
           ◄── { started, error? } ◄──────────────────────  answers at once
store.setRunState ◄── 'audit:state' (the whole RunState) ◄─ session.subscribe(...)
                  ◄── 'audit:complete' { result, ruleMetadata, auditId, saveError? }
                  ◄── 'audit:error' { code, message, hint? }
```

- **Runs.** `audit:run`, `audit:cancel` and `audit:get-state` use
  invoke/handle, so the renderer learns whether the run started. Progress
  arrives on one channel, `audit:state`, carrying the whole run state. The
  store in `ui/stores/audit-store.ts` mirrors that state instead of rebuilding
  it from events. Four progress channels used to do that job, and reassembling
  them is how a crawl ended up with one category row per page.
- **Reads.** `db:list-audits`, `db:get-score-trend`, `db:get-audited-domains`,
  `db:list-domains`, `db:get-audit-detail`, `db:compare`, `db:delete-audit`,
  `db:export-audit` and `app:get-info` call the same functions in
  `src/dashboard/queries.ts` that the web API calls. `db:export-audit` is the
  one place the hosts differ on purpose: the browser downloads a file, the
  desktop app opens a save dialog.
- **A window opened mid-run** asks for the current state on mount
  (`audit:get-state`), so it shows the run rather than an empty form.

The full channel list, with payload types, is `IPC_CHANNELS` in
`electron/shared/ipc-types.ts`.

**Isolation.** The app window runs with `contextIsolation: true` and
`nodeIntegration: false`, and the renderer sees only the typed `electronAPI`
the preload exposes. With `nodeIntegration` on, any script injection in the
renderer would get Node.js. The window also sets `sandbox: false`. Its code
comment credits `better-sqlite3`, but only the main process loads that module.
The constraint the build output shows is the preload itself: it is emitted as an
ES module (`index.mjs`), and Electron runs ES module preloads only outside the
sandbox. The hidden windows that load the pages being audited do run sandboxed,
each in its own session.

### Rendering pages without Playwright

The CLI renders pages with Playwright. The desktop app renders them in a hidden
`BrowserWindow` instead (`electron/main/electron-fetcher.ts`), because a
Playwright Chromium binary inside the `.app` bundle is blocked by macOS
Gatekeeper. The hidden window returns the rendered HTML, the status code and
Core Web Vitals read from the page's performance APIs, in the same shape
Playwright's fetcher returns, so the auditor cannot tell them apart.

The trade-off is reach. A `BrowserWindow` cannot emulate a mobile viewport or
drive a synthetic interaction, so the desktop build reports `mobileParity` and
`simulateInteraction` as unavailable and the form hides both, rather than
offering settings that would do nothing.

Two more differences from the CLI: a run started in the app does not read
`seomator.toml`, because the shared session never loads it, and the run form
leaves Core Web Vitals off by default while `seomator audit` measures them. A
desktop audit and a CLI audit of one site are therefore often measured
differently, and `seomator compare` says so. See
[Compare two runs of a site](WEB-DASHBOARD.md#compare-two-runs-of-a-site).

### Why the native module has to be rebuilt

`better-sqlite3` is a compiled C++ addon. A compiled addon works only with the
Node.js ABI it was built against, identified by `NODE_MODULE_VERSION`. Your
Node.js and the Node.js inside Electron 40 have different ABIs, and the
checkout holds a single `better_sqlite3.node`:

```
node_modules/better-sqlite3/build/Release/better_sqlite3.node   (one file)

  npm run rebuild:cli          → built for your Node.js  → CLI, tests, seomator serve
  npm run rebuild:electron     → built for Electron      → npm run electron:dev
  npm run electron:pack, :dist → built for Electron, not re-signed
```

Loading the wrong build fails with a `NODE_MODULE_VERSION` error, so every
switch between the CLI and the app costs a rebuild. That is why the two rebuild
scripts exist. The npm package is not affected: `files: ["dist"]` ships only the
CLI, and `npm install` gives its users a `better-sqlite3` for their own Node.js.

### Why the module is re-signed on Apple Silicon

On Apple Silicon, macOS refuses to run code whose signature it does not
accept. The `better_sqlite3.node` that `electron-rebuild` leaves behind carries
such a signature, although `codesign -v` reports it valid. The Electron main
process dies inside `dlopen` before it draws a window, with no output and no
stack trace; the only trace is the crash report in
`~/Library/Logs/DiagnosticReports/`. That cost four sessions in which the
desktop app was written off as untestable, until commit `d05f01e` found the
cause.

`codesign --force --sign -` replaces the signature with a fresh ad-hoc one, and
the module loads. `scripts/resign-native.mjs` runs that after every rebuild
instead of trying to detect the bad case, because re-signing a good binary is
harmless. Off macOS the script does nothing, and if `codesign` fails it warns
without failing the rebuild, since only Electron needs the signature.

### Trade-offs

| Choice | Gain | Cost |
|---|---|---|
| Shared `AuditSession` and queries | One run model and one history for every surface | One audit at a time; the desktop app has no retry save or unsaved export yet |
| `ui/` shared with the web dashboard | One UI to build and fix | Every UI change has to be checked in two hosts |
| Hidden `BrowserWindow` instead of Playwright | No Chromium binary for Gatekeeper to block | No mobile parity, no simulated interaction |
| One `better-sqlite3` build in the checkout | A plain `npm install` works for the CLI | A rebuild on every switch between the CLI and the app |
| Re-sign after every rebuild | No guessing which artifact is bad | A macOS-only step, and a dependency on `codesign` |
| Preload emitted as an ES module, following the package's `"type": "module"` | No separate CommonJS build for one file | The app window runs with `sandbox: false` |

## Related

- [How to use the local dashboard](WEB-DASHBOARD.md)
- [Technical architecture](technical-architecture.md)
- [Storage architecture](STORAGE-ARCHITECTURE.md)
- [Configuration](configuration.md)
- [Local web dashboard PRD](PRD-local-web-dashboard.md)
- [Design system PRD](PRD-design-system.md)
