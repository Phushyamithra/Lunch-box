import { describe, expect, it } from 'vitest';
import type { FitnessData } from '../fitness/fitnessApi';
import { LEAN_BULK_PRESET } from '../nutrition/engine';
import type { Entry } from '../nutrition/foodLog';
import type { NutritionData } from '../nutrition/nutritionApi';
import { summariseGoal } from '../goals/engine';
import { buildMarkdownReport, reportFileName } from './markdownReport';

const settings = {
  gain_target_kg_month: 0.4,
  gain_high_kg_month: 0.6,
  gain_low_kg_month: 0.2,
  kcal_target: 2450,
  protein_min_g: 140,
  protein_max_g: 150,
  fat_min_g: 55,
  fat_max_g: 75,
  carbs_target_g: 295,
  waist_interval_days: 14,
  rotation_start: '2026-09-14',
  rotation_offset: 0,
  phase_start: '2026-09-14',
  phase_months: 9,
  key_lifts: [{ label: 'Bench / chest press', exercises: ['Barbell Bench'] }],
  weigh_time: 'morning',
  steps_target: 10000,
  cardio_per_week: 3,
  rest_compound_sec: 150,
  rest_isolation_sec: 75,
  day_focus: { '1': 'Chest + Triceps', '2': 'Back + Biceps' },
  finishers: [],
  reminders: { weigh_days: [1, 3, 5], weigh_time: '07:00', waist_time: '07:00', review_day: 17 },
} as unknown as FitnessData['settings'];

const weigh = (day: string, kg: number, time: 'morning' | 'evening' = 'morning') => ({
  id: `${day}-${time}`,
  day,
  measured_at: `${day}T${time === 'morning' ? '02' : '13'}:00:00Z`,
  time_of_day: time,
  weight_kg: kg,
  notes: null,
  deleted_at: null,
});
// Five weeks of Mon/Wed/Fri morning weigh-ins, +0.1 kg a week.
const weighIns = [0, 1, 2, 3, 4].flatMap((w) =>
  [0, 2, 4].map((i) => weigh(new Date(Date.UTC(2026, 8, 14 + w * 7 + i)).toISOString().slice(0, 10), 66.5 + w * 0.1)),
);

const fitness: FitnessData = {
  settings,
  weighIns: [...weighIns, weigh('2026-10-12', 67.6, 'evening')],
  waists: [
    { id: 'w1', day: '2026-09-28', waist_cm: 78, notes: null, deleted_at: null },
    { id: 'w2', day: '2026-10-12', waist_cm: 78.4, notes: null, deleted_at: null },
  ],
  away: [],
  diet: [],
  steps: [{ id: 's1', day: '2026-10-12', steps: 9000, source: 'manual' }],
  slots: [],
  sessions: [
    { id: 'a', day: '2026-10-05', variant_index: 0, completed: true, slots_completed: 5, notes: null, cardio_done: true, slot_variants: {}, custom_workout_id: null, extras: [], program_weekday: null },
    { id: 'b', day: '2026-10-12', variant_index: 1, completed: true, slots_completed: 5, notes: 'Felt strong | slept 8h', cardio_done: false, slot_variants: {}, custom_workout_id: null, extras: [], program_weekday: 2 },
  ],
  sets: [
    { id: 'x1', session_id: 'a', slot: 1, exercise: 'Barbell Bench', set_number: 1, reps: 8, weight_kg: 60, notes: null },
    { id: 'x2', session_id: 'b', slot: 1, exercise: 'Barbell Bench', set_number: 1, reps: 8, weight_kg: 62.5, notes: null },
    { id: 'x3', session_id: 'b', slot: 1, exercise: 'Barbell Bench', set_number: 2, reps: 7, weight_kg: 62.5, notes: null },
  ],
  presets: [],
  workouts: [],
};

const entry = (day: string, name: string, kcal: number, protein: number, meal: Entry['meal'] = 'lunch'): Entry => ({
  id: `${day}-${name}`,
  day,
  meal,
  food_id: null,
  meal_log_id: null,
  source: 'quick',
  name,
  quantity: 1,
  unit: 'serving',
  grams: null,
  verification: 'user',
  logged_at: `${day}T08:00:00Z`,
  deleted_at: null,
  kcal,
  protein,
  carbs: 300,
  fat: 70,
  fibre: 30,
  sugar: null,
  sodium_mg: null,
});
const nutrition: NutritionData = {
  profile: null,
  targets: [{ ...LEAN_BULK_PRESET, id: 't', effective_from: '2026-09-14', mode: 'lean_bulk', rate_kg_month: 0.4, reason: '', inputs: {}, created_at: '2026-09-14T00:00:00Z' }],
  foods: [],
  entries: [entry('2026-10-12', 'Dal rice + 3 eggs', 2400, 145), entry('2026-10-13', 'Poha', 300, 6, 'breakfast')],
};

