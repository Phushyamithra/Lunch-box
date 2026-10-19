import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomExercise, CustomWorkout } from './dayPlan';
import type { ParsedFinisher, ParsedReference } from './referenceImport';
import { normaliseReminders, type ReminderSettings } from './reminders';
import type { AwayPeriod, DietDay, KeyLiftGroup, Preset, Session, SetRow, Waist, WeighIn, WeighTime } from './rules';

export interface FitnessSettings {
  gain_target_kg_month: number;
  gain_high_kg_month: number;
  gain_low_kg_month: number;
  kcal_target: number;
  protein_min_g: number;
  protein_max_g: number;
  fat_min_g: number;
  fat_max_g: number;
  carbs_target_g: number;
  waist_interval_days: number;
  rotation_start: string;
  rotation_offset: number;
  phase_start: string;
  phase_months: number;
  key_lifts: KeyLiftGroup[];
  weigh_time: WeighTime;
  steps_target: number;
  cardio_per_week: number;
  rest_compound_sec: number;
  rest_isolation_sec: number;
  day_focus: Record<string, string>;
  finishers: ParsedFinisher[];
  reminders: ReminderSettings;
}

export interface WeighInRow extends WeighIn {
  measured_at: string;
  notes: string | null;
}
export interface WaistRow extends Waist {
  notes: string | null;
}
export interface DietRow extends DietDay {
  id: string;
  notes: string | null;
}
export interface StepRow {
  id: string;
  day: string;
  steps: number;
  source: string;
}
export interface SlotRow {
  id: string;
  weekday: number;
  slot: number;
  label: string;
  default_sets: number;
  variants: string[];
}
export interface SessionRow extends Session {
  notes: string | null;
  cardio_done: boolean;
  /** {"3": 1}: slot 3 uses V2 today. */
  slot_variants: Record<string, number>;
  custom_workout_id: string | null;
  extras: CustomExercise[];
}
export type SessionInput = Pick<SessionRow, 'day' | 'variant_index' | 'completed' | 'slots_completed' | 'cardio_done' | 'slot_variants' | 'custom_workout_id' | 'extras'>;
export interface PresetRow extends Preset {
  id: string;
}
export interface WorkoutSetRow extends SetRow {
  id: string;
  slot: number;
  notes: string | null;
}

export interface FitnessData {
  settings: FitnessSettings;
  weighIns: WeighInRow[];
  waists: WaistRow[];
  away: AwayPeriod[];
  diet: DietRow[];
  steps: StepRow[];
  slots: SlotRow[];
  sessions: SessionRow[];
  sets: WorkoutSetRow[];
  presets: PresetRow[];
  workouts: CustomWorkout[];
}

const NUMERIC_SETTINGS: (keyof FitnessSettings)[] = [
  'gain_target_kg_month',
  'gain_high_kg_month',
  'gain_low_kg_month',
  'kcal_target',
  'protein_min_g',
  'protein_max_g',
  'fat_min_g',
  'fat_max_g',
  'carbs_target_g',
  'waist_interval_days',
  'rotation_offset',
  'phase_months',
  'steps_target',
  'cardio_per_week',
  'rest_compound_sec',
  'rest_isolation_sec',
];
const SETTINGS_COLUMNS = [...NUMERIC_SETTINGS, 'rotation_start', 'phase_start', 'key_lifts', 'weigh_time', 'day_focus', 'finishers', 'reminders'].join(', ');
const SESSION_COLUMNS = 'id, day, variant_index, completed, slots_completed, notes, cardio_done, slot_variants, custom_workout_id, extras';
const WORKOUT_COLUMNS = 'id, name, weekday, exercises';

/** Postgres numerics can arrive as strings; normalise once at the edge. */
function normaliseSettings(raw: Record<string, unknown>): FitnessSettings {
  const out = { ...raw } as Record<string, unknown>;
  for (const k of NUMERIC_SETTINGS) out[k] = Number(raw[k]);
  out.key_lifts = Array.isArray(raw.key_lifts) ? raw.key_lifts : [];
  out.finishers = Array.isArray(raw.finishers) ? raw.finishers : [];
  out.day_focus = raw.day_focus && typeof raw.day_focus === 'object' ? raw.day_focus : {};
  out.weigh_time = typeof raw.weigh_time === 'string' ? raw.weigh_time : 'morning';
  out.reminders = normaliseReminders(raw.reminders);
  return out as unknown as FitnessSettings;
}
const normaliseSession = (r: SessionRow): SessionRow => ({
  ...r,
  slot_variants: r.slot_variants && typeof r.slot_variants === 'object' ? r.slot_variants : {},
  custom_workout_id: r.custom_workout_id ?? null,
  extras: Array.isArray(r.extras) ? r.extras : [],
});
const normaliseWorkout = (r: CustomWorkout): CustomWorkout => ({ ...r, exercises: Array.isArray(r.exercises) ? r.exercises : [] });
const num = <T extends object>(rows: T[], keys: (keyof T)[]): T[] =>
  rows.map((r) => {
    const copy = { ...r };
    for (const k of keys) (copy as Record<keyof T, unknown>)[k] = Number(r[k]);
    return copy;
  });

