-- Meal plans: per-category quotas (e.g. 20 salads + 20 sandwiches) and
-- per-item consumption caps inside a plan (one default, editable per item).
-- A plan completes when every quota is used up, or when it is forced
-- complete. Completed plans are kept as history; nothing is deleted.

create table if not exists public.meal_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  started_on        date not null default current_date,
  -- Cap applied to every item unless overridden; null = items uncapped.
  default_item_cap  integer check (default_item_cap is null or default_item_cap >= 0),
  completed_at      timestamptz,
  completion        text check (completion in ('quota_met', 'forced')),
  created_at        timestamptz not null default now(),
  check ((completed_at is null) = (completion is null))
);
-- At most one active (incomplete) plan per user.
create unique index if not exists meal_plans_one_active
  on public.meal_plans (user_id) where completed_at is null;

create table if not exists public.meal_plan_quotas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id      uuid not null references public.meal_plans (id) on delete cascade,
  category_id  uuid not null references public.food_categories (id),
  quantity     integer not null check (quantity > 0),
  unique (plan_id, category_id)
);

create table if not exists public.meal_plan_item_caps (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id  uuid not null references public.meal_plans (id) on delete cascade,
  meal_id  uuid not null references public.meals (id),
  cap      integer not null check (cap >= 0),
  unique (plan_id, meal_id)
);

-- Logs remember which plan they counted toward, and any authorised
-- over-cap override (shown in history, never silently compliant).
alter table public.meal_logs
  add column if not exists plan_id          uuid references public.meal_plans (id),
  add column if not exists cap_override     boolean not null default false,
  add column if not exists override_reason  text;
create index if not exists meal_logs_plan on public.meal_logs (plan_id) where plan_id is not null;

-- ---------- Row Level Security ----------
alter table public.meal_plans          enable row level security;
alter table public.meal_plan_quotas    enable row level security;
alter table public.meal_plan_item_caps enable row level security;

create policy "meal_plans: own rows" on public.meal_plans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meal_plan_quotas: own rows" on public.meal_plan_quotas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meal_plan_item_caps: own rows" on public.meal_plan_item_caps for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Same-owner checks for every new reference ----------
create or replace function public.food_check_plan_ownership() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.plan_id is not null and not exists (
    select 1 from public.meal_plans p where p.id = new.plan_id and p.user_id = new.user_id
  ) then
    raise exception 'plan does not belong to this user';
  end if;
  if tg_table_name = 'meal_plan_quotas' and not exists (
    select 1 from public.food_categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'category does not belong to this user';
  end if;
  if tg_table_name = 'meal_plan_item_caps' and not exists (
    select 1 from public.meals m where m.id = new.meal_id and m.user_id = new.user_id
  ) then
    raise exception 'meal does not belong to this user';
  end if;
  return new;
end $$;

create trigger meal_plan_quotas_ownership before insert or update on public.meal_plan_quotas
  for each row execute function public.food_check_plan_ownership();
create trigger meal_plan_item_caps_ownership before insert or update on public.meal_plan_item_caps
  for each row execute function public.food_check_plan_ownership();
create trigger meal_logs_plan_ownership before insert or update on public.meal_logs
  for each row execute function public.food_check_plan_ownership();
