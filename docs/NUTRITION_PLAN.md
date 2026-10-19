# Nutrition module: audit and staged plan

Status: **plan only, nothing built yet.** Written 2026-10-19 on branch `dev`.

## 1. What exists today

| Area | Where | What it does | Gap for nutrition |
|---|---|---|---|
| Lean-bulk targets | `fitness_settings` (0005) | kcal 2450, protein 140–150, fat 55–75, carbs 295, gain 0.4 (0.2–0.6) kg/month, phase 9 months | One set of values, no history of changes, no goal modes, no estimate from age/height/activity |
| Weight-trend rules | `web/src/fitness/rules.ts` (`weeklyAverages`, `gainRate`, `assessGain`) | Weekly averages at the trend time (≥3 weigh-ins/week), >0.6 → about −100 kcal (fat first), <0.2 after ≥4 weeks → about +100 kcal (carbs first), away periods excluded, suggestion only | Already matches the brief. Needs an "apply" step that asks first and saves a new target version |
| Waist | `waist_measurements`, every 14 days, separate trend | | Already matches |
| Away mode | `away_periods` | Excluded from trends and adherence | Food logs inside away periods must be flagged the same way |
| Diet check-in | `diet_days` (tag on plan / partial / event, optional kcal estimate) | Manual daily tag | Becomes a fallback when no food is logged that day; never overwritten by computed totals |
| Food (lunch box) | `meals`, `meal_logs`, plans and caps (0002–0004) | Meal catalogue **with kcal / protein / carbs / fibre / fat per meal**; one tap logs order + eating; per-item caps | **Totals are computed live from the meal row**, so editing a meal rewrites past days. No grams or portions. `kind` separates ordered and consumed; `external_task_id` keeps Google Tasks traceable |
| Legacy goal targets | `food_settings.goal_settings` (from the extension) | Old calorie and protein goals | A second, older set of targets. It must not be used once nutrition targets exist |
| Import | `import_runs`, extension JSON import | Idempotent via `legacy_id` | No CSV, no versioned export schema yet |

## 2. Conflicts and problems found

1. **The lean-bulk preset does not add up.** With 4 / 4 / 9 kcal per gram:

   | Protein | Fat | Carbs | Total | Gap to 2450 |
   |---|---|---|---|---|
   | 145 (mid) | 65 (mid) | 295 | 2345 | −105 |
   | 140 (low) | 55 (low) | 295 | 2235 | −215 |
   | 150 (high) | 75 (high) | 295 | 2455 | +5 |

   295 g of carbs only works when protein and fat are both at the top of their ranges. Proposed fix: carbs become the remainder, `(kcal − 4·P − 9·F) / 4`, using one chosen point for protein and fat. At the midpoints (145 g, 65 g) that is **≈ 321 g carbs**. The app will show this discrepancy and the fix, and won't change anything until you confirm.
2. **History isn't stable in Food today.** Lunch-box totals come from the current meal values (acceptance criterion 8 fails). Every new log entry will store a snapshot of its nutrients. Old lunch-box logs need a one-time backfill using the meal values as they are now; earlier edits can't be recovered. This writes to production data, so it **needs your approval** when we get there.
3. **Three places hold targets** (`fitness_settings`, `food_settings.goal_settings` and the new engine). Plan: one `nutrition_targets` table with dated versions. Fitness reads from it. The old columns stay untouched, so rolling back is possible.
4. **Two kinds of "food":**
   - lunch-box orders with caps;
   - the full nutrition log.

   To avoid double logging, a lunch-box tap will also add one entry to the nutrition log, linked to that log, so the meal is never logged twice. Ordered-only or planned items, and Google Tasks, never count as eaten.
5. **The Goals placeholder said "Phase 2"** (stale). It now says Phase 5.

## 3. Data sources: what is real and what isn't

Research on 2026-10-19:

