import dayjs, { Dayjs } from 'dayjs';
import { DATE_KEY_FORMAT, MONTH_KEY_FORMAT } from '../constants';

export const toDateKey = (d: Dayjs): string => d.format(DATE_KEY_FORMAT);
export const toMonthKey = (d: Dayjs): string => d.format(MONTH_KEY_FORMAT);
export const todayKey = (): string => toDateKey(dayjs());
export const fromDateKey = (key: string): Dayjs => dayjs(key, DATE_KEY_FORMAT);

/** "2026-07-06" → "July 6" */
export const formatFriendly = (key: string): string =>
  fromDateKey(key).format('MMMM D');

/** "2026-07-06" → "Mon, July 6" */
export const formatWithWeekday = (key: string): string =>
  fromDateKey(key).format('ddd, MMMM D');

/**
 * 42 cells (6 weeks) covering the given month, starting on Sunday.
 * A fixed grid keeps the calendar height stable across months.
 */
export function calendarDays(month: Dayjs): Dayjs[] {
  const start = month.startOf('month').startOf('week');
  return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
}
