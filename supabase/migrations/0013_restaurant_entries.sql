-- Nutrition, stage 5: restaurant meals in the food log.
-- Menus live in the app (official published values only); a logged meal is
-- an entry with source 'restaurant' and its own snapshot, so menu updates
-- never change past days. Widens the allowed sources; no rows change.

alter table public.food_log_entries drop constraint if exists food_log_entries_source_check;
alter table public.food_log_entries add constraint food_log_entries_source_check
  check (source in ('food', 'quick', 'meal_prep', 'restaurant'));
