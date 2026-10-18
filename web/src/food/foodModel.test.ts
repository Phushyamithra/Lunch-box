import { describe, expect, it } from 'vitest';
import type { CategoryRow, LogRow, MealRow } from './foodApi';
import { monthGrid, parseGoalSettings, toCoreMeals, toLogsByDate, totalNutrition, weekOf } from './foodModel';

const meal = (id: string, calories: number, protein: number): MealRow => ({
  id,
  legacy_id: null,
  category_id: 'c1',
  name: id,
  icon: null,
  calories,
  protein,
  carbs: 0,
  fiber: 0,
  fat: 0,
  notes: null,
  archived_at: null,
});
const log = (id: string, mealId: string, date: string, extra: Partial<LogRow> = {}): LogRow => ({
  id,
  meal_id: mealId,
  log_date: date,
  logged_at: `${date}T12:00:00Z`,
  kind: 'consumed',
  source: 'manual',
  deleted_at: null,
  ...extra,
});

describe('foodModel', () => {
  it('weekOf returns Monday to Sunday around any day', () => {
    expect(weekOf('2026-10-18')).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
    expect(weekOf('2026-10-12')[0]).toBe('2026-10-12');
  });

  it('monthGrid builds Monday-first weeks with padding outside the month', () => {
    const oct = monthGrid('2026-10'); // 1 Oct 2026 is a Thursday
    expect(oct[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(oct.flat().filter(Boolean)).toHaveLength(31);
    expect(oct.every((week) => week.length === 7)).toBe(true);
    expect(oct[oct.length - 1]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    // February 2027 starts on a Monday and fills exactly four weeks.
    expect(monthGrid('2027-02')).toHaveLength(4);
    expect(monthGrid('2028-02').flat().filter(Boolean)).toHaveLength(29); // leap year
  });

  it('groups only live consumption logs by date', () => {
    const grouped = toLogsByDate([
      log('a', 'm', '2026-10-01'),
      log('b', 'm', '2026-10-01', { deleted_at: '2026-10-01T13:00:00Z' }),
      log('c', 'm', '2026-10-02', { kind: 'ordered' }),
    ]);
    expect(Object.keys(grouped)).toEqual(['2026-10-01']);
    expect(grouped['2026-10-01'].map((l) => l.id)).toEqual(['a']);
  });

  it('totals catalog nutrition, ignoring logs for unknown meals', () => {
    const meals = new Map([['m1', meal('m1', 400, 20)], ['m2', meal('m2', 250, 10)]]);
    const total = totalNutrition([log('a', 'm1', 'd'), log('b', 'm2', 'd'), log('c', 'gone', 'd')], meals);
    expect(total).toMatchObject({ calories: 650, protein: 30 });
  });

  it('maps cloud rows to core meals with category names', () => {
    const categories: CategoryRow[] = [
      { id: 'c1', legacy_id: null, name: 'Sandwich', icon: '🥪', color: '#000', sort_order: 0, enabled: true },
    ];
    expect(toCoreMeals([meal('m1', 1, 1)], categories).get('m1')?.category).toBe('Sandwich');
  });

  it('parses goal settings over defaults and rejects bad values', () => {
    expect(parseGoalSettings(null).totalDays).toBe(30);
    const s = parseGoalSettings({ totalDays: 40, categoryTargets: { Wrap: 5, Bad: -2, Nope: 'x' } });
    expect(s.totalDays).toBe(40);
    expect(s.categoryTargets.Wrap).toBe(5);
    expect(s.categoryTargets).not.toHaveProperty('Bad');
    expect(s.categoryTargets).not.toHaveProperty('Nope');
  });
});
