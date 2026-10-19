import { describe, expect, it } from 'vitest';
import type { FitnessData } from '../fitness/fitnessApi';
import { LEAN_BULK_PRESET } from '../nutrition/engine';
import { goalCycles, summariseGoal, suggestedGoals, targetOn, validateGoal, type Goal, type GoalContext } from './engine';

const session = (day: string, done = true, cardio = false) => ({
  id: day,
  day,
  variant_index: 0,
  completed: done,
  slots_completed: done ? 5 : 2,
  notes: null,
  cardio_done: cardio,
  slot_variants: {},
  custom_workout_id: null,
  extras: [],
  program_weekday: null,
});
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));

const fitness = {
  settings: { weigh_time: 'morning', steps_target: 10000, gain_low_kg_month: 0.2, gain_high_kg_month: 0.6, key_lifts: [{ label: 'Bench', exercises: ['Barbell Bench'] }], cardio_per_week: 3 },
  weighIns: [],
  waists: [],
  // Mon 28 Sep week: 3 sessions (goal starts Wed); 5 Oct week: 6; 12 Oct week: 4 but away Thu–Sat; 19 Oct: 1 so far.
  sessions: [
    ...days('2026-09-30', 3).map((d) => session(d)),
    ...days('2026-10-05', 6).map((d) => session(d, true, d < '2026-10-08')),
    ...days('2026-10-12', 3).map((d) => session(d)),
    session('2026-10-19'),
  ],
  sets: [
    { id: 's1', session_id: '2026-10-05', slot: 1, exercise: 'Barbell Bench', set_number: 1, reps: 8, weight_kg: 60, notes: null },
    { id: 's2', session_id: '2026-10-13', slot: 1, exercise: 'barbell bench ', set_number: 1, reps: 6, weight_kg: 65, notes: null },
  ],
  away: [{ id: 'a', starts_on: '2026-10-15', ends_on: '2026-10-17', label: 'Wedding' }],
  diet: [],
  steps: [
    { id: 'x', day: '2026-10-17', steps: 12000, source: 'manual' },
    { id: 'y', day: '2026-10-18', steps: 4000, source: 'manual' },
  ],
  slots: [],
  presets: [],
  workouts: [],
} as unknown as FitnessData;

const goal = (over: Partial<Goal>): Goal => ({
  id: 'g',
  title: 'Train 6 days',
  emoji: null,
  metric: 'fitness.sessions',
  params: {},
  cadence: 'weekly',
  versions: [{ from: '2026-09-30', target: 6 }],
  starts_on: '2026-09-30',
  ends_on: null,
  sort_order: 0,
  archived_at: null,
  created_at: '2026-09-30T00:00:00Z',
  ...over,
});
const ctx: GoalContext = { today: '2026-10-19', fitness, nutrition: null, mealPrepDays: null, checkins: [] };

describe('cycles', () => {
  it('derives each week honestly: partial start, met, away, in progress', () => {
    const c = goalCycles(goal({}), ctx);
    expect(c.map((x) => [x.start, x.value, x.status])).toEqual([
      ['2026-09-28', 3, 'partial'],
      ['2026-10-05', 6, 'met'],
      ['2026-10-12', 3, 'away'],
      ['2026-10-19', 1, 'in_progress'],
    ]);
  });

  it('streaks skip neutral cycles and the one in progress', () => {
    const s = summariseGoal(goal({}), ctx);
    expect(s).toMatchObject({ streak: 1, best: 1, met: 1, missed: 0 });
    expect(s.current?.start).toBe('2026-10-19');
  });

  it('a missed week breaks the streak', () => {
    const s = summariseGoal(goal({ versions: [{ from: '2026-09-30', target: 3 }] }), { ...ctx, fitness: { ...fitness, away: [] } });
    // 28 Sep: 3 ≥ 3 met (even partial), 5 Oct met, 12 Oct met (3), 19 Oct in progress.
    expect(s.streak).toBe(3);
    const lower = summariseGoal(goal({ versions: [{ from: '2026-09-30', target: 4 }] }), { ...ctx, fitness: { ...fitness, away: [] } });
    expect(lower.cycles.map((c) => c.status)).toEqual(['partial', 'met', 'missed', 'in_progress']);
    expect(lower.streak).toBe(0);
    expect(lower.best).toBe(1);
  });

  it('target changes apply from their date, never to earlier cycles', () => {
    const g = goal({ versions: [{ from: '2026-09-30', target: 6 }, { from: '2026-10-12', target: 3 }] });
    expect(targetOn(g, '2026-10-05')).toBe(6);
    expect(goalCycles(g, { ...ctx, fitness: { ...fitness, away: [] } }).map((c) => [c.target, c.status])).toEqual([
      [6, 'partial'],
      [6, 'met'],
      [3, 'met'],
      [3, 'in_progress'],
    ]);
  });

  it('daily steps: under target is missed; a day with no entry is no data', () => {
    const c = goalCycles(goal({ metric: 'fitness.steps', cadence: 'daily', starts_on: '2026-10-17', versions: [{ from: '2026-10-17', target: 1 }] }), { ...ctx, fitness: { ...fitness, away: [] } });
    expect(c.map((x) => x.status)).toEqual(['met', 'missed', 'in_progress']);
    const gap = goalCycles(goal({ metric: 'fitness.steps', cadence: 'daily', starts_on: '2026-10-16', versions: [{ from: '2026-10-16', target: 1 }] }), { ...ctx, fitness: { ...fitness, away: [] } });
    expect(gap[0].status).toBe('no_data');
  });

  it('no data is never shown as missed', () => {
    const c = goalCycles(goal({ metric: 'nutrition.days_logged' }), ctx);
    expect(c.slice(0, 3).every((x) => x.status === 'no_data' || x.status === 'partial')).toBe(true);
  });
});

