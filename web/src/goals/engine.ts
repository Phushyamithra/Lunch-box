/**
 * Goals engine. Pure.
 *
 * A goal measures something you already log (sessions, weigh-ins, food
 * days…) or a manual check-in, per day / week / month, or once. Progress
 * is derived from the logs every time, never stored, so editing a goal
 * cannot erase history. Target changes apply from their date onwards.
 *
 * Away periods and the first cycle that started before the goal are
 * neutral: they neither count as met nor break a streak.
 */
import dayjs from 'dayjs';
import type { FitnessData } from '../fitness/fitnessApi';
import { addDays, gainRate, isAway, weeklyAverages, weekStart } from '../fitness/rules';
import type { NutritionData } from '../nutrition/nutritionApi';
import { activeTarget } from '../nutrition/nutritionApi';
import { summariseDays, type DaySummary } from '../nutrition/trends';

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'one_off';
export const CADENCE_LABEL: Record<Cadence, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', one_off: 'One-off' };

export interface GoalVersion {
  from: string;
  target: number;
}
export interface Goal {
  id: string;
  title: string;
  emoji: string | null;
  metric: string;
  params: Record<string, unknown>;
  cadence: Cadence;
  versions: GoalVersion[];
  starts_on: string;
  ends_on: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}
export interface Checkin {
  id: string;
  goal_id: string;
  period_start: string;
  note: string | null;
  deleted_at: string | null;
}

export interface GoalContext {
  today: string;
  fitness: FitnessData | null;
  nutrition: NutritionData | null;
  /** Meal-prep deliveries (live logs). */
  mealPrepDays: string[] | null;
  checkins: Checkin[];
}

export type Module = 'fitness' | 'nutrition' | 'meal_prep' | 'any';
export interface MetricDef {
  key: string;
  module: Module;
  label: string;
  /** Short unit for "4 / 6 sessions". */
  unit: string;
  cadences: Cadence[];
  /** Fixed target (yes/no metrics); otherwise you choose it. */
  fixedTarget?: number;
  /** For one-off goals: value must reach the target from below ('up') or above ('down'). */
  direction: 'up' | 'down';
  /** What data it needs; missing data shows as "no data", never as missed. */
  needs: 'fitness' | 'nutrition' | 'meal_prep' | 'checkins';
  hint: string;
  /** Value over [from, to] (inclusive). null = can't tell from the data. */
  measure: (ctx: GoalContext, from: string, to: string, params: Record<string, unknown>, goal: Goal) => number | null;
}

const daysIn = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
const nutritionDays = (ctx: GoalContext, from: string, to: string): DaySummary[] | null => {
  const n = ctx.nutrition;
  if (!n) return null;
  const f = ctx.fitness;
  return summariseDays({
    from,
    to: to > ctx.today ? ctx.today : to,
    entries: n.entries,
    targetFor: (d) => activeTarget(n.targets, d),
    isAway: (d) => (f ? isAway(d, f.away) : false),
    isEvent: (d) => (f ? f.diet.some((x) => x.day === d && x.tag === 'event') : false),
  });
};

/** Count of fully logged days passing a test; null when nothing was fully logged (can't judge). */
const onTrackedDays = (c: GoalContext, from: string, to: string, ok: (d: DaySummary) => boolean): number | null => {
  const days = nutritionDays(c, from, to);
  if (!days || !days.some((d) => d.status === 'tracked')) return null;
  return days.filter(ok).length;
};

