-- Flexible training days + reminders.
--  * Pick a variant per day (not per week), and mix: any slot can use another
--    variant (workout_sessions.slot_variants, {"3": 1} = slot 3 uses V2).
--  * Your own workout cards (custom_workouts), and extra exercises added to a
--    day on the spot (workout_sessions.extras).
--    Set slots: 1–5 program, 6 finishers, 7–20 custom card, 21–40 extras.
--  * Reminder settings (weigh-in days and time, waist, monthly review).
-- Additive only: no existing row is changed or removed.

create table if not exists public.custom_workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  -- Day of the week it is offered on (Mon = 1); null = every day.
  weekday     smallint check (weekday between 1 and 7),
  -- [{"label": "Upper Chest", "exercise": "Incline DB Press / Incline Barbell", "sets": 3, "reps": "8–10"}]
  exercises   jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) <= 14),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists custom_workouts_user on public.custom_workouts (user_id) where deleted_at is null;

alter table public.custom_workouts enable row level security;
create policy "custom_workouts: own rows" on public.custom_workouts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.workout_sessions
  add column if not exists slot_variants      jsonb not null default '{}'::jsonb check (jsonb_typeof(slot_variants) = 'object'),
  add column if not exists custom_workout_id  uuid references public.custom_workouts (id) on delete set null,
  -- [{"label": "Extra", "exercise": "Cable Fly", "sets": 3}]
  add column if not exists extras             jsonb not null default '[]'::jsonb check (jsonb_typeof(extras) = 'array' and jsonb_array_length(extras) <= 20);

alter table public.workout_sessions drop constraint if exists workout_sessions_slots_completed_check;
alter table public.workout_sessions add constraint workout_sessions_slots_completed_check check (slots_completed between 0 and 40);

alter table public.workout_sets drop constraint if exists workout_sets_slot_check;
alter table public.workout_sets add constraint workout_sets_slot_check check (slot between 1 and 40);

-- A session may only use a custom workout of the same user.
create or replace function public.fitness_check_session_workout_owner() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.custom_workout_id is not null and not exists (
    select 1 from public.custom_workouts w where w.id = new.custom_workout_id and w.user_id = new.user_id
  ) then
    raise exception 'custom workout does not belong to this user';
  end if;
  return new;
end $$;

drop trigger if exists workout_sessions_workout_owner on public.workout_sessions;
create trigger workout_sessions_workout_owner before insert or update on public.workout_sessions
  for each row execute function public.fitness_check_session_workout_owner();

-- {"weigh_days": [1,3,5], "weigh_time": "18:30", "waist_time": "18:30", "review_day": 17}
alter table public.fitness_settings
  add column if not exists reminders jsonb not null default
    '{"weigh_days": [1, 3, 5], "weigh_time": "18:30", "waist_time": "18:30", "review_day": 17}'::jsonb
    check (jsonb_typeof(reminders) = 'object');
