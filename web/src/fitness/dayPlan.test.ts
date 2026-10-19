import { describe, expect, it } from 'vitest';
import {
  EXTRA_SLOT_BASE,
  FINISHER_SLOT,
  buildDayPlan,
  dayProgress,
  isMixed,
  programDaysOwed,
  setsForItem,
  suggestVariant,
  validateCustomWorkout,
  variantsFor,
  workoutFromVariant,
  type CustomWorkout,
} from './dayPlan';
import type { FinisherDef, ProgramSlot } from './muscles';

const v = (...names: string[]) => [...names, ...Array(7 - names.length).fill('')];
// Mon 2026-10-19, Tue 2026-10-20.
const slots: ProgramSlot[] = [
  { weekday: 1, slot: 1, label: 'Mid Chest', default_sets: 3, variants: v('Barbell Bench / DB Bench', 'Machine Chest Press', 'Flat DB Press') },
  { weekday: 1, slot: 2, label: 'Triceps', default_sets: 2, variants: v('Skull Crusher', 'Rope Pushdown', 'Dips') },
  { weekday: 2, slot: 1, label: 'Vertical Pull', default_sets: 3, variants: v('Pull-ups', 'Lat Pulldown', '', '', 'Wide Pulldown') },
];
const finishers: FinisherDef[] = [{ name: 'Abs', days: [1], exercises: [{ name: 'Cable Crunch / Leg Raise', sets: 3, reps: '10–15' }] }];
const base = { variant_index: 0, slot_variants: {}, custom_workout_id: null, extras: [], program_weekday: null };

describe('variant per day', () => {
  it('lists only the variants that have exercises on that day', () => {
    expect(variantsFor(1, slots)).toEqual([0, 1, 2]);
    expect(variantsFor(2, slots)).toEqual([0, 1, 4]);
  });

  it('suggests the next variant after the one last trained on the same weekday', () => {
    const sessions = [
      { day: '2026-10-12', variant_index: 0, custom_workout_id: null }, // last Monday: V1
      { day: '2026-10-13', variant_index: 1, custom_workout_id: null }, // last Tuesday: V2
    ];
    expect(suggestVariant('2026-10-19', sessions, slots, 5)).toEqual({ index: 1, reason: 'next' });
    expect(suggestVariant('2026-10-20', sessions, slots, 5)).toEqual({ index: 4, reason: 'next' }); // skips empty V3, V4
  });

  it('wraps around, ignores days running your own card, and falls back to the rotation', () => {
    expect(suggestVariant('2026-10-19', [{ day: '2026-10-12', variant_index: 2, custom_workout_id: null }], slots, 0).index).toBe(0);
    expect(suggestVariant('2026-10-19', [{ day: '2026-10-12', variant_index: 0, custom_workout_id: 'w1' }], slots, 2)).toEqual({ index: 2, reason: 'rotation' });
    expect(suggestVariant('2026-10-19', [], slots, 6).index).toBe(0); // rotation V7 is empty on Mondays
  });
});

