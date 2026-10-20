/**
 * Goals timeline. Pure.
 *
 * One dated list from every source: your milestones (stored), the phase
 * plan's monthly reviews and next waist check (derived), goals reached and
 * streak milestones (derived from goal cycles), meal-plan completions and
 * the Chrome extension's achievements (carried over as recorded).
 */
import dayjs from 'dayjs';
import type { FitnessData } from '../fitness/fitnessApi';
import { addDays, assessGain, baselineWeight, gainRate, waistSummary, weeklyAverages } from '../fitness/rules';
import type { GoalSummary } from './engine';

export interface Milestone {
  id: string;
  title: string;
  emoji: string | null;
  notes: string | null;
  due_on: string | null;
  approx: boolean;
  done_on: string | null;
  kind: 'checkpoint' | 'achievement';
  source: string;
  archived_at: string | null;
  created_at: string;
}
export type MilestoneInput = Omit<Milestone, 'id' | 'archived_at' | 'created_at'>;

export type ItemKind = 'checkpoint' | 'review' | 'waist' | 'goal' | 'streak' | 'plan' | 'legacy' | 'achievement';
/** 'past' = a checkpoint whose date went by without being marked done; 'info' = a dated reading. */
export type ItemStatus = 'done' | 'due' | 'upcoming' | 'past' | 'info';

export interface TimelineItem {
  key: string;
  date: string;
  /** Shown as "~Jul 2027". */
  approx: boolean;
  title: string;
  emoji: string;
  detail: string | null;
  kind: ItemKind;
  status: ItemStatus;
  /** Set for stored milestones (editable). */
  milestone?: Milestone;
}

const fmtDate = (d: string) => dayjs(d).format('D MMM YYYY');
const isoDay = (ts: string) => dayjs(ts).format('YYYY-MM-DD');

/**
 * Checkpoints from the phase plan, as in the reference file: baseline,
 * first real check a month in, end of bulk, a 6–8 week mini-cut and the
 * end state. You add them once and can edit or archive any of them.
 */
export function phaseCheckpoints(f: FitnessData): MilestoneInput[] {
  const s = f.settings;
  const start = s.phase_start;
  const end = dayjs(start).add(s.phase_months, 'month').format('YYYY-MM-DD');
  const baseline = baselineWeight(f.weighIns, start, s.weigh_time);
  const base = { notes: null, approx: false, done_on: null, kind: 'checkpoint' as const, source: 'phase' };
  return [
    {
      ...base,
      title: 'True baseline',
      emoji: '⭐',
      due_on: start,
      done_on: baseline ? baseline.day : null,
      notes: 'Weight after a full normal week. Everything measures against this.',
    },
    {
      ...base,
      title: 'First real check',
      emoji: '🔎',
      due_on: dayjs(start).add(1, 'month').format('YYYY-MM-DD'),
      notes: `Expect about +${s.gain_target_kg_month} kg, waist unchanged, weights up.`,
    },
    { ...base, title: 'End of the bulk; start the mini-cut', emoji: '🏁', due_on: end, approx: true, notes: '6–8 weeks at about 2,000 kcal, dropping 2–2.5 kg (almost all added fat).' },
    { ...base, title: 'End of the mini-cut', emoji: '✂️', due_on: dayjs(end).add(8, 'week').format('YYYY-MM-DD'), approx: true, notes: null },
    { ...base, title: 'End state', emoji: '🏆', due_on: dayjs(end).add(10, 'week').format('YYYY-MM-DD'), approx: true, notes: 'More muscular and more defined than at the start.' },
  ];
}

/** Streak milestones worth marking, per cadence. */
const STREAK_MARKS = { daily: [7, 30, 100, 365], weekly: [4, 8, 12, 26, 52], monthly: [3, 6, 12] } as const;

const LEGACY_LABEL = (id: string): string => {
  if (id === 'days_goal') return 'Days goal reached (meal prep)';
  if (id === 'balance') return 'Balanced: every category goal complete';
  if (id === 'nutrition_champion') return 'Nutrition champion';
  if (id.startsWith('category_')) return `${id.slice('category_'.length).replace(/_/g, ' ')} goal complete`;
  return id.replace(/_/g, ' ');
};

export interface TimelineInput {
  today: string;
  fitness: FitnessData | null;
  milestones: Milestone[];
  goals: GoalSummary[];
  plans: { id: string; name: string; completed_at: string | null; completion: string | null }[];
  legacyAchievements: Record<string, string> | null;
}

