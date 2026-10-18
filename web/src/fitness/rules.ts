/**
 * Fitness rules for the lean-bulk tracker. Pure functions only, so every
 * rule here is unit-tested. Dates are local `YYYY-MM-DD` keys; weeks run
 * Monday → Sunday.
 *
 * Principles (from the brief): favour weekly averages over daily readings,
 * keep away periods out of trends and adherence, never invent data, and
 * say when there isn't enough of it.
 */
import dayjs from 'dayjs';

const KEY = 'YYYY-MM-DD';
export const DAYS_PER_MONTH = 30.4375;

// ---------- Rows (the subset of DB columns the rules use) ----------

export interface WeighIn {
  id: string;
  day: string;
  weight_kg: number;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'night';
  deleted_at: string | null;
}
export interface Waist {
  id: string;
  day: string;
  waist_cm: number;
  deleted_at: string | null;
}
export interface AwayPeriod {
  id: string;
  starts_on: string;
  ends_on: string;
  label: string | null;
}
export interface Session {
  id: string;
  day: string;
  variant_index: number;
  completed: boolean;
  slots_completed: number;
}
export interface DietDay {
  day: string;
  tag: 'on_plan' | 'partial' | 'event';
  kcal_estimate: number | null;
}
export interface SetRow {
  session_id: string;
  exercise: string;
  set_number: number;
  reps: number;
  weight_kg: number;
}
export interface GainSettings {
  gain_target_kg_month: number;
  gain_high_kg_month: number;
  gain_low_kg_month: number;
}

// ---------- Dates ----------

export const weekStart = (day: string): string => {
  const d = dayjs(day);
  return d.subtract((d.day() + 6) % 7, 'day').format(KEY);
};
export const addDays = (day: string, n: number): string => dayjs(day).add(n, 'day').format(KEY);
export const daysBetween = (from: string, to: string): number => dayjs(to).diff(dayjs(from), 'day');
/** 1 = Monday … 7 = Sunday. */
export const isoWeekday = (day: string): number => ((dayjs(day).day() + 6) % 7) + 1;

// ---------- Away mode ----------

export function awayPeriodFor(day: string, periods: AwayPeriod[]): AwayPeriod | null {
  return periods.find((p) => day >= p.starts_on && day <= p.ends_on) ?? null;
}
export const isAway = (day: string, periods: AwayPeriod[]): boolean => awayPeriodFor(day, periods) !== null;

/**
 * After an away period, weekly trends use only full clean weeks: they
 * resume from the Monday after the period ends (or that day, if the
 * period ended on a Sunday).
 */
export function trendsResumeOn(period: AwayPeriod): string {
  return weekStart(addDays(period.ends_on, 1)) === addDays(period.ends_on, 1)
    ? addDays(period.ends_on, 1)
    : addDays(weekStart(period.ends_on), 7);
}

// ---------- Weight ----------

export interface WeekAverage {
  weekStart: string;
  /** Mean of daily weights (non-away days only); null when no data. */
  average: number | null;
  /** Days with a non-away weigh-in. */
  days: number;
  awayDays: number;
  /** Enough data to trust: at least 3 weighed days. */
  sufficient: boolean;
}

export const MIN_DAYS_PER_WEEK = 3;

/** One value per day: the mean of that day's live, non-away weigh-ins. */
export function dailyWeights(weighIns: WeighIn[], periods: AwayPeriod[]): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const w of weighIns) {
    if (w.deleted_at || isAway(w.day, periods)) continue;
    const s = sums.get(w.day) ?? { total: 0, n: 0 };
    s.total += Number(w.weight_kg);
    s.n += 1;
    sums.set(w.day, s);
  }
  return new Map([...sums].map(([day, s]) => [day, s.total / s.n]));
}

/** Weekly averages from the first weighed week to `today`'s week. */
export function weeklyAverages(weighIns: WeighIn[], periods: AwayPeriod[], today: string): WeekAverage[] {
  const daily = dailyWeights(weighIns, periods);
  const live = weighIns.filter((w) => !w.deleted_at).map((w) => w.day).sort();
  if (live.length === 0) return [];
  const weeks: WeekAverage[] = [];
  for (let start = weekStart(live[0]); start <= weekStart(today); start = addDays(start, 7)) {
    const values: number[] = [];
    let awayDays = 0;
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(start, i);
      if (isAway(day, periods)) awayDays += 1;
      const v = daily.get(day);
      if (v !== undefined) values.push(v);
    }
    weeks.push({
      weekStart: start,
      average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      days: values.length,
      awayDays,
      sufficient: values.length >= MIN_DAYS_PER_WEEK,
    });
  }
  return weeks;
}

