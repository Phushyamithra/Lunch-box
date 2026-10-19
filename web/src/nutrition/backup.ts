/**
 * Nutrition import / export. Pure.
 *
 * - JSON backup: versioned (`schema` + `version`), holds your profile,
 *   every target version, your own foods (incl. edited copies of menu and
 *   catalog items) and the food log with its nutrient snapshots.
 * - CSV: food log and foods, header-based, Excel-friendly.
 *
 * Importing only ever *adds*: nothing existing is overwritten or deleted.
 * Rows already present (same id, or same contents) are reported as
 * duplicates and skipped; invalid rows are listed with their row number.
 */
import type { MacroTargets, Profile } from './engine';
import { MEALS, NUTRIENT_KEYS, validateFood, type Basis, type DietType, type Entry, type Food, type FoodInput, type MealSlot, type Nutrients, type Portion, type Verification } from './foodLog';
import type { NutritionData, TargetRow } from './nutritionApi';

export const BACKUP_SCHEMA = 'tracker.nutrition';
export const BACKUP_VERSION = 1;

export interface BackupFood extends FoodInput {
  id: string;
  verification: Verification;
  notes: string | null;
}
export type BackupEntry = Omit<Entry, 'deleted_at'>;
export type BackupTarget = Omit<TargetRow, 'created_at'> & { created_at?: string };

export interface Backup {
  schema: typeof BACKUP_SCHEMA;
  version: number;
  exported_at: string;
  profile: Profile | null;
  targets: BackupTarget[];
  foods: BackupFood[];
  entries: BackupEntry[];
}

const FOOD_FIELDS = ['name', 'brand', 'diet', 'basis', 'serving_g', 'portions', ...NUTRIENT_KEYS, 'parent_food_id', 'barcode', 'source', 'source_url'] as const;

const toBackupFood = (f: Food): BackupFood => ({
  ...(Object.fromEntries(FOOD_FIELDS.map((k) => [k, f[k] ?? null])) as unknown as FoodInput),
  id: f.id,
  verification: f.verification,
  notes: f.notes ?? null,
  source: f.source,
});

/** Your data only: shared catalog foods and menus are not copied (entries keep their snapshot). */
export function buildBackup(data: NutritionData, now = new Date()): Backup {
  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    profile: data.profile,
    targets: data.targets,
    foods: data.foods.filter((f) => f.user_id !== null).map(toBackupFood),
    entries: data.entries.filter((e) => !e.deleted_at).map(({ deleted_at: _d, ...e }) => e),
  };
}

// ---------- validation ----------

const MEAL_KEYS = MEALS.map((m) => m.key) as string[];
const BASES: Basis[] = ['100g', '100ml', 'serving'];
const DIETS: DietType[] = ['veg', 'vegan', 'egg', 'nonveg'];
const VERIFICATIONS: Verification[] = ['official', 'estimated', 'user'];
const SOURCES: Entry['source'][] = ['food', 'quick', 'meal_prep', 'restaurant'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isDay = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const text = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());

export interface RowError {
  /** What the row is (e.g. "Food log row 4"). */
  where: string;
  message: string;
}

function readNutrients(r: Record<string, unknown>, needKcal = true): { n: Nutrients } | { error: string } {
  const out: Record<string, number | null> = {};
  for (const k of NUTRIENT_KEYS) {
    const v = num(r[k]);
    if (v !== null && Number.isNaN(v)) return { error: `${k} isn’t a number (“${String(r[k])}”).` };
    if (v !== null && v < 0) return { error: `${k} can’t be negative.` };
    out[k] = v;
  }
  if (out.kcal === null && needKcal) return { error: 'kcal is missing.' };
  return {
    n: {
      kcal: out.kcal ?? 0,
      protein: out.protein ?? 0,
      carbs: out.carbs ?? 0,
      fat: out.fat ?? 0,
      fibre: out.fibre ?? 0,
      sugar: out.sugar,
      sodium_mg: out.sodium_mg,
    },
  };
}

