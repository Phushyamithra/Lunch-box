-- Nutrition, stage 1: profile + versioned calorie/macro targets.
--  * nutrition_profile: inputs for the maintenance estimate.
--  * nutrition_targets: every saved target is a new row with the date it
--    applies from, so past days are always judged against the targets in
--    force then. Rows are never edited in place by the app.
-- Additive only: fitness_settings keeps its columns (read-only fallback).

create table if not exists public.nutrition_profile (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sex         text not null check (sex in ('male', 'female')),
  birth_year  smallint not null check (birth_year between 1920 and 2015),
  height_cm   numeric not null check (height_cm between 120 and 230),
  activity    text not null check (activity in ('sedentary', 'light', 'moderate', 'very', 'extra')),
  updated_at  timestamptz not null default now()
);

create table if not exists public.nutrition_targets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from  date not null,
  mode            text not null check (mode in ('deficit', 'maintenance', 'recomp', 'lean_bulk', 'custom')),
  -- Desired change in kg/month (+ bulk, − deficit); null when not relevant.
  rate_kg_month   numeric check (rate_kg_month between -4 and 2),
  kcal            integer not null check (kcal between 1000 and 6000),
  protein_min     numeric not null check (protein_min >= 0),
  protein_max     numeric not null,
  protein_g       numeric not null,
  fat_min         numeric not null check (fat_min >= 0),
  fat_max         numeric not null,
  fat_g           numeric not null,
  carbs_g         numeric not null check (carbs_g >= 0),
  fibre_g         numeric not null default 0 check (fibre_g >= 0),
  -- Why this version exists ("Lean-bulk preset", "Weight trend: −100 kcal", "Edited").
  reason          text not null default '' check (length(reason) <= 200),
  -- The estimate's inputs at the time (weight, BMR, activity…), for "why this target".
  inputs          jsonb not null default '{}'::jsonb check (jsonb_typeof(inputs) = 'object'),
  created_at      timestamptz not null default now(),
  check (protein_min <= protein_g and protein_g <= protein_max),
  check (fat_min <= fat_g and fat_g <= fat_max)
);
create index if not exists nutrition_targets_user_from on public.nutrition_targets (user_id, effective_from desc, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['nutrition_profile', 'nutrition_targets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ': own rows', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || ': own rows', t);
  end loop;
end $$;
