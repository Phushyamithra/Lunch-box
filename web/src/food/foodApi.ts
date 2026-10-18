import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportPlan } from './importPlan';
import type { ItemCapRow, PlanRow, QuotaRow } from './plans';

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
  plan_id: string | null;
  cap_override: boolean;
  override_reason: string | null;
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
  plans: PlanRow[];
  quotas: QuotaRow[];
  caps: ItemCapRow[];
}

const LOG_COLUMNS = 'id, meal_id, log_date, logged_at, kind, source, deleted_at, plan_id, cap_override, override_reason';
const MEAL_COLUMNS = 'id, legacy_id, category_id, name, icon, calories, protein, carbs, fiber, fat, notes, archived_at';
const PLAN_COLUMNS = 'id, name, started_on, default_item_cap, completed_at, completion, created_at';

export async function loadFoodData(client: SupabaseClient): Promise<FoodData> {
  const [categories, meals, logs, settings, plans, quotas, caps] = await Promise.all([
    fetchAll<CategoryRow>((from, to) =>
      client.from('food_categories').select('id, legacy_id, name, icon, color, sort_order, enabled').order('sort_order').range(from, to),
    ),
    fetchAll<MealRow>((from, to) => client.from('meals').select(MEAL_COLUMNS).order('name').range(from, to)),
    fetchAll<LogRow>((from, to) =>
      client.from('meal_logs').select(LOG_COLUMNS).is('deleted_at', null).order('logged_at').range(from, to),
    ),
    client.from('food_settings').select('goal_settings, legacy_achievements').maybeSingle(),
    fetchAll<PlanRow>((from, to) => client.from('meal_plans').select(PLAN_COLUMNS).order('created_at').range(from, to)),
    fetchAll<QuotaRow>((from, to) => client.from('meal_plan_quotas').select('id, plan_id, category_id, quantity').range(from, to)),
    fetchAll<ItemCapRow>((from, to) => client.from('meal_plan_item_caps').select('id, plan_id, meal_id, cap').range(from, to)),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  return { categories, meals, logs, settings: settings.data as FoodSettingsRow | null, plans, quotas, caps };
}

export interface NewLog {
  mealId: string;
  logDate: string;
  planId: string | null;
  /** Set only when the user explicitly authorised logging past a limit. */
  override?: { reason: string | null };
}

export async function insertLog(client: SupabaseClient, input: NewLog): Promise<LogRow> {
  const { data, error } = await client
    .from('meal_logs')
    .insert({
      meal_id: input.mealId,
      log_date: input.logDate,
      logged_at: new Date().toISOString(),
      plan_id: input.planId,
      cap_override: Boolean(input.override),
      override_reason: input.override?.reason?.trim() || null,
    })
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

// ---------- Meal catalog ----------

export interface MealInput {
  name: string;
  categoryId: string;
  icon: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  notes: string | null;
}

const mealPayload = (m: MealInput) => ({
  name: m.name.trim(),
  category_id: m.categoryId,
  icon: m.icon?.trim() || null,
  calories: m.calories,
  protein: m.protein,
  carbs: m.carbs,
  fiber: m.fiber,
  fat: m.fat,
  notes: m.notes?.trim() || null,
  updated_at: new Date().toISOString(),
});

export async function insertMeal(client: SupabaseClient, input: MealInput): Promise<MealRow> {
  const { data, error } = await client.from('meals').insert(mealPayload(input)).select(MEAL_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as MealRow;
}

export async function updateMeal(client: SupabaseClient, id: string, input: MealInput): Promise<MealRow> {
  const { data, error } = await client.from('meals').update(mealPayload(input)).eq('id', id).select(MEAL_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as MealRow;
}

/** Archive hides a meal from logging; its history stays. */
export async function setMealArchived(client: SupabaseClient, id: string, archived: boolean): Promise<MealRow> {
  const { data, error } = await client
    .from('meals')
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(MEAL_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as MealRow;
}

/**
 * Deletes a meal that has no history. Meals with logs (or caps in a plan)
 * are protected by foreign keys; archive those instead.
 */
export async function deleteMeal(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('meals').delete().eq('id', id);
  if (error) throw friendly(error, 'This meal has history, so it can only be archived.');
}

// ---------- Categories ----------

export interface CategoryInput {
  name: string;
  icon: string;
  color: string;
}

const CATEGORY_COLUMNS = 'id, legacy_id, name, icon, color, sort_order, enabled';

export async function insertCategory(client: SupabaseClient, input: CategoryInput, sortOrder: number): Promise<CategoryRow> {
  const { data, error } = await client
    .from('food_categories')
    .insert({ name: input.name.trim(), icon: input.icon.trim() || '🍽️', color: input.color, sort_order: sortOrder })
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) throw friendly(error);
  return data as CategoryRow;
}

export async function updateCategory(
  client: SupabaseClient,
  id: string,
  patch: Partial<Pick<CategoryRow, 'name' | 'icon' | 'color' | 'enabled' | 'sort_order'>>,
): Promise<CategoryRow> {
  const { data, error } = await client
    .from('food_categories')
    .update({ ...patch, ...(patch.name ? { name: patch.name.trim() } : {}), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) throw friendly(error);
  return data as CategoryRow;
}

/**
 * Deletes a category. Its meals are first moved to `moveTo` (required when
 * it has any), so no meal or log is ever lost. Categories used by a meal
 * plan are protected; hide those instead.
 */
export async function deleteCategory(client: SupabaseClient, id: string, moveTo: string | null): Promise<void> {
  if (moveTo) {
    const { error } = await client.from('meals').update({ category_id: moveTo }).eq('category_id', id);
    if (error) throw friendly(error);
  }
  const { error } = await client.from('food_categories').delete().eq('id', id);
  if (error) throw friendly(error, 'This category is part of a meal plan, so it can only be hidden.');
}

/** Maps database errors the user can cause to plain language. */
function friendly(error: { message: string; code?: string }, inUse?: string): Error {
  if (error.code === '23503') return new Error(inUse ?? 'This is still in use elsewhere.');
  if (error.code === '23505') return new Error('That name is already taken.');
  return new Error(error.message);
}

// ---------- Meal plans ----------

export interface NewPlan {
  name: string;
  startedOn: string;
  defaultItemCap: number | null;
  quotas: { categoryId: string; quantity: number }[];
  caps: { mealId: string; cap: number }[];
}

export async function createPlan(
  client: SupabaseClient,
  input: NewPlan,
): Promise<{ plan: PlanRow; quotas: QuotaRow[]; caps: ItemCapRow[] }> {
  const { data: plan, error } = await client
    .from('meal_plans')
    .insert({ name: input.name.trim(), started_on: input.startedOn, default_item_cap: input.defaultItemCap })
    .select(PLAN_COLUMNS)
    .single();
  if (error) {
    throw new Error(
      error.message.includes('meal_plans_one_active')
        ? 'Another plan is still active. Complete it first.'
        : error.message,
    );
  }
  const planId = (plan as PlanRow).id;
  const { data: quotas, error: quotaError } = await client
    .from('meal_plan_quotas')
    .insert(input.quotas.map((q) => ({ plan_id: planId, category_id: q.categoryId, quantity: q.quantity })))
    .select('id, plan_id, category_id, quantity');
  if (quotaError) {
    // Roll back: an empty plan has no data, and must not linger in history.
    await client.from('meal_plans').delete().eq('id', planId);
    throw new Error(quotaError.message);
  }
  let caps: ItemCapRow[] = [];
  if (input.caps.length > 0) {
    const { data, error: capError } = await client
      .from('meal_plan_item_caps')
      .insert(input.caps.map((c) => ({ plan_id: planId, meal_id: c.mealId, cap: c.cap })))
      .select('id, plan_id, meal_id, cap');
    if (capError) {
      await client.from('meal_plan_quotas').delete().eq('plan_id', planId);
      await client.from('meal_plans').delete().eq('id', planId);
      throw new Error(capError.message);
    }
    caps = (data ?? []) as ItemCapRow[];
  }
  return { plan: plan as PlanRow, quotas: (quotas ?? []) as QuotaRow[], caps };
}

export async function updatePlan(
  client: SupabaseClient,
  planId: string,
  patch: Partial<Pick<PlanRow, 'name' | 'default_item_cap' | 'completed_at' | 'completion'>>,
): Promise<PlanRow> {
  const { data, error } = await client.from('meal_plans').update(patch).eq('id', planId).select(PLAN_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as PlanRow;
}

export async function setQuota(client: SupabaseClient, quota: QuotaRow, quantity: number): Promise<QuotaRow> {
  const { data, error } = await client
    .from('meal_plan_quotas')
    .update({ quantity })
    .eq('id', quota.id)
    .select('id, plan_id, category_id, quantity')
    .single();
  if (error) throw new Error(error.message);
  return data as QuotaRow;
}

/** Sets an item's own cap, or (cap = null) returns it to the plan default. */
export async function setItemCap(
  client: SupabaseClient,
  planId: string,
  mealId: string,
  cap: number | null,
): Promise<ItemCapRow | null> {
  if (cap === null) {
    const { error } = await client.from('meal_plan_item_caps').delete().eq('plan_id', planId).eq('meal_id', mealId);
    if (error) throw new Error(error.message);
    return null;
  }
  const { data, error } = await client
    .from('meal_plan_item_caps')
    .upsert({ plan_id: planId, meal_id: mealId, cap }, { onConflict: 'plan_id,meal_id' })
    .select('id, plan_id, meal_id, cap')
    .single();
  if (error) throw new Error(error.message);
  return data as ItemCapRow;
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
