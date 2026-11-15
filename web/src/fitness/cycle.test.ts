import { describe, expect, it } from 'vitest';
import { buildDayPlan, nextCycleDay, programDaysOwed, setSlotFor, suggestVariant } from './dayPlan';
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
    expect(r.dayFocus['1']).toBe('Upper — Chest + Back');
    expect(r.dayFocus['4']).toBe('Pull — Back + Biceps');
    const upper6 = r.slots.find((s) => s.weekday === 1 && s.slot === 6)!;
    expect(upper6).toMatchObject({ label: 'Triceps', sets: 2 });
    // Notes in brackets go; a short qualifier like "(bench-rigged)" stays.
    expect(upper6.variants[0]).toBe('Bodyweight Pull-ups / Assisted Pull-ups');
    expect(r.slots.find((s) => s.weekday === 4)!.variants[5]).toBe('Landmine Row / High Row (bench-rigged)');
    expect(upper6.variants[6]).toBe('');
    expect(r.finishers.map((f) => [f.name, f.days])).toEqual([
      ['Abs', [1, 3, 5]],
      ['Forearms', [2]],
    ]);
  });
});

describe('cycle order and variants', () => {
  const s = (day: string, program_weekday: number | null, variant_index = 0, custom_workout_id: string | null = null) => ({ day, program_weekday, variant_index, custom_workout_id });

  it('the next day follows the last one trained, whatever the date; rest days and own cards don’t move it', () => {
    expect(nextCycleDay([], '2026-11-16', '2026-11-16')).toBe(1);
    const done = [s('2026-11-16', 1), s('2026-11-18', 2), s('2026-11-19', null, 0, 'card')];
    expect(nextCycleDay(done, '2026-11-21', '2026-11-16')).toBe(3);
    expect(nextCycleDay([...done, s('2026-11-21', 3), s('2026-11-22', 4), s('2026-11-24', 5)], '2026-11-25', '2026-11-16')).toBe(1);
    // Sessions from before the cycle started don't count.
    expect(nextCycleDay([s('2026-11-10', 4)], '2026-11-16', '2026-11-16')).toBe(1);
  });

  it('each day moves to its next variant once it has been trained: a full pass on V1, then V2', () => {
    const slots: ProgramSlot[] = [1, 2].map((weekday) => ({ weekday, slot: 1, label: 'X', default_sets: 3, variants: ['a', 'b', 'c', 'd', 'e', 'f', ''] }));
    expect(suggestVariant('2026-11-16', [], slots, 0, 1, '2026-11-16').index).toBe(0);
    const pass = [s('2026-11-16', 1, 0), s('2026-11-17', 2, 0)];
    expect(suggestVariant('2026-11-20', pass, slots, 0, 1, '2026-11-16').index).toBe(1);
    // After V6 it wraps to V1 (no 7th variant).
    expect(suggestVariant('2026-11-20', [s('2026-11-19', 1, 5)], slots, 0, 1, '2026-11-16').index).toBe(0);
    // An older weekday-program session on the same day number is ignored.
    expect(suggestVariant('2026-11-20', [s('2026-11-02', 1, 3)], slots, 0, 1, '2026-11-16').index).toBe(0);
  });

  it('slot 6 logs apart from the finisher sets', () => {
    expect(setSlotFor(6)).toBe(41);
    expect(setSlotFor(3)).toBe(3);
    const slots: ProgramSlot[] = [{ weekday: 1, slot: 6, label: 'Triceps', default_sets: 2, variants: ['Rope Pressdown / Skullcrushers', '', '', '', '', '', ''] }];
    const plan = buildDayPlan({ weekday: 1, session: { variant_index: 0, slot_variants: {}, custom_workout_id: null, extras: [] }, slots, finishers: [], workouts: [] });
    expect(plan[0]).toMatchObject({ slot: 41, programSlot: 6, options: ['Rope Pressdown', 'Skullcrushers'] });
  });

  it('weekly coverage only counts days actually trained in a cycle', () => {
    const sessions = [{ day: '2026-11-17', program_weekday: 2, custom_workout_id: null, completed: true }];
    expect(programDaysOwed('2026-11-16', '2026-11-19', sessions, () => false, true)).toEqual([2]);
    expect(programDaysOwed('2026-11-16', '2026-11-19', sessions, () => false)).toEqual([1, 2, 3]);
  });
});