/** One food-log row (backup or CSV) → a clean entry, or what's wrong with it. */
export function readEntry(r: Record<string, unknown>): { entry: BackupEntry } | { error: string } {
  if (!isDay(r.day)) return { error: `day must be a date like 2026-10-19 (got “${String(r.day ?? '')}”).` };
  const meal = String(r.meal ?? '').trim().toLowerCase();
  if (!MEAL_KEYS.includes(meal)) return { error: `meal must be one of ${MEAL_KEYS.join(', ')} (got “${String(r.meal ?? '')}”).` };
  const name = text(r.name);
  if (!name || name.length > 160) return { error: 'name is missing or longer than 160 characters.' };
  const quantity = num(r.quantity) ?? 1;
  if (!(quantity > 0)) return { error: 'quantity must be more than 0.' };
  const unit = text(r.unit) ?? 'serving';
  if (unit.length > 60) return { error: 'unit is longer than 60 characters.' };
  const grams = num(r.grams);
  if (grams !== null && !(grams >= 0)) return { error: 'grams must be 0 or more.' };
  const nut = readNutrients(r);
  if ('error' in nut) return nut;
  const verification = (text(r.verification) ?? 'user') as Verification;
  if (!VERIFICATIONS.includes(verification)) return { error: `verification must be official, estimated or user.` };
  const source = (text(r.source) ?? 'quick') as Entry['source'];
  if (!SOURCES.includes(source)) return { error: `source must be one of ${SOURCES.join(', ')}.` };
  const loggedAt = text(r.logged_at);
  const id = text(r.id);
  return {
    entry: {
      id: id && UUID.test(id) ? id : '',
      day: r.day as string,
      meal: meal as MealSlot,
      food_id: text(r.food_id),
      meal_log_id: text(r.meal_log_id),
      source,
      name,
      quantity,
      unit,
      grams,
      verification,
      logged_at: loggedAt && !Number.isNaN(Date.parse(loggedAt)) ? new Date(loggedAt).toISOString() : `${r.day}T12:00:00.000Z`,
      ...nut.n,
    },
  };
}

const readPortions = (v: unknown): Portion[] | null => {
  if (v === null || v === undefined || v === '') return [];
  if (Array.isArray(v)) {
    const out = v.map((p) => ({ label: String(p?.label ?? '').trim(), grams: Number(p?.grams) }));
    return out;
  }
  // CSV form: "1 katori:150; 1 piece:40"
  const out: Portion[] = [];
  for (const part of String(v).split(';')) {
    if (!part.trim()) continue;
    const i = part.lastIndexOf(':');
    if (i < 0) return null;
    out.push({ label: part.slice(0, i).trim(), grams: Number(part.slice(i + 1).trim()) });
  }
  return out;
};

/** One food row (backup or CSV) → a clean food, or what's wrong with it. */
export function readFood(r: Record<string, unknown>): { food: BackupFood } | { error: string } {
  const name = text(r.name);
  if (!name) return { error: 'name is missing.' };
  const basis = (text(r.basis) ?? '100g').toLowerCase() as Basis;
  if (!BASES.includes(basis)) return { error: `basis must be 100g, 100ml or serving (got “${String(r.basis)}”).` };
  const dietRaw = text(r.diet)?.toLowerCase().replace(/[^a-z]/g, '') ?? null;
  const diet = dietRaw as DietType | null;
  if (diet !== null && !DIETS.includes(diet)) return { error: `diet must be veg, vegan, egg or nonveg.` };
  const serving = num(r.serving_g);
  if (serving !== null && Number.isNaN(serving)) return { error: 'serving_g isn’t a number.' };
  const portions = readPortions(r.portions);
  if (!portions) return { error: 'portions must look like “1 katori:150; 1 piece:40”.' };
  const nut = readNutrients(r);
  if ('error' in nut) return nut;
  const barcode = text(r.barcode)?.replace(/\D/g, '') || null;
  const verification = (text(r.verification) ?? 'user') as Verification;
  const id = text(r.id);
  const food: BackupFood = {
    id: id && UUID.test(id) ? id : '',
    name,
    brand: text(r.brand),
    diet,
    basis,
    serving_g: serving,
    portions,
    ...nut.n,
    parent_food_id: text(r.parent_food_id),
    barcode,
    source: text(r.source) ?? 'user',
    source_url: text(r.source_url),
    verification: VERIFICATIONS.includes(verification) ? verification : 'user',
    notes: text(r.notes),
  };
  const problem = validateFood(food);
  return problem ? { error: problem } : { food };
}

