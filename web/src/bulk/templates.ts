/**
 * Bulk templates: what each one looks like and how a filled-in file becomes
 * rows to add. Pure. Import only adds; rows already here are skipped.
 */
import { guessCategory, parseAmount } from '../finance/mdImport';
import { validateTransaction, type FinanceDoc, type TransactionInput } from '../finance/model';
import type { FitnessData } from '../fitness/fitnessApi';
import { excelDate, readXlsx } from '../lib/xlsx';
import { parseCsv, toCsv, type RowError } from '../nutrition/backup';

export const FINANCE_COLUMNS = ['date', 'amount', 'category', 'method', 'note', 'one_off'] as const;
export const MEASURE_COLUMNS = ['date', 'weight_kg', 'time_of_day', 'waist_cm', 'steps', 'note'] as const;
export const WORKOUT_COLUMNS = ['date', 'exercise', 'set', 'weight_kg', 'reps'] as const;

/** Slots from here on hold exercises that aren't part of a day's plan. */
const FREE_SLOT = 21;
const LAST_SLOT = 40;
const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export type Table = string[][];

/** Spreadsheets rewrite dates when saved, so the common shapes are all accepted. Day comes first in DD/MM/YYYY. */
export function readDate(raw: string): string | null {
  const s = raw.trim();
  const build = (y: number, m: number, d: number) => {
    const out = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const t = new Date(`${out}T00:00:00Z`);
    return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === out ? out : null;
  };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return build(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{4})$/);
  if (m && MONTHS.includes(m[2].toLowerCase())) return build(Number(m[3]), MONTHS.indexOf(m[2].toLowerCase()) + 1, Number(m[1]));
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelDate(Number(s));
  return null;
}

/** A .csv or .xlsx file as rows of text. */
export async function readTable(file: File): Promise<Table> {
  if (/\.xlsx$/i.test(file.name)) {
    const [sheet] = await readXlsx(await file.arrayBuffer());
    return (sheet?.rows ?? []).map((r) => r.map(String)).filter((r) => r.some((c) => c.trim() !== ''));
  }
  return parseCsv(await file.text());
}

const isExample = (row: string[]) => row.some((c) => /^\s*example\b/i.test(c));

/** The table without the template's example rows, with each row's line in the file. */
function records(table: Table): { line: number; r: Record<string, string> }[] {
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  return table.slice(1).flatMap((row, i) => (isExample(row) ? [] : [{ line: i + 2, r: Object.fromEntries(header.map((h, c) => [h, (row[c] ?? '').trim()])) }]));
}

export const dropExamples = (table: Table): Table => table.filter((r, i) => i === 0 || !isExample(r));

/** The table back as CSV text (for the importers that read CSV). */
export function tableToCsv(table: Table): string {
  const header = table[0] ?? [];
  return toCsv(header, table.slice(1).map((row) => Object.fromEntries(header.map((h, c) => [h, row[c] ?? '']))));
}

/** Null when a column the template needs is missing. */
export function missingColumn(table: Table, needed: readonly string[]): string | null {
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  return needed.find((c) => !header.includes(c)) ?? null;
}

const number = (s: string) => (s === '' ? null : Number(s.replace(/,/g, '')));

// ---------- finance ----------

export interface FinancePlan {
  transactions: TransactionInput[];
  duplicates: number;
  errors: RowError[];
}

