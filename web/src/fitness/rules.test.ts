import { describe, expect, it } from 'vitest';
import {
  addDays,
  assessGain,
  compositionSignal,
  dailyWeights,
  dietSummary,
  gainRate,
  isoWeekday,
  liftSeries,
  trendsResumeOn,
  variantIndexFor,
  waistSummary,
  weekAdherence,
  weekStart,
  weeklyAverages,
  type AwayPeriod,
  type Session,
  type WeighIn,
} from './rules';

const settings = { gain_target_kg_month: 0.4, gain_high_kg_month: 0.6, gain_low_kg_month: 0.2 };
let n = 0;
const w = (day: string, kg: number, extra: Partial<WeighIn> = {}): WeighIn => ({
  id: `w${(n += 1)}`,
  day,
  weight_kg: kg,
  time_of_day: 'evening',
  deleted_at: null,
  ...extra,
});
/** Weigh-ins on Mon–Sat of each week from `monday`, ramping by `perWeek`. */
function weeksOf(monday: string, count: number, start: number, perWeek: number): WeighIn[] {
  const out: WeighIn[] = [];
  for (let wk = 0; wk < count; wk += 1) {
    for (let d = 0; d < 6; d += 1) out.push(w(addDays(monday, wk * 7 + d), start + wk * perWeek + (d % 2 ? 0.3 : -0.3)));
  }
  return out;
}
const away: AwayPeriod = { id: 'a', starts_on: '2026-11-04', ends_on: '2026-11-10', label: 'Trip' };

describe('dates', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(isoWeekday('2026-10-12')).toBe(1);
    expect(isoWeekday('2026-10-18')).toBe(7);
  });
});

describe('weekly weight averages', () => {
  it('averages one value per day, so several weigh-ins in a day do not weigh more', () => {
    const daily = dailyWeights([w('2026-10-12', 68), w('2026-10-12', 69), w('2026-10-13', 70)], []);
    expect(daily.get('2026-10-12')).toBe(68.5);
    const [week] = weeklyAverages([w('2026-10-12', 68), w('2026-10-12', 69), w('2026-10-13', 70)], [], '2026-10-18');
    expect(week.average).toBeCloseTo(69.25);
    expect(week.days).toBe(2);
    expect(week.sufficient).toBe(false); // fewer than 3 weighed days
  });

  it('ignores deleted entries and excludes away days from the average', () => {
    const entries = [w('2026-11-02', 70), w('2026-11-03', 70), w('2026-11-04', 75), w('2026-11-05', 75), w('2026-11-02', 99, { deleted_at: 'x' })];
    const [week] = weeklyAverages(entries, [away], '2026-11-08');
    expect(week.average).toBe(70);
    expect(week.days).toBe(2);
    expect(week.awayDays).toBe(5); // Wed–Sun inside the trip
  });

  it('includes empty weeks so gaps are visible, never filled in', () => {
    const weeks = weeklyAverages([w('2026-10-05', 68), w('2026-10-19', 69)], [], '2026-10-19');
    expect(weeks.map((x) => [x.weekStart, x.average])).toEqual([
      ['2026-10-05', 68],
      ['2026-10-12', null],
      ['2026-10-19', 69],
    ]);
  });
});

