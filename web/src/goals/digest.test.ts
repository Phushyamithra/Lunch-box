import { describe, expect, it } from 'vitest';
import { metricOf, type Cycle, type GoalSummary } from './engine';
import { goalsDue, goalsHeadline } from './digest';
import type { TimelineItem } from './timeline';

const s = (id: string, metric: string, cadence: 'daily' | 'weekly' | 'monthly' | 'one_off', current: Partial<Cycle> | null, over: Partial<GoalSummary> = {}): GoalSummary =>
  ({
    goal: { id, title: id, emoji: null, metric, cadence, archived_at: null },
    metric: metricOf(metric),
    current: current ? { start: '2026-10-19', end: '2026-10-25', value: 0, target: 1, status: 'in_progress', ...current } : null,
    cycles: [],
    streak: 0,
    best: 0,
    met: 0,
    missed: 0,
    achievedOn: null,
    progress: null,
    ...over,
  }) as GoalSummary;
const item = (over: Partial<TimelineItem>): TimelineItem => ({ key: 'k', date: '2026-10-20', approx: false, title: 't', emoji: '📍', detail: null, kind: 'checkpoint', status: 'due', ...over });

describe('goals due', () => {
  it('asks for weekly check-ins only near the end of the week', () => {
    const g = s('Photos', 'manual', 'weekly', {});
    expect(goalsDue([g], [], '2026-10-20')).toEqual([]);
    expect(goalsDue([g], [], '2026-10-24')[0]).toMatchObject({ kind: 'checkin', goalId: 'Photos', periodStart: '2026-10-19', detail: expect.stringContaining('2 days left') });
  });

  it('flags a count that can no longer be met, and only then', () => {
    const g = s('Train', 'fitness.sessions', 'weekly', { value: 2, target: 6 });
    expect(goalsDue([g], [], '2026-10-21')).toEqual([]); // 5 days left for 4
    expect(goalsDue([g], [], '2026-10-23')[0]).toMatchObject({ kind: 'behind', detail: expect.stringContaining('2 / 6 sessions') });
    const met = s('Train', 'fitness.sessions', 'weekly', { value: 6, target: 6, status: 'met' });
    expect(goalsDue([met], [], '2026-10-25')).toEqual([]);
  });

  it('lists checkpoints due or recently passed and not done', () => {
    const m = { id: 'x', done_on: null } as never;
    const due = goalsDue([], [item({ milestone: m }), item({ key: 'old', date: '2026-09-01', milestone: { id: 'y', done_on: null } as never }), item({ key: 'later', date: '2026-11-01', milestone: { id: 'z', done_on: null } as never })], '2026-10-20');
    expect(due.map((d) => d.milestoneId)).toEqual(['x']);
  });
});

describe('headline', () => {
  it('counts goals met this cycle, the best streak and what is next', () => {
    const h = goalsHeadline(
      [
        s('Train', 'fitness.sessions', 'weekly', { status: 'met' }, { streak: 4 }),
        s('Weigh', 'fitness.weigh_ins', 'weekly', {}),
        s('Bench', 'fitness.lift_reach', 'one_off', null, { achievedOn: '2026-10-13' }),
      ],
      [item({ date: '2026-11-17', title: 'Monthly review', status: 'upcoming' })],
      '2026-10-20',
    );
    expect(h).toEqual({ chip: '🏅 1 reached', text: '1/2 met this cycle · 🔥 4 Train · next: Monthly review' });
    expect(goalsHeadline([], [], '2026-10-20')).toBeNull();
  });
});
