import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoalMode, MacroTargets, Profile } from './engine';
import type { Entry, Food, FoodInput, MealSlot, Nutrients, Verification } from './foodLog';

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
  /** Your foods and shared reference foods (not archived). */
  foods: Food[];
  entries: Entry[];
}

export interface EntryInput extends Nutrients {
  day: string;
  meal: MealSlot;
  food_id: string | null;
  meal_log_id: string | null;
  source: Entry['source'];
  name: string;
  quantity: number;
  unit: string;
  grams: number | null;
  verification: Verification;
}

const FOOD_COLUMNS =
  'id, user_id, name, brand, diet, basis, serving_g, portions, kcal, protein, carbs, fat, fibre, sugar, sodium_mg, source, verification, parent_food_id, source_url, archived_at, ref_code, category, aliases, notes, barcode';
const ENTRY_COLUMNS =
  'id, day, meal, food_id, meal_log_id, source, name, quantity, unit, grams, kcal, protein, carbs, fat, fibre, sugar, sodium_mg, verification, logged_at, deleted_at';
const nOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const normaliseFood = (r: Food): Food => ({
  ...r,
  serving_g: nOrNull(r.serving_g),
  portions: Array.isArray(r.portions) ? r.portions.map((p) => ({ label: String(p.label), grams: Number(p.grams) })) : [],
  kcal: Number(r.kcal),
  protein: Number(r.protein),
  carbs: Number(r.carbs),
  fat: Number(r.fat),
  fibre: Number(r.fibre),
  sugar: nOrNull(r.sugar),
  sodium_mg: nOrNull(r.sodium_mg),
});
const normaliseEntry = (r: Entry): Entry => ({
  ...r,
  quantity: Number(r.quantity),
  grams: nOrNull(r.grams),
  kcal: Number(r.kcal),
  protein: Number(r.protein),
  carbs: Number(r.carbs),
  fat: Number(r.fat),
  fibre: Number(r.fibre),
  sugar: nOrNull(r.sugar),
  sodium_mg: nOrNull(r.sodium_mg),
});

const PAGE = 1000;
async function fetchAll<T>(run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
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
  const [profile, targets, foods, entries] = await Promise.all([
    client.from('nutrition_profile').select('sex, birth_year, height_cm, activity').maybeSingle(),
    client.from('nutrition_targets').select(TARGET_COLUMNS).order('effective_from').order('created_at'),
    fetchAll<Food>((f, t) => client.from('foods').select(FOOD_COLUMNS).is('archived_at', null).order('name').range(f, t)),
    fetchAll<Entry>((f, t) => client.from('food_log_entries').select(ENTRY_COLUMNS).is('deleted_at', null).order('logged_at').range(f, t)),
  ]);
  const p = check(profile) as Profile | null;
  return {
    profile: p ? { ...p, birth_year: Number(p.birth_year), height_cm: Number(p.height_cm) } : null,
    targets: ((check(targets) ?? []) as TargetRow[]).map(normaliseTarget),
    foods: foods.map(normaliseFood),
    entries: entries.map(normaliseEntry),
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

export async function saveFood(client: SupabaseClient, input: FoodInput, id?: string): Promise<Food> {
  const row = { ...input, name: input.name.trim(), brand: input.brand?.trim() || null, updated_at: new Date().toISOString() };
  const q = id ? client.from('foods').update(row).eq('id', id) : client.from('foods').insert(row);
  return normaliseFood(check(await q.select(FOOD_COLUMNS).single()) as Food);
}

/** Archiving hides a food from search; logged entries keep their snapshot. */
export async function archiveFood(client: SupabaseClient, id: string): Promise<void> {
  check(await client.from('foods').update({ archived_at: new Date().toISOString() }).eq('id', id).select('id').single());
}

export async function addEntry(client: SupabaseClient, input: EntryInput): Promise<Entry> {
  return normaliseEntry(check(await client.from('food_log_entries').insert(input).select(ENTRY_COLUMNS).single()) as Entry);
}

/** Soft delete / restore (undo-able). */
export async function setEntryDeleted(client: SupabaseClient, id: string, deleted: boolean): Promise<Entry> {
  return normaliseEntry(
    check(await client.from('food_log_entries').update({ deleted_at: deleted ? new Date().toISOString() : null }).eq('id', id).select(ENTRY_COLUMNS).single()) as Entry,
  );
}

export interface ImportRows {
  foods: (FoodInput & { id: string; notes: string | null })[];
  entries: (EntryInput & { id: string; logged_at: string })[];
  targets: (TargetInput & { id: string })[];
  profile: Profile | null;
}

/**
 * Adds imported rows (never updates or deletes). Ids are chosen client side
 * so links between new rows hold; foods go first, in chunks.
 */
export async function importRows(client: SupabaseClient, rows: ImportRows, onProgress?: (done: number, total: number) => void): Promise<void> {
  const total = rows.foods.length + rows.entries.length + rows.targets.length + (rows.profile ? 1 : 0);
  let done = 0;
  const step = (n: number) => onProgress?.((done += n), total);
  const CHUNK = 500;
  const insert = async (table: string, list: object[]) => {
    for (let i = 0; i < list.length; i += CHUNK) {
      const part = list.slice(i, i + CHUNK);
      check(await client.from(table).insert(part).select('id'));
      step(part.length);
    }
  };
  const now = new Date().toISOString();
  await insert('foods', rows.foods.map((f) => ({ ...f, name: f.name.trim(), updated_at: now })));
  await insert('nutrition_targets', rows.targets);
  await insert('food_log_entries', rows.entries);
  if (rows.profile) {
    await saveProfile(client, rows.profile);
    step(1);
  }
}
