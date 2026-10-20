-- Finance (Phase 6): one encrypted blob per user. Additive only.
--
-- The app encrypts your finance data in the browser (AES-GCM, key from a
-- passphrase via PBKDF2) before it gets here. This table never holds
-- readable amounts, categories or notes, and the passphrase is never sent.
--
-- `revision` lets a device save only if nobody saved in between; otherwise
-- it downloads, merges and tries again, so no edit is lost.

create table if not exists public.finance_vault (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ciphertext     text not null check (length(ciphertext) between 16 and 8000000),
  iv             text not null check (length(iv) between 12 and 32),
  -- {"name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64>"}
  kdf            jsonb not null check (jsonb_typeof(kdf) = 'object' and kdf ? 'salt' and kdf ? 'iterations'),
  format_version integer not null default 1 check (format_version >= 1),
  revision       bigint not null default 1 check (revision >= 1),
  -- Which device saved last (a random label, no personal data).
  device         text check (device is null or length(device) <= 64),
  updated_at     timestamptz not null default now()
);

alter table public.finance_vault enable row level security;
drop policy if exists "finance_vault: own row" on public.finance_vault;
create policy "finance_vault: own row" on public.finance_vault for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Each save moves the revision forward by exactly one.
create or replace function public.finance_vault_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.revision <> old.revision + 1 then
    raise exception 'finance_vault: revision must advance by one (expected %, got %)', old.revision + 1, new.revision;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists finance_vault_revision on public.finance_vault;
create trigger finance_vault_revision before insert or update on public.finance_vault
  for each row execute function public.finance_vault_revision();
