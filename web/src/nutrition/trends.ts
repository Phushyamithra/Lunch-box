/**
 * Intake trends, adherence and maintenance calibration. Pure.
 *
 * Honest about gaps: a day only counts toward averages and adherence when
 * it looks fully logged (at least half the calorie target), and away /
 * event days are kept apart. Nothing here changes
 * targets; suggestions are applied only after you confirm.
 */
import type { MacroTargets } from './engine';
import { DAYS_PER_MONTH, KCAL_PER_KG } from './engine';
import { sumNutrients, type Entry, type MealSlot, type Nutrients } from './foodLog';

export type DayStatus = 'tracked' | 'partial' | 'empty' | 'away' | 'event';

export interface DaySummary {
  day: string;
  total: Nutrients;
  target: MacroTargets | null;
  status: DayStatus;
  /** Calories within ±10% of target (tracked days only). */
  kcalOnTarget: boolean | null;
  /** Protein at or above the minimum of the range (tracked days only). */
  proteinOk: boolean | null;
}

const addDay = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const dayRange = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDay(d, 1)) out.push(d);
  return out;
};

export function summariseDays(input: {
  from: string;
  to: string;
  entries: Entry[];
  targetFor: (day: string) => MacroTargets | null;
  isAway: (day: string) => boolean;
  /** Days tagged "event / travel" in Fitness. */
  isEvent: (day: string) => boolean;
}): DaySummary[] {
  const byDay = new Map<string, Entry[]>();
  for (const e of input.entries) {
    if (e.deleted_at || e.day < input.from || e.day > input.to) continue;
    byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  }
  return dayRange(input.from, input.to).map((day) => {
    const rows = byDay.get(day) ?? [];
    const total = sumNutrients(rows);
    const target = input.targetFor(day);
    let status: DayStatus;
    if (input.isAway(day)) status = 'away';
    else if (input.isEvent(day)) status = 'event';
    else if (rows.length === 0) status = 'empty';
    else status = target && total.kcal < target.kcal * 0.5 ? 'partial' : 'tracked';
    const tracked = status === 'tracked' && target !== null;
    return {
      day,
      total,
      target,
      status,
      kcalOnTarget: tracked ? Math.abs(total.kcal - target.kcal) <= target.kcal * 0.1 : null,
      proteinOk: tracked ? total.protein >= target.protein_min : null,
    };
  });
}

export interface PeriodStats {
  days: number;
  tracked: number;
  partial: number;
  empty: number;
  away: number;
  event: number;
  avgKcal: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  avgFibre: number | null;
  kcalOnTarget: number;
  proteinOk: number;
  /** Average daily gap to the calorie target (tracked days). */
  avgKcalGap: number | null;
}

export function periodStats(days: DaySummary[]): PeriodStats {
  const tracked = days.filter((d) => d.status === 'tracked');
  const avg = (f: (d: DaySummary) => number) => (tracked.length ? Math.round((tracked.reduce((a, d) => a + f(d), 0) / tracked.length) * 10) / 10 : null);
  const count = (s: DayStatus) => days.filter((d) => d.status === s).length;
  const withTarget = tracked.filter((d) => d.target);
  return {
    days: days.length,
    tracked: tracked.length,
    partial: count('partial'),
    empty: count('empty'),
    away: count('away'),
    event: count('event'),
    avgKcal: avg((d) => d.total.kcal),
    avgProtein: avg((d) => d.total.protein),
    avgCarbs: avg((d) => d.total.carbs),
    avgFat: avg((d) => d.total.fat),
    avgFibre: avg((d) => d.total.fibre),
    kcalOnTarget: tracked.filter((d) => d.kcalOnTarget).length,
    proteinOk: tracked.filter((d) => d.proteinOk).length,
    avgKcalGap: withTarget.length ? Math.round(withTarget.reduce((a, d) => a + (d.total.kcal - (d.target as MacroTargets).kcal), 0) / withTarget.length) : null,
  };
}

export interface Calibration {
  status: 'ready' | 'not_enough';
  /** Estimated real maintenance (kcal/day). */
  maintenance: number | null;
  avgIntake: number | null;
  trackedDays: number;
  spanDays: number;
  kgPerMonth: number | null;
  message: string;
}

