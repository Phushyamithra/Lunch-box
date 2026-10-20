/**
 * What goals need from you now, and a one-line status. Pure.
 */
import { addDays } from '../fitness/rules';
import type { GoalSummary } from './engine';
import type { TimelineItem } from './timeline';

export interface GoalDue {
  key: string;
  emoji: string;
  title: string;
  detail: string;
  kind: 'checkin' | 'behind' | 'checkpoint';
  /** Check-ins: tap to tick. */
  goalId?: string;
  periodStart?: string;
  /** Checkpoints: tap to mark done. */
  milestoneId?: string;
}

const daysLeft = (end: string, today: string) => {
  let n = 0;
  for (let d = today; d <= end; d = addDays(d, 1)) n++;
  return n;
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * - Check-ins you haven't ticked, near the end of their cycle (daily: today;
 *   weekly: last 2 days; monthly: last 7).
 * - Counted goals that can no longer be met this cycle at one a day (said
 *   plainly, once, so the week doesn't end with a surprise).
 * - Checkpoints dated today or in the last 14 days and not marked done.
 */
export function goalsDue(summaries: GoalSummary[], timeline: TimelineItem[], today: string): GoalDue[] {
  const out: GoalDue[] = [];
  for (const s of summaries) {
    const { goal, current, metric } = s;
    if (goal.archived_at || !current || !metric || current.status !== 'in_progress') continue;
    const left = daysLeft(current.end, today);
    const emoji = goal.emoji ?? '🎯';
    if (goal.metric === 'manual') {
      const window = goal.cadence === 'daily' ? 1 : goal.cadence === 'weekly' ? 2 : 7;
      if (left <= window) {
        out.push({
          key: `c-${goal.id}`,
          emoji,
          title: goal.title,
          detail: goal.cadence === 'daily' ? 'Tick it when done today.' : `Not ticked yet · ${plural(left, 'day')} left this ${goal.cadence === 'weekly' ? 'week' : 'month'}.`,
          kind: 'checkin',
          goalId: goal.id,
          periodStart: current.start,
        });
      }
      continue;
    }
    if (metric.fixedTarget !== undefined || goal.cadence === 'daily' || current.value === null) continue;
    const needed = Math.ceil(current.target - current.value);
    // Day-based counts can rise by at most one a day.
    if (needed > 0 && needed > left && ['days', 'sessions'].includes(metric.unit)) {
      out.push({
        key: `b-${goal.id}`,
        emoji,
        title: goal.title,
        detail: `${current.value} / ${current.target} ${metric.unit}; ${plural(left, 'day')} left can’t close the gap this ${goal.cadence === 'weekly' ? 'week' : 'month'}. No drama: it’s one cycle.`,
        kind: 'behind',
      });
    }
  }
  for (const i of timeline) {
    if (i.kind !== 'checkpoint' || !i.milestone || i.milestone.done_on) continue;
    if (i.date > today || i.date < addDays(today, -14)) continue;
    out.push({
      key: `m-${i.milestone.id}`,
      emoji: i.emoji,
      title: i.title,
      detail: i.date === today ? 'Planned for today.' : 'Its date has passed; mark it done if it happened.',
      kind: 'checkpoint',
      milestoneId: i.milestone.id,
    });
  }
  return out;
}

/** Home card: how many recurring goals are met so far this cycle, the best live streak and what's next. */
export function goalsHeadline(summaries: GoalSummary[], timeline: TimelineItem[], today: string): { chip: string; text: string } | null {
  const live = summaries.filter((s) => !s.goal.archived_at && s.metric);
  if (!live.length) return null;
  const recurring = live.filter((s) => s.goal.cadence !== 'one_off' && s.current);
  const metNow = recurring.filter((s) => s.current?.status === 'met').length;
  const best = [...live].sort((a, b) => b.streak - a.streak)[0];
  const next = timeline.find((i) => i.date >= today && i.status !== 'done' && i.status !== 'info');
  const parts = [
    recurring.length ? `${metNow}/${recurring.length} met this cycle` : null,
    best && best.streak > 1 ? `🔥 ${best.streak} ${best.goal.title}` : null,
    next ? `next: ${next.title}` : null,
  ].filter(Boolean);
  const reached = live.filter((s) => s.goal.cadence === 'one_off' && s.achievedOn).length;
  return { chip: reached ? `🏅 ${reached} reached` : `${live.length} goal${live.length === 1 ? '' : 's'}`, text: parts.join(' · ') };
}
