-- Shared UI settings (theme, etc.) — one row per user.
-- Module data gets its own tables in later migrations. Finance records are
-- stored only as client-side-encrypted ciphertext (phase 4).

create table if not exists public.app_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb
             check (jsonb_typeof(settings) = 'object'),
  -- Written by the client: used for last-write-wins between devices.
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Every policy is scoped to the signed-in user; there is no public access.
create policy "app_settings: read own row"
  on public.app_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "app_settings: insert own row"
  on public.app_settings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "app_settings: update own row"
  on public.app_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No delete policy: rows go away only when the auth user is deleted.