const PAGE = 1000;
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

/** Loads everything; creates the settings row (with defaults) on first use. */
export async function loadFitness(client: SupabaseClient): Promise<FitnessData> {
  let { data: settings, error } = await client.from('fitness_settings').select(SETTINGS_COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  if (!settings) {
    const created = await client.from('fitness_settings').insert({}).select(SETTINGS_COLUMNS).single();
    if (created.error) throw new Error(created.error.message);
    settings = created.data;
  }
  const [weighIns, waists, away, diet, steps, slots, sessions, sets, presets, workouts] = await Promise.all([
    fetchAll<WeighInRow>((f, t) =>
      client.from('weigh_ins').select('id, day, measured_at, time_of_day, weight_kg, notes, deleted_at').is('deleted_at', null).order('measured_at').range(f, t),
    ),
    fetchAll<WaistRow>((f, t) =>
      client.from('waist_measurements').select('id, day, waist_cm, notes, deleted_at').is('deleted_at', null).order('day').range(f, t),
    ),
    fetchAll<AwayPeriod>((f, t) => client.from('away_periods').select('id, starts_on, ends_on, label').order('starts_on').range(f, t)),
    fetchAll<DietRow>((f, t) => client.from('diet_days').select('id, day, tag, kcal_estimate, notes').order('day').range(f, t)),
    fetchAll<StepRow>((f, t) => client.from('step_counts').select('id, day, steps, source').order('day').range(f, t)),
    fetchAll<SlotRow>((f, t) => client.from('program_slots').select('id, weekday, slot, label, default_sets, variants').range(f, t)),
    fetchAll<SessionRow>((f, t) =>
      client.from('workout_sessions').select(SESSION_COLUMNS).order('day').range(f, t),
    ),
    fetchAll<WorkoutSetRow>((f, t) =>
      client.from('workout_sets').select('id, session_id, slot, exercise, set_number, reps, weight_kg, notes').range(f, t),
    ),
    fetchAll<PresetRow>((f, t) => client.from('exercise_presets').select('id, exercise, weight_kg, reps').range(f, t)),
    fetchAll<CustomWorkout>((f, t) => client.from('custom_workouts').select(WORKOUT_COLUMNS).is('deleted_at', null).order('created_at').range(f, t)),
  ]);
  return {
    settings: normaliseSettings(settings as unknown as Record<string, unknown>),
    weighIns: num(weighIns, ['weight_kg']),
    waists: num(waists, ['waist_cm']),
    away,
    diet,
    steps,
    slots,
    sessions: sessions.map(normaliseSession),
    sets: num(sets, ['weight_kg']),
    presets: num(presets, ['weight_kg']),
    workouts: workouts.map(normaliseWorkout),
  };
}

const check = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export async function saveSettings(client: SupabaseClient, patch: Partial<FitnessSettings>): Promise<FitnessSettings> {
  const row = check(
    await client.from('fitness_settings').update({ ...patch, updated_at: new Date().toISOString() }).not('user_id', 'is', null).select(SETTINGS_COLUMNS).single(),
  );
  return normaliseSettings(row as unknown as Record<string, unknown>);
}

export async function addWeighIn(
  client: SupabaseClient,
  input: { day: string; weight_kg: number; time_of_day: WeighIn['time_of_day']; notes?: string | null },
): Promise<WeighInRow> {
  const row = check(
    await client.from('weigh_ins').insert(input).select('id, day, measured_at, time_of_day, weight_kg, notes, deleted_at').single(),
  ) as WeighInRow;
  return { ...row, weight_kg: Number(row.weight_kg) };
}

/** Soft delete / restore (undo-able); measurements are never hard-deleted. */
export async function setDeleted(client: SupabaseClient, table: 'weigh_ins' | 'waist_measurements', id: string, deleted: boolean) {
  check(await client.from(table).update({ deleted_at: deleted ? new Date().toISOString() : null }).eq('id', id).select('id').single());
}

export async function addWaist(client: SupabaseClient, input: { day: string; waist_cm: number; notes?: string | null }): Promise<WaistRow> {
  const row = check(await client.from('waist_measurements').insert(input).select('id, day, waist_cm, notes, deleted_at').single()) as WaistRow;
  return { ...row, waist_cm: Number(row.waist_cm) };
}

export async function upsertDiet(
  client: SupabaseClient,
  input: { day: string; tag: DietDay['tag']; kcal_estimate: number | null; notes: string | null },
): Promise<DietRow> {
  return check(
    await client
      .from('diet_days')
      .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' })
      .select('id, day, tag, kcal_estimate, notes')
      .single(),
  ) as DietRow;
}

export async function upsertSteps(client: SupabaseClient, day: string, steps: number): Promise<StepRow> {
  return check(
    await client
      .from('step_counts')
      .upsert({ day, steps, source: 'manual', updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' })
      .select('id, day, steps, source')
      .single(),
  ) as StepRow;
}

export async function addAway(client: SupabaseClient, input: { starts_on: string; ends_on: string; label: string | null }): Promise<AwayPeriod> {
  return check(await client.from('away_periods').insert(input).select('id, starts_on, ends_on, label').single()) as AwayPeriod;
}
export async function updateAway(client: SupabaseClient, id: string, input: { starts_on: string; ends_on: string; label: string | null }): Promise<AwayPeriod> {
  return check(await client.from('away_periods').update(input).eq('id', id).select('id, starts_on, ends_on, label').single()) as AwayPeriod;
}
/** Removing an away period only changes labels: measurements stay. */
export async function deleteAway(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('away_periods').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function upsertSlot(
  client: SupabaseClient,
  input: { weekday: number; slot: number; label: string; default_sets: number; variants: string[] },
): Promise<SlotRow> {
  return check(
    await client
      .from('program_slots')
      .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'user_id,weekday,slot' })
      .select('id, weekday, slot, label, default_sets, variants')
      .single(),
  ) as SlotRow;
}

export async function upsertSession(
  client: SupabaseClient,
  input: SessionInput,
): Promise<SessionRow> {
  return normaliseSession(
    check(
      await client
        .from('workout_sessions')
        .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' })
        .select(SESSION_COLUMNS)
        .single(),
    ) as SessionRow,
  );
}

/** Your own workout cards. Deleting only hides them (logged sets stay). */
export async function saveWorkout(client: SupabaseClient, input: Omit<CustomWorkout, 'id'>, id?: string): Promise<CustomWorkout> {
  const row = { ...input, updated_at: new Date().toISOString() };
  const q = id ? client.from('custom_workouts').update(row).eq('id', id) : client.from('custom_workouts').insert(row);
  return normaliseWorkout(check(await q.select(WORKOUT_COLUMNS).single()) as CustomWorkout);
}
export async function hideWorkout(client: SupabaseClient, id: string): Promise<void> {
  check(await client.from('custom_workouts').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single());
}

export async function addSet(
  client: SupabaseClient,
  input: { session_id: string; slot: number; exercise: string; set_number: number; reps: number; weight_kg: number },
): Promise<WorkoutSetRow> {
  const row = check(
    await client.from('workout_sets').insert(input).select('id, session_id, slot, exercise, set_number, reps, weight_kg, notes').single(),
  ) as WorkoutSetRow;
  return { ...row, weight_kg: Number(row.weight_kg) };
}
export async function deleteSet(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('workout_sets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Remembers the latest weight × reps for an exercise (pre-fills next time). */
export async function upsertPreset(client: SupabaseClient, exercise: string, weight_kg: number, reps: number): Promise<PresetRow> {
  const row = check(
    await client
      .from('exercise_presets')
      .upsert({ exercise: exercise.trim(), weight_kg, reps, updated_at: new Date().toISOString() }, { onConflict: 'user_id,exercise_key' })
      .select('id, exercise, weight_kg, reps')
      .single(),
  ) as PresetRow;
  return { ...row, weight_kg: Number(row.weight_kg) };
}
export async function deletePreset(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('exercise_presets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Writes a parsed reference file: every program slot (upsert, so re-importing
 * just updates), plus day focus, finishers, key lifts and snapshot targets.
 * Logged sessions and sets are never touched.
 */
export async function importReference(
  client: SupabaseClient,
  parsed: ParsedReference,
  keyLifts: KeyLiftGroup[],
): Promise<{ slots: SlotRow[]; settings: FitnessSettings }> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('program_slots')
    .upsert(
      parsed.slots.map((s) => ({ weekday: s.weekday, slot: s.slot, label: s.label, default_sets: s.sets, variants: s.variants, updated_at: now })),
      { onConflict: 'user_id,weekday,slot' },
    )
    .select('id, weekday, slot, label, default_sets, variants');
  if (error) throw new Error(error.message);
  const patch: Partial<FitnessSettings> = { day_focus: parsed.dayFocus, finishers: parsed.finishers, key_lifts: keyLifts };
  if (parsed.baselineDate) patch.phase_start = parsed.baselineDate;
  if (parsed.stepsTarget !== null) patch.steps_target = parsed.stepsTarget;
  if (parsed.phaseMonths !== null) patch.phase_months = parsed.phaseMonths;
  const settings = await saveSettings(client, patch);
  return { slots: (data ?? []) as SlotRow[], settings };
}