export function planFinance(table: Table, doc: FinanceDoc): FinancePlan {
  const { categories, methods } = doc.settings;
  // Each existing row can only match one row of the file, so two equal real expenses both survive.
  const seen = new Map<string, number>();
  const key = (date: string, amount: number, method: string) => `${date}|${amount}|${method}`;
  for (const t of doc.transactions) if (!t.deletedAt) seen.set(key(t.date, t.amount, t.method), (seen.get(key(t.date, t.amount, t.method)) ?? 0) + 1);
  const out: FinancePlan = { transactions: [], duplicates: 0, errors: [] };
  for (const { line, r } of records(table)) {
    const bad = (message: string) => out.errors.push({ where: `Row ${line}`, message });
    const date = readDate(r.date ?? '');
    if (!date) {
      bad(`“${r.date ?? ''}” isn’t a date. Use YYYY-MM-DD.`);
      continue;
    }
    const { paise } = parseAmount(r.amount ?? '');
    if (paise === null) {
      bad('The amount is missing.');
      continue;
    }
    const method = methods.find((m) => m.toLowerCase() === (r.method ?? '').toLowerCase());
    if (!method) {
      bad(`“${r.method ?? ''}” isn’t a payment method. Use one of: ${methods.join(', ')}.`);
      continue;
    }
    const note = r.note || null;
    const input: TransactionInput = { date, amount: paise, category: guessCategory(r.category ?? '', note ?? '', categories).category, method, note, oneOff: /^(y|yes|true|1)$/i.test(r.one_off ?? '') || undefined };
    const problem = validateTransaction(input, doc.settings);
    if (problem) {
      bad(problem);
      continue;
    }
    const k = key(date, paise, method);
    const left = seen.get(k) ?? 0;
    if (left > 0) {
      seen.set(k, left - 1);
      out.duplicates += 1;
    } else out.transactions.push(input);
  }
  return out;
}

// ---------- fitness ----------

export interface MeasurementPlan {
  weighIns: { day: string; weight_kg: number; time_of_day: (typeof TIMES)[number]; notes: string | null; measured_at: string }[];
  waists: { day: string; waist_cm: number; notes: string | null }[];
  steps: { day: string; steps: number }[];
  duplicates: number;
  errors: RowError[];
}

export function planMeasurements(table: Table, data: Pick<FitnessData, 'weighIns' | 'waists' | 'steps'>): MeasurementPlan {
  const weights = new Set(data.weighIns.map((w) => `${w.day}|${w.weight_kg}`));
  const waists = new Set(data.waists.map((w) => `${w.day}|${w.waist_cm}`));
  const stepDays = new Set(data.steps.map((s) => s.day));
  const out: MeasurementPlan = { weighIns: [], waists: [], steps: [], duplicates: 0, errors: [] };
  for (const { line, r } of records(table)) {
    const bad = (message: string) => out.errors.push({ where: `Row ${line}`, message });
    const day = readDate(r.date ?? '');
    if (!day) {
      bad(`“${r.date ?? ''}” isn’t a date. Use YYYY-MM-DD.`);
      continue;
    }
    const weight = number(r.weight_kg ?? '');
    const waist = number(r.waist_cm ?? '');
    const steps = number(r.steps ?? '');
    const time = (r.time_of_day || 'morning').toLowerCase() as (typeof TIMES)[number];
    const notes = r.note || null;
    if (weight === null && waist === null && steps === null) {
      bad('Fill in at least one of weight, waist or steps.');
      continue;
    }
    if (weight !== null && !(weight >= 20 && weight <= 300)) bad('Weight must be 20–300 kg.');
    else if (weight !== null && !TIMES.includes(time)) bad(`Time of day must be one of: ${TIMES.join(', ')}.`);
    else if (weight !== null) {
      if (weights.has(`${day}|${weight}`)) out.duplicates += 1;
      else {
        weights.add(`${day}|${weight}`);
        out.weighIns.push({ day, weight_kg: weight, time_of_day: time, notes, measured_at: `${day}T12:00:00Z` });
      }
    }
    if (waist !== null && !(waist >= 30 && waist <= 250)) bad('Waist must be 30–250 cm.');
    else if (waist !== null) {
      if (waists.has(`${day}|${waist}`)) out.duplicates += 1;
      else {
        waists.add(`${day}|${waist}`);
        out.waists.push({ day, waist_cm: waist, notes });
      }
    }
    if (steps !== null && !(Number.isInteger(steps) && steps >= 0 && steps <= 200000)) bad('Steps must be a whole number up to 200,000.');
    else if (steps !== null) {
      // One count per day: the one you already have stays.
      if (stepDays.has(day)) out.duplicates += 1;
      else {
        stepDays.add(day);
        out.steps.push({ day, steps });
      }
    }
  }
  return out;
}

