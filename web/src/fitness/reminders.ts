/**
 * Reminders: what is due today (weigh-in, waist, monthly review) and a
 * calendar file (.ics) with repeating alarms, so the phone's own calendar
 * does the nudging without push notifications. Pure.
 */
import dayjs from 'dayjs';
import { addDays, isoWeekday, weekStart, type WeighIn } from './rules';

export interface ReminderSettings {
  /** Weekdays to weigh in (Mon = 1). */
  weigh_days: number[];
  /** "HH:MM", local time. */
  weigh_time: string;
  waist_time: string;
  /** Day of the month for the monthly review (1–28). */
  review_day: number;
}

export const DEFAULT_REMINDERS: ReminderSettings = { weigh_days: [1, 3, 5], weigh_time: '18:30', waist_time: '18:30', review_day: 17 };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normaliseReminders(raw: unknown): ReminderSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReminderSettings>;
  const days = Array.isArray(r.weigh_days) ? [...new Set(r.weigh_days.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : null;
  const review = Number(r.review_day);
  return {
    weigh_days: days ?? DEFAULT_REMINDERS.weigh_days,
    weigh_time: typeof r.weigh_time === 'string' && TIME.test(r.weigh_time) ? r.weigh_time : DEFAULT_REMINDERS.weigh_time,
    waist_time: typeof r.waist_time === 'string' && TIME.test(r.waist_time) ? r.waist_time : DEFAULT_REMINDERS.waist_time,
    review_day: Number.isInteger(review) && review >= 1 && review <= 28 ? review : DEFAULT_REMINDERS.review_day,
  };
}

export function validateReminders(r: ReminderSettings): string | null {
  if (r.weigh_days.length === 0) return 'Pick at least one weigh-in day.';
  if (!TIME.test(r.weigh_time) || !TIME.test(r.waist_time)) return 'Times must be HH:MM.';
  if (!Number.isInteger(r.review_day) || r.review_day < 1 || r.review_day > 28) return 'Review day must be 1–28 (so it exists every month).';
  return null;
}

export interface DueItem {
  key: 'weigh' | 'waist' | 'review';
  emoji: string;
  title: string;
  detail: string;
  /** Overdue items first. */
  overdue: boolean;
}

/**
 * What to do today. `weighIns` are live, non-away entries; `waistNextDue`
 * comes from waistSummary (null before the first measurement).
 */
export function dueToday(input: {
  today: string;
  reminders: ReminderSettings;
  weighIns: Pick<WeighIn, 'day' | 'time_of_day'>[];
  trendTime: string;
  minPerWeek: number;
  waistNextDue: string | null;
  hasWaist: boolean;
  away: boolean;
}): DueItem[] {
  const { today, reminders, weighIns, trendTime, minPerWeek, waistNextDue, hasWaist, away } = input;
  if (away) return [];
  const items: DueItem[] = [];
  const start = weekStart(today);
  const thisWeek = new Set(weighIns.filter((w) => w.day >= start && w.day <= today && (trendTime === 'any' || w.time_of_day === trendTime)).map((w) => w.day));
  const weighedToday = weighIns.some((w) => w.day === today);
  // Weigh days left after today; if they can't make up the week, nudge today too.
  const daysLeft = reminders.weigh_days.filter((d) => d > isoWeekday(today)).length;
  const isWeighDay = reminders.weigh_days.includes(isoWeekday(today));
  const short = minPerWeek - thisWeek.size;
  if (!weighedToday && (isWeighDay || (short > 0 && short > daysLeft))) {
    items.push({
      key: 'weigh',
      emoji: '⚖️',
      title: 'Weigh in',
      detail: `${thisWeek.size}/${minPerWeek} this week${trendTime === 'evening' ? ' · gym scale, before training' : trendTime === 'morning' ? ' · after the loo, before food' : ''}`,
      overdue: short > daysLeft + (isWeighDay ? 1 : 0),
    });
  }
  if (!hasWaist) {
    items.push({ key: 'waist', emoji: '📏', title: 'Measure your waist', detail: 'First measurement sets the baseline', overdue: false });
  } else if (waistNextDue && waistNextDue <= today) {
    const late = dayjs(today).diff(dayjs(waistNextDue), 'day');
    items.push({ key: 'waist', emoji: '📏', title: 'Measure your waist', detail: late > 0 ? `${late} day${late === 1 ? '' : 's'} overdue` : 'Due today', overdue: late > 0 });
  }
  if (dayjs(today).date() === reminders.review_day) {
    items.push({ key: 'review', emoji: '🗓️', title: 'Monthly review', detail: 'Check the gain rate and waist, then adjust food', overdue: false });
  }
  return items.sort((a, b) => Number(b.overdue) - Number(a.overdue));
}

// ---------- Calendar file ----------

const BYDAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
const stamp = (d: string, time: string) => `${d.replace(/-/g, '')}T${time.replace(':', '')}00`;

/** First day on or after `from` that falls on one of `weekdays`. */
function firstOn(from: string, weekdays: number[]): string {
  for (let i = 0; i < 7; i += 1) if (weekdays.includes(isoWeekday(addDays(from, i)))) return addDays(from, i);
  return from;
}

function event(uid: string, now: string, start: string, time: string, rrule: string, summary: string, description: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@tracker`,
    `DTSTAMP:${now}`,
    `DTSTART:${stamp(start, time)}`,
    'DURATION:PT10M',
    `RRULE:${rrule}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(summary)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ];
}

/**
 * Repeating events with alarms, in local ("floating") time, so they ring at
 * the same clock time wherever you are. Re-importing replaces them (same UIDs).
 */
export function buildIcs(input: { today: string; reminders: ReminderSettings; trendTime: string; waistIntervalDays: number; waistNextDue: string | null; nowUtc: Date }): string {
  const { today, reminders: r, trendTime, waistIntervalDays, waistNextDue, nowUtc } = input;
  const now = nowUtc.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const weighHow =
    trendTime === 'evening'
      ? 'Gym scale, before training, similar clothes. Trends use evening weigh-ins.'
      : 'After the loo, before food or water. Trends use morning weigh-ins.';
  const waistStart = waistNextDue && waistNextDue > today ? waistNextDue : today;
  const reviewStart = dayjs(today).date() <= r.review_day ? dayjs(today).date(r.review_day) : dayjs(today).add(1, 'month').date(r.review_day);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tracker//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Tracker reminders',
    ...event('weigh-in', now, firstOn(today, r.weigh_days), r.weigh_time, `FREQ=WEEKLY;BYDAY=${r.weigh_days.map((d) => BYDAY[d]).join(',')}`, '⚖️ Weigh in', weighHow),
    ...event('waist', now, waistStart, r.waist_time, `FREQ=DAILY;INTERVAL=${waistIntervalDays}`, '📏 Measure waist', 'At the navel, relaxed, after breathing out.'),
    ...event('monthly-review', now, reviewStart.format('YYYY-MM-DD'), r.waist_time, `FREQ=MONTHLY;BYMONTHDAY=${r.review_day}`, '🗓️ Monthly review', 'Open Tracker → Fitness → Review.'),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