/**
 * Real maintenance from your own data: average intake minus the energy that
 * went into the weight change over the same weeks (≈7,700 kcal per kg).
 * Needs a weight trend and at least 14 tracked days covering 70% of it.
 */
export function calibrateMaintenance(input: {
  days: DaySummary[];
  rate: { kgPerMonth: number; fromWeek: string; toWeekEnd: string } | null;
}): Calibration {
  const { rate } = input;
  if (!rate) {
    return { status: 'not_enough', maintenance: null, avgIntake: null, trackedDays: 0, spanDays: 0, kgPerMonth: null, message: 'Needs a weight trend first: two weeks with 3+ weigh-ins each.' };
  }
  const span = input.days.filter((d) => d.day >= rate.fromWeek && d.day <= rate.toWeekEnd);
  const counted = span.filter((d) => d.status !== 'away' && d.status !== 'event');
  const tracked = counted.filter((d) => d.status === 'tracked');
  const avgIntake = tracked.length ? Math.round(tracked.reduce((a, d) => a + d.total.kcal, 0) / tracked.length) : null;
  const enough = tracked.length >= 14 && counted.length > 0 && tracked.length / counted.length >= 0.7;
  if (!enough || avgIntake === null) {
    return {
      status: 'not_enough',
      maintenance: null,
      avgIntake,
      trackedDays: tracked.length,
      spanDays: counted.length,
      kgPerMonth: rate.kgPerMonth,
      message: `Needs fully logged days for most of the weight-trend window: ${tracked.length} of ${counted.length} so far (want 14+ and 70%).`,
    };
  }
  const stored = (rate.kgPerMonth * KCAL_PER_KG) / DAYS_PER_MONTH;
  const maintenance = Math.round((avgIntake - stored) / 10) * 10;
  return {
    status: 'ready',
    maintenance,
    avgIntake,
    trackedDays: tracked.length,
    spanDays: counted.length,
    kgPerMonth: rate.kgPerMonth,
    message: `You averaged ${avgIntake} kcal on ${tracked.length} fully logged days while weight changed ${rate.kgPerMonth >= 0 ? '+' : ''}${rate.kgPerMonth.toFixed(2)} kg/month (≈${Math.round(stored)} kcal/day ${stored >= 0 ? 'stored' : 'drawn'}). So maintenance ≈ ${maintenance} kcal.`,
  };
}

/**
 * Targets rebuilt around a calibrated maintenance, keeping your intended
 * surplus/deficit (rate) and protein/fat; carbs absorb the difference.
 */
export function retargetFromMaintenance(t: MacroTargets, maintenance: number, rateKgPerMonth: number): MacroTargets {
  const kcal = Math.round((maintenance + (rateKgPerMonth * KCAL_PER_KG) / DAYS_PER_MONTH) / 50) * 50;
  const carbs = Math.max(0, Math.round(t.carbs_g + (kcal - t.kcal) / 4));
  return { ...t, kcal, carbs_g: carbs };
}

/** Optional per-meal protein guide (snacks lighter), from the day's aim. */
export const PROTEIN_SPLIT: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.3, snacks: 0.15, dinner: 0.3 };
export const proteinPerMeal = (aim: number): Record<MealSlot, number> =>
  Object.fromEntries(Object.entries(PROTEIN_SPLIT).map(([k, f]) => [k, Math.round((aim * f) / 5) * 5])) as Record<MealSlot, number>;

/** What contributed most over a period: by food (or name), with calories and protein. */
export function topFoods(entries: Entry[], from: string, to: string, limit = 8): { name: string; times: number; kcal: number; protein: number }[] {
  const m = new Map<string, { name: string; times: number; kcal: number; protein: number }>();
  for (const e of entries) {
    if (e.deleted_at || e.day < from || e.day > to) continue;
    const key = e.food_id ?? e.name.toLowerCase();
    const g = m.get(key) ?? { name: e.name, times: 0, kcal: 0, protein: 0 };
    g.times += 1;
    g.kcal += e.kcal;
    g.protein += e.protein;
    m.set(key, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, kcal: Math.round(g.kcal), protein: Math.round(g.protein * 10) / 10 }))
    .sort((a, b) => b.kcal - a.kcal)
    .slice(0, limit);
}
