import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDERS, buildIcs, dueToday, normaliseReminders, validateReminders } from './reminders';

const base = {
  reminders: DEFAULT_REMINDERS, // Mon/Wed/Fri
  weighIns: [] as { day: string; time_of_day: 'morning' | 'evening' | 'afternoon' | 'night' }[],
  trendTime: 'evening',
  minPerWeek: 3,
  waistNextDue: '2026-10-25',
  hasWaist: true,
  away: false,
};

describe('due today', () => {
  it('asks for a weigh-in on weigh days, with the evening checklist', () => {
    const items = dueToday({ ...base, today: '2026-10-19' }); // Monday
    expect(items).toEqual([expect.objectContaining({ key: 'weigh', detail: '0/3 this week · gym scale, before training', overdue: false })]);
    expect(dueToday({ ...base, today: '2026-10-20', weighIns: [{ day: '2026-10-19', time_of_day: 'evening' }] })).toEqual([]); // Tuesday, on track
    expect(dueToday({ ...base, today: '2026-10-20' })[0]).toMatchObject({ key: 'weigh', overdue: true }); // Tuesday, Monday missed
  });

  it('nags on other days once three weigh-ins are no longer possible on weigh days', () => {
    // Thursday with only Monday done: just Friday left, two still needed.
    const items = dueToday({ ...base, today: '2026-10-22', weighIns: [{ day: '2026-10-19', time_of_day: 'evening' }] });
    expect(items[0]).toMatchObject({ key: 'weigh', detail: expect.stringContaining('1/3'), overdue: true });
  });

  it('only counts weigh-ins at the trend time, and none are due once weighed today', () => {
    const items = dueToday({ ...base, today: '2026-10-21', weighIns: [{ day: '2026-10-19', time_of_day: 'morning' }] });
    expect(items[0].detail).toContain('0/3');
    expect(dueToday({ ...base, today: '2026-10-21', weighIns: [{ day: '2026-10-21', time_of_day: 'evening' }] })).toEqual([]);
  });

  it('waist due / overdue / first ever, and the monthly review', () => {
    expect(dueToday({ ...base, today: '2026-10-25' }).map((i) => i.detail)).toContain('Due today');
    expect(dueToday({ ...base, today: '2026-10-27' }).find((i) => i.key === 'waist')).toMatchObject({ detail: '2 days overdue', overdue: true });
    expect(dueToday({ ...base, today: '2026-10-20', hasWaist: false, waistNextDue: null }).find((i) => i.key === 'waist')?.detail).toMatch(/baseline/);
    expect(dueToday({ ...base, today: '2026-11-17' }).map((i) => i.key)).toContain('review');
  });

  it('nothing is due while away', () => {
    expect(dueToday({ ...base, today: '2026-10-19', away: true })).toEqual([]);
  });
});

describe('reminder settings', () => {
  it('fills defaults and drops bad values', () => {
    expect(normaliseReminders(null)).toEqual(DEFAULT_REMINDERS);
    expect(normaliseReminders({ weigh_days: [5, 1, 9, 1], weigh_time: '7:00', review_day: 31 })).toEqual({ ...DEFAULT_REMINDERS, weigh_days: [1, 5] });
  });
  it('validates', () => {
    expect(validateReminders({ ...DEFAULT_REMINDERS, weigh_days: [] })).toMatch(/at least one/);
    expect(validateReminders({ ...DEFAULT_REMINDERS, review_day: 30 })).toMatch(/1–28/);
    expect(validateReminders(DEFAULT_REMINDERS)).toBeNull();
  });
});

describe('calendar file', () => {
  it('has repeating events with alarms at local time', () => {
    const ics = buildIcs({
      today: '2026-10-20',
      reminders: DEFAULT_REMINDERS,
      trendTime: 'evening',
      waistIntervalDays: 14,
      waistNextDue: '2026-10-25',
      nowUtc: new Date('2026-10-20T10:00:00Z'),
    });
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART:20261021T183000'); // next Wednesday
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(lines).toContain('DTSTART:20261025T183000');
    expect(lines).toContain('RRULE:FREQ=DAILY;INTERVAL=14');
    expect(lines).toContain('DTSTART:20261117T183000'); // 17 Oct passed → November
    expect(lines).toContain('DTSTAMP:20261020T100000Z');
    expect(lines.filter((l) => l === 'BEGIN:VALARM')).toHaveLength(3);
    expect(ics).toContain('Gym scale\\, before training');
  });
});