function readTarget(r: Record<string, unknown>): { target: BackupTarget } | { error: string } {
  if (!isDay(r.effective_from)) return { error: 'effective_from must be a date.' };
  const keys: (keyof MacroTargets)[] = ['kcal', 'protein_min', 'protein_max', 'protein_g', 'fat_min', 'fat_max', 'fat_g', 'carbs_g', 'fibre_g'];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = num(r[k]);
    if (v === null || Number.isNaN(v) || v < 0) return { error: `${k} must be a number.` };
    out[k] = v;
  }
  const mode = text(r.mode) ?? 'custom';
  if (!['deficit', 'maintenance', 'recomp', 'lean_bulk', 'custom'].includes(mode)) return { error: 'mode is not recognised.' };
  const rate = num(r.rate_kg_month);
  return {
    target: {
      ...(out as unknown as MacroTargets),
      id: text(r.id) ?? '',
      effective_from: r.effective_from as string,
      mode: mode as TargetRow['mode'],
      rate_kg_month: rate === null || Number.isNaN(rate) ? null : rate,
      reason: text(r.reason) ?? 'Imported',
      inputs: r.inputs && typeof r.inputs === 'object' && !Array.isArray(r.inputs) ? (r.inputs as Record<string, unknown>) : {},
      created_at: text(r.created_at) ?? undefined,
    },
  };
}

function readProfile(v: unknown): Profile | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const by = Number(p.birth_year);
  const h = Number(p.height_cm);
  if (!['male', 'female'].includes(String(p.sex)) || !(by > 1900 && by < 2100) || !(h > 80 && h < 260)) return null;
  if (!['sedentary', 'light', 'moderate', 'very', 'extra'].includes(String(p.activity))) return null;
  return { sex: p.sex as Profile['sex'], birth_year: by, height_cm: h, activity: p.activity as Profile['activity'] };
}

export interface ParsedImport {
  kind: 'backup' | 'log_csv' | 'foods_csv';
  profile: Profile | null;
  targets: BackupTarget[];
  foods: BackupFood[];
  entries: BackupEntry[];
  errors: RowError[];
  /** When the file was made (backups). */
  exportedAt: string | null;
}

/** A JSON backup → its clean rows, or a reason it can't be read at all. */
export function parseBackup(raw: string): ParsedImport | { fatal: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(raw.replace(/^﻿/, ''));
  } catch {
    return { fatal: 'This file isn’t valid JSON.' };
  }
  if (!obj || typeof obj !== 'object' || (obj as Backup).schema !== BACKUP_SCHEMA) return { fatal: 'This isn’t a Tracker nutrition backup.' };
  const b = obj as Partial<Backup>;
  if (typeof b.version !== 'number' || b.version < 1) return { fatal: 'The backup has no version number.' };
  if (b.version > BACKUP_VERSION) return { fatal: `This backup was made by a newer version of the app (format ${b.version}; this app reads up to ${BACKUP_VERSION}). Update the app first.` };
  const out: ParsedImport = { kind: 'backup', profile: readProfile(b.profile), targets: [], foods: [], entries: [], errors: [], exportedAt: typeof b.exported_at === 'string' ? b.exported_at : null };
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  list(b.targets).forEach((r, i) => {
    const t = readTarget(r ?? {});
    if ('error' in t) out.errors.push({ where: `Target ${i + 1}`, message: t.error });
    else out.targets.push(t.target);
  });
  list(b.foods).forEach((r, i) => {
    const f = readFood(r ?? {});
    if ('error' in f) out.errors.push({ where: `Food ${i + 1} (${String(r?.name ?? '?')})`, message: f.error });
    else out.foods.push(f.food);
  });
  list(b.entries).forEach((r, i) => {
    const e = readEntry(r ?? {});
    if ('error' in e) out.errors.push({ where: `Log entry ${i + 1}`, message: e.error });
    else out.entries.push(e.entry);
  });
  return out;
}