export const METRICS: MetricDef[] = [
  {
    key: 'fitness.sessions',
    module: 'fitness',
    label: 'Workouts completed',
    unit: 'sessions',
    cadences: ['weekly', 'monthly'],
    direction: 'up',
    needs: 'fitness',
    hint: 'Sessions marked done.',
    measure: (c, from, to) => (c.fitness ? c.fitness.sessions.filter((s) => s.completed && s.day >= from && s.day <= to).length : null),
  },
  {
    key: 'fitness.weigh_ins',
    module: 'fitness',
    label: 'Weigh-in days (trend time)',
    unit: 'days',
    cadences: ['weekly', 'monthly'],
    direction: 'up',
    needs: 'fitness',
    hint: 'Days with a weigh-in at your trend time of day.',
    measure: (c, from, to) => {
      if (!c.fitness) return null;
      const t = c.fitness.settings.weigh_time;
      return new Set(c.fitness.weighIns.filter((w) => !w.deleted_at && w.day >= from && w.day <= to && (t === 'any' || w.time_of_day === t)).map((w) => w.day)).size;
    },
  },
  {
    key: 'fitness.waist',
    module: 'fitness',
    label: 'Waist measured',
    unit: 'times',
    cadences: ['monthly'],
    direction: 'up',
    needs: 'fitness',
    hint: 'Waist measurements logged.',
    measure: (c, from, to) => (c.fitness ? c.fitness.waists.filter((w) => !w.deleted_at && w.day >= from && w.day <= to).length : null),
  },
  {
    key: 'fitness.cardio',
    module: 'fitness',
    label: 'Cardio sessions',
    unit: 'sessions',
    cadences: ['weekly', 'monthly'],
    direction: 'up',
    needs: 'fitness',
    hint: 'Sessions with cardio ticked.',
    measure: (c, from, to) => (c.fitness ? c.fitness.sessions.filter((s) => s.cardio_done && s.day >= from && s.day <= to).length : null),
  },
  {
    key: 'fitness.steps',
    module: 'fitness',
    label: 'Days at your steps target',
    unit: 'days',
    cadences: ['daily', 'weekly', 'monthly'],
    direction: 'up',
    needs: 'fitness',
    hint: 'Days whose recorded steps reach the target in Fitness settings. Steps are entered by hand, so a cycle with no entries shows as no data.',
    measure: (c, from, to) => {
      if (!c.fitness) return null;
      const target = c.fitness.settings.steps_target;
      const rows = c.fitness.steps.filter((s) => s.day >= from && s.day <= to);
      return rows.length ? rows.filter((s) => s.steps >= target).length : null;
    },
  },
  {
    key: 'fitness.gain_on_track',
    module: 'fitness',
    label: 'Gain rate in your planned band',
    unit: '',
    cadences: ['monthly'],
    fixedTarget: 1,
    direction: 'up',
    needs: 'fitness',
    hint: 'At month end, the measured weekly-average rate is inside the band in Fitness settings.',
    measure: (c, _from, to) => {
      const f = c.fitness;
      if (!f) return null;
      const asOf = to < c.today ? addDays(to, 1) : c.today;
      const rate = gainRate(weeklyAverages(f.weighIns, f.away, asOf, f.settings.weigh_time), f.away, asOf);
      if (!rate) return null;
      return rate.kgPerMonth >= f.settings.gain_low_kg_month && rate.kgPerMonth <= f.settings.gain_high_kg_month ? 1 : 0;
    },
  },
  {
    key: 'fitness.weight_reach',
    module: 'fitness',
    label: 'Weekly average weight reaches',
    unit: 'kg',
    cadences: ['one_off'],
    direction: 'up',
    needs: 'fitness',
    hint: 'A full week (3+ weigh-ins) averages at or above the target. For a cut, choose "down".',
    measure: (c, from, to, params) => {
      const f = c.fitness;
      if (!f) return null;
      const weeks = weeklyAverages(f.weighIns, f.away, c.today, f.settings.weigh_time).filter((w) => w.sufficient && w.average !== null && w.weekStart >= weekStart(from) && addDays(w.weekStart, 6) <= to);
      if (!weeks.length) return null;
      const vals = weeks.map((w) => w.average as number);
      return params.direction === 'down' ? Math.min(...vals) : Math.max(...vals);
    },
  },
  {
    key: 'fitness.lift_reach',
    module: 'fitness',
    label: 'Key lift working weight reaches',
    unit: 'kg',
    cadences: ['one_off'],
    direction: 'up',
    needs: 'fitness',
    hint: 'Heaviest logged set in a key-lift group (Fitness settings).',
    measure: (c, from, to, params) => {
      const f = c.fitness;
      if (!f) return null;
      const group = f.settings.key_lifts.find((g) => g.label === params.lift);
      if (!group) return null;
      const names = new Set(group.exercises.map((e) => e.trim().toLowerCase()));
      const dayOf = new Map(f.sessions.map((s) => [s.id, s.day]));
      let best: number | null = null;
      for (const s of f.sets) {
        const d = dayOf.get(s.session_id);
        if (!d || d < from || d > to || s.reps <= 0 || !names.has(s.exercise.trim().toLowerCase())) continue;
        best = Math.max(best ?? 0, Number(s.weight_kg));
      }
      return best;
    },
  },
  {
    key: 'nutrition.days_logged',
    module: 'nutrition',
    label: 'Days fully logged',
    unit: 'days',
    cadences: ['daily', 'weekly', 'monthly'],
    direction: 'up',
    needs: 'nutrition',
    hint: 'Food logged up to at least half your calorie target.',
    measure: (c, from, to) => nutritionDays(c, from, to)?.filter((d) => d.status === 'tracked').length ?? null,
  },
  {
    key: 'nutrition.kcal_on_target',
    module: 'nutrition',
    label: 'Days within ±10% of calories',
    unit: 'days',
    cadences: ['daily', 'weekly', 'monthly'],
    direction: 'up',
    needs: 'nutrition',
    hint: 'Fully logged days within ±10% of the target in force that day.',
    measure: (c, from, to) => onTrackedDays(c, from, to, (d) => !!d.kcalOnTarget),
  },
  {
    key: 'nutrition.protein_ok',
    module: 'nutrition',
    label: 'Days at the protein minimum',
    unit: 'days',
    cadences: ['daily', 'weekly', 'monthly'],
    direction: 'up',
    needs: 'nutrition',
    hint: 'Fully logged days at or above the protein minimum.',
    measure: (c, from, to) => onTrackedDays(c, from, to, (d) => !!d.proteinOk),
  },
  {
    key: 'meal_prep.meals',
    module: 'meal_prep',
    label: 'Meal-prep meals logged',
    unit: 'meals',
    cadences: ['weekly', 'monthly'],
    direction: 'up',
    needs: 'meal_prep',
    hint: 'Deliveries logged in Meal prep.',
    measure: (c, from, to) => (c.mealPrepDays ? c.mealPrepDays.filter((d) => d >= from && d <= to).length : null),
  },
  {
    key: 'manual',
    module: 'any',
    label: 'Manual check-in',
    unit: '',
    cadences: ['daily', 'weekly', 'monthly', 'one_off'],
    fixedTarget: 1,
    direction: 'up',
    needs: 'checkins',
    hint: 'For what the app can’t see (photos in natural light, sleep…): tick it each cycle.',
    measure: (c, from, to, _p, goal) =>
      c.checkins.filter((x) => x.goal_id === goal.id && !x.deleted_at && x.period_start >= from && x.period_start <= to).length ? 1 : 0,
  },
];
export const metricOf = (key: string): MetricDef | undefined => METRICS.find((m) => m.key === key);

