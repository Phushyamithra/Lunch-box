# DEVELOPER_GUIDE.md — Working on LunchBox

## Setup & commands

```bash
npm install
npm run dev       # http://localhost:5173 in a normal tab
npm run build     # strict type-check + production build -> dist/
```

Dev mode runs in a browser tab: `createStorageAdapter()` detects the missing
`chrome.storage` and falls back to localStorage, so the whole app (except
Google sync and the app-window) is testable without loading the extension.

## Loading & debugging the extension

1. `npm run build` → `chrome://extensions` → Load unpacked → `dist/`.
2. App window: click the toolbar icon. DevTools: right-click inside the
   window → Inspect.
3. Service worker logs: `chrome://extensions` → LunchBox → "service worker".
4. After each rebuild press the ↻ reload button on the extension card.

## Testing OAuth & Google Tasks

- Config: see docs/PRODUCTION_SETUP.md (client ID, redirect URI).
- The exact redirect URI is displayed in Settings → Google Tasks Sync.
- Dev diagnostics: `npm run dev` builds keep `console.debug` logs from
  `GoogleTasksSyncService` (`[GoogleTasksSync] …`) — auth start, redirect
  URI, token receipt, API calls, refreshes, sync results. Production builds
  strip them.
- Manual test matrix: connect → create "Meal Tracker" list → enable →
  log meal (task appears completed) → delete log (task disappears) →
  Sync now (idempotent, no duplicates) → disconnect → reconnect.

## Inspecting storage

App-window DevTools console:
```js
chrome.storage.local.get(null, console.log)   // everything
chrome.storage.local.get('lunchbox.logs', console.log)
```
Dev tab: `localStorage` with the same `lunchbox.*` keys (JSON strings).

## Code conventions

- TypeScript strict; no `any`; `tsc --noEmit` must pass (build enforces it).
- No magic strings: keys in `STORAGE_KEYS`, config in `src/constants`.
- Layering (enforced by convention, see OPERATIONS_MANUAL.md):
  UI → AppDataContext → domain services → StorageService → StorageAdapter.
  UI never imports chrome.* or fetch-based APIs directly.
- Components: folder-per-feature under `src/components`; pages lazy-loaded.
- Errors: services throw user-friendly `Error(message)`; UI catches and
  shows snackbars. Never surface raw API errors.

## Branching & releases (suggested)

- `main` = releasable; feature branches `feat/…`, fixes `fix/…`.
- Release: bump versions (manifest, package.json, APP_VERSION) → build →
  smoke test → tag `vX.Y.Z` → distribute (see SHARING_AND_DISTRIBUTION.md).