// ---------- CSV ----------

/** RFC 4180: quotes, doubled quotes, commas and newlines inside quotes; tolerates a BOM and CRLF. */
export function parseCsv(raw: string): string[][] {
  const s = raw.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Cells starting with = + - @ would run as formulas in a spreadsheet; prefix a quote. Numbers are left alone. */
const safeCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const unsafe = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

export function toCsv(header: readonly string[], rows: Record<string, unknown>[]): string {
  return '﻿' + [header.join(','), ...rows.map((r) => header.map((h) => safeCell(r[h])).join(','))].join('\r\n') + '\r\n';
}

export const LOG_COLUMNS = ['day', 'meal', 'name', 'quantity', 'unit', 'grams', ...NUTRIENT_KEYS, 'verification', 'source', 'logged_at', 'id'] as const;
export const FOOD_COLUMNS = ['name', 'brand', 'diet', 'basis', 'serving_g', 'portions', ...NUTRIENT_KEYS, 'barcode', 'source', 'source_url', 'verification', 'notes', 'id'] as const;

export const entriesToCsv = (entries: Entry[]) =>
  toCsv(
    LOG_COLUMNS,
    entries.filter((e) => !e.deleted_at).sort((a, b) => a.day.localeCompare(b.day) || a.logged_at.localeCompare(b.logged_at)) as unknown as Record<string, unknown>[],
  );
export const foodsToCsv = (foods: Food[]) =>
  toCsv(
    FOOD_COLUMNS,
    foods
      .filter((f) => f.user_id !== null)
      .map((f) => ({ ...f, portions: f.portions.map((p) => `${p.label}:${p.grams}`).join('; ') })),
  );

/** Header aliases so a hand-made sheet works too. */
const ALIASES: Record<string, string> = {
  date: 'day',
  food: 'name',
  item: 'name',
  qty: 'quantity',
  calories: 'kcal',
  energy: 'kcal',
  energy_kcal: 'kcal',
  carbohydrates: 'carbs',
  carbohydrate: 'carbs',
  fiber: 'fibre',
  sodium: 'sodium_mg',
  sugars: 'sugar',
  serving_size_g: 'serving_g',
  serving: 'serving_g',
};
const headerKey = (h: string) => {
  const k = h
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .trim()
    .replace(/[\s-]+/g, '_');
  return ALIASES[k] ?? k;
};

/** A CSV of food-log rows or foods → clean rows; the kind is told by the headers. */
export function parseCsvImport(raw: string): ParsedImport | { fatal: string } {
  const rows = parseCsv(raw);
  if (rows.length < 2) return { fatal: 'The CSV has no rows under the header.' };
  const header = rows[0].map(headerKey);
  const kind = header.includes('day') && header.includes('meal') ? 'log_csv' : header.includes('name') && header.includes('kcal') ? 'foods_csv' : null;
  if (!kind) return { fatal: 'Couldn’t tell what this CSV holds. A food log needs day, meal, name and kcal columns; foods need name and kcal.' };
  const out: ParsedImport = { kind, profile: null, targets: [], foods: [], entries: [], errors: [], exportedAt: null };
  rows.slice(1).forEach((cells, i) => {
    const r = Object.fromEntries(header.map((h, j) => [h, unsafe(cells[j] ?? '')]));
    const where = `Row ${i + 2}`;
    if (kind === 'log_csv') {
      const e = readEntry(r);
      if ('error' in e) out.errors.push({ where, message: e.error });
      else out.entries.push(e.entry);
    } else {
      const f = readFood(r);
      if ('error' in f) out.errors.push({ where: `${where} (${r.name || '?'})`, message: f.error });
      else out.foods.push(f.food);
    }
  });
  return out;
}

export function parseImportFile(name: string, raw: string): ParsedImport | { fatal: string } {
  const trimmed = raw.replace(/^﻿/, '').trimStart();
  if (/\.json$/i.test(name) || trimmed.startsWith('{')) return parseBackup(raw);
  return parseCsvImport(raw);
}

// ---------- planning ----------

const r1 = (v: number) => Math.round(v * 10) / 10;
const foodKey = (f: Pick<FoodInput, 'name' | 'brand' | 'basis' | 'kcal' | 'protein'>) =>
  [f.name.trim().toLowerCase(), (f.brand ?? '').trim().toLowerCase(), f.basis, Math.round(f.kcal), r1(f.protein)].join('|');
const entryKey = (e: Pick<Entry, 'day' | 'meal' | 'name' | 'quantity' | 'unit' | 'kcal'>) =>
  [e.day, e.meal, e.name.trim().toLowerCase(), r1(e.quantity), e.unit.trim().toLowerCase(), Math.round(e.kcal)].join('|');
const targetKey = (t: Pick<TargetRow, 'effective_from' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>) =>
  [t.effective_from, Math.round(t.kcal), Math.round(t.protein_g), Math.round(t.carbs_g), Math.round(t.fat_g)].join('|');

export interface ImportPlan {
  /** New rows, with fresh ids and links already remapped to them. */
  foods: (FoodInput & { id: string; notes: string | null })[];
  entries: (Omit<BackupEntry, 'id'> & { id: string })[];
  targets: Omit<BackupTarget, 'created_at'>[];
  /** Set only when you have no profile yet. */
  profile: Profile | null;
  duplicates: { foods: number; entries: number; targets: number };
  /** Notes about what was adjusted (e.g. links that couldn't be kept). */
  notes: string[];
  /** The backup's profile differs from yours and was left alone. */
  profileKept: boolean;
}

/**
 * What an import would add to your current data. Nothing is overwritten:
 * duplicates are skipped, ids are fresh, food links that point at foods you
 * don't have are dropped (the entry keeps its nutrient snapshot), and
 * meal-prep delivery links are dropped (they can't be checked from here).
 */
export function planImport(current: NutritionData, incoming: ParsedImport, newId: () => string): ImportPlan {
  const notes: string[] = [];
  const knownIds = new Set(current.foods.map((f) => f.id));
  const ownKeys = new Set(current.foods.filter((f) => f.user_id !== null).map(foodKey));
  const barcodes = new Map(current.foods.filter((f) => f.user_id !== null && f.barcode).map((f) => [f.barcode as string, f.id]));
  const idMap = new Map<string, string>();
  const dup = { foods: 0, entries: 0, targets: 0 };

  const foods: ImportPlan['foods'] = [];
  for (const f of incoming.foods) {
    if (f.id && knownIds.has(f.id)) {
      idMap.set(f.id, f.id);
      dup.foods++;
      continue;
    }
    const sameBarcode = f.barcode ? barcodes.get(f.barcode) : undefined;
    if (sameBarcode || ownKeys.has(foodKey(f))) {
      const existing = sameBarcode ?? current.foods.find((c) => c.user_id !== null && foodKey(c) === foodKey(f))?.id;
      if (f.id && existing) idMap.set(f.id, existing);
      dup.foods++;
      continue;
    }
    const id = newId();
    if (f.id) idMap.set(f.id, id);
    ownKeys.add(foodKey(f));
    if (f.barcode) barcodes.set(f.barcode, id);
    const { verification: _v, ...rest } = f;
    foods.push({ ...rest, id });
  }
  let droppedParents = 0;
  for (const f of foods) {
    if (!f.parent_food_id) continue;
    const mapped = idMap.get(f.parent_food_id) ?? (knownIds.has(f.parent_food_id) ? f.parent_food_id : null);
    if (!mapped) droppedParents++;
    f.parent_food_id = mapped;
  }
  // Parents before their copies.
  const order = new Map(foods.map((f) => [f.id, f]));
  const sorted: ImportPlan['foods'] = [];
  const visit = (f: ImportPlan['foods'][number], depth = 0) => {
    if (!order.has(f.id) || depth > 20) return;
    order.delete(f.id);
    const parent = f.parent_food_id ? foods.find((p) => p.id === f.parent_food_id) : undefined;
    if (parent) visit(parent, depth + 1);
    sorted.push(f);
  };
  foods.forEach((f) => visit(f));

  const liveIds = new Set(current.entries.map((e) => e.id));
  const liveKeys = new Set(current.entries.filter((e) => !e.deleted_at).map(entryKey));
  const entries: ImportPlan['entries'] = [];
  let unlinked = 0;
  let deliveries = 0;
  for (const e of incoming.entries) {
    if ((e.id && liveIds.has(e.id)) || liveKeys.has(entryKey(e))) {
      dup.entries++;
      continue;
    }
    liveKeys.add(entryKey(e));
    let foodId = e.food_id;
    if (foodId) {
      foodId = idMap.get(foodId) ?? (knownIds.has(foodId) ? foodId : null);
      if (!foodId) unlinked++;
    }
    if (e.meal_log_id) deliveries++;
    entries.push({ ...e, id: newId(), food_id: foodId, meal_log_id: null });
  }

  const tKeys = new Set(current.targets.map(targetKey));
  const targets: ImportPlan['targets'] = [];
  for (const t of incoming.targets) {
    if (tKeys.has(targetKey(t))) {
      dup.targets++;
      continue;
    }
    tKeys.add(targetKey(t));
    const { created_at: _c, ...rest } = t;
    targets.push({ ...rest, id: newId() });
  }

  const sameProfile = (a: Profile, b: Profile) => a.sex === b.sex && a.birth_year === b.birth_year && a.height_cm === b.height_cm && a.activity === b.activity;
  const profile = incoming.profile && !current.profile ? incoming.profile : null;
  const profileKept = !!(incoming.profile && current.profile && !sameProfile(incoming.profile, current.profile));

  if (droppedParents) notes.push(`${droppedParents} edited cop${droppedParents === 1 ? 'y' : 'ies'} point at an original you don't have; they're added as standalone foods.`);
  if (unlinked) notes.push(`${unlinked} log entr${unlinked === 1 ? 'y points' : 'ies point'} at a food you don't have; ${unlinked === 1 ? 'it keeps its' : 'they keep their'} logged nutrients.`);
  if (deliveries) notes.push(`${deliveries} meal-prep entr${deliveries === 1 ? 'y' : 'ies'} won't be linked to a delivery (nutrients are kept).`);
  if (targets.length) notes.push('Target versions are added to your history; the newest by date stays in force, as usual.');
  if (profileKept) notes.push('Your current profile is kept (the file’s profile is different).');

  return { foods: sorted, entries, targets, profile, duplicates: dup, notes, profileKept };
}

export const planIsEmpty = (p: ImportPlan) => !p.foods.length && !p.entries.length && !p.targets.length && !p.profile;

/** File names like tracker-nutrition-2026-10-19.json */
export const exportName = (what: 'backup' | 'food-log' | 'foods', day: string) => `tracker-nutrition-${what === 'backup' ? '' : `${what}-`}${day}.${what === 'backup' ? 'json' : 'csv'}`;
