# LunchBox — Operating Manual

> Audience: humans AND AI coding agents maintaining this project.
> Read this before changing anything. Keep it updated when behavior changes.

## machine-readable summary

```yaml
project: lunchbox-chrome-extension
version: 1.3.0
stack: [react18, typescript-strict, vite5, mui6, framer-motion, dayjs, sheetjs, manifest-v3]
entry_points:
  app_page: index.html -> src/main.tsx        # opened in an app window, NOT a toolbar popup
  service_worker: src/background.ts -> dist/background.js   # window management
build:
  install: npm install
  dev: npm run dev                            # browser tab; localStorage adapter
  build: npm run build                        # tsc strict + vite -> dist/
  load: chrome://extensions -> Load unpacked -> dist/
extension_id: gghekejecnlabppaolhgkgpljilnjbnp                          # PINNED via manifest "key" — never changes
oauth:
  api: chrome.identity.launchWebAuthFlow      # NOT getAuthToken (fails: "Custom URI scheme")
  grant: implicit (response_type=token)
  client_type: Web application                # in Google Cloud Console
  redirect_uri: https://gghekejecnlabppaolhgkgpljilnjbnp.chromiumapp.org/   # generated via chrome.identity.getRedirectURL()
  scopes: [https://www.googleapis.com/auth/tasks, https://www.googleapis.com/auth/userinfo.email]
  required_api: Google Tasks API (enable in Cloud Console)
  token_storage: chrome.storage.local (key lunchbox.sync.token) + in-memory cache
data_keys:                                    # all under chrome.storage.local
  user: lunchbox.user
  meals: lunchbox.meals                       # Meal[] with nutrition + icon
  logs: lunchbox.logs                         # email -> date -> MealLog[]  (ARRAY per day)
  goals: lunchbox.goals
  achievements: lunchbox.achievements         # email -> id -> awardedAt
  sync_settings: lunchbox.sync
  sync_task_map: lunchbox.sync.tasks          # email -> logId -> googleTaskId
  sync_token: lunchbox.sync.token
invariants:
  - UI never touches chrome.storage directly; only via StorageService
  - UI never calls Google APIs directly; only via GoogleTasksSyncService
  - logs reference meals by id; categories are open strings (getCategoryMeta fallback)
  - one Google Task per MealLog id; upsert by stored task id (no duplicates)
  - extension is source of truth; sync is one-way (extension -> Google Tasks)
  - background sync never opens auth UI; only user-initiated actions may
```

## Architecture map

| Layer | Files | Responsibility |
| --- | --- | --- |
| Models | `src/models/` | Types only. `MealLog` has unique `id`; days hold arrays of logs. |
| Constants | `src/constants/` | Storage keys, `getCategoryMeta` (known + generated fallback), nutrient meta. |
| Storage | `src/services/storage/` + `StorageService.ts` | The ONLY gateway to chrome.storage (localStorage in dev). Includes legacy-shape migration for logs. |
| Domain | `MealService` (catalog/seeding/import), `GoalService` (progress/achievements), `NutritionService` + `InsightService` (pure analytics) | Business rules; nothing here touches UI or network. |
| Sync | `GoogleTasksSyncService.ts` | ALL auth + Google Tasks I/O. Dev-only logging via `import.meta.env.DEV`. |
| State | `src/context/AppDataContext.tsx` | In-memory mirror + write-through mutations; fires best-effort sync hooks. |
| UI | `src/components/`, `src/pages/` | Render derived data only. |
| Window | `src/background.ts` | Opens/focuses the centered app window (chrome.windows). |

## Google Tasks sync — setup & troubleshooting

One-time Google Cloud Console setup (project owner):
1. Enable **Google Tasks API** (APIs & Services → Library).
2. OAuth consent screen: External, add the user under **Test users**.
3. Credentials → Create OAuth client ID → type **Web application** →
   Authorized redirect URI: `https://gghekejecnlabppaolhgkgpljilnjbnp.chromiumapp.org/` (exact, with trailing slash).
4. Put the client ID in `public/manifest.json` → `oauth2.client_id`, rebuild (or edit `dist/manifest.json` too), reload extension.

The live redirect URI is always displayed in Settings → Google Tasks Sync.

| Symptom | Cause | Fix |
| --- | --- | --- |
| 400 "malformed" on connect | Placeholder client ID | Set real client ID in manifest |
| "Custom URI scheme is not supported" | Using `getAuthToken` / Chrome-App client | Already fixed: we use `launchWebAuthFlow` + Web client |
| 400 redirect_uri_mismatch | Console URI ≠ `getRedirectURL()` (extension ID drifted) | ID is now pinned via manifest `key`; register the URI above once |
| 403 access_denied | Account not in Test users | Add account to Test users |
| 403 "API has not been used" | Tasks API disabled | Enable Google Tasks API |
| "User interaction required" | Silent token refresh needs UI | Fixed: persisted tokens + interactive escalation on user actions; press "Sync now" |

## History of incidents (why things are the way they are)

1. **v1.2 OAuth**: started with `chrome.identity.getAuthToken` → "Custom URI
   scheme is not supported on Chrome apps" → switched to `launchWebAuthFlow`
   with a Web-application client. Do not switch back.
2. **"User interaction required"**: in-memory tokens died with every popup
   restart and silent refresh needed interaction → tokens now persist in
   storage; user-initiated calls escalate to interactive auth; background
   calls fail softly with a reconnect hint.
3. **redirect_uri_mismatch (v1.3)**: the unpacked extension ID changed
   (IDs derive from the install path unless pinned), invalidating the
   registered redirect URI → manifest `key` added; ID is now permanently
   `gghekejecnlabppaolhgkgpljilnjbnp`. The keypair lives in `keys/extension-key.pem`
   (needed only for future .crx packaging; do not delete or regenerate,
   or the ID — and the OAuth registration — breaks again).
4. **Multiple meals/day (v1.2.x)**: logs migrated from one-per-day objects
   to arrays; legacy logs get `id = date`, matching old task-map keys.
   `StorageService.normalizeUserLogs` handles old data forever — keep it.

## Rules for future agents

- Never hardcode redirect URIs, extension IDs, or client IDs in code — the
  client ID lives in the manifest; the redirect URI comes from
  `chrome.identity.getRedirectURL()`.
- Never regenerate `keys/extension-key.pem` or remove `manifest.key`.
- Any new persisted data: add a key in `STORAGE_KEYS`, accessors in
  `StorageService`, logic in a domain service — never in components.
- New meal categories require ZERO code changes (verify `getCategoryMeta`).
- Build must pass `tsc --noEmit` (strict) with zero errors before shipping.
- `dist/` is the loadable artifact; rebuild it after any change and keep
  `manifest.json` (client_id + key) intact.
