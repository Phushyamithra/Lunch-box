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
- [~] **Phase 2 — Food.**
  - [x] 2a: `0002_food.sql` (categories, meals, meal_logs, food_settings,
    import_runs; RLS plus same-owner triggers). Extension backup import
    (preview, then confirm; idempotent through legacy ids; deleted meals kept
    as archived placeholders; Google Task ids preserved). Food page: log by
    search and tap, per-day view, undo, soft delete, week strip, catalog
    nutrition estimates, legacy goal progress. Shared logic moved into
    `src/core` (goals, logs, backup format).
  - [ ] 2b: meal catalog editing, per-order item caps with override
    history, milestone cycles (needs the cap answers).
- [ ] **Phase 3 — Fitness.**
- [ ] **Phase 4 — Finance** (encrypted sync).
- [ ] **Phase 5 — Home dashboard, polish, PWA install/offline.**

## Rollback

The extension and its `chrome.storage` data are never modified by the
migration. Imports copy data; they never move it. Take a backup
(Settings → Backup) before every import. Database changes are versioned
migrations.