- **Indian staples:** *Indian Food Composition Tables 2017* (NIN-ICMR) cover 528 raw foods. The book is copyrighted, and I found no open-data licence ([NIN PDF](https://nin.res.in/ebooks/IFCT2017.pdf), [community package](https://github.com/ifct2017/ifct2017.github.io)). For a private, single-user app the plan is:
  - Use IFCT values for ingredients.
  - Compute cooked dishes (dal, sabzi, poha, biryani…) from recipes, labelled **estimated**, with household portions (katori, roti, ladle) shown in grams.
  - Confirm NIN's terms before this is shared with anyone.
- **Packaged products:**
  - Lookup order: your own library first, then the Open Food Facts API (open data, has Indian barcodes but patchy coverage), then manual entry from the label.
  - Only the barcode is sent out.
- **Restaurants:** nothing is labelled *official* unless it comes from the chain's own published data. Each item stores its source URL and the date it was captured.

  | Chain | What I found |
  |---|---|
  | Pizza Hut India | Publishes FSSAI nutrition PDFs per slice or portion ([example](https://www.pizzahut.co.in/order/pdfs/in/nutritionals.2602cddd8cb981ebba811b2951cfad28.pdf)) |
  | McDonald's India | Said in 2022 it would show nutrition in-store and in the McDelivery app ([report](https://www.udayavani.com/english-news/mcdonalds-india-to-display-allergen-nutritional-info-for-entire-menu)). No public file found yet; to source during Stage 5 |
  | Domino's India, Subway India, California Burrito India | No official Indian data found. Items will be **estimated** (built from ingredients) or entered by you, and clearly marked. Third-party figures (e.g. FatSecret) are never labelled official |

## 4. Engine design (summary)

- **Estimating maintenance calories:**
  - BMR uses Mifflin–St Jeor. Inputs: sex, age, height, current weekly-average weight.
  - Maintenance = BMR × activity factor. The factor comes from your job/steps level plus the training days in your program, not from per-workout calorie burns.
  - The app labels this an *estimate* and recalibrates it from your intake and weight trend once 3–4 weeks of data exist.
- **Goal modes:** deficit, maintenance, recomposition, lean bulk and custom. Weight-change rate → kcal/day using about 7700 kcal/kg for loss; lean bulk uses the configured surplus.
- **Macros:**
  - Protein in g/kg, with a range and one target point.
  - Fat as a range and a point.
  - Carbs = the remainder, so calories and macros always agree.
  - The difference between label energy and calculated energy is shown and tolerated (±5%).
- **Explaining and changing targets:** every suggested target shows its working. You can edit it, and nothing changes when you log food. Each target change is saved as a new version with a date, so past adherence keeps the targets that applied then.
- **Lean-bulk preset:**
  - Default values: 0.4 kg/month, 8–10 months, the protein and fat ranges above, carbs as the remainder.
  - Has its own dashboard.
  - The existing 0.6 / 0.2 rules gain an "Apply −100 kcal (fat first)" or "+100 kcal (carbs first)" button that asks before changing anything.

## 5. Proposed new tables (all additive, RLS on every table)

- **`nutrition_profile`:** sex, birth year, height, activity level.
- **`nutrition_targets`:** versioned. Mode, kcal, protein/fat ranges and points, carbs, fibre, `effective_from`, reason.
- **`foods`:**
  - Shared reference rows (IFCT, curated, restaurant) are readable by everyone and editable by no user.
  - Your own rows: custom foods, products, edited copies.
  - Each row has: nutrients per 100 g/ml, source, `verification` (official / estimated / user), `parent_food_id` for edited versions (the original is never changed), `source_url`, `captured_at`.
- **`food_portions`:** household units → grams.
- **`food_barcodes`**
- **`recipes`, `recipe_items`**
- **`food_log_entries`:**
  - Day, meal slot, `food_id`, quantity, unit, grams.
  - A **snapshot of the nutrients**, so history never changes.
  - Source, `meal_log_id` (the lunch-box link), soft delete.
- **`meal_logs` (existing):** gets snapshot columns, backfilled only after your approval.

## 6. Stages (each one: tests → migration tested in PGlite → preview check → push to `dev`)

1. **Engine and targets:**
   - Pure calculation code with tests.
   - Profile, goal modes and versioned targets.
   - The lean-bulk preset with its carbs fix.
   - A "why this target" screen.
2. **Food log core:**
   - Entries with nutrient snapshots.
   - Daily dashboard: kcal, protein, carbs, fat, fibre, remaining and meal-by-meal.
   - Lunch-box link.
3. **Indian food database:**
   - Staples and dishes, veg / vegan / egg / non-veg filters, household portions.
   - Search, favourites and frequent foods.
   - Custom foods and recipes.
4. **Barcodes:** camera scan (BarcodeDetector, with a ZXing fallback for iPhone), manual entry, Open Food Facts lookup, label entry, personal library.
5. **Restaurants:**
   - Indian menus, official vs estimated.
   - Customise, copy, and save as your own version.
   - A clear "can't calculate exactly" note when it applies.
6. **Trends and adjustments:**
   - Weekly and monthly adherence and protein adherence.
   - Optional protein spread across meals.
   - The confirm-to-apply button for the weight-trend suggestions.
   - Away and incomplete days handled honestly.
7. **Import and export:** versioned JSON backup and restore, CSV for logs / foods / recipes / restaurant versions, preview, duplicate detection, clear errors.

Regression run after every stage: all existing Vitest suites, the PGlite migration checks, and a click-through of Food, Fitness and Home in the preview. Nothing goes to production (`main`) without your approval.

## 7. Decisions (answered 2026-10-19)

1. **Separate module, "Nutrition"**, for logging what you eat. Food becomes
   **Meal prep**: it tracks what the meal-prep service delivered and when,
   and moves to the end of the nav. The two stay separate: a delivery is
   never counted as eaten automatically. Nutrition gets an explicit
   "add from meal prep" that copies the meal's values as a snapshot and
   remembers the link, so the same delivery can't be added twice.
2. **Lean-bulk carbs stay at 295 g.** The preset is an ideal day, not a
   daily rule. The app shows that 2,450 kcal sits inside what your ranges
   allow (2,235–2,455 kcal) and notes the midpoint gap, without changing
   anything. New targets from other modes use carbs as the remainder.
3. **Android (Pixel 9):** Chrome's built-in BarcodeDetector covers camera
   scanning; manual entry stays as the fallback. No extra scanner library.
4. **Order:** Nutrition (Phase 4) → Goals (Phase 5) → Finance (Phase 6) →
   polish (Phase 7).
5. **IFCT 2017 values are OK** for this private app. If the app is ever
   shared with others, check NIN's terms first.
6. Old meal-prep logs: no backfill needed. Meal prep stays a delivery log;
   nutrition copies a delivery's values only when you add it (stage 2).
7. Profile inputs (sex, age, height, activity) are entered in the app.

## 8. Progress

- **Stage 1 (done):** `0008_nutrition_targets.sql`, engine and tests,
  Targets screen with the working shown, lean-bulk dashboard with
  confirm-to-apply trend changes.
- **Stage 2 (done):** `0009_food_log.sql` (foods with per-100 g/ml or
  per-serving values and household portions; food log entries with nutrient
  snapshots; one-time link to a meal-prep delivery; owner checks).
  - **Today:** totals against the targets in force that day, what's left,
    the protein and fat ranges, meal by meal, remove with undo.
  - **Add sheet:** search your foods, frequent foods, quick add, meal prep.
  - **My foods:** create, edit and archive; edits never change past days.
- **Stage 3 (done):** `0010_indian_foods.sql` adds 188 shared foods,
  generated by `web/scripts/gen-reference-foods.ts` from
  `web/src/nutrition/reference/`. Regenerate it after changing the catalog;
  re-running the SQL updates the foods in place, and logged days keep their
  snapshots.
  - **100 ingredients (official):** from IFCT 2017 (`ifct.ts`, extracted
    from @ifct2017/compositions 2.0.9) and USDA FoodData Central for
    staples IFCT lacks (`usda.ts`): sugar, butter, curd, cream, honey, oats,
    peanut butter, soya.
  - **88 dishes (estimated):** each from a typical home recipe (raw grams →
    cooked weight), with the recipe shown and household portions in grams.
    Salt isn't counted.
  - **IFCT calories:** worked out from the macros (4/9/4, plus 2 per gram
    of fibre), because the package's own energy column is inconsistent for
    some foods.
  - **Search:** English, Hindi and regional names; a Veg / +Egg / All filter;
    browse by category.
  - **"Make my version":** saves an edited copy linked to the original
    (`parent_food_id`); the original never changes.
