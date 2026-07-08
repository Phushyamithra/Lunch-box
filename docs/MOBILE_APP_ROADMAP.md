# MOBILE_APP_ROADMAP.md — From Chrome Extension to Cross-Platform App

## Recommended stack

**Primary recommendation: React Native + Expo (TypeScript).**
Rationale: ~70% of this codebase is already platform-independent TypeScript
(models, services, analytics); React knowledge, component mental model and
even Framer-Motion-style animation (Moti/Reanimated) transfer directly.
Expo gives OTA updates, push notifications, secure storage and store builds
without native toolchain pain.

Alternatives considered:
- **Flutter** — excellent UI fidelity, but zero code reuse (Dart) and a
  second design system to maintain.
- **Kotlin (Android) + Swift (iOS)** — best native integration, highest
  cost: two codebases, zero reuse. Only worth it if deep OS integration
  (widgets, watch apps) becomes the product focus.

## What is already portable (move to a shared core package)

| Module | Portability | Notes |
| --- | --- | --- |
| `models/` | ✅ 100% | Pure types |
| `constants/` (keys, category meta) | ✅ | Emoji work everywhere |
| `NutritionService`, `InsightService`, `GoalService` | ✅ | Pure functions over data |
| `MealService`, `CategoryService` | ✅ | Depend only on StorageService interface |
| `StorageService` | ✅ | Already built on a swappable `StorageAdapter` — mobile implements an AsyncStorage/SQLite adapter |
| `GoogleTasksSyncService` | ◐ | HTTP layer portable; replace `chrome.identity` with `expo-auth-session` behind an `AuthProvider` interface |
| `utils/` (date, icons, id) | ✅ | `spreadsheet.ts` works with SheetJS on RN via file pickers |
| UI (`components/`, `pages/`) | ✖ | Rebuild in RN; keep the same component names/props for parity |

Target structure (monorepo):
```
packages/
  core/          models, constants, services, utils  (no DOM, no chrome.*)
  extension/     current app (imports core)
  mobile/        Expo app (imports core)
  backend/       optional sync API (see below)
```
Extraction steps: (1) move the table's ✅ modules into `packages/core`,
(2) define `StorageAdapter` + `AuthProvider` + `Clock` interfaces there,
(3) each platform supplies implementations. The extension already satisfies
this shape — extraction is mostly file moves + import paths.

## Backend evolution (shared data for extension + mobile)

Today: device-local `chrome.storage`, keyed by email, one-way Google Tasks
mirror. Evolution path:

1. **Phase 1 (now)** — local-first stays; Google Tasks is the visibility layer.
2. **Phase 2** — introduce a sync API (Supabase or Firebase are both fine;
   Supabase/Postgres maps cleanly to the existing entities):
   tables `users`, `meals`, `categories`, `logs`, `goals`, `achievements`
   mirroring `src/models`. Auth: Google Sign-In (the local email identity
   was designed to be replaced — `saveEmail` is the single integration point).
3. **Phase 3** — offline-first sync: keep local storage as cache, add
   `updatedAt` + tombstones to entities, last-write-wins per record, queue
   outbound mutations (the fire-and-forget hook pattern used for Tasks sync
   generalizes to this). Both platforms share the sync engine in `core`.
4. **Data migration**: on first cloud sign-in, upload the local store
   (export already exists), then switch reads to cache-then-network.

## Mobile-specific features

- Push notifications / meal reminders: `expo-notifications`; schedule from
  goal progress (core exposes "next milestone" — already computed).
- Offline support: ships free with the local-first design.
- Design system: port the Material You theme tokens (colors, radii,
  category metadata) into a shared `theme` module in core; RN Paper or
  custom components consume the same tokens.
- Navigation: React Navigation with the same page names
  (Dashboard/Analytics/Meals/Categories/Settings) for muscle-memory parity.

## Suggested sequence

1. Extract `packages/core` (1–2 days, mechanical).
2. Expo shell + storage adapter + Dashboard/log flow (MVP).
3. Google auth via expo-auth-session reusing GoogleTasksSyncService HTTP layer.
4. Backend (Supabase) + sync engine; extension adopts the same engine.
5. Notifications, widgets, wearables as product demands.
