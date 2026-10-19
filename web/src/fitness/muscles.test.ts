import { describe, expect, it } from 'vitest';
import {
  buildMuscleMap,
  exerciseEmoji,
  guessMuscle,
  muscleForTarget,
  muscleOf,
  swapOptions,
  swapWarning,
  weeklyCoverage,
  type FinisherDef,
  type ProgramSlot,
} from './muscles';

const v = (...names: string[]) => [...names, ...Array(7 - names.length).fill('')];
const slots: ProgramSlot[] = [
  { weekday: 1, slot: 1, label: 'Mid Chest', default_sets: 3, variants: v('Barbell Bench / DB Bench', 'DB Bench / Flat Barbell', 'Machine Chest Press / Wide Chest Press') },
  { weekday: 1, slot: 2, label: 'Upper Chest', default_sets: 3, variants: v('Incline DB Press / Incline Barbell') },
  { weekday: 1, slot: 4, label: 'Triceps Compound', default_sets: 3, variants: v('Close-Grip Bench / Dips') },
  { weekday: 2, slot: 1, label: 'Vertical Pull', default_sets: 3, variants: v('Pull-ups / Wide Lat Pulldown', '', '', '', 'Barbell Deadlift / Romanian DL') },
  { weekday: 3, slot: 3, label: 'Hamstring', default_sets: 3, variants: v('Romanian DL / Lying Leg Curl', 'Lying Leg Curl / Romanian DL') },
  { weekday: 6, slot: 1, label: 'Hip Hinge', default_sets: 3, variants: v('Romanian DL / Straight-Leg DL', 'Barbell Deadlift / Romanian DL') },
];
const finishers: FinisherDef[] = [{ name: 'Abs', days: [1, 3, 5], exercises: [{ name: 'Weighted Cable Crunch', sets: 3, reps: '10–15' }] }];
const map = buildMuscleMap(slots, finishers);

describe('muscles', () => {
  it('maps the reference slot targets to muscles', () => {
    expect(['Mid Chest', 'Row — Thickness', 'Rear Delt', 'Biceps Iso / Forearm', 'Quad Secondary', 'Hip Hinge', 'Unilateral', 'Calves', 'Triceps Compound'].map(muscleForTarget)).toEqual([
      'Chest', 'Back', 'Shoulders', 'Biceps', 'Quads', 'Hamstrings', 'Quads', 'Calves', 'Triceps',
    ]);
  });

  it('takes each exercise’s muscle from your program, majority vote', () => {
    expect(muscleOf('barbell bench', map)).toBe('Chest');
    expect(muscleOf('Close-Grip Bench', map)).toBe('Triceps'); // not chest: it sits in a triceps slot
    expect(muscleOf('Barbell Deadlift', map)).toBe('Hamstrings'); // tie (pull vs hinge) → name decides
    expect(muscleOf('Weighted Cable Crunch', map)).toBe('Abs');
  });

  it('guesses typed-in exercises by keyword, specific before general', () => {
    expect(guessMuscle('Seated Leg Curl')).toBe('Hamstrings');
    expect(guessMuscle('Spider Curl')).toBe('Biceps');
    expect(guessMuscle('Smith Machine Upright Row')).toBe('Shoulders');
    expect(guessMuscle('Chest-Supported T-Bar Row')).toBe('Back');
    expect(guessMuscle('Mystery Machine')).toBeNull();
  });

  it('gives every exercise an emoji', () => {
    expect(exerciseEmoji('Barbell Bench')).toBe('🏋️');
    expect(exerciseEmoji('Pec-Dec Fly')).toBe('🦋');
    expect(exerciseEmoji('Lying Leg Curl')).toBe('🦵');
    expect(exerciseEmoji('EZ-Bar Curl')).toBe('💪');
    expect(exerciseEmoji('Wide Lat Pulldown')).toBe('🧗');
    expect(exerciseEmoji('Something New')).toBe('🏋️');
  });
});

describe('swap options', () => {
  it('lists this week first, then the slot’s other weeks, then same-muscle exercises, no duplicates', () => {
    const groups = swapOptions(slots[0], 0, slots, map);
    expect(groups[0]).toEqual({ label: 'Today', options: ['Barbell Bench', 'DB Bench'] });
    expect(groups[1].options).toEqual(['Flat Barbell', 'Machine Chest Press', 'Wide Chest Press']);
    expect(groups[2].label).toBe('Other Chest exercises');
    expect(groups[2].options).toEqual(['Incline Barbell', 'Incline DB Press']);
    expect(groups.flatMap((g) => g.options)).not.toContain('Close-Grip Bench');
  });

  it('warns when a swap moves the slot to a different muscle', () => {
    expect(swapWarning('Upper Chest', 'Incline Barbell', map)).toBeNull();
    expect(swapWarning('Upper Chest', 'Dips', map)).toEqual({ from: 'Chest', to: 'Triceps' });
    expect(swapWarning('Upper Chest', 'Mystery Machine', map)).toEqual({ from: 'Chest', to: null });
  });
});

describe('weekly coverage', () => {
  it('compares sets done with what the program planned so far this week', () => {
    const logged = [
      ...Array.from({ length: 3 }, () => ({ exercise: 'Barbell Bench', day: '2026-10-19', slot: 1 })),
      ...Array.from({ length: 3 }, () => ({ exercise: 'Dips', day: '2026-10-19', slot: 2 })), // swapped upper chest → triceps
      ...Array.from({ length: 3 }, () => ({ exercise: 'Close-Grip Bench', day: '2026-10-19', slot: 4 })),
    ];
    const cov = weeklyCoverage(slots, finishers, logged, [1], map);
    const get = (m: string) => cov.find((c) => c.muscle === m);
    expect(get('Chest')).toMatchObject({ planned: 6, expectedSoFar: 6, done: 3, status: 'behind' });
    expect(get('Triceps')).toMatchObject({ planned: 3, expectedSoFar: 3, done: 6, status: 'ahead' });
    expect(get('Abs')).toMatchObject({ planned: 9, expectedSoFar: 3, done: 0, status: 'behind' });
    expect(get('Back')).toMatchObject({ expectedSoFar: 0, done: 0, status: 'not_started' });
  });

  it('away days are left out of what is expected so far', () => {
    const cov = weeklyCoverage(slots, finishers, [], [], map);
    expect(cov.every((c) => c.expectedSoFar === 0)).toBe(true);
  });
});
