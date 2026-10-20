import { describe, expect, it } from 'vitest';
import type { FitnessData } from '../fitness/fitnessApi';
import type { Cycle, GoalSummary } from './engine';
import { buildTimeline, phaseCheckpoints, splitTimeline, validateMilestone, type Milestone } from './timeline';

const weigh = (day: string, kg: number) => ({ id: day, day, measured_at: `${day}T13:00:00Z`, time_of_day: 'evening' as const, weight_kg: kg, notes: null, deleted_at: null });
const fitness = {
  settings: {
    phase_start: '2026-09-17',
    phase_months: 9,
    weigh_time: 'evening',
    gain_target_kg_month: 0.4,
    gain_high_kg_month: 0.6,
    gain_low_kg_month: 0.2,
    waist_interval_days: 14,
    reminders: { weigh_days: [1, 3, 5], weigh_time: '18:30', waist_time: '18:30', review_day: 17 },
  },
  weighIns: [weigh('2026-09-18', 66.5), weigh('2026-09-21', 66.6)],
  waists: [{ id: 'w', day: '2026-10-05', waist_cm: 78, notes: null, deleted_at: null }],
  away: [],
} as unknown as FitnessData;

const ms = (over: Partial<Milestone>): Milestone => ({
  id: 'm',
  title: 'x',
  emoji: null,
  notes: null,
  due_on: null,
  approx: false,
  done_on: null,
  kind: 'checkpoint',
  source: 'user',
  archived_at: null,
  created_at: '',
  ...over,
});
const cycles = (statuses: Cycle['status'][], from = '2026-09-14'): Cycle[] =>
  statuses.map((status, i) => {
    const start = new Date(Date.parse(`${from}T00:00:00Z`) + i * 7 * 86400000).toISOString().slice(0, 10);
    return { start, end: new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10), value: 1, target: 1, status };
  });
const summary = (over: Partial<GoalSummary>): GoalSummary =>
  ({ goal: { id: 'g', title: 'Train 6 days', emoji: '🏋️', cadence: 'weekly', archived_at: null }, cycles: [], best: 0, achievedOn: null, ...over }) as unknown as GoalSummary;

const base = { today: '2026-10-20', fitness, milestones: [], goals: [], plans: [], legacyAchievements: null };

describe('phase checkpoints', () => {
  it('follow the reference plan, with the baseline marked done once weighed', () => {
    const c = phaseCheckpoints(fitness);
    expect(c.map((x) => [x.title, x.due_on, x.approx])).toEqual([
      ['True baseline', '2026-09-17', false],
      ['First real check', '2026-10-17', false],
      ['End of the bulk; start the mini-cut', '2027-06-17', true],
      ['End of the mini-cut', '2027-08-12', true],
      ['End state', '2027-08-26', true],
    ]);
    expect(c[0].done_on).toBe('2026-09-18');
    for (const x of c) expect(validateMilestone(x)).toBeNull();
  });
});

describe('timeline', () => {
  it('stored milestones: done, overdue (past), due soon, upcoming; archived hidden', () => {
    const t = buildTimeline({
      ...base,
      fitness: null,
      milestones: [
        ms({ id: 'a', title: 'Baseline', due_on: '2026-09-17', done_on: '2026-09-18' }),
        ms({ id: 'b', title: 'First check', due_on: '2026-10-17' }),
        ms({ id: 'c', title: 'Deload', due_on: '2026-10-25' }),
        ms({ id: 'd', title: 'End of bulk', due_on: '2027-06-17', approx: true }),
        ms({ id: 'e', title: 'Old', due_on: '2026-10-01', archived_at: '2026-10-02' }),
        ms({ id: 'f', title: 'First pull-up', kind: 'achievement', done_on: '2026-10-10' }),
      ],
    });
    expect(t.map((i) => [i.title, i.status, i.approx])).toEqual([
      ['Baseline', 'done', false],
      ['First pull-up', 'done', false],
      ['First check', 'past', false],
      ['Deload', 'due', false],
      ['End of bulk', 'upcoming', true],
    ]);
  });

  it('monthly reviews carry the reading; only the next one is shown ahead', () => {
    const t = buildTimeline(base).filter((i) => i.kind === 'review');
    expect(t.map((i) => [i.date, i.status])).toEqual([
      ['2026-10-17', 'info'],
      ['2026-11-17', 'upcoming'],
    ]);
    expect(t[0].detail).toMatch(/Not enough weigh-ins/);
  });

  it('next waist check from the interval', () => {
    const w = buildTimeline(base).find((i) => i.kind === 'waist');
    expect(w).toMatchObject({ date: '2026-10-20', title: 'Waist check overdue', status: 'due' });
  });

  it('streak marks fire once per threshold; misses reset the run', () => {
    const g = summary({ cycles: cycles(['met', 'met', 'met', 'met', 'missed', 'met', 'met', 'met', 'met', 'met']) });
    const t = buildTimeline({ ...base, fitness: null, goals: [g] });
    expect(t.map((i) => [i.title, i.date])).toEqual([['4 weeks in a row: Train 6 days', '2026-10-11']]);
  });

  it('goals reached, meal plans and extension achievements are carried in', () => {
    const t = buildTimeline({
      ...base,
      fitness: null,
      goals: [summary({ goal: { id: 'l', title: 'Bench 70 kg', emoji: null, cadence: 'one_off', archived_at: null } as never, achievedOn: '2026-10-13' })],
      plans: [
        { id: 'p', name: 'October salads', completed_at: '2026-10-02T10:00:00Z', completion: 'quota_met' },
        { id: 'q', name: 'Open', completed_at: null, completion: null },
      ],
      legacyAchievements: { days_goal: '2026-08-01T00:00:00Z', category_salad: '2026-08-10T00:00:00Z', bad: 'not a date' },
    });
    expect(t.map((i) => [i.date, i.title])).toEqual([
      ['2026-08-01', 'Days goal reached (meal prep)'],
      ['2026-08-10', 'salad goal complete'],
      ['2026-10-02', 'Meal plan complete: October salads'],
      ['2026-10-13', 'Reached: Bench 70 kg'],
    ]);
  });

  it('splits into coming up (soonest first) and history (latest first)', () => {
    const t = buildTimeline({
      ...base,
      fitness: null,
      milestones: [
        ms({ id: 'a', title: 'A', due_on: '2026-09-01', done_on: '2026-09-01' }),
        ms({ id: 'b', title: 'B', due_on: '2026-12-01' }),
        ms({ id: 'c', title: 'C', due_on: '2026-11-01' }),
        ms({ id: 'd', title: 'D', due_on: '2026-10-01' }),
      ],
    });
    const { ahead, behind } = splitTimeline(t, '2026-10-20');
    expect(ahead.map((i) => i.title)).toEqual(['C', 'B']);
    expect(behind.map((i) => i.title)).toEqual(['D', 'A']);
  });

  it('validates milestones', () => {
    const m = { emoji: null, notes: null, approx: false, done_on: null, kind: 'checkpoint' as const, source: 'user' };
    expect(validateMilestone({ ...m, title: ' ', due_on: '2026-10-01' })).toMatch(/name/);
    expect(validateMilestone({ ...m, title: 'x', due_on: null })).toMatch(/date/);
  });
});