/** Version in force on `day` (latest `from` ≤ day; the first version before that). */
export function targetOn(goal: Pick<Goal, 'versions'>, day: string): number {
  const sorted = [...goal.versions].sort((a, b) => a.from.localeCompare(b.from));
  let t = sorted[0]?.target ?? 1;
  for (const v of sorted) if (v.from <= day) t = v.target;
  return t;
}

/** Start of the cycle containing `day`. */
export function cycleStart(cadence: Cadence, day: string): string {
  if (cadence === 'weekly') return weekStart(day);
  if (cadence === 'monthly') return dayjs(day).startOf('month').format('YYYY-MM-DD');
  return day;
}
export function cycleEnd(cadence: Cadence, start: string): string {
  if (cadence === 'weekly') return addDays(start, 6);
  if (cadence === 'monthly') return dayjs(start).endOf('month').format('YYYY-MM-DD');
  return start;
}

export type CycleStatus = 'met' | 'missed' | 'in_progress' | 'away' | 'partial' | 'no_data';
export interface Cycle {
  start: string;
  end: string;
  value: number | null;
  target: number;
  status: CycleStatus;
}

const isMet = (value: number | null, target: number, direction: 'up' | 'down') => value !== null && (direction === 'up' ? value >= target : value <= target);

/** Every cycle from the goal's start to today (or its end date), oldest first. */
export function goalCycles(goal: Goal, ctx: GoalContext): Cycle[] {
  const metric = metricOf(goal.metric);
  if (!metric || goal.cadence === 'one_off') return [];
  const last = goal.ends_on && goal.ends_on < ctx.today ? goal.ends_on : ctx.today;
  const out: Cycle[] = [];
  const away = ctx.fitness?.away ?? [];
  for (let start = cycleStart(goal.cadence, goal.starts_on); start <= last; start = addDays(cycleEnd(goal.cadence, start), 1)) {
    const end = cycleEnd(goal.cadence, start);
    const target = metric.fixedTarget ?? targetOn(goal, start);
    const value = metric.measure(ctx, start, end, goal.params, goal);
    const met = isMet(value, target, metric.direction);
    let status: CycleStatus;
    if (met) status = 'met';
    else if (end >= ctx.today) status = 'in_progress';
    else if (value === null) status = 'no_data';
    else if (daysIn(start, end).some((d) => isAway(d, away))) status = 'away';
    else if (start < goal.starts_on) status = 'partial';
    else status = 'missed';
    out.push({ start, end, value, target, status });
  }
  return out;
}

