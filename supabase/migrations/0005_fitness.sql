-- Fitness module: lean-bulk tracking. Every table is owned by one user and
-- locked to that user by RLS. Measurements are never edited in place by
-- trend logic; away status is derived from away_periods at read time, so
-- editing an away period re-labels history consistently.

-- Targets and program settings (one row per user; all values editable).
create table if not exists public.fitness_settings (
  user_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  gain_target_kg_month  numeric not null default 0.4,
  gain_high_kg_month    numeric not null default 0.6,  -- above: suggest −100 kcal (fat first)
  gain_low_kg_month     numeric not null default 0.2,  -- below after a full month: suggest +100 kcal (carbs)
  kcal_target           integer not null default 2450,
  protein_min_g         integer not null default 140,
  protein_max_g         integer not null default 150,
  fat_min_g             integer not null default 55,
  fat_max_g             integer not null default 75,
  carbs_target_g        integer not null default 295,
  waist_interval_days   integer not null default 14 check (waist_interval_days between 1 and 90),
  -- Monday of the week that uses V1; manual advances add to the offset.
  rotation_start        date not null default (date_trunc('week', current_date))::date,
  rotation_offset       integer not null default 0,
  phase_start           date not null default current_date,
  phase_months          integer not null default 9 check (phase_months between 1 and 24),
  -- Key lifts: [{"label": "Bench / chest press", "exercises": ["Bench press", ...]}]
  key_lifts             jsonb not null default '[
    {"label": "Bench / chest press", "exercises": ["Bench press", "Chest press"]},
    {"label": "Row / pulldown", "exercises": ["Barbell row", "Lat pulldown"]},
    {"label": "Squat / leg press", "exercises": ["Squat", "Leg press"]},
    {"label": "Shoulder press", "exercises": ["Shoulder press"]},
    {"label": "Romanian deadlift", "exercises": ["Romanian deadlift"]}
  ]'::jsonb,
  updated_at            timestamptz not null default now(),
  check (protein_min_g <= protein_max_g and fat_min_g <= fat_max_g)
);

create table if not exists public.weigh_ins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day          date not null,
  measured_at  timestamptz not null default now(),
  time_of_day  text not null default 'evening' check (time_of_day in ('morning', 'afternoon', 'evening', 'night')),
  weight_kg    numeric not null check (weight_kg between 20 and 300),
  notes        text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists weigh_ins_user_day on public.weigh_ins (user_id, day);

create table if not exists public.waist_measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  waist_cm    numeric not null check (waist_cm between 30 and 250),
  notes       text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists waist_user_day on public.waist_measurements (user_id, day);

create table if not exists public.away_periods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  label       text,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.diet_days (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day           date not null,
  tag           text not null check (tag in ('on_plan', 'partial', 'event')),
  kcal_estimate integer check (kcal_estimate is null or kcal_estimate between 0 and 10000),
  notes         text,
  updated_at    timestamptz not null default now(),
  unique (user_id, day)
);

create table if not exists public.step_counts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  steps       integer not null check (steps between 0 and 200000),
  -- Where the number came from; 'manual' until an integration exists.
  source      text not null default 'manual',
  updated_at  timestamptz not null default now(),
  unique (user_id, day)
);

-- Program: Mon (1) – Sat (6), five numbered slots, seven variants each.
create table if not exists public.program_slots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday       smallint not null check (weekday between 1 and 6),
  slot          smallint not null check (slot between 1 and 5),
  label         text not null default '',
  default_sets  smallint not null default 3 check (default_sets between 1 and 6),
  variants      text[] not null default array['', '', '', '', '', '', '']
                check (array_length(variants, 1) = 7),
  updated_at    timestamptz not null default now(),
  unique (user_id, weekday, slot)
);

-- One check-in per day. The variant in use is stored, so history keeps
-- what was actually done even after the program changes.
create table if not exists public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day              date not null,
  variant_index    smallint not null check (variant_index between 0 and 6),
  completed        boolean not null default false,
  slots_completed  smallint not null default 0 check (slots_completed between 0 and 5),
  notes            text,
  updated_at       timestamptz not null default now(),
  unique (user_id, day)
);

create table if not exists public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id  uuid not null references public.workout_sessions (id) on delete cascade,
  slot        smallint not null check (slot between 1 and 5),
  exercise    text not null check (length(trim(exercise)) > 0),  -- snapshot of what was done
  set_number  smallint not null check (set_number between 1 and 20),
  reps        smallint not null check (reps between 0 and 200),
  weight_kg   numeric not null default 0 check (weight_kg between 0 and 1000),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists workout_sets_session on public.workout_sets (session_id);

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['fitness_settings', 'weigh_ins', 'waist_measurements', 'away_periods', 'diet_days',
                           'step_counts', 'program_slots', 'workout_sessions', 'workout_sets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || ': own rows', t);
  end loop;
end $$;

-- A set may only belong to a session of the same user. (A dedicated
-- function per table: no column is referenced on a table that lacks it.)
create or replace function public.fitness_check_set_owner() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.workout_sessions s where s.id = new.session_id and s.user_id = new.user_id) then
    raise exception 'session does not belong to this user';
  end if;
  return new;
end $$;

create trigger workout_sets_owner before insert or update on public.workout_sets
  for each row execute function public.fitness_check_set_owner();
