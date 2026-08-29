<p align="center">
  <a href="README.md">简体中文</a> | <strong>English</strong>
</p>

This is currently a development test version, which may have various issues—please use with caution. The official release 1.0.0 will be available in future updates.

# dsh-openwiki

> A DSH plugin that brings [openwiki](https://github.com/langchain-ai/openwiki)'s codebase knowledge-base capability into DeepSeek Harness — generate / read / update repository Wiki and Grounded Claims (traceable knowledge cards) in one click, **reusing the model already configured in DSH**, no need to enter an API key again.

`dsh-openwiki` is a **Web-profile package plugin** for DeepSeek Harness (a Cordis all-plugin architecture): the Host half hosts the openwiki CLI runtime and drives generation jobs, while the Client half provides the knowledge-base entry, floating window, directory tree and document reading UI in the DSH main interface. The core idea is to **treat openwiki as an incremental generation engine** (CLI + disk-artifact contract); the DSH side owns UI, job orchestration, model bridging and triggers.

***

## 📑 Table of Contents

* [🚀 Installation](#-installation)

* [🛠️ Development & Maintenance](#-development--maintenance)

* [✨ Feature Overview](#-feature-overview)

* [🧱 Architecture](#-architecture)

* [🖼️ Feature Tour](#-feature-tour)

* [🧠 Key Logic](#-key-logic)

* [📡 RPC API](#-rpc-api)

* [⚠️ Known Limitations](#-known-limitations)

* [🧪 Verification Scripts](#-verification-scripts)

***

## 🚀 Installation

Prerequisites: Node ≥ 20, openwiki CLI (the plugin can install it automatically), DSH model + credentials configured.

### Option 1: npm package (recommended)

```powershell
dsh plugin --profile web add dsh-openwiki
```

### Option 2: Local source

```powershell
# 1. Get the source into any local directory (referred to as <source-dir> below)
git clone <repository-url> <source-dir>

# 2. Build the artifacts (lib/ and client/)
cd <source-dir>
npm run build

# 3. Install into the DSH web profile as a local directory
dsh plugin --profile web add <source-dir>
```

### Post-install configuration (same for both options)

```powershell
# Edit <your-DSH-user-dir>\profiles\web\cordis.patch.yml, append:
# - id: dsh-openwiki
#   name: 'dsh-openwiki'
# Restart dsh web
```

> Notes:
>
> * When installing from a local directory, `dsh plugin add` links the profile's `node_modules` entry to `<source-dir>` (pnpm's default behavior for directory installs); edit source + `npm run build`, then restart dsh web to load the new bundle
>
> * `dsh.profile.bundles` must include `dsh-openwiki` (dsh.client manifest: platform web, peerDependency schemastery)

***

## 🛠️ Development & Maintenance

### Directory Layout

```
<source-dir>/
├── src/host/index.js        # Host authoritative source (shared by dynamic & package forms)
├── src/client/index.js      # Client authoritative source
├── scripts/build-host.mjs   # → lib/index.js (ESM entry)
├── scripts/build-client.mjs # → client/client.js (ModuleLoader bundle)
├── lib/  client/            # build artifacts
├── tests/                   # Playwright / offline verification scripts + screenshots/
└── package.json             # dsh.client manifest (platform web)
```

<br />

### AI-Facing Notes

* **Build script rewrites**: build-host rewrites `harness.handle` → `rpc.handle` and injects `webServer`/`settings`; build-client rewrites `host.call` → `rpc.call`. Use `harness.handle(...)` for new Host handlers and `host.call(...)` for new Client interactions; the build adapts automatically.

* **readBytes limit**: `fs.readBytes` throws when the file exceeds maxBytes (it does not truncate) — read file heads with `readText` + slice.

* **Missing manifest is the norm**: all wiki reads must go through the disk-scan fallback (`readWikiTree`/`readWikiOverview`/`readWikiClaims`).

* **Shim EPERM**: on Windows do not spawn `.cmd`; parse the script path inside the shim and spawn node directly.

* **not found stays silent**: optional state files (`.page-manifest.json`/`.run.json`/`.last-update.json`) missing must not `console.error`, or polling will spam.

* **settings namespace**: `settings.register('openwiki', schema)` depends on `@deepseek-ai/schemastery`, whose dynamic import from the profile may fail (`settings namespace skipped`) — do not rely on it; use in-memory state + localStorage.

* **Client service registry is rebuilt on every refresh**: the better-sidebar registration must auto-re-register (autoRegisterSidebar), never depend on a user click.

* **openwiki has no git trigger**: auto-update relies on the plugin polling `git rev-parse HEAD`.

* **Non-git repos cannot be generated**: `startJob` pre-checks and returns a clear error.

* **Markdown rendering**: the fence detection must be `startsWith('```')` (see the hang lesson under «🧠 Key Logic»).

* **Performance**: idle polling only refreshes jobs + overview (lightweight); full `refreshWorkspace` only while a job is running — avoid a full disk scan every 3s.

***

## ✨ Feature Overview

* **📚 Knowledge-base entry**: the "openwiki知识库" entry above the "Settings" button in the DSH bottom-left (can be hidden, persisted in `localStorage`), opening a draggable/resizable **floating window**; plus a `conversation.view` session-view tab and a better-sidebar side page as two more embedded forms. **The workspace list is re-fetched whenever the knowledge base opens or the "Refresh" button is clicked** (a workspace added afterwards shows up without a page reload).

  ![Knowledge-base floating window](screenshots/readme-1-window.png)

* **🗂️ Dual-mode views**: two persistent tabs — `Open Wiki` (repo Wiki document tree) and `知识卡片` (Grounded Claims traceable points) — with selected highlight; plus "忽略文件" (ignore file) and "Refresh" buttons; the left column width is draggable.

  ![Left column, dual tabs and button row](screenshots/readme-4-left.png)

* **📄 Document reading**: preview / code dual views + **TOC split pane** (click "目录" to split a left TOC panel beneath the toolbar, with its own vertical scrollbar, sticky and not scrolling with the body; clicking an entry smooth-scrolls to the heading).

  ![Document reading (preview / code / TOC split)](screenshots/readme-2-doc.png)

  ![TOC split pane](screenshots/readme-3-toc.png)

* **🗂️ Knowledge cards**: Grounded Claims traceable points (statement + evidence), viewed from the "知识卡片" tab.

  ![Knowledge cards view](screenshots/readme-5-cards.png)

* **🔗 In-app link navigation**: internal md links (including `/openwiki/...` absolute paths) navigate within the app on click, never taking the browser to a `file://`; folder links (trailing `/`) enter folder browse.

* **⚡ Generation jobs**: generate / regenerate (incremental update) / cancel with live progress (`已完成 X/Y (Z%)，处理中: N，失败: M`), resumable via openwiki's `.run.json`; non-git repos get a clear error.

* **📊 Generation status card**: the right panel shows file count / success / failure / last update / document location (`openwiki/`) plus a "Regenerate" button.

* **🔌 Model reuse**: reads the DSH default model (`agentDefaultModel`) and credentials, maps them to openwiki provider config written to `~/.openwiki/.env` (openai-compatible / anthropic / gemini / openrouter).

* **🖥️ Runtime hosting**: auto-detects the openwiki CLI (parses the npm shim), version check (registry), install / upgrade / self-check (`--help`).

* **🔔 Auto-update**: polls the selected workspace's git HEAD; on a new commit it runs an incremental update (openwiki has no native git trigger, the plugin supplies it).

* **🧩 better-sidebar integration**: when the `dsh-better-sidebar` service is detected it **auto-registers** a side page (re-registered after refresh, effectively persistent); when not installed the settings page shows install guidance.

* **🛡️ Ignore file**: `.openwikiignore` (gitignore syntax) graphical editing and save.

* **⚙️ Settings page**: runtime / model / auto-update / better-sidebar registration / entry visibility.

  ![openwiki settings page](screenshots/readme-7-settings.png)

> 🔌 **Core idea**: openwiki is the CLI engine, DSH is the host. All state (`.page-manifest.json` / `.run.json` / `.last-update.json` / `.claims/` under the `openwiki/` directory) is a disk contract; the plugin only **reads + displays + triggers**, never touching the generation algorithm itself.

***

## 🧱 Architecture

### Dual Half Structure (Host / Client)

A Cordis plugin splits into two halves, each with **authoritative source code**, and build scripts produce the package artifacts:

| Half   | Authoritative source  | Build artifact                               | Responsibility                                                                                                          |
| ------ | --------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Host   | `src/host/index.js`   | `lib/index.js` (ESM entry)                   | openwiki runtime hosting, model bridging, generation jobs, wiki/claims disk reads, ignore file, auto-update, RPC server |
| Client | `src/client/index.js` | `client/client.js` (Web ModuleLoader bundle) | all UI: entry, floating window, directory tree, document rendering, settings page, better-sidebar registration          |

The build scripts (`scripts/build-host.mjs` / `build-client.mjs`) rewrite the free identifiers in the source into package form:

* Host: `harness.handle(` → `rpc.handle(`; `lib/index.js` injects hard deps `webServer`/`settings` and registers the same-origin JSON-RPC route `/dsh-openwiki/rpc`

* Client: `host.call(` → `rpc.call(` (`fetch('/dsh-openwiki/rpc', { headers: {'x-dsh-openwiki':'1'} })`); `styles.insert` → local `<style>` injection

> During development you can also run `src/` directly as a dynamic plugin via the cordis\_define/run flow of the "plugin development mode"; both forms share the same source.

### Communication Bridge (Client ↔ Host RPC)

```
Client bundle ──fetch──▶ /dsh-openwiki/rpc (webServer, kind: exact)
                          ├─ request header x-dsh-openwiki: 1 (CSRF guard; cross-origin cannot set it)
                          ├─ body: { method, args }
                          └─ response: JSON (handler return or { ok:false, error })
```

The Host side registers 20+ methods in a `handlers` Map (see «📡 RPC API»), all fiber-bound (`ctx.effect` auto-disposes).

### Client State Management (closure store)

The Client uses a lightweight subscription store (`createKbStore`, not Redux) holding all UI state; slot components subscribe via `useKb()`:

```
state = {
  open, runtime, model, busy, action, lastOutput,
  workspaces[], selected, overview, tree, page, claims, jobs[],
  tab ('wiki'|'cards'), search, tabs[] (document multi-tab), activeTab,
  browseDir, docView, tocOpen, showIgnore, ignoreContent, error,
  win {x,y,w,h,max}        ← floating-window geometry
  expandedDirs {}          ← tree collapse state
  sidebar, sidebarRegistered, showEntry,
  autoUpdate {enabled}
}
```

### Slot Registration (Client)

| Slot                    | id                    | Notes                                                                            |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `sidebar.footer.action` | `openwiki` (order 10) | entry above the bottom-left "Settings" button (hidden when `showEntry=false`)    |
| `shell.overlay`         | `openwiki-kb`         | floating window host (`.owk-win`, draggable/resizable/maximizable)               |
| `conversation.view`     | `openwiki` (order 20) | knowledge-base view tab in the conversation area                                 |
| `settings.section`      | `openwiki` (order 30) | settings page: runtime / model / auto-update / better-sidebar / entry visibility |

***

## 🖼️ Feature Tour

### Floating Window (`shell.overlay`)

The knowledge base is not a fullscreen layer but a **draggable/resizable window**, convenient for reading docs while chatting:

* Geometry lives in `kb.win {x,y,w,h,max}`; header `onMouseDown` starts dragging (document `mousemove/mouseup` follows), the bottom-right `.owk-win-resize` handle resizes (SE corner anchored), `□/▣` maximizes

* **Viewport clamp**: drag and resize both go through `clampWin(x,y,w,h)` — the window's top/left edge is always `>= 0` and size clamps to `360..vw` × `240..vh`, shrinking if larger than the viewport. This prevents dragging the title bar out of the browser top, which would make the window un-grabbable.

* Window z-index 99999; CSS in `.owk-win*`

* Close button sits beside the title (avoiding the better-sidebar top-right rail overlap)

### Dual-mode Tabs & Button Layout

* Left row 1: `Open Wiki` / `知识卡片` persistent tabs (`.owk-tab.sel` highlight, no emoji)

* Left row 2: `忽略文件` / `刷新`

* **Left width draggable**: `.owk-kb-resizer` divider (`col-resize` cursor) updates `kb.leftWidth` (clamped 220–520px, in-memory)

### Collapsible Directory Tree

* `buildTree(pages)` builds `{path, dirs{}, pages[]}` from relative paths; directory nodes carry a stable `path` key

* `expandedDirs {}` records collapse state (`toggleDir` toggles); `expandAllDirs` **expands everything by default** on tree load

* Sorting: root-level `index`/`quickstart` pages render above directories, the rest by title alphabetically

* Clicking a document → `openPage(path)` (keeps `.md` suffix; host falls back for extension-less input); clicking a directory → `browseDirectory` lists that folder's files on the right

### Document Reading & TOC Split

* Toolbar order **目录 / 预览 / 代码**; "目录" toggles `tocOpen`, splitting the area below the toolbar: left `.owk-toc-pane` TOC panel (`overflow-y: auto` own vertical scrollbar + `position: sticky` not scrolling with the body, `max-height: calc(100vh - 240px)`), right `.owk-doc-main` the document

* Clicking a TOC entry → `goToHeading(i)`: switch to preview, then `setTimeout` `scrollIntoView('owk-h-i')` (anchors numbered by `renderMarkdown` over h2–h4 order); the panel stays open for continuous jumps

* The code view shows the raw Markdown source

### In-App Link Navigation

md rendering (`renderInline`) renders internal links as `.owk-wiki-link` (intercepted via `onClick + preventDefault`):

```
href decision:
  http(s)/mailto/…  → new tab
  trailing "/" or /openwiki/xxx/ → browseDirectory (folder browse)
  otherwise → openWikiLink(href)
    ├─ strip /openwiki/ prefix (same convention as the host tree reader)
    ├─ absolute paths don't join the current page dir; relative ones do
    └─ normalize ./ ../ → openPage(target)
```

### Generation Jobs (Host `JobDriver`)

`startJob({workspaceId, mode, language})`:

1. **Pre-checks**: workspace exists, no concurrent job, `readGitHead` non-empty (non-git repo errors clearly), model bridge ready (writes `.env`), CLI resolvable
2. `subprocess.spawn(openwiki --init|--update -p -l <lang>)`, cwd = workspace path
3. Poll `openwiki/.run.json` every 2s (`readRunState`) for `phase/total/done/pending/failed`; on finish read `.last-update.json`
4. After completion, remove from the jobs Map after a 120s delay; the client polls `refreshJobs` every 3s
5. Client detects an error-status job → writes `kb.error` (prominent red message, avoiding "running then silently gone")

### Wiki Reads (manifest-missing fallback)

openwiki normally emits `.page-manifest.json`, but in an **edge case (init finalize mid-way) it is missing** — all reads then fall back to **recursive disk scan**:

| Data               | Source when manifest missing                                                            |
| ------------------ | --------------------------------------------------------------------------------------- |
| `readWikiTree`     | recursively scan `.md` under `openwiki/`, read each file's frontmatter title            |
| `readWikiOverview` | recursively count `.md` for `pageCount`/`successCount`; `failedCount` from the last run |
| `readWikiClaims`   | scan `openwiki/.claims/*.json` (matching the manifest page list)                        |

### Model Bridging (M2 core)

`buildOpenWikiEnv()`:

```
agentDefaultModel.currentSelection() → {provider, model}
  ├─ deepseek-official/deepseek → openai-compatible + DEEPSEEK_API_KEY
  └─ pi-ai providers[provider]   → map by api field: anthropic/gemini/openrouter/openai-compatible
credentials.resolve(apiKeyEnv)    → real Key (source: env/credentials.yaml/user-env)
applyEnvUpdates()                 → write ~/.openwiki/.env (only MANAGED_ENV_KEYS, preserve others)
```

### Auto-update (git HEAD polling)

openwiki has **no** git-commit trigger (no hook / no file watcher; only a daily CI cron workflow); DSH has no git hook service either. The plugin implements it itself:

* Host `startAutoUpdate(workspaceId)`: every 15s `readGitHead` (`git rev-parse --verify HEAD`), compare with the previous value; on change run `startJob({mode:'update'})` (incremental: openwiki regenerates only changed pages per `lastUpdate.gitHead` and `git diff`)

* Toggle on the settings "自动更新" card, via `openwiki/autoupdate/set|status` RPC

### better-sidebar Auto-registration

`ctx.get('betterSidebar')` is the client-side Cordis service provided by the better-sidebar plugin (`registerTab`/`getTabs`/…):

* **Auto-register**: at the end of `apply`, `timer.interval(400ms, ≤12 attempts)` polls until the service is present, then `registerTab({id:'openwiki', title, icon, order:50, single:true, component: SidebarKbView})`

* The client service registry is **rebuilt on every page load**, so auto-re-registering after refresh = "persistence"; the settings manual button is kept (idempotent, shows «已注册侧边页» after registering)

* When not detected the settings page shows install guidance and the repo URL

***

## 🧠 Key Logic

### Host (`src/host/index.js`)

| Area                                                                    | Line (approx)          | Notes                                                                                                                                     |
| ----------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `readText`                                                              | 24                     | unified file read; **not-found returns null silently** (optional state files missing is normal — avoid spam)                              |
| `resolveCli`                                                            | 47                     | resolve the openwiki executable: inside a Windows npm shim parse `node "%~dp0\...\cli.js"` and spawn node directly (spawning .cmd EPERMs) |
| `resolveNpm` / `readVersion` / `readLatest`                             | 105 / 137 / 152        | npm resolution, version read, registry latest (failures logged once)                                                                      |
| `runtimeStatus` / `install` / `update` / `ensure` / `probe`             | 217–272                | runtime status, npm install/upgrade, lazy ensure, `--help` self-check                                                                     |
| `buildOpenWikiEnv` / `applyEnvUpdates` / `readOpenWikiEnvStatus`        | 331 / 426 / 453        | model-bridge trio                                                                                                                         |
| `readGitHead` / `startAutoUpdate` / `stopAutoUpdate`                    | 484 / 500 / 492        | auto-update watcher                                                                                                                       |
| `startJob` / `killJob` / `jobStatus`                                    | 569 / 684 / 697        | generation job driver                                                                                                                     |
| `readWikiTree` / `readWikiPage` / `readWikiOverview` / `readWikiClaims` | 751 / 899 / 928 / 1008 | disk reads (incl. fallbacks)                                                                                                              |
| `readIgnore` / `saveIgnore`                                             | 1063 / 1072            | `.openwikiignore`                                                                                                                         |
| `workspaceOf` / `readRunState` / `readLastUpdate`                       | 525 / 535 / 558        | workspace resolution, `.run.json` progress, `.last-update.json`                                                                           |

**Security conventions**: `readWikiPage` sanitizes the path with `replace(/^\/+/,'').replace(/\.\./g,'')` against traversal; `saveIgnore` stays within the workspace path.

### Client (`src/client/index.js`)

| Area                                               | Line (approx)   | Notes                                               |
| -------------------------------------------------- | --------------- | --------------------------------------------------- |
| `createKbStore` / `useKb`                          | 14 / 72         | subscription store                                  |
| `openPage` / `browseDirectory` / `closeTab`        | 231 / 254 / 262 | document tabs, folder browse, close                 |
| `startJob` / `killJob`                             | 281 / 294       | job triggering (incl. git-check error pass-through) |
| `openWikiLink` / `renderInline` / `renderMarkdown` | 341 / 379 / 424 | lightweight Markdown render + in-app link nav       |
| `buildTree` / `expandAllDirs` / `renderTree`       | 558 / 578 / 592 | directory tree (collapse, index-first)              |
| `renderDoc` / `renderKb`                           | 676 / 778       | doc area (TOC split) / kb main panel                |
| `registerSidebarTab` / `autoRegisterSidebar`       | 1009 / 1037     | better-sidebar registration                         |
| `toggleShowEntry` / `SidebarKbView`                | 975 / 983       | entry visibility / side-page view                   |

**Markdown rendering note** (must-read for maintenance): `renderMarkdown`'s fenced block detection must be `line.startsWith('```')` (it used `/^```(\S*)\s*$/`, which fails for **space-containing info strings** like   ` ```ts type-equiv`; the line then fell into the paragraph branch and was excluded by `!/^```/` → `i` never advanced → **infinite loop hang**, fixed in M6.1).

***

## 📡 RPC API

All POST `/dsh-openwiki/rpc`, requires the `x-dsh-openwiki: 1` header. Client `call(method, args)` wraps it.

| Method                                          | Args                                              | Return highlights                                                                                          |
| ----------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `openwiki/runtime/status`                       | —                                                 | `{installed, version, latestVersion, hasUpdate, exePath, scriptPath, error}`                               |
| `openwiki/runtime/install` / `update` / `probe` | —                                                 | `{ok, version\|from\|to\|output}`; probe returns first 600 chars of `--help`                               |
| `openwiki/runtime/ensure` / `checkUpdate`       | —                                                 | lazy ensure / version compare                                                                              |
| `openwiki/model/status`                         | —                                                 | `{selection, owProvider, apiKeyEnv, keyConfigured, keySource, envExists, envProvider, envModel, warnings}` |
| `openwiki/model/sync`                           | —                                                 | performs the `.env` write                                                                                  |
| `openwiki/model/env`                            | —                                                 | managed env keys (secrets masked)                                                                          |
| `openwiki/workspaces`                           | —                                                 | `{workspaces:[{id,path,title}]}` (workspaceRegistry)                                                       |
| `openwiki/job/start`                            | `{workspaceId, mode('init'\|'update'), language}` | `{ok, jobId}`; non-git repo returns a clear error                                                          |
| `openwiki/job/kill`                             | `{workspaceId}`                                   | `{ok}`                                                                                                     |
| `openwiki/job/status`                           | —                                                 | `{jobs:[{jobId, workspaceId, status, phase, total, done, failed, message}]}`                               |
| `openwiki/wiki/tree`                            | `{workspaceId}`                                   | `{pages:[{path,title,status}], inProgress[], scanError}`                                                   |
| `openwiki/wiki/page`                            | `{workspaceId, path}`                             | `{content, frontmatter}` (extension-less input has a fallback)                                             |
| `openwiki/wiki/overview`                        | `{workspaceId}`                                   | `{pageCount, successCount, failedCount, wikiDirRelative, runActive, runPhase, runProgress, lastUpdate}`    |
| `openwiki/wiki/claims`                          | `{workspaceId}`                                   | `{claims:[{id,statement,evidenceCount,firstEvidence,page}]}`                                               |
| `openwiki/ignore/get` / `save`                  | `{workspaceId, content?}`                         | ignore-file read/write                                                                                     |
| `openwiki/autoupdate/set` / `status`            | `{workspaceId, enabled?}`                         | auto-update toggle / state                                                                                 |
| `openwiki/logs/tail`                            | —                                                 | placeholder (returns empty currently)                                                                      |

***

## ⚠️ Known Limitations

| Item                           | Notes                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| settings namespace persistence | the `openwiki` namespace registration depends on schemastery, whose dynamic import from the profile node\_modules may fail; actual config today uses in-memory state + localStorage, core features unaffected |
| `latestVersion`                | without a usable web provider `readLatest` returns null (logged once); "new version" hint empty                                                                                                               |
| Markdown rendering             | lightweight (headings/code blocks/tables/lists/quotes/inline), Mermaid fences shown as code blocks, no full Markdown dialects                                                                                 |
| personal mode                  | repository (code) mode only; non-git dirs cannot be generated (clear error)                                                                                                                                   |
| auto-update granularity        | HEAD polling every 15s, not instant; incremental update only after a new commit is detected                                                                                                                   |
| `openwiki/logs/tail`           | placeholder (returns empty); can later wire openwiki run logs                                                                                                                                                 |

***

## 🧪 Verification Scripts

| Script                                                                                                                   | Coverage                                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `tests/verify-host-entry.mjs`                                                                                            | Host entry offline test (name/inject/RPC route/auth/dispatch)                        |
| `tests/redesign-verify.mjs`                                                                                              | M4: floating window/dual tabs/collapse tree/in-link nav/settings (23 checks)         |
| `tests/link-nav-verify.mjs`                                                                                              | in-link navigation focus                                                             |
| `tests/sidebar-reg-verify.mjs`                                                                                           | better-sidebar manual registration focus                                             |
| `tests/autoreg-verify.mjs`                                                                                               | auto-register + refresh persistence focus                                            |
| `tests/round2-verify.mjs`                                                                                                | M5: button rename/order/right status card/folder browse/auto-update card (16 checks) |
| `tests/round3-verify.mjs`                                                                                                | M6: TOC split/two-row buttons/trae gen error (11 checks)                             |
| `tests/fixverify.mjs`                                                                                                    | status mislabel/left path/render regression                                          |
| `tests/verify-scan.mjs` / `verify-claims-scan.mjs` / `verify-frontmatter.mjs` / `verify-reader.mjs` / `verify-final.mjs` | offline parser verification                                                          |

Playwright usage: `$env:DSH_GUI_BASE='http://127.0.0.1:3081'; node tests/<script>.mjs` (headless Chrome + playwright-core, `createRequire('C:/nvm4w/nodejs/package.json')`).

***

*This document was compiled from the plugin development process for later maintenance and AI-assisted development; interface contracts are subject to source code and live Cordis Inspect Provider queries.*
