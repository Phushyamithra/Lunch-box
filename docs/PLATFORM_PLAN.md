# PLATFORM_PLAN.md — From LunchBox extension to a personal tracking platform

Living record of the audit, the decisions taken, and phase status.

## Audit summary (2026-10-18)

- **What exists:** an MV3 Chrome extension loaded unpacked. No hosting, no
  production URL. React 18 + Vite 5 + TypeScript (strict) + MUI 6.
- **Storage:** `chrome.storage.local` behind `StorageAdapter`
  (`lunchbox.*` keys). Logs are `email → date → MealLog[]`. Identity is a
  typed-in email; there is no real auth.
- **Google Tasks:** one-way push (extension → Tasks). One completed task per
  log, `logId → taskId` map prevents duplicates. No import. Implicit-grant
  OAuth via `chrome.identity` (extension-only API).
- **Completion:** every log counts as a completed meal. `GoalService`
  counts logs per category and distinct logged days against targets.
  Achievements are one-time timestamps; there are no cycles.
- **Known issues:** deleting a log while sync is off leaves its task
  orphaned; `xlsx@0.18.5` on npm is unmaintained with known advisories.

## Decisions

| Topic | Decision |
| --- | --- |
| Delivery | New hosted PWA alongside the extension. The extension stays untouched until the PWA reaches parity. |
| Hosting | Vercel (free tier), with preview deployments per branch. |
| UI stack | Keep MUI; add Recharts for charts and Vitest for tests. No Tailwind. |
| Food data | Moves to Supabase so every device sees it. One-time import from the extension's JSON backup. |
| Fitness data | Supabase, email magic-link auth, Row Level Security. |
| Finance data | Synced through Supabase **end-to-end encrypted**: records are encrypted in the browser with a key derived from a passphrase only you know, so the database stores ciphertext only. Phone is the primary device. IndexedDB remains the local store; JSON backup/restore stays. Forgetting the passphrase means the cloud copy is unrecoverable (local backups still work). |
| Item caps | Per item, with the tracking period set to a specific **order** (plus date ranges / recurring periods). Counts are derived from logs, never stored, so resets cannot delete history. |
| Google Tasks | Low priority now that data is cross-device. Keep the existing push; no import. |
| Steps | Google Fit APIs are deprecated; Health Connect has no web API. Manual entry, labelled as such (re-verify before the fitness phase). |
| Signing key | Repo will be made private. Key untracked from now on (still in earlier history). Extension is unpacked-only, so no rotation needed. |

## Phases

- [x] **Phase 0 — Safety.** `dev` branch; signing key untracked; full JSON
  backup in Settings → Backup; Vitest with characterization tests of the
  existing behavior (goal counting, legacy-log migration, log upserts,
  catalog import, Tasks sync dedupe, backup/validation).
- [x] **Phase 1 — Foundation (code).** `web/` PWA named **Tracker** (own calm palette: cream, peach, rose, charcoal; shares the extension's
  models); bottom nav (phone) and side rail (laptop); dark by
  default; Supabase magic link plus 6-digit code sign-in; `app_settings`
  table with RLS and last-write-wins sync; installable, with an offline
  app shell; `vercel.json`. See `docs/WEB_APP_SETUP.md`. **Not yet done:**
  creating the Supabase project and Vercel deployment (your accounts), and
  a real two-device sign-in test. Moving shared services into `core` is
  deferred to phase 2, when the food services move to Supabase.
- [x] **Phase 2 — Food.**
  - [x] 2a: `0002_food.sql` (categories, meals, meal_logs, food_settings,
    import_runs; RLS plus same-owner triggers). Extension backup import
    (preview, then confirm; idempotent through legacy ids; deleted meals kept
    as archived placeholders; Google Task ids preserved). Food page: log by
    search and tap, per-day view, undo, soft delete, week strip, catalog
    nutrition estimates, legacy goal progress. Shared logic moved into
    `src/core` (goals, logs, backup format).
  - [x] 2b: `0003_meal_plans.sql`. A meal plan holds a quota per category
    (for example 20 salads and 20 sandwiches) plus a cap per item (one
    default, editable per item). Logging is the order and the meal in one
    tap. Logging past a cap or quota is blocked unless you override it,
    and every override is stored with an optional reason and shown as
    "Over limit". The plan completes by itself when every quota is met, or
    by force; undoing the final log reopens an automatic completion. Past
    plans stay in history, and counts are always derived from the logs.
    Also: a meal catalog to add, edit and archive meals, and a month
    calendar.
  - [ ] Shared milestone system (Goals module): plan completions and goal
    cycles in one history.
