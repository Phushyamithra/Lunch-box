-- Food module: categories, meal catalog, meal logs, settings, import audit.
-- Every table is owned by one user and locked to that user by RLS.
-- `legacy_id` holds the Chrome extension's id so re-running an import never
-- duplicates rows (unique per user), and history can be traced back.

create table if not exists public.food_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  legacy_id   text,
  name        text not null check (length(trim(name)) > 0),
  icon        text not null default '🍽️',
  color       text not null default '#B46060',
  sort_order  integer not null default 0,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, legacy_id)
);
create unique index if not exists food_categories_user_name
  on public.food_categories (user_id, lower(name));

create table if not exists public.meals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  legacy_id    text,
  category_id  uuid not null references public.food_categories (id),
  name         text not null check (length(trim(name)) > 0),
  icon         text,
  calories     numeric not null default 0 check (calories >= 0),
  protein      numeric not null default 0 check (protein >= 0),
  carbs        numeric not null default 0 check (carbs >= 0),
  fiber        numeric not null default 0 check (fiber >= 0),
  fat          numeric not null default 0 check (fat >= 0),
  notes        text,
  -- Archived meals are hidden from logging but keep their history.
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, legacy_id)
);
create index if not exists meals_user on public.meals (user_id);

create table if not exists public.meal_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  legacy_id         text,
  meal_id           uuid not null references public.meals (id),
  log_date          date not null,
  logged_at         timestamptz not null default now(),
  -- Extension logs were all consumption; 'ordered' arrives with item caps.
  kind              text not null default 'consumed' check (kind in ('consumed', 'ordered')),
  source            text not null default 'manual' check (source in ('manual', 'extension_import')),
  -- Google Task created by the extension for this log (kept for traceability).
  external_task_id  text,
  -- Soft delete: undo restores the row; history is never hard-deleted.
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, legacy_id)
);
create index if not exists meal_logs_user_date on public.meal_logs (user_id, log_date);

-- Food-specific settings (legacy goal targets until milestones replace them).
create table if not exists public.food_settings (
  user_id              uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  goal_settings        jsonb not null default '{}'::jsonb,
  -- Extension achievements, preserved verbatim for the milestone history.
  legacy_achievements  jsonb not null default '{}'::jsonb,
  updated_at           timestamptz not null default now()
);

-- One row per import run: what came in, from which backup.
create table if not exists public.import_runs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source              text not null,
  backup_exported_at  timestamptz,
  summary             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.food_categories enable row level security;
alter table public.meals           enable row level security;
alter table public.meal_logs       enable row level security;
alter table public.food_settings   enable row level security;
alter table public.import_runs     enable row level security;

create policy "food_categories: own rows" on public.food_categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meals: own rows" on public.meals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meal_logs: own rows" on public.meal_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "food_settings: own row" on public.food_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Import runs are an audit trail: insert and read only.
create policy "import_runs: read own" on public.import_runs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "import_runs: insert own" on public.import_runs for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- A meal or log may only point at rows owned by the same user.
create or replace function public.food_check_ownership() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'meals' then
    if not exists (select 1 from public.food_categories c
                   where c.id = new.category_id and c.user_id = new.user_id) then
      raise exception 'category does not belong to this user';
    end if;
  elsif tg_table_name = 'meal_logs' then
    if not exists (select 1 from public.meals m
                   where m.id = new.meal_id and m.user_id = new.user_id) then
      raise exception 'meal does not belong to this user';
    end if;
  end if;
  return new;
end $$;

create trigger meals_ownership before insert or update on public.meals
  for each row execute function public.food_check_ownership();
create trigger meal_logs_ownership before insert or update on public.meal_logs
  for each row execute function public.food_check_ownership();
