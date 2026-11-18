import { describe, expect, it } from 'vitest';
import { classicWeekly } from './classicSplit';

describe('classic weekly split', () => {
  const parsed = classicWeekly();

  it('has all six Mon–Sat days, five slots each, seven variants per slot', () => {
    expect(parsed.cycle).toBe(false);
    expect(parsed.warnings).toEqual([]);
    for (const d of [1, 2, 3, 4, 5, 6]) {
      const slots = parsed.slots.filter((s) => s.weekday === d);
      expect(slots).toHaveLength(5);
      for (const s of slots) expect(s.variants.filter(Boolean)).toHaveLength(7);
    }
    expect(parsed.dayFocus['1']).toMatch(/chest.*triceps/i);
    expect(parsed.dayFocus['2']).toMatch(/back.*biceps/i);
    expect(parsed.dayFocus['4']).toMatch(/shoulders.*arms/i);
    expect(parsed.dayFocus['5']).toMatch(/chest.*shoulders/i);
  });

  it('keeps the set counts and the first variant', () => {
    expect(parsed.slots.filter((s) => s.weekday === 1).map((s) => s.sets)).toEqual([3, 3, 2, 3, 2]);
    expect(parsed.slots.find((s) => s.weekday === 1 && s.slot === 1)?.variants[0]).toBe('Barbell Bench / DB Bench');
  });

  it('brings the Abs and Forearms finishers and no targets', () => {
    expect(parsed.finishers.map((f) => f.name)).toEqual(['Abs', 'Forearms']);
    expect(parsed.finishers[0].days).toEqual([1, 3, 5]);
    expect(parsed.baselineDate).toBeNull();
    expect(parsed.stepsTarget).toBeNull();
  });
});
