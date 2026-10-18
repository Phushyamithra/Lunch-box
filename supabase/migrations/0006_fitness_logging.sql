-- Faster logging + the bulk reference file.
--  * exercise_presets: last-used (or starting) weight × reps per exercise,
--    used to pre-fill every set row.
--  * finishers (abs / forearms) logged as slot 6.
--  * cardio check per day, steps target, weigh-in time used for trends,
--    rest times, day focus labels and finisher definitions.

alter table public.fitness_settings
  add column if not exists weigh_time            text not null default 'morning'
    check (weigh_time in ('morning', 'afternoon', 'evening', 'night', 'any')),
  add column if not exists steps_target          integer not null default 10000 check (steps_target between 0 and 100000),
  add column if not exists cardio_per_week       integer not null default 3 check (cardio_per_week between 0 and 14),
  add column if not exists rest_compound_sec     integer not null default 150 check (rest_compound_sec between 15 and 600),
  add column if not exists rest_isolation_sec    integer not null default 75 check (rest_isolation_sec between 15 and 600),
  -- {"1": "Chest + Triceps", ...} (Mon = 1)
  add column if not exists day_focus             jsonb not null default '{}'::jsonb,
  -- [{"name": "Abs", "days": [1,3,5], "exercises": [{"name": "...", "sets": 3, "reps": "10–15"}]}]
  add column if not exists finishers             jsonb not null default '[]'::jsonb;

alter table public.workout_sessions
  add column if not exists cardio_done boolean not null default false;

-- Slot 6 holds finisher sets.
alter table public.workout_sets drop constraint if exists workout_sets_slot_check;
alter table public.workout_sets add constraint workout_sets_slot_check check (slot between 1 and 6);

create table if not exists public.exercise_presets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise      text not null check (length(trim(exercise)) > 0),
  exercise_key  text generated always as (lower(trim(exercise))) stored,
  weight_kg     numeric not null default 0 check (weight_kg between 0 and 1000),
  reps          smallint not null default 8 check (reps between 0 and 200),
  updated_at    timestamptz not null default now(),
  unique (user_id, exercise_key)
);

alter table public.exercise_presets enable row level security;
create policy "exercise_presets: own rows" on public.exercise_presets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
