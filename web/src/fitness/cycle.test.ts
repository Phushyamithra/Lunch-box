import { describe, expect, it } from 'vitest';
import { buildDayPlan, finisherCards, nextCycleDay, programDaysOwed, setSlotFor, suggestVariant } from './dayPlan';
import type { ProgramSlot } from './muscles';
import { parseReference } from './referenceImport';

/** A small rotating-cycle file in the reference format (made up for the test). */
const FILE = `
## THE ROTATION

| Order | Day | Focus | Sets | Finisher |
|-----|-------|------|------|----------|
| 1 | **Upper** | Chest + Back (lighter, frequency top-up) | 14 | Abs |
| 2 | **Lower** | Quads + Hamstrings | 12 | Forearms |
| 3 | **Push** | Chest + Shoulders | 16 | Abs |
| 4 | **Pull** | Back + Biceps | 15 | — |
| 5 | **Legs** | Full lower body | 14 | Abs |

## DAY 1 — UPPER
| # | Target | Sets | This cycle |
|---|---|---|---|
| 1 | Chest (incline-biased) | 3 | |
| 6 | Triceps | 2 | |

| # | V1 | V2 | V3 | V4 | V5 | V6 |
|---|----|----|----|----|----|-----|
| 1 | Incline DB Press / Incline Barbell | B / C | D / E | F / G | H / I | J / K |
| 6 | **Bodyweight Pull-ups** / Assisted Pull-ups (8–12 reps, technique focus — no added load here) | V-Bar / Dips | a | b | c | d |

## DAY 4 — PULL
| # | Target | Sets | This cycle |
|---|---|---|---|
| 1 | Vertical Pull — **weighted pull-ups** | 3 | |

| # | V1 | V2 | V3 | V4 | V5 | V6 |
|---|----|----|----|----|----|-----|
| 1 | Weighted Pull-ups / Lat Pulldown | Chin-ups / Close Lat Pull | x | y | z | Landmine Row / High Row (bench-rigged) |

## FINISHERS

### Abs — after Upper / Push / Legs (3 of 5 days)

| Exercise | Sets | Reps |
|---|---|---|
| Weighted Cable Crunch | 3 | 10–15 |

### Forearms — after Lower (Pull already has a built-in forearm slot)

| Exercise | Sets | Reps / Duration |
|---|---|---|
| Wrist Roller | 2 | To failure |
`;

describe('rotating cycle reference file', () => {
  const r = parseReference(FILE);

  it('reads the days, six slots, six variants and finishers by day name', () => {
    expect(r.cycle).toBe(true);
    // Cycle days are 11–15, apart from the weekly split's Mon–Sat.
    expect(r.dayFocus['11']).toBe('Upper — Chest + Back');
    expect(r.dayFocus['14']).toBe('Pull — Back + Biceps');
    expect(r.slots.every((s) => s.weekday >= 11 && s.weekday <= 15)).toBe(true);
    const upper6 = r.slots.find((s) => s.weekday === 11 && s.slot === 6)!;
    expect(upper6).toMatchObject({ label: 'Triceps', sets: 2 });
    // Notes in brackets go; a short qualifier like "(bench-rigged)" stays.
    expect(upper6.variants[0]).toBe('Bodyweight Pull-ups / Assisted Pull-ups');
    expect(r.slots.find((s) => s.weekday === 14)!.variants[5]).toBe('Landmine Row / High Row (bench-rigged)');
    expect(upper6.variants[6]).toBe('');
    expect(r.finishers.map((f) => [f.name, f.days])).toEqual([
      ['Abs', [11, 13, 15]],
      ['Forearms', [12]],
    ]);
  });
});

