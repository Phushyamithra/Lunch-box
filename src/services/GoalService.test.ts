import { describe, expect, it } from 'vitest';
import type { GoalSettings, Meal, MealLog } from '../models';
import { MemoryStorageAdapter } from '../test/MemoryStorageAdapter';
import { GoalService } from './GoalService';
import { StorageService, type LogsByDate } from './StorageService';

const nutrition = { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
const meal = (id: string, category: string): Meal => ({
  id,
  name: id,
  category,
  nutrition,
  createdAt: '2026-01-01T00:00:00.000Z',
});
const log = (id: string, date: string, mealId: string): MealLog => ({
  id,
  email: 'me@example.com',
  date,
  mealId,
  loggedAt: `${date}T12:00:00.000Z`,
});

const meals = new Map([
  ['paneer', meal('paneer', 'Sandwich')],
  ['greek', meal('greek', 'Salad')],
]);
const settings: GoalSettings = { totalDays: 3, categoryTargets: { Sandwich: 2, Salad: 1 } };
const service = new GoalService(new StorageService(new MemoryStorageAdapter()));

describe('GoalService.computeProgress (existing completion counting)', () => {
  it('counts every log as a completed meal and distinct days separately', () => {
    const logs: LogsByDate = {
      '2026-10-01': [log('a', '2026-10-01', 'paneer'), log('b', '2026-10-01', 'greek')],
      '2026-10-02': [log('c', '2026-10-02', 'paneer')],
    };
    const p = service.computeProgress(logs, meals, settings, ['Sandwich', 'Salad']);
    expect(p.days).toMatchObject({ count: 2, target: 3, remaining: 1, complete: false });
    const sandwich = p.categories.find((c) => c.category === 'Sandwich');
    expect(sandwich).toMatchObject({ count: 2, target: 2, complete: true, percent: 100 });
    expect(p.balanceComplete).toBe(true);
    expect(p.championComplete).toBe(false);
  });

  it('ignores empty days and logs whose meal no longer exists', () => {
    const logs: LogsByDate = {
      '2026-10-01': [],
      '2026-10-02': [log('x', '2026-10-02', 'deleted-meal')],
    };
    const p = service.computeProgress(logs, meals, settings, ['Sandwich', 'Salad']);
    expect(p.days.count).toBe(1);
    expect(p.categories.every((c) => c.count === 0)).toBe(true);
  });

  it('treats a target of 0 as disabled', () => {
    const p = service.computeProgress(
      {},
      meals,
      { totalDays: 1, categoryTargets: { Sandwich: 0 } },
      ['Sandwich'],
    );
    expect(p.categories[0]).toMatchObject({ enabled: false, complete: false, percent: 0 });
  });
});

describe('GoalService.newlyEarned (one-time achievements)', () => {
  it('awards each milestone once and never re-awards', () => {
    const logs: LogsByDate = {
      '2026-10-01': [log('a', '2026-10-01', 'paneer')],
      '2026-10-02': [log('b', '2026-10-02', 'paneer')],
      '2026-10-03': [log('c', '2026-10-03', 'greek')],
    };
    const p = service.computeProgress(logs, meals, settings, ['Sandwich', 'Salad']);
    const earned = service.newlyEarned(p, {});
    expect([...earned].sort()).toEqual(
      ['balance', 'category_Salad', 'category_Sandwich', 'days_goal', 'nutrition_champion'].sort(),
    );
    const awarded = Object.fromEntries(earned.map((id) => [id, '2026-10-03T00:00:00.000Z']));
    expect(service.newlyEarned(p, awarded)).toEqual([]);
  });
});
