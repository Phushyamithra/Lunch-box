# 🥪 LunchBox — Daily Meal Logger

A Material You–inspired Chrome Extension for logging your daily lunch (Sandwiches, Salads & Smoothies), browsing meal history on a colorful calendar, tracking meal goals with achievements and confetti, and managing your meal catalog with Excel/CSV import & export.

Built with **React 18 · TypeScript (strict) · Vite · MUI v6 · Framer Motion · Day.js · SheetJS** on **Manifest V3**.

## Install the extension

A production build is already included in `dist/`.

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Pin **LunchBox** and click its icon — enter your email on first launch and start logging.

## Development

```bash
npm install
npm run dev      # runs in a browser tab; falls back to localStorage automatically
npm run build    # type-checks (strict) + builds the extension into dist/
```

After `npm run build`, reload the unpacked extension in `chrome://extensions`.

## Features

- Monthly calendar with today highlighted, month navigation, and category-colored emoji indicators on logged days.
- Two-step logging dialog (category → meal) with spring animations and a drawn-checkmark success state; edit or delete an existing log by clicking its day.
- Recent-meals summary that jumps (with a pulse) to the clicked calendar day.
- Manage Meals page: search, category filter, add/edit/delete with confirmation.
- Excel/CSV import with validation (required columns, valid categories, duplicate & invalid-row skipping) and an import summary; export to `.xlsx` or `.csv`.
- Light / Dark / System themes, persisted, respecting `prefers-color-scheme`.
- Keyboard navigation, ARIA labels, focus rings, friendly error snackbars.
- **Goals & Progress** card: animated circular ring for the 30-day logging goal plus per-category progress bars (counts, percentage, remaining) and dynamic motivational messages.
- **Achievements**: one-time celebrations with confetti when the day goal, a category goal, or the overall "Meal Balance" goal (all enabled category goals) is completed; badges persist afterwards.
- **Configurable goals** in Settings: total logged days (default 30), Sandwich (15), Salad (15), Smoothie (0 = disabled); persisted per device.
- **Smoothie category** 🥤 with starter meals, fully supported across logging, calendar, management, import and export (existing installs are migrated automatically).

## Architecture

```
src/
  models/       Domain types (Meal, MealLog, UserProfile, ThemeMode)
  constants/    Storage keys, category metadata, defaults — no magic strings
  services/
    storage/    StorageAdapter interface + Chrome/localStorage adapters
    StorageService.ts   Domain persistence facade (the ONLY data gateway)
    MealService.ts      Catalog business rules: seeding, validation, import
    GoalService.ts      Goal progress, achievement detection, motivation
    ThemeService.ts     Theme persistence + resolution
  context/      AppDataContext (state + write-through mutations),
                SnackbarContext, NavigationContext
  components/   Calendar, Header, MealDialog, MealCard, MealList, Goals
                (GoalsCard, ProgressRing, ProgressBar, Confetti,
                CelebrationDialog, GoalStepper), ThemeToggle, FAB,
                ImportExport, ManageMeals, common
  pages/        Dashboard, ManageMeals, Settings, Onboarding (lazy-loaded)
  theme/        Material You–inspired MUI themes (light + dark)
  utils/        date, id, spreadsheet (SheetJS, lazy-loaded chunk)
```

Key decisions:

- **Swappable backend.** UI → `AppDataContext` → `StorageService` → `StorageAdapter`. To move to Firebase/Supabase, implement one new adapter (or swap `StorageService` internals); nothing above changes. Logs are already keyed per-user email, so multi-user and cloud sync slot in cleanly.
- **Auth-ready.** The email form in `Onboarding` calls a single integration point (`saveEmail`). Replace it with Google Sign-In and populate the same `UserProfile`.
- **Logs reference meals by ID only** — names live solely in the catalog.
- **Performance.** Secondary pages and SheetJS (~425 KB) are code-split and loaded on demand; lists and the calendar are memoized.
- **Extensible categories.** Adding Breakfast/Dinner/Snacks = extending the `MEAL_CATEGORIES` tuple and `CATEGORY_META` — the UI, goals and import derive everything from those (Smoothie was added exactly this way, plus a one-time seed migration).
- **Extensible goals.** `GoalProgress` is derived (never persisted); only settings and awarded achievements are stored. New goal types (streaks, weekly goals, calories) = new fields in `GoalProgress` + detection in `GoalService.newlyEarned` + a card row. Achievements are recorded once with a timestamp, so celebrations can't re-trigger.

## Import format

| Meal Name       | Category |
| --------------- | -------- |
| Paneer Sandwich | Sandwich |
| Caesar Salad    | Salad    |

Accepted: `.xlsx`, `.xls`, `.csv`. Headers are case-insensitive (`Name`/`Meal Name`); categories tolerate plurals ("Sandwiches").
