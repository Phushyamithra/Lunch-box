-- Rotating program (Upper → Lower → Push → Pull → Legs, not tied to weekdays)
-- and six slots per day. Additive: weekday programs and logged sets are
-- untouched; only limits widen and one setting is added.
--
-- * program_mode 'cycle': program days 1–5 run in order, whatever the
--   calendar says; 'weekday' (the default) keeps Mon–Sat.
-- * program slots 1–6 (was 1–5).
-- * set slot 41 holds program slot 6 (slot 6 already holds finisher sets).

alter table public.fitness_settings
  add column if not exists program_mode text not null default 'weekday';
alter table public.fitness_settings drop constraint if exists fitness_settings_program_mode_check;
alter table public.fitness_settings add constraint fitness_settings_program_mode_check check (program_mode in ('weekday', 'cycle'));

alter table public.program_slots drop constraint if exists program_slots_slot_check;
alter table public.program_slots add constraint program_slots_slot_check check (slot between 1 and 6);

alter table public.workout_sets drop constraint if exists workout_sets_slot_check;
alter table public.workout_sets add constraint workout_sets_slot_check check (slot between 1 and 41);
