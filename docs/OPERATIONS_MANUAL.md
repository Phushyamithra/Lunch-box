# OPERATIONS_MANUAL.md — Maintaining LunchBox

The complete maintainer handbook. Machine-readable quick reference lives in
`OPERATING_MANUAL.md` (repo root); this document is the narrative version.
Companion docs: DEVELOPER_GUIDE, PRODUCTION_SETUP, CHROME_WEBSTORE_PUBLISHING,
SHARING_AND_DISTRIBUTION, MOBILE_APP_ROADMAP.

## 1. Project overview

LunchBox (v1.4.0) is a Manifest V3 Chrome extension for meal & nutrition
tracking: calendar logging (multiple meals/day), a nutrition-rich meal
catalog seeded from a bundled Excel workbook, fully user-managed categories
with icons, configurable goals with achievements, analytics/insights,
Excel import/export, Light/Dark/System theming, and optional one-way
Google Tasks sync. It opens as a centered app window (not a toolbar popup).

## 2. Folder structure

```
public/manifest.json   MV3 manifest: pinned "key", oauth2 client, background SW
public/data/           bundled default-meals workbook (verbatim)
keys/extension-key.pem private key matching manifest "key" (crx packaging)
src/
  background.ts        app-window management (service worker)
  models/              domain types (Meal, MealLog[], Category, goals, sync)
  constants/           STORAGE_KEYS, getCategoryMeta + overrides registry
  data/defaultMeals.ts generated seed data (from the workbook)
  services/            StorageService (ONLY storage gateway) + domain services
  context/             AppDataContext (state), Snackbar, Navigation
  components/, pages/  UI (pages lazy-loaded)
  theme/, utils/, styles/
docs/                  this documentation set
dist/                  build output = the loadable extension
```

## 3. Data flow

User action → page/component → `useAppData()` mutation → domain service
(validation/rules) → `StorageService` → `StorageAdapter`
(chrome.storage.local; localStorage in dev). State is mirrored in memory,
so UI updates instantly; Google Tasks sync fires as a best-effort hook
after log mutations. Everything displayed (goal progress, analytics,
insights, category metadata) is DERIVED, never persisted.

## 4. Subsystem notes

- **Storage**: every key in `STORAGE_KEYS`. Logs: `email → date → MealLog[]`
  (legacy one-log-per-day objects are normalized on read — keep
  `normalizeUserLogs` forever). Migration flags: `lunchbox.seeded*`.
- **Categories**: entities `{id,name,icon,color,order,enabled}` in
  `lunchbox.categories`. Meals reference categories BY NAME → renames
  propagate to meals + goal targets (see `updateCategory` in context).
  `registerCategoryOverrides` feeds `getCategoryMeta`, which every
  component uses — custom icons/colors appear app-wide automatically.
  Deletion always asks: move meals or delete them.
- **Meals**: `MealService` — workbook seeding + migrations, duplicate
  detection (name+category), nutrition sanitization (numeric, ≥0, default 0),
  auto icon assignment (`utils/icons.ts`).
- **Goals**: `GoalService.computeProgress(logs, mealById, settings,
  enabledCategoryNames)`; achievements awarded once (timestamps in storage);
  first check after load is silent (no confetti replay).
- **OAuth / Tasks sync**: see OPERATING_MANUAL.md §sync + PRODUCTION_SETUP.
  Extension ID pinned to `gghekejecnlabppaolhgkgpljilnjbnp`; task map
  `email → logId → taskId` guarantees no duplicates; one-way sync only.
- **Excel import**: `.xlsx/.xls/.xlsm/.csv`; both header formats
  (Type/Item Name and Category/Meal Name); macro workbooks flagged,
  archived, never executed; merge-only.
- **Analytics/Insights**: pure derivations in NutritionService/InsightService.

## 5. Routine operations

- **Updating default meals**: replace `public/data/default-meals.xlsx`,
  regenerate `src/data/defaultMeals.ts` (same columns; ids `meal_%03d`),
  and add a new seeding flag (e.g. `lunchbox.seeded.workbook2`) with a
  merge migration in `MealService.ensureSeeded` — never overwrite user meals.
- **Backups**: users can export the catalog (xlsx/csv). Full backup =
  DevTools `chrome.storage.local.get(null)` dump; restore via `set`.
  A first-class backup/restore UI is a good future improvement.
- **Releasing**: PRODUCTION_SETUP.md §5 checklist.

## 6. Troubleshooting

| Symptom | Likely cause → fix |
| --- | --- |
| Window doesn't open on icon click | Service worker error — inspect via chrome://extensions |
| OAuth 400 malformed / invalid_client | Wrong/placeholder client_id in dist manifest |
| redirect_uri_mismatch | Console URI ≠ `https://gghekejecnlabppaolhgkgpljilnjbnp.chromiumapp.org/` |
| 403 access_denied | Account missing from consent-screen Test users |
| 403 "API has not been used" | Enable Google Tasks API |
| "session expired" status | Press Sync now (interactive re-auth) |
| Meals show 🍽️ icon | Category entity missing — open Manage Categories (auto-backfills) |
| Data "gone" after re-adding extension | Extension ID change = fresh storage; ID is pinned now, so only removal/re-add of a DIFFERENT key causes this |

Recovery: storage is plain JSON — dump, edit, restore via DevTools as above.
Never edit `lunchbox.sync.tasks` unless cleaning orphaned task links.

## 7. Future improvements (known backlog)

Backup/restore UI · streaks & weekly goals (GoalService is shaped for it) ·
calorie targets · cloud sync (MOBILE_APP_ROADMAP phases) · i18n ·
drag-and-drop category reorder · per-meal serving sizes.
