-- Goals (Phase 5): goals measured from data you already log, manual
-- check-ins for things the app can't see, and dated milestones for the
-- phase timeline. Additive only; nothing existing is changed.
--
-- Progress is never stored: each cycle (day / week / month) is derived
-- from the logs, so editing a goal can't erase history. Target changes are
-- kept as dated versions in `versions`.

create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 80),
  emoji       text check (emoji is null or length(emoji) <= 16),
  -- What is measured, e.g. 'fitness.sessions' or 'manual'. Validated in the app.
  metric      text not null check (length(metric) between 1 and 60),
  -- Metric options, e.g. {"lift": "Bench / chest press"}.
  params      jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  cadence     text not null check (cadence in ('daily', 'weekly', 'monthly', 'one_off')),
  -- [{"from": "2026-10-19", "target": 6}], oldest first, append-only.
  versions    jsonb not null check (jsonb_typeof(versions) = 'array' and jsonb_array_length(versions) >= 1),
  starts_on   date not null default current_date,
  ends_on     date check (ends_on is null or ends_on >= starts_on),
  sort_order  integer not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists goals_user on public.goals (user_id);

alter table public.goals enable row level security;
drop policy if exists "goals: own rows" on public.goals;
create policy "goals: own rows" on public.goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Manual goals: one check-in per cycle (soft delete keeps undo possible).
create table if not exists public.goal_checkins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id      uuid not null references public.goals (id) on delete cascade,
  period_start date not null,
  note         text check (note is null or length(note) <= 280),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create unique index if not exists goal_checkins_one_per_cycle on public.goal_checkins (goal_id, period_start)
  where deleted_at is null;

alter table public.goal_checkins enable row level security;
drop policy if exists "goal_checkins: own rows" on public.goal_checkins;
create policy "goal_checkins: own rows" on public.goal_checkins for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.goals_check_checkin_owner() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id) then
    raise exception 'goal does not belong to this user';
  end if;
  return new;
end $$;

drop trigger if exists goal_checkins_owner on public.goal_checkins;
create trigger goal_checkins_owner before insert or update on public.goal_checkins
  for each row execute function public.goals_check_checkin_owner();

-- Timeline: dated checkpoints (baseline, first check, end of bulk …) and
-- one-off achievements you record yourself.
create table if not exists public.milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 120),
  emoji       text check (emoji is null or length(emoji) <= 16),
  notes       text check (notes is null or length(notes) <= 1000),
  -- Planned date ("~July 2027" is stored as a date plus approx = true).
  due_on      date,
  approx      boolean not null default false,
  done_on     date,
  kind        text not null default 'checkpoint' check (kind in ('checkpoint', 'achievement')),
  -- Where it came from: 'user', or 'phase' when generated from the phase plan.
  source      text not null default 'user' check (length(source) between 1 and 40),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (due_on is not null or done_on is not null)
);
create index if not exists milestones_user on public.milestones (user_id);

alter table public.milestones enable row level security;
drop policy if exists "milestones: own rows" on public.milestones;
create policy "milestones: own rows" on public.milestones for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