export function buildTimeline(input: TimelineInput): TimelineItem[] {
  const { today, fitness: f } = input;
  const items: TimelineItem[] = [];
  const statusFor = (date: string, done: boolean): ItemStatus => (done ? 'done' : date < today ? 'past' : date <= addDays(today, 7) ? 'due' : 'upcoming');

  for (const m of input.milestones) {
    if (m.archived_at) continue;
    const date = m.done_on ?? (m.due_on as string);
    items.push({
      key: `m-${m.id}`,
      date,
      approx: !m.done_on && m.approx,
      title: m.title,
      emoji: m.emoji ?? (m.kind === 'achievement' ? '🏅' : '📍'),
      detail: m.notes,
      kind: m.kind === 'achievement' ? 'achievement' : 'checkpoint',
      status: m.kind === 'achievement' ? 'done' : statusFor(date, !!m.done_on),
      milestone: m,
    });
  }

  if (f) {
    const s = f.settings;
    // Monthly reviews: past ones carry the reading at that point; the next one is upcoming.
    const reviewDay = Math.min(Math.max(1, s.reminders.review_day || 1), 28);
    const phaseEnd = dayjs(s.phase_start).add(s.phase_months, 'month').format('YYYY-MM-DD');
    let first = dayjs(s.phase_start).date(reviewDay);
    if (first.format('YYYY-MM-DD') <= s.phase_start) first = first.add(1, 'month');
    let upcoming = 0;
    for (let d = first; d.format('YYYY-MM-DD') <= phaseEnd && upcoming < 1; d = d.add(1, 'month')) {
      const date = d.format('YYYY-MM-DD');
      if (date > today) {
        upcoming++;
        items.push({ key: `review-${date}`, date, approx: false, title: 'Monthly review', emoji: '🗓️', detail: 'Rate, waist, strength, photos. The only time to change anything.', kind: 'review', status: statusFor(date, false) });
        continue;
      }
      const weeks = weeklyAverages(f.weighIns, f.away, date, s.weigh_time);
      const verdict = assessGain(gainRate(weeks, f.away, date), s);
      items.push({
        key: `review-${date}`,
        date,
        approx: false,
        title: 'Monthly review',
        emoji: '🗓️',
        detail: verdict.kind === 'insufficient' ? 'Not enough weigh-ins for a rate yet.' : `${verdict.rate.kgPerMonth >= 0 ? '+' : ''}${verdict.rate.kgPerMonth.toFixed(2)} kg/month. ${verdict.message}`,
        kind: 'review',
        status: 'info',
      });
    }
    const waist = waistSummary(f.waists, f.away, s.waist_interval_days, today);
    if (waist.nextDue) {
      items.push({
        key: 'waist-next',
        date: waist.nextDue < today ? today : waist.nextDue,
        approx: false,
        title: waist.overdue ? 'Waist check overdue' : 'Next waist check',
        emoji: '📏',
        detail: waist.latest ? `Last: ${Number(waist.latest.waist_cm).toFixed(1)} cm on ${fmtDate(waist.latest.day)}.` : null,
        kind: 'waist',
        status: waist.overdue ? 'due' : statusFor(waist.nextDue, false),
      });
    }
  }

  for (const g of input.goals) {
    if (g.goal.archived_at && !g.achievedOn && !g.best) continue;
    const emoji = g.goal.emoji ?? '🎯';
    if (g.achievedOn) {
      items.push({ key: `goal-${g.goal.id}`, date: g.achievedOn, approx: false, title: `Reached: ${g.goal.title}`, emoji, detail: null, kind: 'goal', status: 'done' });
    }
    if (g.goal.cadence === 'one_off') continue;
    const marks = STREAK_MARKS[g.goal.cadence];
    let run = 0;
    const hit = new Set<number>();
    for (const c of g.cycles) {
      if (c.status === 'met') {
        run++;
        const mark = (marks as readonly number[]).includes(run) ? run : null;
        if (mark && !hit.has(mark)) {
          hit.add(mark);
          const unit = g.goal.cadence === 'daily' ? 'days' : g.goal.cadence === 'weekly' ? 'weeks' : 'months';
          items.push({ key: `streak-${g.goal.id}-${mark}`, date: c.end > today ? today : c.end, approx: false, title: `${mark} ${unit} in a row: ${g.goal.title}`, emoji: '🔥', detail: null, kind: 'streak', status: 'done' });
        }
      } else if (c.status === 'missed') run = 0;
    }
  }

  for (const p of input.plans) {
    if (!p.completed_at) continue;
    items.push({
      key: `plan-${p.id}`,
      date: isoDay(p.completed_at),
      approx: false,
      title: `Meal plan complete: ${p.name}`,
      emoji: '🚚',
      detail: p.completion === 'forced' ? 'Closed by hand.' : 'Every quota used.',
      kind: 'plan',
      status: 'done',
    });
  }

  for (const [id, at] of Object.entries(input.legacyAchievements ?? {})) {
    if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) continue;
    items.push({ key: `legacy-${id}`, date: isoDay(at), approx: false, title: LEGACY_LABEL(id), emoji: '🏅', detail: 'From the Chrome extension.', kind: 'legacy', status: 'done' });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

/** Coming up (soonest first) and history (latest first). */
export function splitTimeline(items: TimelineItem[], today: string): { ahead: TimelineItem[]; behind: TimelineItem[] } {
  const ahead = items.filter((i) => i.status === 'due' || i.status === 'upcoming' || (i.date >= today && i.status !== 'done'));
  const behind = items.filter((i) => !ahead.includes(i)).reverse();
  return { ahead, behind };
}

export function validateMilestone(m: MilestoneInput): string | null {
  if (!m.title.trim()) return 'Give it a name.';
  if (m.title.trim().length > 120) return 'Keep the name under 120 characters.';
  if (!m.due_on && !m.done_on) return 'Pick a date.';
  if (m.notes && m.notes.length > 1000) return 'Keep notes under 1,000 characters.';
  return null;
}
