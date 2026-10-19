-- Nutrition, stage 2: foods and the daily food log.
--  * foods: nutrients per 100 g, per 100 ml or per serving. user_id null =
--    shared reference food (Indian database, menus: added in later stages,
--    read-only for users); otherwise your own food or edited copy.
--  * food_log_entries: what you ate. Each row stores a snapshot of its
--    nutrients, so editing a food never rewrites past days.
--    meal_log_id links a meal-prep delivery you chose to add (once only).
-- Additive only.

create table if not exists public.foods (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (length(trim(name)) between 1 and 120),
  brand           text check (brand is null or length(brand) <= 80),
  diet            text check (diet in ('veg', 'vegan', 'egg', 'nonveg')),
  basis           text not null default '100g' check (basis in ('100g', '100ml', 'serving')),
  serving_g       numeric check (serving_g is null or serving_g > 0),
  -- [{"label": "1 katori", "grams": 150}]
  portions        jsonb not null default '[]'::jsonb check (jsonb_typeof(portions) = 'array'),
  kcal            numeric not null check (kcal >= 0),
  protein         numeric not null default 0 check (protein >= 0),
  carbs           numeric not null default 0 check (carbs >= 0),
  fat             numeric not null default 0 check (fat >= 0),
  fibre           numeric not null default 0 check (fibre >= 0),
  sugar           numeric check (sugar is null or sugar >= 0),
  sodium_mg       numeric check (sodium_mg is null or sodium_mg >= 0),
  -- Where the values came from: user, ifct, curated, off, restaurant, estimate.
  source          text not null default 'user',
  verification    text not null default 'user' check (verification in ('official', 'estimated', 'user')),
  -- Your edited version of another food; the original stays as it was.
  parent_food_id  uuid references public.foods (id) on delete set null,
  source_url      text,
  captured_at     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);
create index if not exists foods_user on public.foods (user_id) where archived_at is null;
create index if not exists foods_name on public.foods (lower(name));

alter table public.foods enable row level security;
drop policy if exists "foods: read own and shared" on public.foods;
create policy "foods: read own and shared" on public.foods for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists "foods: write own" on public.foods;
create policy "foods: write own" on public.foods for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "foods: update own" on public.foods;
create policy "foods: update own" on public.foods for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "foods: delete own" on public.foods;
create policy "foods: delete own" on public.foods for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.food_log_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day           date not null,
  meal          text not null check (meal in ('breakfast', 'lunch', 'snacks', 'dinner')),
  food_id       uuid references public.foods (id) on delete set null,
  meal_log_id   uuid references public.meal_logs (id) on delete set null,
  source        text not null check (source in ('food', 'quick', 'meal_prep')),
  -- Snapshot: name, amount and nutrients as logged.
  name          text not null check (length(trim(name)) between 1 and 160),
  quantity      numeric not null check (quantity > 0),
  unit          text not null check (length(unit) between 1 and 60),
  grams         numeric check (grams is null or grams >= 0),
  kcal          numeric not null check (kcal >= 0),
  protein       numeric not null default 0 check (protein >= 0),
  carbs         numeric not null default 0 check (carbs >= 0),
  fat           numeric not null default 0 check (fat >= 0),
  fibre         numeric not null default 0 check (fibre >= 0),
  sugar         numeric check (sugar is null or sugar >= 0),
  sodium_mg     numeric check (sodium_mg is null or sodium_mg >= 0),
  verification  text not null default 'user' check (verification in ('official', 'estimated', 'user')),
  notes         text,
  logged_at     timestamptz not null default now(),
  -- Soft delete: undo restores the row.
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists food_log_user_day on public.food_log_entries (user_id, day);
-- A meal-prep delivery can be added to the food log only once (while live).
create unique index if not exists food_log_one_per_delivery on public.food_log_entries (user_id, meal_log_id)
  where meal_log_id is not null and deleted_at is null;

alter table public.food_log_entries enable row level security;
drop policy if exists "food_log_entries: own rows" on public.food_log_entries;
create policy "food_log_entries: own rows" on public.food_log_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Entries may only point at your own (or shared) foods and your own deliveries.
create or replace function public.nutrition_check_entry_links() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.food_id is not null and not exists (
    select 1 from public.foods f where f.id = new.food_id and (f.user_id is null or f.user_id = new.user_id)
  ) then
    raise exception 'food does not belong to this user';
  end if;
  if new.meal_log_id is not null and not exists (
    select 1 from public.meal_logs m where m.id = new.meal_log_id and m.user_id = new.user_id
  ) then
    raise exception 'delivery does not belong to this user';
  end if;
  return new;
end $$;

drop trigger if exists food_log_entries_links on public.food_log_entries;
create trigger food_log_entries_links before insert or update on public.food_log_entries
  for each row execute function public.nutrition_check_entry_links();
