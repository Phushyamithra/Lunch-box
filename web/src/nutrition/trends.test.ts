import { describe, expect, it } from 'vitest';
import { LEAN_BULK_PRESET } from './engine';
import type { Entry } from './foodLog';
import { calibrateMaintenance, dayRange, periodStats, proteinPerMeal, retargetFromMaintenance, summariseDays, topFoods } from './trends';

const e = (day: string, kcal: number, protein: number, name = 'x'): Entry => ({
  id: `${day}-${name}-${kcal}`,
  day,
  meal: 'lunch',
  food_id: null,
  meal_log_id: null,
  name,
  quantity: 1,
  unit: 'serving',
  grams: null,
  verification: 'user',
  source: 'quick',
  logged_at: `${day}T12:00:00Z`,
  deleted_at: null,
  kcal,
  protein,
  carbs: 0,
  fat: 0,
  fibre: 0,
  sugar: null,
  sodium_mg: null,
});

const base = { targetFor: () => LEAN_BULK_PRESET, isAway: (d: string) => d === '2026-10-15', isEvent: (d: string) => d === '2026-10-16' };

describe('daily status and adherence', () => {
  const entries = [
    e('2026-10-12', 2400, 145), // on target, protein ok
    e('2026-10-13', 2000, 120), // under by 450 → off target, protein low
    e('2026-10-14', 900, 50), // under half the target → partial (likely not fully logged)
    e('2026-10-15', 3000, 90), // away
    e('2026-10-16', 3200, 80), // event day
    e('2026-10-18', 2600, 150), // within 10%
  ];
  const days = summariseDays({ from: '2026-10-12', to: '2026-10-18', entries, ...base });

  it('classifies each day honestly', () => {
    expect(days.map((d) => d.status)).toEqual(['tracked', 'tracked', 'partial', 'away', 'event', 'empty', 'tracked']);
    expect(days[0]).toMatchObject({ kcalOnTarget: true, proteinOk: true });
    expect(days[1]).toMatchObject({ kcalOnTarget: false, proteinOk: false });
    expect(days[2].kcalOnTarget).toBeNull();
  });

  it('averages and adherence use only fully logged days', () => {
    expect(periodStats(days)).toMatchObject({
      days: 7,
      tracked: 3,
      partial: 1,
      empty: 1,
      away: 1,
      event: 1,
      avgKcal: 2333.3,
      avgProtein: 138.3,
      kcalOnTarget: 2,
      proteinOk: 2,
      avgKcalGap: -117,
    });
  });
});

describe('maintenance calibration', () => {
  const span = dayRange('2026-09-14', '2026-10-18');
  const entries = span.map((d) => e(d, 2700, 145));

  it('estimates maintenance from intake and the weight trend', () => {
    const days = summariseDays({ from: '2026-09-14', to: '2026-10-18', entries, targetFor: () => LEAN_BULK_PRESET, isAway: () => false, isEvent: () => false });
    const c = calibrateMaintenance({ days, rate: { kgPerMonth: 1, fromWeek: '2026-09-14', toWeekEnd: '2026-10-18' } });
    // 2700 − 1 kg × 7700 / 30.44 ≈ 2700 − 253 → 2450
    expect(c).toMatchObject({ status: 'ready', avgIntake: 2700, maintenance: 2450, trackedDays: 35 });
    expect(c.message).toContain('maintenance ≈ 2450');
  });

  it('refuses without enough logged days or a weight trend', () => {
    const sparse = summariseDays({
      from: '2026-09-14',
      to: '2026-10-18',
      entries: entries.filter((_, i) => i % 2 === 0),
      targetFor: () => LEAN_BULK_PRESET,
      isAway: () => false,
      isEvent: () => false,
    });
    expect(calibrateMaintenance({ days: sparse, rate: { kgPerMonth: 1, fromWeek: '2026-09-14', toWeekEnd: '2026-10-18' } }).status).toBe('not_enough');
    expect(calibrateMaintenance({ days: sparse, rate: null }).message).toMatch(/weight trend/);
  });

  it('rebuilds targets around the calibrated maintenance, carbs taking the difference', () => {
    const t = retargetFromMaintenance(LEAN_BULK_PRESET, 2600, 0.4);
    expect(t.kcal).toBe(2700); // 2600 + ~101, rounded to 50
    expect(t.carbs_g).toBe(295 + 63); // +250 kcal / 4
    expect(t.protein_g).toBe(LEAN_BULK_PRESET.protein_g);
  });
});

describe('helpers', () => {
  it('splits protein across meals, snacks lighter', () => {
    expect(proteinPerMeal(145)).toEqual({ breakfast: 35, lunch: 45, snacks: 20, dinner: 45 });
  });
  it('ranks foods by calories contributed', () => {
    const top = topFoods([e('2026-10-12', 300, 20, 'Paneer'), e('2026-10-13', 300, 20, 'Paneer'), e('2026-10-13', 500, 5, 'Samosa')], '2026-10-12', '2026-10-18');
    expect(top.map((t) => [t.name, t.times, t.kcal])).toEqual([
      ['Paneer', 2, 600],
      ['Samosa', 1, 500],
    ]);
  });
});
