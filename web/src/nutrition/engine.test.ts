import { describe, expect, it } from 'vitest';
import {
  LEAN_BULK_PRESET,
  adjustForTrend,
  bmr,
  checkConsistency,
  estimateTargets,
  suggestActivity,
  validateTargets,
  type Profile,
} from './engine';

const me: Profile = { sex: 'male', birth_year: 2000, height_cm: 175, activity: 'moderate' };

describe('energy estimate', () => {
  it('uses Mifflin–St Jeor', () => {
    expect(bmr({ sex: 'male', age: 26, height_cm: 175, weight_kg: 65 })).toBeCloseTo(1618.75);
    expect(bmr({ sex: 'female', age: 26, height_cm: 160, weight_kg: 55 })).toBeCloseTo(1259);
  });

  it('suggests an activity level from training days and steps, not from workout burns', () => {
    expect(suggestActivity(6, 10000).level).toBe('moderate');
    expect(suggestActivity(0, 4000).level).toBe('sedentary');
    expect(suggestActivity(2, 7000).level).toBe('light');
  });

  it('lean bulk: maintenance + rate surplus, macros that add up, working shown', () => {
    const e = estimateTargets({ profile: me, weight_kg: 65, year: 2026, mode: 'lean_bulk', rateKgPerMonth: 0.4 });
    expect(Math.round(e.maintenance)).toBe(2509); // 1618.75 × 1.55
    expect(Math.round(e.adjustment)).toBe(101); // 0.4 × 7700 / 30.4375
    expect(e.targets.kcal).toBe(2600);
    expect(e.targets).toMatchObject({ protein_min: 105, protein_max: 145, protein_g: 125, fat_min: 40, fat_max: 65, fat_g: 65 });
    expect(checkConsistency(e.targets).status).toBe('consistent');
    expect(e.working.join(' ')).toContain('estimate');
  });

  it('deficit and recomposition go below maintenance; maintenance stays put', () => {
    const cut = estimateTargets({ profile: me, weight_kg: 80, year: 2026, mode: 'deficit', rateKgPerMonth: 2 });
    const keep = estimateTargets({ profile: me, weight_kg: 80, year: 2026, mode: 'maintenance', rateKgPerMonth: 2 });
    const recomp = estimateTargets({ profile: me, weight_kg: 80, year: 2026, mode: 'recomp', rateKgPerMonth: 0 });
    expect(cut.targets.kcal).toBeLessThan(keep.targets.kcal - 400);
    expect(recomp.targets.kcal).toBeLessThan(keep.targets.kcal);
    expect(keep.adjustment).toBe(0);
    for (const e of [cut, keep, recomp]) expect(checkConsistency(e.targets).status).toBe('consistent');
  });
});

describe('consistency', () => {
  it('keeps the lean-bulk preset as configured: inside the ranges, with the midpoint gap shown', () => {
    const c = checkConsistency(LEAN_BULK_PRESET);
    expect(c.status).toBe('within_ranges');
    expect(c.pointKcal).toBe(2345);
    expect(c.rangeKcal).toEqual([2235, 2455]);
    expect(c.gap).toBe(-105);
    expect(c.carbsForPoints).toBe(321);
    expect(validateTargets(LEAN_BULK_PRESET)).toBeNull();
  });

  it('flags a real mismatch and says how to fix it', () => {
    const bad = { ...LEAN_BULK_PRESET, carbs_g: 150 };
    const c = checkConsistency(bad);
    expect(c.status).toBe('inconsistent');
    expect(c.message).toContain('321 g');
    expect(validateTargets(bad)).toMatch(/Carbs of about 321 g/);
  });

  it('rejects aims outside their ranges', () => {
    expect(validateTargets({ ...LEAN_BULK_PRESET, protein_g: 160 })).toMatch(/Protein/);
    expect(validateTargets({ ...LEAN_BULK_PRESET, kcal: 500 })).toMatch(/Calories/);
  });
});

describe('trend adjustments (only applied after you confirm)', () => {
  it('−100 kcal takes fat first, down to its minimum, then carbs', () => {
    const r = adjustForTrend(LEAN_BULK_PRESET, 'down');
    expect(r.targets).toMatchObject({ kcal: 2350, fat_g: 55, carbs_g: 292 });
    expect(r.summary).toBe('−100 kcal: −10 g fat, −3 g carbs');
  });
  it('+100 kcal goes to carbs', () => {
    const r = adjustForTrend(LEAN_BULK_PRESET, 'up');
    expect(r.targets).toMatchObject({ kcal: 2550, carbs_g: 320, fat_g: 65 });
  });
  it('returns only target numbers, never the saved row’s id', () => {
    const r = adjustForTrend({ ...LEAN_BULK_PRESET, id: 'x', created_at: 'y' } as never, 'up');
    expect(Object.keys(r.targets)).not.toContain('id');
    expect(Object.keys(r.targets)).not.toContain('created_at');
  });
});

describe('target versions', () => {
  it('a day uses the version in force then; the latest save wins on the same day', async () => {
    const { activeTarget } = await import('./nutritionApi');
    const v = (id: string, effective_from: string, created_at: string) => ({ ...LEAN_BULK_PRESET, id, effective_from, created_at, mode: 'lean_bulk' as const, rate_kg_month: 0.4, reason: '', inputs: {} });
    const versions = [v('a', '2026-09-17', '2026-09-17T08:00'), v('b', '2026-10-19', '2026-10-19T08:00'), v('c', '2026-10-19', '2026-10-19T09:00')];
    expect(activeTarget(versions, '2026-09-01')).toBeNull();
    expect(activeTarget(versions, '2026-10-18')?.id).toBe('a');
    expect(activeTarget(versions, '2026-10-19')?.id).toBe('c');
  });
});