export interface GainRate {
  kgPerMonth: number;
  from: WeekAverage;
  to: WeekAverage;
  spanWeeks: number;
  /** An away period falls between the compared weeks. */
  spansAway: boolean;
}

/**
 * Gain rate from weekly averages (never daily readings): the latest
 * complete, sufficient week against one about four weeks earlier (or the
 * earliest available). Null when fewer than two such weeks exist.
 */
export function gainRate(weeks: WeekAverage[], periods: AwayPeriod[], today: string): GainRate | null {
  const usable = weeks.filter((w) => w.sufficient && w.average !== null && addDays(w.weekStart, 6) < today);
  if (usable.length < 2) return null;
  const to = usable[usable.length - 1];
  const target = addDays(to.weekStart, -28);
  const earlier = usable.slice(0, -1);
  const from = [...earlier].reverse().find((w) => w.weekStart <= target) ?? earlier[0];
  const spanWeeks = daysBetween(from.weekStart, to.weekStart) / 7;
  const kgPerMonth = (((to.average as number) - (from.average as number)) / (spanWeeks * 7)) * DAYS_PER_MONTH;
  const spansAway = periods.some((p) => p.ends_on >= from.weekStart && p.starts_on <= addDays(to.weekStart, 6));
  return { kgPerMonth, from, to, spanWeeks, spansAway };
}

export type GainVerdict =
  | { kind: 'insufficient'; message: string }
  | { kind: 'on_track' | 'fast' | 'slow' | 'slow_early'; message: string; rate: GainRate };

/** Plain-language reading of the gain rate (indicative, not a diagnosis). */
export function assessGain(rate: GainRate | null, s: GainSettings): GainVerdict {
  if (!rate) {
    return {
      kind: 'insufficient',
      message: `Need two complete weeks with at least ${MIN_DAYS_PER_WEEK} weigh-ins each to estimate a trend.`,
    };
  }
  const r = rate.kgPerMonth;
  if (r > s.gain_high_kg_month) {
    return { kind: 'fast', rate, message: 'Gaining faster than planned. Consider about 100 kcal/day less, reducing fat first.' };
  }
  if (r < s.gain_low_kg_month) {
    if (rate.spanWeeks >= 4) {
      return { kind: 'slow', rate, message: 'Gaining slower than planned over a full month. Consider about 100 kcal/day more, adding carbohydrates.' };
    }
    return { kind: 'slow_early', rate, message: 'Slow so far, but less than a month of data. Give it a full month before changing intake.' };
  }
  return { kind: 'on_track', rate, message: `On track for about ${s.gain_target_kg_month} kg/month.` };
}

// ---------- Waist ----------

export interface WaistSummary {
  baseline: Waist | null;
  latest: Waist | null;
  changeFromBaseline: number | null;
  nextDue: string | null;
  overdue: boolean;
  /** Trend points (away measurements excluded). */
  trend: Waist[];
}

export function waistSummary(entries: Waist[], periods: AwayPeriod[], intervalDays: number, today: string): WaistSummary {
  const live = entries.filter((w) => !w.deleted_at).sort((a, b) => a.day.localeCompare(b.day));
  const trend = live.filter((w) => !isAway(w.day, periods));
  const baseline = trend[0] ?? null;
  const latest = live[live.length - 1] ?? null;
  const latestTrend = trend[trend.length - 1] ?? null;
  const nextDue = latest ? addDays(latest.day, intervalDays) : null;
  return {
    baseline,
    latest,
    changeFromBaseline: baseline && latestTrend ? Number(latestTrend.waist_cm) - Number(baseline.waist_cm) : null,
    nextDue,
    overdue: nextDue !== null && nextDue < today,
    trend,
  };
}

export type CompositionSignal = 'favourable' | 'review' | 'neutral' | 'insufficient';

