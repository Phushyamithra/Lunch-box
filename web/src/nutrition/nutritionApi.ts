import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoalMode, MacroTargets, Profile } from './engine';

export interface TargetRow extends MacroTargets {
  id: string;
  effective_from: string;
  mode: GoalMode;
  rate_kg_month: number | null;
  reason: string;
  inputs: Record<string, unknown>;
  created_at: string;
}
export type TargetInput = Omit<TargetRow, 'id' | 'created_at'>;

export interface NutritionData {
  profile: Profile | null;
  /** Oldest first. */
  targets: TargetRow[];
}

const TARGET_COLUMNS =
  'id, effective_from, mode, rate_kg_month, kcal, protein_min, protein_max, protein_g, fat_min, fat_max, fat_g, carbs_g, fibre_g, reason, inputs, created_at';
const NUMERIC: (keyof TargetRow)[] = ['kcal', 'protein_min', 'protein_max', 'protein_g', 'fat_min', 'fat_max', 'fat_g', 'carbs_g', 'fibre_g'];

const normaliseTarget = (r: TargetRow): TargetRow => {
  const out = { ...r } as Record<string, unknown>;
  for (const k of NUMERIC) out[k] = Number(r[k]);
  out.rate_kg_month = r.rate_kg_month === null || r.rate_kg_month === undefined ? null : Number(r.rate_kg_month);
  out.inputs = r.inputs && typeof r.inputs === 'object' ? r.inputs : {};
  return out as unknown as TargetRow;
};

const check = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export async function loadNutrition(client: SupabaseClient): Promise<NutritionData> {
  const [profile, targets] = await Promise.all([
    client.from('nutrition_profile').select('sex, birth_year, height_cm, activity').maybeSingle(),
    client.from('nutrition_targets').select(TARGET_COLUMNS).order('effective_from').order('created_at'),
  ]);
  const p = check(profile) as Profile | null;
  return {
    profile: p ? { ...p, birth_year: Number(p.birth_year), height_cm: Number(p.height_cm) } : null,
    targets: ((check(targets) ?? []) as TargetRow[]).map(normaliseTarget),
  };
}

export async function saveProfile(client: SupabaseClient, p: Profile): Promise<Profile> {
  const row = check(
    await client
      .from('nutrition_profile')
      .upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('sex, birth_year, height_cm, activity')
      .single(),
  ) as Profile;
  return { ...row, birth_year: Number(row.birth_year), height_cm: Number(row.height_cm) };
}

/** Targets are append-only: every change is a new version. */
export async function addTargets(client: SupabaseClient, input: TargetInput): Promise<TargetRow> {
  return normaliseTarget(check(await client.from('nutrition_targets').insert(input).select(TARGET_COLUMNS).single()) as TargetRow);
}

/** The version in force on `day` (latest effective_from ≤ day; latest saved wins on the same day). */
export function activeTarget(targets: TargetRow[], day: string): TargetRow | null {
  let best: TargetRow | null = null;
  for (const t of targets) {
    if (t.effective_from > day) continue;
    if (!best || t.effective_from > best.effective_from || (t.effective_from === best.effective_from && t.created_at >= best.created_at)) best = t;
  }
  return best;
}