describe('gain rate and verdict', () => {
  it('needs two complete, sufficient weeks', () => {
    const weeks = weeklyAverages(weeksOf('2026-10-05', 1, 68, 0.1), [], '2026-10-20');
    expect(gainRate(weeks, [], '2026-10-20')).toBeNull();
    expect(assessGain(null, settings).kind).toBe('insufficient');
  });

  it('ignores the current, still-incomplete week', () => {
    const entries = weeksOf('2026-10-05', 3, 68, 0.1);
    const rate = gainRate(weeklyAverages(entries, [], '2026-10-21'), [], '2026-10-21');
    expect(rate?.to.weekStart).toBe('2026-10-12'); // week of 19 Oct not finished yet
  });

  it('~0.4 kg/month reads as on track', () => {
    const entries = weeksOf('2026-09-07', 6, 68, 0.4 / (30.4375 / 7));
    const rate = gainRate(weeklyAverages(entries, [], '2026-10-19'), [], '2026-10-19');
    expect(rate?.kgPerMonth).toBeCloseTo(0.4, 2);
    expect(rate?.spanWeeks).toBe(4);
    expect(assessGain(rate, settings).kind).toBe('on_track');
  });

  it('above 0.6 suggests about 100 kcal less, fat first', () => {
    const entries = weeksOf('2026-09-07', 6, 68, 0.2);
    const verdict = assessGain(gainRate(weeklyAverages(entries, [], '2026-10-19'), [], '2026-10-19'), settings);
    expect(verdict.kind).toBe('fast');
    expect(verdict.message).toMatch(/100 kcal.*fat/);
  });

  it('below 0.2 only suggests more food after a full month of data', () => {
    const early = weeksOf('2026-09-28', 3, 68, 0);
    expect(assessGain(gainRate(weeklyAverages(early, [], '2026-10-19'), [], '2026-10-19'), settings).kind).toBe('slow_early');
    const month = weeksOf('2026-09-07', 6, 68, 0);
    const verdict = assessGain(gainRate(weeklyAverages(month, [], '2026-10-19'), [], '2026-10-19'), settings);
    expect(verdict.kind).toBe('slow');
    expect(verdict.message).toMatch(/100 kcal.*carbohydrates/);
  });

  it('labels a comparison that spans an away period', () => {
    const entries = weeksOf('2026-10-19', 5, 68, 0.1);
    const rate = gainRate(weeklyAverages(entries, [away], '2026-11-30'), [away], '2026-11-30');
    expect(rate?.spansAway).toBe(true);
  });
});

describe('away mode', () => {
  it('trends resume from the first full week after the trip', () => {
    expect(trendsResumeOn(away)).toBe('2026-11-16'); // trip ended Tue 10 Nov
    expect(trendsResumeOn({ ...away, ends_on: '2026-11-15' })).toBe('2026-11-16'); // ended on a Sunday
  });
});

describe('waist', () => {
  const entries = [
    { id: '1', day: '2026-10-01', waist_cm: 82, deleted_at: null },
    { id: '2', day: '2026-10-15', waist_cm: 82.2, deleted_at: null },
    { id: '3', day: '2026-11-05', waist_cm: 85, deleted_at: null }, // during trip
  ];

  it('first entry is the baseline; next check is 14 days after the latest', () => {
    const s = waistSummary(entries.slice(0, 2), [], 14, '2026-10-20');
    expect(s.baseline?.day).toBe('2026-10-01');
    expect(s.changeFromBaseline).toBeCloseTo(0.2);
    expect(s.nextDue).toBe('2026-10-29');
    expect(s.overdue).toBe(false);
    expect(waistSummary(entries.slice(0, 2), [], 14, '2026-10-30').overdue).toBe(true);
  });

  it('away measurements stay visible but out of the trend', () => {
    const s = waistSummary(entries, [away], 14, '2026-11-06');
    expect(s.latest?.day).toBe('2026-11-05');
    expect(s.trend.map((x) => x.id)).toEqual(['1', '2']);
  });

  it('stable waist with rising weight is favourable; rising waist is flagged', () => {
    const rising = { kgPerMonth: 0.4 } as never;
    const stable = [entries[0], { ...entries[1], day: '2026-10-29', waist_cm: 82.3 }];
    expect(compositionSignal(stable, rising).signal).toBe('favourable');
    const grew = [entries[0], { ...entries[1], day: '2026-10-29', waist_cm: 83.5 }];
    expect(compositionSignal(grew, rising).signal).toBe('review');
    expect(compositionSignal([entries[0]], rising).signal).toBe('insufficient');
  });
});

