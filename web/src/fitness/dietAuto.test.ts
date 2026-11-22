import { describe, expect, it } from 'vitest';
import { backfillDiet, dietVerdict } from './dietAuto';
import { dietMisses, dietSummary } from './rules';

const target = { kcal: 2450, protein_min: 140 };

describe('diet verdict from the food log', () => {
  it('is on track within ±10% with enough protein', () => {
    expect(dietVerdict({ kcal: 2500, protein: 145 }, target)).toMatchObject({ band: 'on_track', tag: 'on_plan', label: 'On track' });
    expect(dietVerdict({ kcal: 2205, protein: 140 }, target)?.band).toBe('on_track'); // −10% exactly
    expect(dietVerdict({ kcal: 2695, protein: 140 }, target)?.band).toBe('on_track'); // +10% exactly
  });

  it('separates below, slightly above and way off', () => {
    expect(dietVerdict({ kcal: 2000, protein: 150 }, target)).toMatchObject({ tag: 'under', label: 'Below target' }); // −18%
    expect(dietVerdict({ kcal: 2800, protein: 150 }, target)).toMatchObject({ tag: 'over', label: 'Slightly above' }); // +14%
    expect(dietVerdict({ kcal: 3200, protein: 150 }, target)).toMatchObject({ tag: 'way_off', label: 'Way above' }); // +31%
    expect(dietVerdict({ kcal: 1500, protein: 150 }, target)).toMatchObject({ tag: 'way_off', label: 'Way below' }); // −39%
  });

  it('counts protein short as below target', () => {
    expect(dietVerdict({ kcal: 2450, protein: 110 }, target)).toMatchObject({ band: 'protein_short', tag: 'under' });
  });

  it('says nothing for a barely logged day or no target', () => {
    expect(dietVerdict({ kcal: 300, protein: 20 }, target)).toBeNull();
    expect(dietVerdict({ kcal: 2400, protein: 150 }, { kcal: 0, protein_min: 0 })).toBeNull();
  });

  it('writes a readable note', () => {
    expect(dietVerdict({ kcal: 2610, protein: 142 }, target)?.note).toBe('From food log: 2,610 / 2,450 kcal (+7%), protein 142 g. On track.');
  });
});

describe('back-filling past days', () => {
  const days = [
    { day: '2026-11-01', kcal: 2450, protein: 150 }, // on track, no row yet
    { day: '2026-11-02', kcal: 2900, protein: 150 }, // over, but you tagged it Event
    { day: '2026-11-03', kcal: 2000, protein: 150 }, // under, row from the log that's out of date
    { day: '2026-11-04', kcal: 200, protein: 10 }, // barely logged
    { day: '2026-11-05', kcal: 2450, protein: 150 }, // you tagged it On plan yourself
    { day: '2026-11-30', kcal: 2450, protein: 150 }, // future
  ];
  const existing = [
    { day: '2026-11-02', tag: 'event' as const, kcal_estimate: null, notes: null },
    { day: '2026-11-03', tag: 'on_plan' as const, kcal_estimate: 2450, notes: 'From food log: 2,450 / 2,450 kcal (+0%), protein 150 g. On track.' },
    { day: '2026-11-05', tag: 'under' as const, kcal_estimate: null, notes: 'felt off' },
  ];

  it('fills untagged and food-log days, never yours, and nothing barely logged or ahead', () => {
    const out = backfillDiet(days, () => target, existing, '2026-11-22');
    expect(out.map((w) => [w.day, w.tag])).toEqual([
      ['2026-11-01', 'on_plan'],
      ['2026-11-03', 'under'],
    ]);
  });

  it('is a no-op once everything matches', () => {
    const first = backfillDiet(days, () => target, existing, '2026-11-22');
    const merged = [...existing.filter((e) => !first.some((w) => w.day === e.day)), ...first];
    expect(backfillDiet(days, () => target, merged, '2026-11-22')).toEqual([]);
  });
});

describe('diet summary', () => {
  it('scores on-track days against every counted day, events aside', () => {
    const s = dietSummary(
      [
        { day: '2026-11-01', tag: 'on_plan', kcal_estimate: null },
        { day: '2026-11-02', tag: 'under', kcal_estimate: null },
        { day: '2026-11-03', tag: 'over', kcal_estimate: null },
        { day: '2026-11-04', tag: 'event', kcal_estimate: null },
      ],
      '2026-11-01',
      '2026-11-07',
    );
    expect(s.adherence).toBeCloseTo(1 / 3);
    expect(dietMisses(s)).toBe('1 below · 1 above · 1 event');
  });
});