describe('one-off goals', () => {
  it('records the first day a lift reached the target', () => {
    const s = summariseGoal(goal({ metric: 'fitness.lift_reach', cadence: 'one_off', params: { lift: 'Bench' }, versions: [{ from: '2026-09-30', target: 62.5 }] }), ctx);
    expect(s).toMatchObject({ achievedOn: '2026-10-13', progress: 65 });
  });
  it('shows progress while not reached', () => {
    const s = summariseGoal(goal({ metric: 'fitness.lift_reach', cadence: 'one_off', params: { lift: 'Bench' }, versions: [{ from: '2026-09-30', target: 70 }] }), ctx);
    expect(s).toMatchObject({ achievedOn: null, progress: 65 });
  });
  it('manual one-off: the check-in date', () => {
    const s = summariseGoal(goal({ id: 'm', metric: 'manual', cadence: 'one_off' }), { ...ctx, checkins: [{ id: 'c', goal_id: 'm', period_start: '2026-10-10', note: null, deleted_at: null }] });
    expect(s.achievedOn).toBe('2026-10-10');
  });
});

describe('manual and nutrition goals', () => {
  it('a check-in meets its cycle; a removed one does not', () => {
    const g = goal({ id: 'p', metric: 'manual', cadence: 'monthly', starts_on: '2026-09-01', versions: [{ from: '2026-09-01', target: 1 }] });
    const c = goalCycles(g, { ...ctx, checkins: [
      { id: '1', goal_id: 'p', period_start: '2026-09-01', note: null, deleted_at: null },
      { id: '2', goal_id: 'p', period_start: '2026-10-01', note: null, deleted_at: '2026-10-02T00:00:00Z' },
    ] });
    expect(c.map((x) => x.status)).toEqual(['met', 'in_progress']);
  });
  it('nutrition days count only fully logged days', () => {
    const entry = (day: string, kcal: number) => ({ id: day, day, meal: 'lunch' as const, food_id: null, meal_log_id: null, source: 'quick' as const, name: 'x', quantity: 1, unit: 'serving', grams: null, verification: 'user' as const, logged_at: `${day}T08:00:00Z`, deleted_at: null, kcal, protein: 150, carbs: 0, fat: 0, fibre: 0, sugar: null, sodium_mg: null });
    const nutrition = { profile: null, targets: [{ ...LEAN_BULK_PRESET, id: 't', effective_from: '2026-09-01', mode: 'lean_bulk' as const, rate_kg_month: 0.4, reason: '', inputs: {}, created_at: '' }], foods: [], entries: [entry('2026-10-05', 2400), entry('2026-10-06', 600), entry('2026-10-07', 2500)] };
    const c = goalCycles(goal({ metric: 'nutrition.days_logged', versions: [{ from: '2026-09-30', target: 2 }] }), { ...ctx, nutrition, fitness: { ...fitness, away: [] } });
    expect(c[1]).toMatchObject({ value: 2, status: 'met' });
  });
});

describe('validation and suggestions', () => {
  const base = { title: 'x', emoji: null, metric: 'fitness.sessions', params: {}, cadence: 'weekly' as const, target: 6, starts_on: '2026-10-19', ends_on: null };
  it('checks the cadence, target and dates', () => {
    expect(validateGoal(base)).toBeNull();
    expect(validateGoal({ ...base, cadence: 'daily' })).toMatch(/works weekly or monthly/);
    expect(validateGoal({ ...base, metric: 'nutrition.days_logged', target: 8 })).toMatch(/at most 7 days/);
    expect(validateGoal({ ...base, target: 0 })).toMatch(/more than 0/);
    expect(validateGoal({ ...base, ends_on: '2026-10-01' })).toMatch(/after the start/);
    expect(validateGoal({ ...base, metric: 'fitness.lift_reach', cadence: 'one_off', params: { lift: 'Squat' } }, { fitness })).toMatch(/key lift/);
  });
  it('every suggestion is valid', () => {
    for (const s of suggestedGoals(fitness, '2026-10-19')) expect(validateGoal(s), s.title).toBeNull();
  });
});