export interface GoalSummary {
  goal: Goal;
  metric: MetricDef | undefined;
  cycles: Cycle[];
  current: Cycle | null;
  /** Consecutive met cycles up to now (neutral cycles skipped, the cycle in progress doesn't break it). */
  streak: number;
  best: number;
  met: number;
  missed: number;
  /** One-off goals: the day it was first reached. */
  achievedOn: string | null;
  /** One-off goals: latest value toward the target. */
  progress: number | null;
}

/** First day a one-off goal was reached (scans by day; weight goals by week end). */
function firstReached(goal: Goal, metric: MetricDef, ctx: GoalContext): { on: string | null; value: number | null } {
  const target = targetOn(goal, ctx.today);
  const last = goal.ends_on && goal.ends_on < ctx.today ? goal.ends_on : ctx.today;
  const dir = goal.params.direction === 'down' ? 'down' : metric.direction;
  const value = metric.measure(ctx, goal.starts_on, last, goal.params, goal);
  if (!isMet(value, target, dir)) return { on: null, value };
  // Values only grow (or, going down, shrink) as the window widens, so binary-search the first day.
  const days = daysIn(goal.starts_on, last);
  let lo = 0;
  let hi = days.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (isMet(metric.measure(ctx, goal.starts_on, days[mid], goal.params, goal), target, dir)) hi = mid;
    else lo = mid + 1;
  }
  return { on: days[lo], value };
}

export function summariseGoal(goal: Goal, ctx: GoalContext): GoalSummary {
  const metric = metricOf(goal.metric);
  if (goal.cadence === 'one_off') {
    if (!metric) return { goal, metric, cycles: [], current: null, streak: 0, best: 0, met: 0, missed: 0, achievedOn: null, progress: null };
    let achievedOn: string | null = null;
    let progress: number | null;
    if (goal.metric === 'manual') {
      const c = ctx.checkins.filter((x) => x.goal_id === goal.id && !x.deleted_at).sort((a, b) => a.period_start.localeCompare(b.period_start))[0];
      achievedOn = c?.period_start ?? null;
      progress = c ? 1 : 0;
    } else {
      const r = firstReached(goal, metric, ctx);
      achievedOn = r.on;
      progress = r.value;
    }
    return { goal, metric, cycles: [], current: null, streak: 0, best: 0, met: achievedOn ? 1 : 0, missed: 0, achievedOn, progress };
  }
  const cycles = goalCycles(goal, ctx);
  let streak = 0;
  let run = 0;
  let best = 0;
  for (const c of cycles) {
    if (c.status === 'met') {
      run++;
      best = Math.max(best, run);
    } else if (c.status === 'missed') run = 0;
  }
  // Current streak: walk back from the latest, skipping neutral and in-progress cycles.
  for (let i = cycles.length - 1; i >= 0; i--) {
    const s = cycles[i].status;
    if (s === 'met') streak++;
    else if (s === 'missed') break;
  }
  const current = cycles.length && cycles[cycles.length - 1].end >= ctx.today ? cycles[cycles.length - 1] : null;
  return {
    goal,
    metric,
    cycles,
    current,
    streak,
    best,
    met: cycles.filter((c) => c.status === 'met').length,
    missed: cycles.filter((c) => c.status === 'missed').length,
    achievedOn: null,
    progress: null,
  };
}