/**
 * Indicative only: rising weight with a stable waist reads as favourable;
 * rising weight with a rising waist is flagged for review.
 */
export function compositionSignal(trend: Waist[], rate: GainRate | null): { signal: CompositionSignal; waistDelta: number | null } {
  if (trend.length < 2 || !rate) return { signal: 'insufficient', waistDelta: null };
  const latest = trend[trend.length - 1];
  const earlier = [...trend].reverse().find((w) => daysBetween(w.day, latest.day) >= 21) ?? trend[0];
  const waistDelta = Number(latest.waist_cm) - Number(earlier.waist_cm);
  if (rate.kgPerMonth <= 0) return { signal: 'neutral', waistDelta };
  if (waistDelta >= 1) return { signal: 'review', waistDelta };
  if (Math.abs(waistDelta) < 0.5) return { signal: 'favourable', waistDelta };
  return { signal: 'neutral', waistDelta };
}

// ---------- Program rotation ----------

/**
 * Whole program rotates weekly: week 1 → V1 … week 7 → V7, then wraps.
 * `offset` holds manual advances. Returns 0-based variant index.
 */
export function variantIndexFor(day: string, rotationStart: string, offset: number): number {
  const weeks = Math.floor(daysBetween(weekStart(rotationStart), weekStart(day)) / 7);
  return (((weeks + offset) % 7) + 7) % 7;
}

// ---------- Training adherence ----------

export interface WeekAdherence {
  weekStart: string;
  /** Planned Mon–Sat sessions not inside an away period. */
  eligible: number;
  completed: number;
  awayDays: number;
}

export function weekAdherence(start: string, sessions: Session[], periods: AwayPeriod[]): WeekAdherence {
  let eligible = 0;
  let completed = 0;
  let awayDays = 0;
  for (let i = 0; i < 6; i += 1) {
    const day = addDays(start, i);
    if (isAway(day, periods)) {
      awayDays += 1;
      continue;
    }
    eligible += 1;
    if (sessions.some((s) => s.day === day && s.completed)) completed += 1;
  }
  return { weekStart: start, eligible, completed, awayDays };
}

// ---------- Diet ----------

export interface DietSummary {
  onPlan: number;
  partial: number;
  event: number;
  /** Share of non-event tagged days that were on plan; null if none. */
  adherence: number | null;
}

/** Event/travel days are kept apart: they are neither wins nor failures. */
export function dietSummary(days: DietDay[], from: string, to: string): DietSummary {
  const inRange = days.filter((d) => d.day >= from && d.day <= to);
  const onPlan = inRange.filter((d) => d.tag === 'on_plan').length;
  const partial = inRange.filter((d) => d.tag === 'partial').length;
  const event = inRange.filter((d) => d.tag === 'event').length;
  return { onPlan, partial, event, adherence: onPlan + partial > 0 ? onPlan / (onPlan + partial) : null };
}

// ---------- Key lifts ----------

export interface KeyLiftGroup {
  label: string;
  exercises: string[];
}
export interface LiftPoint {
  day: string;
  /** Heaviest working set that day. */
  weight: number;
  reps: number;
}

/**
 * Working-weight trend per exact exercise name. Different exercises in
 * the same group (e.g. bench press vs chest press) stay separate series.
 */
export function liftSeries(group: KeyLiftGroup, sets: SetRow[], sessions: Session[]): Map<string, LiftPoint[]> {
  const dayOf = new Map(sessions.map((s) => [s.id, s.day]));
  const names = new Map(group.exercises.map((e) => [e.trim().toLowerCase(), e]));
  const series = new Map<string, Map<string, LiftPoint>>();
  for (const set of sets) {
    const name = names.get(set.exercise.trim().toLowerCase());
    const day = dayOf.get(set.session_id);
    if (!name || !day || set.reps <= 0) continue;
    const byDay = series.get(name) ?? new Map<string, LiftPoint>();
    const current = byDay.get(day);
    const weight = Number(set.weight_kg);
    if (!current || weight > current.weight || (weight === current.weight && set.reps > current.reps)) {
      byDay.set(day, { day, weight, reps: set.reps });
    }
    series.set(name, byDay);
  }
  return new Map([...series].map(([name, byDay]) => [name, [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))]));
}
