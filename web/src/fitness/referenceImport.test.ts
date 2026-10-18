import { describe, expect, it } from 'vitest';
import { deriveKeyLifts, exerciseOptions, parseReference } from './referenceImport';

// Trimmed copy of the reference format (one day + snapshot + finishers).
const SAMPLE = `
# DAILY REFERENCE — Bulk Phase

## 60-SECOND SNAPSHOT

| | |
|---|---|
| **Phase** | Lean bulk — 8–10 months |
| **Steps** | 10k daily, including rest day |
| **Baseline** | 17 Sept 2026 morning weight — everything measures against this |

---

## MONDAY — CHEST + TRICEPS
**3 / 3 / 2 / 3 / 2 = 13 sets** · finisher: Abs

| # | Target | Sets | This week |
|---|---|---|---|
| 1 | Mid Chest | 3 | |
| 2 | Upper Chest | 3 | |
| 3 | Chest Isolation | 2 | |
| 4 | Triceps Compound | 3 | |
| 5 | Triceps Isolation | 2 | |

<details><summary><b>Variant bank — Monday</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 | V7 |
|---|----|----|----|----|----|----|-----|
| 1 | Barbell Bench / DB Bench | DB Bench / Flat Barbell | Machine Chest Press / Wide Chest Press | Flat DB Press / Barbell Bench | Wide Chest Press / Machine Press | Decline Barbell / Flat DB Press | Barbell Bench / Wide Chest Press |
| 2 | Incline DB Press / Incline Barbell | Incline Barbell / Decline Barbell | Incline DB Fly / Low-High Cable | Incline Barbell / Machine Chest | Incline DB Press / Incline Cable Fly | Incline DB Press / Incline Barbell | Machine Chest Press / Incline Barbell |
| 3 | Pec-Dec Fly / Cable Fly | Cable Crossover / Pec-Dec | Cable Fly / Pec-Dec | Pec-Dec / Low-High Cable | Cable Crossover / DB Fly | Pec-Dec / High-Low Cable | Low-High Cable / Pec-Dec |
| 4 | Close-Grip Bench / Dips | Skullcrushers / Overhead DB Ext | Dips / Close-Grip Bench | Skullcrushers / Dips | Overhead DB Ext / Close-Grip Bench | Close-Grip Bench / Skullcrushers | Parallel Bar Dips / Close-Grip Bench |
| 5 | Rope Pressdown / V-Bar | V-Bar / Rope Pressdown | Overhead DB Ext / Skullcrushers | Cable Rope Pressdown / V-Bar | Skullcrushers / V-Bar | Rope Pressdown / Overhead DB Ext | V-Bar / Skullcrushers |

</details>

## SATURDAY — LEGS: POSTERIOR CHAIN
| # | Target | Sets | This week |
|---|---|---|---|
| 1 | Hip Hinge | 3 | |

## FINISHERS

### Abs — Mon / Wed / Fri (~8 sets, ~24/week)

| Exercise | Sets | Reps |
|---|---|---|
| Weighted Cable Crunch | 3 | 10–15 |
| Hanging Leg Raise (weighted if possible) | 3 | 10–15 |

### Forearms — Tue / Thu / Sat

| Exercise | Sets | Reps / Duration |
|---|---|---|
| Wrist Roller | 2 | To failure |

## Weekly Volume Check

| Muscle | Sets/Week | Status |
|---|---|---|
| Chest | ~16 | Slightly high |
`;

describe('parseReference', () => {
  const parsed = parseReference(SAMPLE);

  it('reads the snapshot: baseline date, steps target, phase length', () => {
    expect(parsed.baselineDate).toBe('2026-09-17');
    expect(parsed.stepsTarget).toBe(10000);
    expect(parsed.phaseMonths).toBe(9);
  });

  it('reads day focus, slot targets and set counts', () => {
    expect(parsed.dayFocus['1']).toBe('Chest + Triceps');
    expect(parsed.dayFocus['6']).toBe('Legs — Posterior Chain');
    const monday = parsed.slots.filter((s) => s.weekday === 1);
    expect(monday.map((s) => [s.slot, s.label, s.sets])).toEqual([
      [1, 'Mid Chest', 3],
      [2, 'Upper Chest', 3],
      [3, 'Chest Isolation', 2],
      [4, 'Triceps Compound', 3],
      [5, 'Triceps Isolation', 2],
    ]);
  });

  it('reads all seven variants per slot', () => {
    const slot1 = parsed.slots.find((s) => s.weekday === 1 && s.slot === 1);
    expect(slot1?.variants).toHaveLength(7);
    expect(slot1?.variants[0]).toBe('Barbell Bench / DB Bench');
    expect(slot1?.variants[2]).toBe('Machine Chest Press / Wide Chest Press');
  });

  it('reads finishers with their days, dropping notes in brackets', () => {
    expect(parsed.finishers).toEqual([
      {
        name: 'Abs',
        days: [1, 3, 5],
        exercises: [
          { name: 'Weighted Cable Crunch', sets: 3, reps: '10–15' },
          { name: 'Hanging Leg Raise', sets: 3, reps: '10–15' },
        ],
      },
      { name: 'Forearms', days: [2, 4, 6], exercises: [{ name: 'Wrist Roller', sets: 2, reps: 'To failure' }] },
    ]);
  });

  it('reports what is missing instead of guessing', () => {
    expect(parsed.warnings).toContain('Day 6: only 1 of 5 slots found.');
    expect(parsed.warnings).toContain('No slots found for day 2.');
    expect(parsed.warnings.some((w) => w.includes('Day 6 slot 1: no variants'))).toBe(true);
  });
});

describe('exerciseOptions', () => {
  it('splits default / fallback, keeping names with slashes-free hyphens intact', () => {
    expect(exerciseOptions('Barbell Bench / DB Bench')).toEqual(['Barbell Bench', 'DB Bench']);
    expect(exerciseOptions('Pec-Dec Fly / Cable Fly')).toEqual(['Pec-Dec Fly', 'Cable Fly']);
    expect(exerciseOptions('Wrist Roller')).toEqual(['Wrist Roller']);
    expect(exerciseOptions('')).toEqual([]);
  });
});

describe('deriveKeyLifts', () => {
  it('matches the brief’s key lifts to your exercise names, flat pressing only', () => {
    const groups = deriveKeyLifts(parseReference(SAMPLE).slots);
    const bench = groups.find((g) => g.label === 'Bench / chest press');
    expect(bench?.exercises).toEqual(['Barbell Bench', 'DB Bench', 'Flat Barbell', 'Flat DB Press', 'Machine Chest Press', 'Wide Chest Press']);
    expect(bench?.exercises.some((e) => /incline|close-grip/i.test(e))).toBe(false);
  });
});
