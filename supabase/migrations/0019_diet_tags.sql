-- Fitness: diet tags in more detail. Run once in the Supabase SQL Editor.
--
-- The Diet card used to have On plan / Partial / Event. Partial mixed up
-- eating a bit under, a bit over and a long way off, so it now says which:
--   on_plan  On track        within ±10% of the day's calories, protein met
--   under    Below target    10–25% under, or calories fine but protein short
--   over     Slightly above  10–25% over
--   way_off  Way off         more than 25% under or over
--   event    Event / travel  kept out of adherence
-- 'partial' stays allowed so days tagged before keep their tag.
-- Widens the allowed values only; no rows change. Safe to re-run.

alter table public.diet_days drop constraint if exists diet_days_tag_check;
alter table public.diet_days add constraint diet_days_tag_check
  check (tag in ('on_plan', 'under', 'over', 'way_off', 'partial', 'event'));