/** A goal's form, checked before saving. */
export interface GoalInput {
  title: string;
  emoji: string | null;
  metric: string;
  params: Record<string, unknown>;
  cadence: Cadence;
  target: number;
  starts_on: string;
  ends_on: string | null;
}
export function validateGoal(g: GoalInput, ctx?: Pick<GoalContext, 'fitness'>): string | null {
  const metric = metricOf(g.metric);
  if (!g.title.trim()) return 'Give the goal a name.';
  if (g.title.trim().length > 80) return 'Keep the name under 80 characters.';
  if (!metric) return 'Pick what to measure.';
  if (!metric.cadences.includes(g.cadence)) return `“${metric.label}” works ${metric.cadences.map((c) => CADENCE_LABEL[c].toLowerCase()).join(' or ')}.`;
  if (!(g.target > 0) && metric.fixedTarget === undefined) return 'The target must be more than 0.';
  const max = g.cadence === 'daily' && metric.unit === 'days' ? 1 : g.cadence === 'weekly' && metric.unit === 'days' ? 7 : g.cadence === 'monthly' && metric.unit === 'days' ? 31 : Infinity;
  if (g.target > max) return `A ${CADENCE_LABEL[g.cadence].toLowerCase()} goal can count at most ${max} day${max === 1 ? '' : 's'}.`;
  if (g.metric === 'fitness.lift_reach' && ctx?.fitness && !ctx.fitness.settings.key_lifts.some((k) => k.label === g.params.lift)) return 'Pick a key lift.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.starts_on)) return 'Pick a start date.';
  if (g.ends_on && g.ends_on < g.starts_on) return 'The end date must be after the start.';
  return null;
}

/**
 * Ready-made goals from your reference plan; targets come from your
 * settings. They start at the phase start, so past weeks show at once
 * (progress is measured from logs you already have).
 */
export function suggestedGoals(f: FitnessData | null, today: string): GoalInput[] {
  const s = f?.settings;
  const base = { emoji: null, params: {}, starts_on: s?.phase_start && s.phase_start <= today ? s.phase_start : today, ends_on: null };
  return [
    { ...base, title: 'Train 6 days a week', emoji: '🏋️', metric: 'fitness.sessions', cadence: 'weekly', target: 6 },
    { ...base, title: 'Weigh in 3 times a week', emoji: '⚖️', metric: 'fitness.weigh_ins', cadence: 'weekly', target: 3 },
    { ...base, title: 'Incline cardio', emoji: '🚶', metric: 'fitness.cardio', cadence: 'weekly', target: s?.cardio_per_week ?? 3 },
    { ...base, title: `${(s?.steps_target ?? 10000).toLocaleString('en-IN')} steps`, emoji: '👟', metric: 'fitness.steps', cadence: 'daily', target: 1 },
    { ...base, title: 'Waist every fortnight', emoji: '📏', metric: 'fitness.waist', cadence: 'monthly', target: 2 },
    { ...base, title: 'Gain on track this month', emoji: '📈', metric: 'fitness.gain_on_track', cadence: 'monthly', target: 1 },
    { ...base, title: 'Log food 6 days a week', emoji: '🍛', metric: 'nutrition.days_logged', cadence: 'weekly', target: 6 },
    { ...base, title: 'Protein minimum 5 days a week', emoji: '🥚', metric: 'nutrition.protein_ok', cadence: 'weekly', target: 5 },
    { ...base, title: 'Monthly photos in natural light', emoji: '📸', metric: 'manual', cadence: 'monthly', target: 1 },
  ];
}
