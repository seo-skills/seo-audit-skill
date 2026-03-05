# SEOmator Desktop App — Architecture Guide

The Electron desktop app wraps the existing Node.js audit engine in a native macOS/Windows application with a React UI. **Zero changes were made to `src/`** — the entire Electron layer is additive, living in the `electron/` directory.

## Table of Contents

- [How It Works](#how-it-works)
- [Directory Structure](#directory-structure)
- [The Three-Process Model](#the-three-process-model)
- [IPC Bridge Architecture](#ipc-bridge-architecture)
- [State Management](#state-management)
- [Design System](#design-system)
- [Build System](#build-system)
- [Distribution & Packaging](#distribution--packaging)
- [Development Workflow](#development-workflow)
- [Key Design Decisions](#key-design-decisions)

---

## How It Works

The desktop app reuses the CLI's `Auditor` class directly — no HTTP APIs, no child processes, no re-implementation. The connection works through Electron's IPC (Inter-Process Communication):

```
┌───────────────────────────────────────────────────────────────┐
│  Renderer Process (React UI)                                  │
│                                                               │
│  useAudit() hook ──► window.electronAPI.runAudit(url)         │
│                         │                                     │
│                         │ ipcRenderer.send('audit:run')       │
└─────────────────────────┼─────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │  Preload Script       │
              │  contextBridge        │
              └───────────┼───────────┘
                          │
┌─────────────────────────┼─────────────────────────────────────┐
│  Main Process (Node.js)  │                                     │
│                          ▼                                     │
│  audit-bridge.ts ──► new Auditor({                            │
│                        onCategoryStart: (id, name) => {       │
│                          win.webContents.send(                │
│                            'audit:progress:category-start',   │
│                            { categoryId: id, ... }            │
│                          );                                   │
│                        }                                      │
│                      })                                       │
│                                                               │
│  Auditor class (from src/auditor.ts)                          │
│    └── fetchPage() → Cheerio parse → runAllCategories()       │
│        └── 251 rules across 20 categories                     │
│                                                               │
│  db-bridge.ts ──► AuditsDatabase (from src/storage/)          │
│    └── SQLite queries: listAudits, getScoreTrend, etc.        │
└───────────────────────────────────────────────────────────────┘
```

**The key insight**: The CLI's `Auditor` class already exposes a callback interface (`onCategoryStart`, `onCategoryComplete`, `onRuleComplete`, `onPageComplete`). The audit bridge simply wires those callbacks to `BrowserWindow.webContents.send()` calls, turning the CLI's synchronous callbacks into IPC event streams.

---

## Directory Structure

```
electron/
├── electron-vite.config.ts       # Triple-target Vite build (main + preload + renderer)
├── tsconfig.json                 # TypeScript config with @core/* and @renderer/* aliases
│
├── main/                         # Main process (Node.js context — full system access)
│   ├── index.ts                  # BrowserWindow creation, IPC handler registration
│   ├── audit-bridge.ts           # Wraps Auditor class → IPC events
│   └── db-bridge.ts              # Wraps AuditsDatabase → IPC invoke/handle
│
├── preload/                      # Preload script (security boundary)
│   └── index.ts                  # contextBridge — exposes typed electronAPI
│
├── renderer/                     # Renderer process (browser context — React app)
│   ├── index.html                # HTML shell
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component — header + page routing
│   ├── components/               # 15 React components
│   │   ├── Header.tsx            # App header with navigation tabs
│   │   ├── AuditRunner.tsx       # URL input + run/cancel controls
│   │   ├── ProgressStream.tsx    # Live category-by-category progress
│   │   ├── ScoreCircle.tsx       # Animated circular score gauge
│   │   ├── ScoreStats.tsx        # Pass/warn/fail summary cards
│   │   ├── CategoryGrid.tsx      # Grid of category score cards
│   │   ├── CategorySection.tsx   # Expandable category with rules
│   │   ├── CategoryBar.tsx       # Horizontal score bar
│   │   ├── RuleCard.tsx          # Individual rule result display
│   │   ├── IssuesTable.tsx       # Filterable table of all issues
│   │   ├── FilterTabs.tsx        # Pass/warn/fail tab filters
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   ├── AuditList.tsx         # History list of past audits
│   │   ├── DomainPicker.tsx      # Domain selector for history
│   │   └── ScoreTrend.tsx        # Recharts line chart of score over time
│   ├── pages/
│   │   ├── AuditPage.tsx         # Main audit view (runner + results)
│   │   └── HistoryPage.tsx       # Audit history with trend charts
│   ├── hooks/
│   │   ├── useAudit.ts           # Audit lifecycle via IPC (subscribe/run/cancel)
│   │   ├── useAuditHistory.ts    # Database queries via IPC
│   │   └── useTheme.ts           # Light/dark theme with localStorage
│   ├── stores/
│   │   └── audit-store.ts        # Zustand — audit state machine
│   ├── lib/
│   │   ├── ipc-client.ts         # Typed accessor for window.electronAPI
│   │   ├── format.ts             # Score color/label helpers
│   │   └── fix-suggestions.ts    # Rule fix suggestion registry
│   └── styles/
│       ├── tailwind.css           # Tailwind v4 entry
│       └── globals.css            # Design tokens (light + dark themes)
│
├── shared/                       # Shared between main and renderer
│   └── ipc-types.ts              # IPC channel names + payload types
│
└── resources/                    # Build assets
    └── icon.png                  # App icon (1024x1024, auto-converts to .icns/.ico)
```

---

## The Three-Process Model

Electron applications run three isolated processes. This is fundamental to understanding the architecture:

### 1. Main Process (`electron/main/`)

- **Runs Node.js** — full access to file system, native modules, `src/` code.
- Creates the `BrowserWindow` and manages the app lifecycle.
- Hosts the two IPC bridges:
  - **`audit-bridge.ts`** — instantiates the `Auditor` class from `src/auditor.ts`, streams progress events to the renderer.
  - **`db-bridge.ts`** — wraps `AuditsDatabase` from `src/storage/audits-db/`, handles SQLite queries.
- Configured in `electron/main/index.ts`:
  - Window: 1280x820, macOS hidden inset title bar, traffic lights at (16, 16).
  - `sandbox: false` is required because `better-sqlite3` is a native C++ addon.
  - Dev mode loads from Vite dev server (`ELECTRON_RENDERER_URL`); production loads `renderer/index.html`.

### 2. Preload Script (`electron/preload/`)

- **Security boundary** between main and renderer processes.
- Uses Electron's `contextBridge.exposeInMainWorld()` to create `window.electronAPI`.
- Provides a fully typed interface (`ElectronAPI`) — the renderer never touches `ipcRenderer` directly.
- The preload script is the **only** code that can access both Node.js APIs and the DOM.

### 3. Renderer Process (`electron/renderer/`)

- **Standard browser context** — runs the React app. No Node.js access.
- Communicates exclusively through `window.electronAPI` (exposed by preload).
- Built with Vite + React + Tailwind CSS v4.

---

## IPC Bridge Architecture

IPC channels are defined in `electron/shared/ipc-types.ts` and follow a `namespace:action` naming convention.

### Audit Channels (streaming events)

These use the **send/on pattern** — fire-and-forget messages that stream in real time.

| Direction | Channel | Payload | Purpose |
|---|---|---|---|
| Renderer → Main | `audit:run` | `AuditRunArgs` | Start an audit |
| Renderer → Main | `audit:cancel` | — | Abort running audit |
| Main → Renderer | `audit:progress:category-start` | `{ categoryId, categoryName }` | Category began |
| Main → Renderer | `audit:progress:category-complete` | `{ categoryId, categoryName, result }` | Category finished |
| Main → Renderer | `audit:progress:rule-complete` | `{ ruleId, ruleName, result }` | Single rule finished |
| Main → Renderer | `audit:progress:page-complete` | `{ url, pageNumber, totalPages }` | Crawled page done |
| Main → Renderer | `audit:complete` | `AuditCompletePayload` | Entire audit done |
| Main → Renderer | `audit:error` | `string` | Error message |

The `AuditCompletePayload` includes both the full `AuditResult` and a `ruleMetadata` map (`ruleId → { name, description }`) looked up from the rule registry.

### Database Channels (request/response)

These use the **invoke/handle pattern** — async request-response, like an RPC call.

| Channel | Args | Returns | Purpose |
|---|---|---|---|
| `db:list-audits` | `{ domain?, limit?, offset? }` | `AuditSummaryIpc[]` | List past audits |
| `db:get-score-trend` | `{ domain, limit? }` | `ScoreTrendPoint[]` | Score history for charts |
| `db:get-audited-domains` | — | `string[]` | Unique domains audited |

### How the Audit Bridge Connects to `src/`

The bridge works because `Auditor` already has a callback-based interface:

```typescript
// In audit-bridge.ts — this is the entire connection
currentAuditor = new Auditor({
  measureCwv: args.options.measureCwv ?? false,

  onCategoryStart: (categoryId, categoryName) => {
    win.webContents.send('audit:progress:category-start', { categoryId, categoryName });
  },

  onCategoryComplete: (categoryId, categoryName, result) => {
    win.webContents.send('audit:progress:category-complete', { categoryId, categoryName, result });
  },

  // ... same pattern for onRuleComplete, onPageComplete
});

// Single vs multi-page audit
if (args.options.crawl) {
  result = await currentAuditor.auditWithCrawl(args.url, maxPages, concurrency);
} else {
  result = await currentAuditor.audit(args.url);
}
```

No adapters, no serialization layers — the existing `Auditor` callbacks map 1:1 to IPC events.

---

## State Management

### Zustand Store (`audit-store.ts`)

The audit runs as a **state machine**:

```
idle ──[startAudit]──► running ──[setComplete]──► complete
                           │
                           └──[setError]──► error
```

State shape:
- `status`: `'idle' | 'running' | 'complete' | 'error'`
- `url`: Target URL being audited
- `progress`: Live streaming data (completed categories, current category, rule count)
- `result`: Full `AuditResult` (same TypeScript type from `src/types.ts`)
- `ruleMetadata`: Rule names and descriptions from the registry
- `error`: Error message string

### Data Flow

```
User clicks "Run"
  └─► useAudit().run(url)
        ├─► store.startAudit(url)           // status = 'running'
        └─► electronAPI.runAudit({ url })    // IPC to main process
              └─► Auditor runs...
                    ├─► onCategoryStart  ──► store.setCategoryStart()
                    ├─► onRuleComplete   ──► store.addRuleComplete()
                    ├─► onCategoryComplete ──► store.setCategoryComplete()
                    └─► audit:complete   ──► store.setComplete(result)  // status = 'complete'
```

### Hooks

| Hook | Purpose |
|---|---|
| `useAudit()` | Subscribes to IPC events, updates Zustand store, returns `{ run, cancel, status, result, progress }` |
| `useAuditHistory()` | Fetches audit history + score trends from SQLite via IPC |
| `useTheme()` | Light/dark toggle persisted in localStorage |

---

## Design System

The desktop app shares the same visual language as the CLI's HTML report output.

### Design Tokens (`globals.css`)

Extracted from `src/reporters/html-reporter.ts` into CSS custom properties:

- **Colors**: `--color-pass` (#10b981), `--color-warn` (#f59e0b), `--color-fail` (#ef4444)
- **Backgrounds**: `--color-bg`, `--color-bg-elevated`, `--color-bg-hover`
- **Typography**: IBM Plex Sans (body), IBM Plex Mono (code)
- **Layout**: `--header-height: 64px`, `--sidebar-width: 260px`
- **Dark mode**: `[data-theme='dark']` overrides all token values

### Tailwind CSS v4

Uses the new Tailwind v4 syntax with `@theme {}` blocks for custom properties. The `@tailwindcss/vite` plugin handles the build integration.

### Electron-Specific CSS

```css
.drag-region  { -webkit-app-region: drag; }    /* Header is draggable */
.no-drag      { -webkit-app-region: no-drag; } /* Buttons inside header are clickable */
```

The macOS window uses `titleBarStyle: 'hiddenInset'` with traffic lights positioned at `(16, 16)`, which gives the native frameless look while keeping window controls.

---

## Build System

The app uses **electron-vite**, which runs three parallel Vite builds:

```
electron-vite build
  ├── main/index.ts      → dist-electron/main/index.js        (Node.js, ESM)
  ├── preload/index.ts   → dist-electron/preload/index.mjs    (Node.js, ESM)
  └── renderer/index.html → dist-electron/renderer/            (Browser, React+CSS)
```

Configuration in `electron/electron-vite.config.ts`:

- **Main**: Uses `externalizeDepsPlugin()` — all `node_modules` are left as external `require()` calls, not bundled. This is critical for native modules like `better-sqlite3`.
- **Preload**: Same externalization strategy.
- **Renderer**: Standard Vite build with React and Tailwind plugins.
- **Path aliases**: `@core` → `../src`, `@renderer` → `./renderer`

---

## Distribution & Packaging

### Configuration

Packaging is handled by **electron-builder** (v26.7.0), configured in `electron-builder.yml`:

| Setting | Value |
|---|---|
| `appId` | `com.seomator.desktop` |
| `productName` | `SEOmator` |
| `buildResources` | `electron/resources/` |
| `output` | `release/` |
| `asar` | `true` (with `.node` files unpacked) |

### Platform Targets

| Platform | Format | Notes |
|---|---|---|
| macOS | `.dmg` + `.zip` | Universal binary (Intel + Apple Silicon) |
| Windows | `.exe` (NSIS) | User-selectable install directory |
| Linux | `.AppImage` | Portable, no install needed |

### Scripts

```bash
npm run electron:icon       # Generate icon.png from scripts/generate-icon.mjs
npm run electron:pack       # Quick test build (unpacked .app directory)
npm run electron:dist       # Full distributable for current platform
npm run electron:dist:mac   # macOS .dmg + .zip
npm run electron:dist:win   # Windows .exe installer
```

### Icon Pipeline

1. `scripts/generate-icon.mjs` renders an HTML-designed icon using Playwright → `electron/resources/icon.png` (1024x1024)
2. electron-builder auto-converts the PNG to `.icns` (macOS) and `.ico` (Windows) at build time
3. To use a custom icon, replace `electron/resources/icon.png` with any 1024x1024+ PNG

### Native Module Handling

`better-sqlite3` is a C++ addon that must be compiled for the target Electron version:

1. `electron-builder install-app-deps` rebuilds native modules against Electron's Node.js headers
2. `asarUnpack: ["**/*.node"]` extracts compiled `.node` files from the asar archive (they can't be loaded from within an asar)

### Code Signing (Production)

For distribution outside your team:
- **macOS**: Requires an Apple Developer ID certificate + notarization. Add `CSC_LINK` and `CSC_KEY_PASSWORD` env vars, plus `notarize` config in `electron-builder.yml`.
- **Windows**: Requires an Authenticode code signing certificate. Add `CSC_LINK` and `CSC_KEY_PASSWORD` env vars.
- **Without signing**: Users see "unidentified developer" warnings. On macOS, users can bypass via right-click → Open.

---

## Development Workflow

```bash
# Start dev mode (Vite HMR + Electron hot reload)
npm run electron:dev

# In dev mode:
# - Renderer loads from Vite dev server (localhost:5173)
# - Main process restarts on file changes
# - DevTools open automatically
```

### Adding New IPC Channels

1. Define the channel name and payload types in `electron/shared/ipc-types.ts`
2. Add the handler in the relevant bridge (`audit-bridge.ts` or `db-bridge.ts`)
3. Expose it through the preload script (`electron/preload/index.ts`)
4. Call it from the renderer via `getAPI()` from `electron/renderer/lib/ipc-client.ts`

### Adding New Pages/Components

1. Create the component in `electron/renderer/components/`
2. If it needs IPC data, create a hook in `electron/renderer/hooks/`
3. If it needs shared state, extend the Zustand store in `electron/renderer/stores/audit-store.ts`
4. Add routing in `electron/renderer/App.tsx`

---

## Key Design Decisions

### Why No Changes to `src/`?

The Electron app is purely additive. The CLI and desktop app share the same `Auditor` class, rule registry, and scoring engine through direct imports (via the `@core` alias). This means:
- Bug fixes to rules automatically apply to both CLI and desktop.
- No sync issues between two codebases.
- The CLI remains independently publishable to npm.

### Why `send/on` Instead of `invoke/handle` for Audits?

Audits are long-running operations (5-30 seconds) with streaming progress updates. The `invoke/handle` pattern returns a single promise — it can't stream intermediate results. Using `send/on` lets us push 20+ category progress events to the renderer in real time, showing the user a live progress stream instead of a spinner.

Database queries use `invoke/handle` because they're simple request-response operations (query → rows).

### Why `contextBridge` Instead of `nodeIntegration: true`?

Security. With `nodeIntegration: true`, any XSS vulnerability in the renderer gives an attacker full Node.js access (file system, network, child processes). The `contextBridge` pattern ensures the renderer can only call the specific functions we expose — nothing more.

### Why `sandbox: false`?

`better-sqlite3` is a native C++ addon that uses Node.js N-API. Electron's sandbox restricts native module loading. Since the preload script needs to bridge to the main process (which loads `better-sqlite3`), the sandbox is disabled. The `contextBridge` still provides the security boundary.

### Why Zustand Over Redux/Context?

Zustand is 1KB, has zero boilerplate, and works perfectly for the audit state machine pattern. The store is a single flat object with actions — no reducers, no action types, no providers. It also supports subscriptions outside React (useful for future IPC patterns).

### Why Design Tokens from HTML Reporter?

The HTML report (`src/reporters/html-reporter.ts`) established the visual language — score colors, typography, spacing. Extracting those values into CSS custom properties in `globals.css` ensures the desktop app and HTML report look identical. Users see consistent branding across all output formats.