const goalsInput = {
  summaries: [
    summariseGoal(
      { id: 'g', title: 'Train 1 day a week', emoji: '🏋️', metric: 'fitness.sessions', params: {}, cadence: 'weekly', versions: [{ from: '2026-10-05', target: 1 }], starts_on: '2026-10-05', ends_on: null, sort_order: 0, archived_at: null, created_at: '' },
      { today: '2026-10-19', fitness, nutrition, mealPrepDays: null, checkins: [] },
    ),
  ],
  timeline: [{ key: 'm', date: '2027-06-17', approx: true, title: 'End of the bulk', emoji: '🏁', detail: null, kind: 'checkpoint' as const, status: 'upcoming' as const }],
};
const report = (sections = { food: true, measurements: true, workouts: true, goals: true }) =>
  buildMarkdownReport({ fitness, nutrition, from: '2026-10-12', to: '2026-10-18', today: '2026-10-19', sections, now: new Date('2026-10-19T12:00:00Z'), goals: goalsInput });

describe('markdown report', () => {
  const md = report();

  it('opens with the snapshot in the reference layout', () => {
    expect(md).toContain('# TRACKER REPORT — 12 Oct 2026 to 18 Oct 2026');
    expect(md).toContain('## 60-SECOND SNAPSHOT');
    expect(md).toContain('| **Calories** | 2,450');
    expect(md).toContain('| **Baseline** | 66.5 kg on 14 Sep 2026 (morning) |');
    expect(md).toMatch(/\| \*\*Measured rate\*\* \| \+0\.4\d kg\/month/);
  });

  it('reports food honestly: logged vs partial days, per-day tables', () => {
    expect(md).toContain('# PART 1 — EATING');
    expect(md).toMatch(/\| Fully logged days \| 1 \|/);
    expect(md).toMatch(/\| Partly logged \(under half the target\) \| 1 \|/);
    expect(md).toContain('### Mon 12 Oct — 2,400 kcal · P 145 g');
    expect(md).toContain('| Lunch | Dal rice + 3 eggs | 1 serving | 2,400 | 145 |');
  });

  it('lists sessions with sets, and compares key lifts to the previous period', () => {
    expect(md).toContain("| Mon 12 Oct | Back + Biceps (Tue's) · V2 | done | 2 |");
    expect(md).toContain('| Barbell Bench | 62.5×8, 62.5×7 |');
    expect(md).toContain('*Notes: Felt strong / slept 8h*'); // pipe can't break the table
    expect(md).toContain('| Bench / chest press | Barbell Bench 62.5 kg × 8 (Mon 12 Oct) | Barbell Bench 60 kg × 8 | +2.5 kg |');
  });

  it('keeps off-trend weigh-ins visible but marked', () => {
    expect(md).toContain('| Mon 12 Oct | evening');
    expect(md).toContain('no (other time of day)');
    expect(md).toContain('| Mon 12 Oct | 78.4 cm | +0.4 cm |');
  });

  it('fills the weekly and monthly templates', () => {
    expect(md).toContain('WEEK OF: 12 Oct 2026          VARIANT RUNNING: V2');
    expect(md).toContain('Weekly average: 66.90 kg   Change from last week: +0.10 kg');
    expect(md).toContain('TRAINING — sessions completed: 1 / 6');
    expect(md).toMatch(/Bench \/ chest press:\s+Barbell Bench 62\.5 kg × 8/);
    expect(md).toContain('MONTH: October 2026 (to 19 Oct 2026)');
    expect(md).toContain('[x] ~0.4 kg gained → on track, change nothing');
    expect(md).toContain('PHOTOS TAKEN IN NATURAL LIGHT?  [ ] Yes  [ ] No');
  });

  it('leaves out sections you untick', () => {
    const only = report({ food: false, measurements: true, workouts: false, goals: false });
    expect(only).not.toContain('PART 5 — GOALS');
    expect(only).not.toContain('PART 1 — EATING');
    expect(only).not.toContain('PART 2 — TRAINING');
    expect(only).toContain('PART 3 — MEASUREMENTS');
    expect(only).not.toContain('NUTRITION (fully logged days)');
  });

  it('adds goals: cycles in the period, streaks and what is coming', () => {
    expect(md).toContain('# PART 5 — GOALS');
    expect(md).toContain('| Train 1 day a week | Weekly | 1 sessions | 1 met · 0 missed | 2 | 2 |');
    expect(md).toContain('- ~Jun 2027 — 🏁 End of the bulk');
  });

  it('names the file by range', () => {
    expect(reportFileName('2026-10-01', '2026-10-31')).toBe('tracker-report-2026-10-01_to_2026-10-31.md');
  });
});
