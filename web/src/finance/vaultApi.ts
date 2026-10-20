import type { SupabaseClient } from '@supabase/supabase-js';
import type { KdfParams, Sealed } from './vault';

export interface VaultRow {
  ciphertext: string;
  iv: string;
  kdf: KdfParams;
  format_version: number;
  revision: number;
  device: string | null;
  updated_at: string;
}

const COLUMNS = 'ciphertext, iv, kdf, format_version, revision, device, updated_at';
const toRow = (r: VaultRow): VaultRow => ({ ...r, revision: Number(r.revision) });

/** Your encrypted vault, or null if you haven't set Finance up yet. */
export async function fetchVault(client: SupabaseClient): Promise<VaultRow | null> {
  const { data, error } = await client.from('finance_vault').select(COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRow(data as VaultRow) : null;
}

/** First save. Returns false if a vault already exists (another device got there first). */
export async function createVault(client: SupabaseClient, s: Sealed, device: string): Promise<boolean> {
  const { error } = await client.from('finance_vault').insert({ ciphertext: s.ciphertext, iv: s.iv, kdf: s.kdf, format_version: s.formatVersion, revision: 1, device });
  if (!error) return true;
  if (/duplicate key|finance_vault_pkey|23505/.test(`${error.message} ${(error as { code?: string }).code ?? ''}`)) return false;
  throw new Error(error.message);
}

/** Saves only if the cloud is still at `expected`. Returns the new revision, or null when another device saved first. */
export async function updateVault(client: SupabaseClient, s: Sealed, expected: number, device: string): Promise<number | null> {
  const { data, error } = await client
    .from('finance_vault')
    .update({ ciphertext: s.ciphertext, iv: s.iv, kdf: s.kdf, format_version: s.formatVersion, revision: expected + 1, device })
    .eq('revision', expected)
    .select('revision');
  if (error) throw new Error(error.message);
  return data && data.length ? Number((data[0] as { revision: number }).revision) : null;
}