describe('program rotation', () => {
  it('rotates the whole program weekly V1 → V7 and wraps', () => {
    const start = '2026-10-12';
    expect(variantIndexFor('2026-10-12', start, 0)).toBe(0); // V1
    expect(variantIndexFor('2026-10-18', start, 0)).toBe(0); // same week
    expect(variantIndexFor('2026-10-19', start, 0)).toBe(1); // V2
    expect(variantIndexFor(addDays(start, 6 * 7), start, 0)).toBe(6); // V7
    expect(variantIndexFor(addDays(start, 7 * 7), start, 0)).toBe(0); // back to V1
  });

  it('manual advance shifts the week, and works before the start date', () => {
    expect(variantIndexFor('2026-10-12', '2026-10-12', 1)).toBe(1);
    expect(variantIndexFor('2026-10-05', '2026-10-12', 0)).toBe(6);
  });
});

describe('training adherence', () => {
  const sessions: Session[] = [
    { id: 's1', day: '2026-11-02', variant_index: 0, completed: true, slots_completed: 5 },
    { id: 's2', day: '2026-11-03', variant_index: 0, completed: true, slots_completed: 5 },
    { id: 's3', day: '2026-11-04', variant_index: 0, completed: true, slots_completed: 3 }, // away day
    { id: 's4', day: '2026-11-08', variant_index: 0, completed: true, slots_completed: 1 }, // Sunday rest
  ];

  it('counts out of 6 planned sessions, minus away days', () => {
    expect(weekAdherence('2026-10-26', sessions, [])).toEqual({ weekStart: '2026-10-26', eligible: 6, completed: 0, awayDays: 0 });
    expect(weekAdherence('2026-11-02', sessions, [away])).toEqual({ weekStart: '2026-11-02', eligible: 2, completed: 2, awayDays: 4 });
  });
});

describe('diet tags', () => {
  it('keeps event days apart from adherence', () => {
    const days = [
      { day: '2026-10-12', tag: 'on_plan' as const, kcal_estimate: null },
      { day: '2026-10-13', tag: 'on_plan' as const, kcal_estimate: null },
      { day: '2026-10-14', tag: 'partial' as const, kcal_estimate: 2900 },
      { day: '2026-10-15', tag: 'event' as const, kcal_estimate: 3500 },
    ];
    const s = dietSummary(days, '2026-10-12', '2026-10-18');
    expect(s).toMatchObject({ onPlan: 2, partial: 1, event: 1 });
    expect(s.adherence).toBeCloseTo(2 / 3);
    expect(dietSummary([], '2026-10-12', '2026-10-18').adherence).toBeNull();
  });
});

describe('key lifts', () => {
  it('tracks the heaviest set per day, per exact exercise', () => {
    const sessions = [
      { id: 'a', day: '2026-10-12', variant_index: 0, completed: true, slots_completed: 5 },
      { id: 'b', day: '2026-10-19', variant_index: 1, completed: true, slots_completed: 5 },
    ];
    const sets = [
      { session_id: 'a', exercise: 'Bench press', set_number: 1, reps: 8, weight_kg: 50 },
      { session_id: 'a', exercise: 'bench press ', set_number: 2, reps: 6, weight_kg: 55 },
      { session_id: 'b', exercise: 'Chest press', set_number: 1, reps: 10, weight_kg: 60 },
      { session_id: 'b', exercise: 'Incline press', set_number: 1, reps: 10, weight_kg: 40 },
    ];
    const series = liftSeries({ label: 'Bench / chest', exercises: ['Bench press', 'Chest press'] }, sets, sessions);
    expect(series.get('Bench press')).toEqual([{ day: '2026-10-12', weight: 55, reps: 6 }]);
    expect(series.get('Chest press')).toEqual([{ day: '2026-10-19', weight: 60, reps: 10 }]);
    expect(series.has('Incline press')).toBe(false); // not in the group
  });
});