describe('day plan', () => {
  it('uses the day’s variant, with per-slot mixing, then finishers', () => {
    const plan = buildDayPlan({ weekday: 1, session: { ...base, variant_index: 1, slot_variants: { '2': 2 } }, slots, finishers, workouts: [] });
    expect(plan.map((p) => [p.kind, p.slot, p.options[0], p.variantIndex])).toEqual([
      ['program', 1, 'Machine Chest Press', 1],
      ['program', 2, 'Dips', 2],
      ['finisher', FINISHER_SLOT, 'Cable Crunch', null],
    ]);
    expect(isMixed({ variant_index: 1, slot_variants: { '2': 2 } })).toBe(true);
    expect(isMixed({ variant_index: 1, slot_variants: { '2': 1 } })).toBe(false);
  });

  it('runs your own card instead of the program, and adds extras at the end', () => {
    const workouts: CustomWorkout[] = [
      { id: 'w1', name: 'Hotel gym', weekday: 1, exercises: [{ label: 'Chest', exercise: 'Push-up / Knee Push-up', sets: 4 }, { label: '', exercise: 'Band Pushdown', sets: 3 }] },
    ];
    const plan = buildDayPlan({
      weekday: 1,
      session: { ...base, custom_workout_id: 'w1', extras: [{ label: '', exercise: 'Cable Fly', sets: 2 }] },
      slots,
      finishers,
      workouts,
    });
    expect(plan.map((p) => [p.kind, p.slot, p.title, p.core])).toEqual([
      ['custom', 7, 'Chest', true],
      ['custom', 8, 'Band Pushdown', true],
      ['finisher', 6, 'Abs finisher', false],
      ['extra', EXTRA_SLOT_BASE, 'Cable Fly', false],
    ]);
    expect(plan[0].options).toEqual(['Push-up', 'Knee Push-up']);
  });

  it('counts progress over the core cards only', () => {
    const plan = buildDayPlan({ weekday: 1, session: base, slots, finishers, workouts: [] });
    const sets = [
      ...Array.from({ length: 4 }, () => ({ slot: 1, exercise: 'Barbell Bench' })), // one extra set over plan
      { slot: 2, exercise: 'Skull Crusher' },
      { slot: 6, exercise: 'Cable Crunch' },
      { slot: 6, exercise: 'Something else' },
    ];
    expect(dayProgress(plan, sets)).toEqual({ logged: 4, planned: 5, done: 1, total: 2 });
    expect(setsForItem(plan[2], sets)).toHaveLength(1);
  });
});

describe('custom cards', () => {
  it('validates name, exercises and sets', () => {
    expect(validateCustomWorkout({ name: '', exercises: [] })).toMatch(/name/);
    expect(validateCustomWorkout({ name: 'Home', exercises: [{ label: '', exercise: ' ', sets: 3 }] })).toMatch(/at least one/);
    expect(validateCustomWorkout({ name: 'Home', exercises: [{ label: '', exercise: 'Push-up', sets: 0 }] })).toMatch(/Sets/);
    expect(validateCustomWorkout({ name: 'Home', exercises: [{ label: '', exercise: 'Push-up', sets: 3 }] })).toBeNull();
  });

  it('can start from an existing variant', () => {
    expect(workoutFromVariant(2, 4, slots)).toEqual([{ label: 'Vertical Pull', exercise: 'Wide Pulldown', sets: 3 }]);
  });
});

describe('training another day’s program', () => {
  it('suggests per program day, wherever it was trained', () => {
    // Last Wednesday you trained Tuesday’s program (V2); today (Monday) you pick Tuesday’s again.
    const sessions = [{ day: '2026-10-14', variant_index: 1, custom_workout_id: null, program_weekday: 2 }];
    expect(suggestVariant('2026-10-19', sessions, slots, 0, 2)).toEqual({ index: 4, reason: 'next' });
    // Monday’s own program is unaffected by it.
    expect(suggestVariant('2026-10-19', sessions, slots, 0).reason).toBe('rotation');
  });

  it('weekly coverage owes the program you actually trained, plus missed days', () => {
    const away = (d: string) => d === '2026-10-21';
    const sessions = [
      { day: '2026-10-19', program_weekday: 2, custom_workout_id: null, completed: true }, // Mon: did Tuesday’s
      { day: '2026-10-20', program_weekday: 1, custom_workout_id: null, completed: true }, // Tue: did Monday’s
      { day: '2026-10-23', program_weekday: null, custom_workout_id: 'w1', completed: true }, // Fri: own card
      { day: '2026-10-24', program_weekday: null, custom_workout_id: null, completed: false }, // Sat (today), not done yet
    ];
    // Wed away, Thu missed (owes Thursday), Fri own card, Sat not finished.
    expect(programDaysOwed('2026-10-19', '2026-10-24', sessions, away)).toEqual([2, 1, 4]);
    expect(programDaysOwed('2026-10-19', '2026-10-19', [], away)).toEqual([]);
  });
});