export interface WorkoutDayPlan {
  day: string;
  /** The day's session, when there already is one. */
  sessionId: string | null;
  sets: { exercise: string; slot: number; set_number: number; reps: number; weight_kg: number }[];
}
export interface WorkoutPlan {
  days: WorkoutDayPlan[];
  sets: number;
  duplicates: number;
  errors: RowError[];
}

export function planWorkouts(table: Table, data: Pick<FitnessData, 'sessions' | 'sets'>): WorkoutPlan {
  const out: WorkoutPlan = { days: [], sets: 0, duplicates: 0, errors: [] };
  const byDay = new Map<string, WorkoutDayPlan & { taken: Set<string>; slots: Map<string, number>; next: Map<string, number>; free: number }>();
  const open = (day: string) => {
    const hit = byDay.get(day);
    if (hit) return hit;
    const session = data.sessions.find((s) => s.day === day);
    const existing = session ? data.sets.filter((x) => x.session_id === session.id) : [];
    const name = (e: string) => e.trim().toLowerCase();
    const plan = {
      day,
      sessionId: session?.id ?? null,
      sets: [],
      taken: new Set(existing.map((x) => `${name(x.exercise)}|${x.set_number}`)),
      slots: new Map(existing.map((x) => [name(x.exercise), x.slot])),
      next: new Map<string, number>(),
      free: Math.max(FREE_SLOT, ...existing.map((x) => x.slot + 1)),
    };
    for (const x of existing) plan.next.set(name(x.exercise), Math.max(plan.next.get(name(x.exercise)) ?? 1, x.set_number + 1));
    byDay.set(day, plan);
    return plan;
  };
  for (const { line, r } of records(table)) {
    const bad = (message: string) => out.errors.push({ where: `Row ${line}`, message });
    const day = readDate(r.date ?? '');
    const exercise = r.exercise ?? '';
    const given = number(r.set ?? '');
    const weight = number(r.weight_kg ?? '') ?? 0;
    const reps = number(r.reps ?? '');
    if (!day) bad(`“${r.date ?? ''}” isn’t a date. Use YYYY-MM-DD.`);
    else if (!exercise) bad('The exercise is missing.');
    else if (reps === null || !Number.isInteger(reps) || reps < 0 || reps > 200) bad('Reps must be a whole number up to 200.');
    else if (!(weight >= 0 && weight <= 1000)) bad('Weight must be 0–1000 kg.');
    else if (given !== null && !(Number.isInteger(given) && given >= 1 && given <= 20)) bad('Set must be a number from 1 to 20.');
    else {
      const plan = open(day);
      const name = exercise.toLowerCase();
      const set_number = given ?? plan.next.get(name) ?? 1;
      if (set_number > 20) {
        bad('More than 20 sets of this exercise.');
        continue;
      }
      plan.next.set(name, Math.max(plan.next.get(name) ?? 1, set_number + 1));
      if (plan.taken.has(`${name}|${set_number}`)) {
        out.duplicates += 1;
        continue;
      }
      let slot = plan.slots.get(name);
      if (slot === undefined) {
        if (plan.free > LAST_SLOT) {
          bad('Too many different exercises on this day (20 is the most).');
          continue;
        }
        slot = plan.free++;
        plan.slots.set(name, slot);
      }
      plan.taken.add(`${name}|${set_number}`);
      plan.sets.push({ exercise, slot, set_number, reps, weight_kg: weight });
      out.sets += 1;
    }
  }
  out.days = [...byDay.values()].filter((d) => d.sets.length).map(({ day, sessionId, sets }) => ({ day, sessionId, sets }));
  return out;
}