describe('cycle order and variants', () => {
  const s = (day: string, program_weekday: number | null, variant_index = 0, custom_workout_id: string | null = null) => ({ day, program_weekday, variant_index, custom_workout_id });

  it('the next day follows the last one trained, whatever the date; rest days and own cards don’t move it', () => {
    expect(nextCycleDay([], '2026-11-16', '2026-11-16')).toBe(11);
    const done = [s('2026-11-16', 11), s('2026-11-18', 12), s('2026-11-19', null, 0, 'card')];
    expect(nextCycleDay(done, '2026-11-21', '2026-11-16')).toBe(13);
    expect(nextCycleDay([...done, s('2026-11-21', 13), s('2026-11-22', 14), s('2026-11-24', 15)], '2026-11-25', '2026-11-16')).toBe(11);
    // Sessions from before the cycle started, and weekly-split sessions, don't count.
    expect(nextCycleDay([s('2026-11-10', 14)], '2026-11-16', '2026-11-16')).toBe(11);
    expect(nextCycleDay([s('2026-11-17', 2)], '2026-11-18', '2026-11-16')).toBe(11);
  });

  it('each day moves to its next variant once it has been trained: a full pass on V1, then V2', () => {
    const slots: ProgramSlot[] = [11, 12].map((weekday) => ({ weekday, slot: 1, label: 'X', default_sets: 3, variants: ['a', 'b', 'c', 'd', 'e', 'f', ''] }));
    expect(suggestVariant('2026-11-16', [], slots, 0, 11, '2026-11-16').index).toBe(0);
    const pass = [s('2026-11-16', 11, 0), s('2026-11-17', 12, 0)];
    expect(suggestVariant('2026-11-20', pass, slots, 0, 11, '2026-11-16').index).toBe(1);
    // After V6 it wraps to V1 (no 7th variant).
    expect(suggestVariant('2026-11-20', [s('2026-11-19', 11, 5)], slots, 0, 11, '2026-11-16').index).toBe(0);
    // A session from before the cycle started is ignored.
    expect(suggestVariant('2026-11-20', [s('2026-11-02', 11, 3)], slots, 0, 11, '2026-11-16').index).toBe(0);
  });

  it('slot 6 logs apart from the finisher sets', () => {
    expect(setSlotFor(6)).toBe(41);
    expect(setSlotFor(3)).toBe(3);
    const slots: ProgramSlot[] = [{ weekday: 1, slot: 6, label: 'Triceps', default_sets: 2, variants: ['Rope Pressdown / Skullcrushers', '', '', '', '', '', ''] }];
    const plan = buildDayPlan({ weekday: 1, session: { variant_index: 0, slot_variants: {}, custom_workout_id: null, extras: [] }, slots, finishers: [], workouts: [] });
    expect(plan[0]).toMatchObject({ slot: 41, programSlot: 6, options: ['Rope Pressdown', 'Skullcrushers'] });
  });

  it('weekly coverage only counts days actually trained in a cycle', () => {
    const sessions = [{ day: '2026-11-17', program_weekday: 12, custom_workout_id: null, completed: true }];
    expect(programDaysOwed('2026-11-16', '2026-11-19', sessions, () => false, true)).toEqual([12]);
    expect(programDaysOwed('2026-11-16', '2026-11-19', [{ ...sessions[0], program_weekday: 2 }], () => false)).toEqual([1, 2, 3]);
  });
});

describe('Abs and Forearms as cards', () => {
  it('turns finishers into any-day cards, once per name', () => {
    const finishers = [
      { name: 'Abs', days: [1, 3, 5], exercises: [{ name: 'Weighted Cable Crunch', sets: 3, reps: '10–15' }] },
      { name: 'Abs', days: [11, 13, 15], exercises: [{ name: 'Hanging Leg Raise', sets: 3, reps: '10–15' }] },
      { name: 'Forearms', days: [12], exercises: [{ name: 'Wrist Roller', sets: 2, reps: 'To failure' }] },
    ];
    const cards = finisherCards(finishers, [{ name: 'forearms' }]);
    expect(cards).toEqual([{ name: 'Abs', weekday: null, exercises: [{ label: 'Abs', exercise: 'Weighted Cable Crunch', sets: 3, reps: '10–15' }] }]);
  });
});