- [x] **Phase 3 — Fitness.** `0005_fitness.sql` (9 tables, RLS, set
  ownership trigger; checked in PGlite). Rules in `web/src/fitness/rules.ts`
  with 19 tests:
  - weekly averages of daily means; a week counts with 3 or more weighed days
  - gain rate from about 4 weeks of weekly averages; current week excluded
  - verdicts: on track, fast (−100 kcal, fat first), slow after a full
    month (+100 kcal, carbs), or slow so far (wait)
  - away periods excluded from trends and adherence, labelled, with the
    date full-week trends resume
  - waist: baseline, 14-day reminder, composition signal (indicative)
  - weekly V1–V7 rotation with manual shift; adherence out of 6 minus away
    days; event days kept apart in diet adherence; key lifts tracked per
    exact exercise

  Screens: Today, Dashboard (Recharts), Training, Program, Review, Targets
  & away.
  - Effortless logging (`0006_fitness_logging.sql`): Program → import the
    Daily Reference markdown (6 days × 5 slots × V1–V7 default/fallback,
    set counts, finishers, day focus, baseline date, steps target, key
    lifts derived from your exercise names). Today shows every exercise as
    pre-filled set rows (last time → previous set → starting-weight preset);
    ± nudges, one tap to log, rest timer (compound vs isolation), automatic
    slot/session progress, finishers, cardio toggle. Trends use morning
    weigh-ins only; change measured from the baseline. Steps are manual entry: the Google Fit APIs are closed to new
  developers and shut down in 2026, and Health Connect is on-device only.
  - Flexible days and reminders (`0007_flexible_days_reminders.sql`):
    pick a variant per day from swipeable cards (the next variant after the
    last one trained on that weekday is suggested), switch any single
    exercise to another variant ("mixed"), make your own workout cards
    (custom_workouts, soft delete), add exercises to a day on the spot,
    weekly muscle coverage. Trend switch mornings/evenings with matching
    checklists. Reminders: "Due today" on Today and Home (weigh-in days,
    waist every N days, monthly review) and a downloadable .ics with
    repeating alarms. Page and card animations (reduced-motion respected).
- [ ] **Phase 4 — Nutrition** (separate module; see `docs/NUTRITION_PLAN.md`).
  Stages: 1 engine and targets → 2 food log → 3 Indian foods → 4 barcodes
  → 5 restaurants → 6 trends and adjustments → 7 import/export.
  Food is renamed **Meal prep** (tracks the meal-prep deliveries) and moves
  to the end of the nav.
- [x] **Phase 5 — Goals.** Shared milestones across Fitness, Nutrition and
  Meal prep (daily / weekly / monthly / one-off, cycle history, timeline;
  extension achievements carried over). Comes before Finance so goals can
  use the fitness and nutrition data already in place.
  See `docs/GOALS_PLAN.md`. Stages 1 (engine, `0014_goals.sql`, Goals page), 2 (timeline) and
  3 (Home, due list, report) are done.
- [ ] **Phase 6 — Finance** (encrypted sync, phone primary). See
  `docs/FINANCE_PLAN.md`; stage 1 (foundation, `0015_finance_vault.sql`) done.
- [ ] **Phase 7 — Home dashboard, polish, PWA install/offline.**

## Rollback

The extension and its `chrome.storage` data are never modified by the
migration. Imports copy data; they never move it. Take a backup
(Settings → Backup) before every import. Database changes are versioned
migrations.
