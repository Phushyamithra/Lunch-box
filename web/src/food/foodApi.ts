import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportPlan } from './importPlan';

export interface CategoryRow {
  id: string;
  legacy_id: string | null;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  enabled: boolean;
}

export interface MealRow {
  id: string;
  legacy_id: string | null;
  category_id: string;
  name: string;
  icon: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  notes: string | null;
  archived_at: string | null;
}

export interface LogRow {
  id: string;
  meal_id: string;
  log_date: string;
  logged_at: string;
  kind: 'consumed' | 'ordered';
  source: 'manual' | 'extension_import';
  deleted_at: string | null;
}

export interface FoodSettingsRow {
  goal_settings: unknown;
  legacy_achievements: Record<string, string>;
}

const PAGE = 1000; // Supabase's default max rows per request
const CHUNK = 500;

/** Reads every row of a query, page by page (PostgREST caps each response). */
async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export interface FoodData {
  categories: CategoryRow[];
  meals: MealRow[];
  logs: LogRow[];
  settings: FoodSettingsRow | null;
}

export async function loadFoodData(client: SupabaseClient): Promise<FoodData> {
  const [categories, meals, logs, settings] = await Promise.all([
    fetchAll<CategoryRow>((from, to) =>
      client.from('food_categories').select('id, legacy_id, name, icon, color, sort_order, enabled').order('sort_order').range(from, to),
    ),
    fetchAll<MealRow>((from, to) =>
      client
        .from('meals')
        .select('id, legacy_id, category_id, name, icon, calories, protein, carbs, fiber, fat, notes, archived_at')
        .order('name')
        .range(from, to),
    ),
    fetchAll<LogRow>((from, to) =>
      client
        .from('meal_logs')
        .select('id, meal_id, log_date, logged_at, kind, source, deleted_at')
        .is('deleted_at', null)
        .order('logged_at')
        .range(from, to),
    ),
    client.from('food_settings').select('goal_settings, legacy_achievements').maybeSingle(),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  return { categories, meals, logs, settings: settings.data as FoodSettingsRow | null };
}

const LOG_COLUMNS = 'id, meal_id, log_date, logged_at, kind, source, deleted_at';

export async function insertLog(client: SupabaseClient, mealId: string, logDate: string): Promise<LogRow> {
  const { data, error } = await client
    .from('meal_logs')
    .insert({ meal_id: mealId, log_date: logDate, logged_at: new Date().toISOString() })
    .select(LOG_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as LogRow;
}

/** Soft delete (undo-able). History rows are never hard-deleted. */
export async function setLogDeleted(client: SupabaseClient, id: string, deleted: boolean): Promise<void> {
  const { error } = await client
    .from('meal_logs')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Import ----------

export interface ImportResult {
  categoriesAdded: number;
  mealsAdded: number;
  logsAdded: number;
  logsAlreadyPresent: number;
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

/**
 * Writes an import plan. Re-runnable: rows are keyed by legacy id and
 * existing rows are skipped (never overwritten), so a partial failure can
 * simply be retried. Categories that already exist by name are reused.
 */
export async function runImport(client: SupabaseClient, plan: ImportPlan): Promise<ImportResult> {
  const fail = (step: string, message: string): never => {
    throw new Error(`Import stopped while saving ${step}: ${message}. Nothing was overwritten; you can run it again.`);
  };

  // 1. Categories — match existing ones by legacy id or by name.
  const existingCats = await fetchAll<CategoryRow>((from, to) =>
    client.from('food_categories').select('id, legacy_id, name, icon, color, sort_order, enabled').range(from, to),
  );
  const catIdByLegacy = new Map<string, string>();
  const catIdByName = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));
  for (const c of existingCats) if (c.legacy_id) catIdByLegacy.set(c.legacy_id, c.id);

  const newCats = plan.categories.filter((c) => {
    const byName = catIdByName.get(c.name.toLowerCase());
    if (catIdByLegacy.has(c.legacyId)) return false;
    if (byName) {
      catIdByLegacy.set(c.legacyId, byName);
      return false;
    }
    return true;
  });
  for (const batch of chunks(newCats)) {
    const { data, error } = await client
      .from('food_categories')
      .insert(batch.map((c) => ({ legacy_id: c.legacyId, name: c.name, icon: c.icon, color: c.color, sort_order: c.sortOrder, enabled: c.enabled })))
      .select('id, legacy_id');
    if (error) fail('categories', error.message);
    for (const row of data ?? []) catIdByLegacy.set(row.legacy_id as string, row.id as string);
  }

  // 2. Meals.
  const existingMeals = await fetchAll<{ id: string; legacy_id: string | null }>((from, to) =>
    client.from('meals').select('id, legacy_id').not('legacy_id', 'is', null).range(from, to),
  );
  const mealIdByLegacy = new Map(existingMeals.map((m) => [m.legacy_id as string, m.id]));
  const newMeals = plan.meals.filter((m) => !mealIdByLegacy.has(m.legacyId));
  const now = new Date().toISOString();
  for (const batch of chunks(newMeals)) {
    const { data, error } = await client
      .from('meals')
      .insert(
        batch.map((m) => ({
          legacy_id: m.legacyId,
          category_id: catIdByLegacy.get(m.categoryLegacyId),
          name: m.name,
          icon: m.icon,
          ...m.nutrition,
          archived_at: m.archived ? now : null,
        })),
      )
      .select('id, legacy_id');
    if (error) fail('meals', error.message);
    for (const row of data ?? []) mealIdByLegacy.set(row.legacy_id as string, row.id as string);
  }

  // 3. Logs — insert only those not already imported.
  const existingLogs = await fetchAll<{ legacy_id: string }>((from, to) =>
    client.from('meal_logs').select('legacy_id').not('legacy_id', 'is', null).range(from, to),
  );
  const present = new Set(existingLogs.map((l) => l.legacy_id));
  const newLogs = plan.logs.filter((l) => !present.has(l.legacyId));
  for (const batch of chunks(newLogs)) {
    const { error } = await client.from('meal_logs').insert(
      batch.map((l) => ({
        legacy_id: l.legacyId,
        meal_id: mealIdByLegacy.get(l.mealLegacyId),
        log_date: l.logDate,
        logged_at: l.loggedAt,
        kind: 'consumed',
        source: 'extension_import',
        external_task_id: l.externalTaskId,
      })),
    );
    if (error) fail('meal logs', error.message);
  }

  // 4. Settings — only created if missing; never overwrite web edits.
  const { error: settingsError } = await client.from('food_settings').upsert(
    { goal_settings: plan.goalSettings ?? {}, legacy_achievements: plan.achievements },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (settingsError) fail('settings', settingsError.message);

  const result: ImportResult = {
    categoriesAdded: newCats.length,
    mealsAdded: newMeals.length,
    logsAdded: newLogs.length,
    logsAlreadyPresent: plan.logs.length - newLogs.length,
  };

  // 5. Audit trail.
  const { error: auditError } = await client.from('import_runs').insert({
    source: 'lunchbox-extension-backup',
    backup_exported_at: plan.exportedAt,
    summary: { ...result, warnings: plan.warnings, emails: plan.emails },
  });
  if (auditError) fail('the import record', auditError.message);

  return result;
}
