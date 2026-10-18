import { describe, expect, it } from 'vitest';
import {
  baselineWeight,
  compositionSignal,
  isCompoundSlot,
  setProgress,
  suggestSet,
  weeklyAverages,
  type Session,
  type SetRow,
  type WeighIn,
} from './rules';

const w = (day: string, kg: number, time: WeighIn['time_of_day']): WeighIn => ({
  id: `${day}-${time}`,
  day,
  weight_kg: kg,
  time_of_day: time,
  deleted_at: null,
});

describe('morning-only trends (reference: weekly morning averages)', () => {
  const entries = [
    w('2026-10-12', 67.0, 'morning'),
    w('2026-10-12', 67.9, 'evening'), // evening reads ~0.5–1 kg heavier
    w('2026-10-14', 67.2, 'morning'),
    w('2026-10-16', 67.1, 'morning'),
  ];

  it('uses only morning weigh-ins when the trend time is morning', () => {
    const [week] = weeklyAverages(entries, [], '2026-10-18', 'morning');
    expect(week.average).toBeCloseTo(67.1);
    expect(week.days).toBe(3);
    expect(week.sufficient).toBe(true); // 3 mornings a week
  });

  it('mixing times would skew the average upward', () => {
    const [week] = weeklyAverages(entries, [], '2026-10-18', 'any');
    expect(week.average).toBeGreaterThan(67.1);
  });

  it('baseline is the first morning weigh-in on or after the phase start', () => {
    const b = baselineWeight([w('2026-09-16', 66.2, 'morning'), w('2026-09-17', 66.9, 'evening'), w('2026-09-18', 66.5, 'morning')], '2026-09-17', 'morning');
    expect(b?.day).toBe('2026-09-18');
    expect(b?.weight_kg).toBe(66.5);
  });
});

describe('waist reading: steady means within ~1 cm', () => {
  const rising = { kgPerMonth: 0.4 } as never;
  const at = (day: string, cm: number) => ({ id: day, day, waist_cm: cm, deleted_at: null });
  it('up to 1 cm is lean gain; more than 1 cm is flagged', () => {
    expect(compositionSignal([at('2026-10-01', 80), at('2026-10-29', 81)], rising).signal).toBe('favourable');
    expect(compositionSignal([at('2026-10-01', 80), at('2026-10-29', 81.2)], rising).signal).toBe('review');
  });
});

describe('set suggestions (pre-filled rows)', () => {
  const sessions: Session[] = [
    { id: 'a', day: '2026-10-05', variant_index: 0, completed: true, slots_completed: 5 },
    { id: 'b', day: '2026-10-12', variant_index: 0, completed: true, slots_completed: 5 },
    { id: 'today', day: '2026-10-19', variant_index: 1, completed: false, slots_completed: 0 },
  ];
  const sets: SetRow[] = [
    { session_id: 'a', exercise: 'Barbell Bench', set_number: 1, reps: 8, weight_kg: 42.5 },
    { session_id: 'b', exercise: 'Barbell Bench', set_number: 1, reps: 8, weight_kg: 45 },
    { session_id: 'b', exercise: 'Barbell Bench', set_number: 2, reps: 7, weight_kg: 45 },
    { session_id: 'today', exercise: 'Lat Pulldown', set_number: 1, reps: 10, weight_kg: 50 },
  ];
  const presets = [{ exercise: 'Machine Chest Press', weight_kg: 45, reps: 8 }];

  it('repeats the same set from the most recent earlier session', () => {
    expect(suggestSet('barbell bench', 2, '2026-10-19', sets, sessions, presets)).toEqual({ weight: 45, reps: 7, from: 'last', lastDay: '2026-10-12' });
  });

  it('falls back to that session’s last set when this set number is new', () => {
    expect(suggestSet('Barbell Bench', 3, '2026-10-19', sets, sessions, presets)).toMatchObject({ weight: 45, reps: 7, from: 'last' });
  });

  it('within today, the next set copies the previous one', () => {
    expect(suggestSet('Lat Pulldown', 2, '2026-10-19', sets, sessions, presets)).toEqual({ weight: 50, reps: 10, from: 'previous_set' });
  });

  it('uses the saved preset for an exercise never logged, else an empty row', () => {
    expect(suggestSet('Machine Chest Press', 1, '2026-10-19', sets, sessions, presets)).toEqual({ weight: 45, reps: 8, from: 'preset' });
    expect(suggestSet('Pec-Dec Fly', 1, '2026-10-19', sets, sessions, presets)).toEqual({ weight: 0, reps: 8, from: 'none' });
  });
});

describe('day progress and rest', () => {
  it('counts logged working sets against the plan, capped per slot', () => {
    const logged = new Map([
      [1, 3],
      [2, 4], // an extra set does not inflate progress
      [3, 1],
    ]);
    expect(setProgress([3, 3, 2, 3, 2], logged)).toEqual({ logged: 7, planned: 13, slotsDone: 2 });
  });

  it('first heavy slots are compounds (longer rest)', () => {
    expect(isCompoundSlot(1, 3)).toBe(true);
    expect(isCompoundSlot(3, 2)).toBe(false);
    expect(isCompoundSlot(4, 3)).toBe(false);
  });
});
