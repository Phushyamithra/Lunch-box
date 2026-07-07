# 🥪 LunchBox — Meal & Nutrition Tracker

A Material You–inspired Chrome Extension that logs your daily meals with full nutritional information, tracks configurable goals with gamified achievements, shows nutrition analytics, and optionally mirrors every logged meal to Google Tasks (which syncs to your Android devices).

Built with **React 18 · TypeScript (strict) · Vite · MUI v6 · Framer Motion · Day.js · SheetJS** on **Manifest V3**.

## Install the extension

A production build is already included in `dist/`.

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Click the LunchBox toolbar icon — the app opens as a **centered application window** (560×800, reused/focused if already open) instead of a toolbar popup. Enter your email on first launch and start logging.

The extension ID is pinned via the manifest `key` to `gghekejecnlabppaolhgkgpljilnjbnp`, so OAuth configuration never breaks when the extension is reloaded or moved. See `OPERATING_MANUAL.md` for architecture, sync setup and troubleshooting.

## Development

```bash
npm install
npm run dev      # runs in a browser tab; falls back to localStorage automatically
npm run build    # type-checks (strict) + builds the extension into dist/
```

## Features

- **Bundled default meal database** — 38 meals (Salads, Sandwiches, Beverages) seeded automatically on first launch from the included workbook (`public/data/default-meals.xlsx`, preserved verbatim), each with calories, protein, carbs, fiber and fat. Existing installs are migrated: nutrition is backfilled where names match and new meals are merged without ever overwriting user meals.
- **Automatic meal icons** — assigned from the meal name (🥭 Mango…, 🍫 Choco…, 🥑 Avocado…) with category fallback, shown consistently across the calendar, meal picker, summaries, analytics, goals and management screens.
- **Nutrition everywhere** — selecting a meal shows a Material nutrition card; lists show calories at a glance.
- **Analytics page** — daily / weekly / monthly summaries, smart insights from real data, category distribution, and animated 14-day trend charts for each nutrient.
- **Four goals + achievements** — logged-days goal plus per-category goals (all configurable in Settings; new categories appear automatically). One-time celebrations with confetti, including 🏆 **Nutrition Champion** when every configured goal is complete.
- **Excel/CSV import & export** — `.xlsx`, `.xls`, `.xlsm`, `.csv`. Merge-only imports (duplicates skipped, invalid rows reported, blanks ignored, nutrition defaulting to 0). Macro-enabled workbooks are detected, flagged, archived verbatim and their VBA is **never executed**. Exports use the same column layout as the default workbook.
- **Google Tasks sync (optional, one-way)** — every logged meal becomes a *completed* task (title = icon + name; notes = category + nutrition + logged date) in a task list of your choice or an auto-created **Meal Tracker** list. Edits update the task, deletions remove it, never duplicating. First enable asks whether to sync history; Settings offers connect/disconnect, list selection, sync now, last-sync time and status. The extension is the source of truth — changes in Google Tasks never flow back.
- Monthly calendar, recent-meals summary, Light/Dark/System themes, keyboard navigation and ARIA labels — all carried forward from earlier versions.

### Google Tasks setup (one-time)

Sync uses `chrome.identity.launchWebAuthFlow` with a standard **Web application** OAuth client (NOT the "Chrome extension" client type — that path fails with "Custom URI scheme is not supported"):

1. In Google Cloud Console, enable the **Google Tasks API**.
2. Configure the OAuth consent screen (External) and add yourself under **Test users**.
3. Create an **OAuth client ID** of type **Web application** and add this **Authorized redirect URI**: `https://gghekejecnlabppaolhgkgpljilnjbnp.chromiumapp.org/` (the extension ID is pinned by the manifest `key`, so this URI is permanent; it is also shown in Settings → Google Tasks Sync).
4. Put the client ID into `manifest.json` → `oauth2.client_id` (both `public/` and `dist/`) and reload the extension.

Scopes requested: Google Tasks + account email (shown in Settings). Full troubleshooting matrix in `OPERATING_MANUAL.md`.

## Architecture

```
src/
  data/         defaultMeals.ts — generated from the bundled workbook
  models/       Domain types (Meal + Nutrition, logs, goals, sync)
  constants/    Storage keys, category metadata (getCategoryMeta — known +
                generated fallback so NEW categories need zero code changes)
  services/
    storage/    StorageAdapter interface + Chrome/localStorage adapters
    StorageService.ts        Persistence facade (the ONLY data gateway)
    MealService.ts           Seeding/migration, validation, import shaping
    GoalService.ts           Goal progress, achievements, motivation
    NutritionService.ts      Summaries, breakdowns, trends (pure derivation)
    InsightService.ts        Smart insights from real data only
    GoogleTasksSyncService.ts Auth, task lists, completed-task CRUD, retry
    ThemeService.ts           Theme persistence + resolution
  context/      AppDataContext (state + write-through mutations),
                SnackbarContext, NavigationContext
  components/   Calendar, Header, MealDialog, MealCard, MealList, Goals,
                Nutrition, Analytics, Sync, ImportExport, ManageMeals, common
  pages/        Dashboard, Analytics, ManageMeals, Settings, Onboarding
  theme/        Material You–inspired MUI themes (light + dark)
  utils/        date, id, icons (auto-assignment), spreadsheet (lazy chunk)
```

Key decisions:

- **Open categories.** `category` is a string; `getCategoryMeta` supplies curated metadata for known categories and a stable generated fallback for anything new (the bundled workbook's "Beverage" category exercises this). Goals, filters, pickers and analytics all derive categories from live data.
- **Swappable backend.** UI → context → services → `StorageAdapter`; one new adapter moves everything to Firebase/Supabase.
- **Sync is isolated.** Only `GoogleTasksSyncService` touches the Google Tasks API; the UI and data layer know nothing about it beyond fire-and-forget hooks in log mutations.
- **Derived, never persisted.** Goal progress, analytics and insights are recomputed from logs; only settings, achievements and the task-id map are stored.
- **Performance.** Secondary pages + SheetJS are code-split; lists, calendar and charts are memoized.

## Import format

| Type | Item Name | Calories (kcal) | Protein (g) | Carbs (g) | Fiber (g) | Fat (g) |
| ---- | --------- | --------------- | ----------- | --------- | --------- | ------- |
| Salad | Greek Salad | 280 | 11 | 18 | 6 | 14 |

Headers are matched case-insensitively; the legacy two-column format (`Meal Name` / `Category`) still works, with nutrition defaulting to 0. Categories tolerate plurals; unknown categories are created automatically.
