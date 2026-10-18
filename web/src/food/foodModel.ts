import dayjs from 'dayjs';
import { DEFAULT_GOAL_SETTINGS, EMPTY_NUTRITION } from '../../../src/constants';
import type { LogsByDate } from '../../../src/core/logs';
import type { GoalSettings, Meal, Nutrition } from '../../../src/models';
import type { CategoryRow, LogRow, MealRow } from './foodApi';

export const DATE_KEY = 'YYYY-MM-DD';
export const todayKey = (): string => dayjs().format(DATE_KEY);

export function nutritionOf(meal: MealRow): Nutrition {
  return { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fiber: meal.fiber, fat: meal.fat };
}

/**
 * Adapts cloud rows to the extension's shapes so shared logic in src/core
 * (goal progress) runs unchanged on both platforms.
 */
export function toCoreMeals(meals: MealRow[], categories: CategoryRow[]): Map<string, Meal> {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  return new Map(
    meals.map((m) => [
      m.id,
      {
        id: m.id,
        name: m.name,
        category: nameById.get(m.category_id) ?? 'Uncategorized',
        nutrition: nutritionOf(m),
        icon: m.icon ?? undefined,
        createdAt: '',
      },
    ]),
  );
}

/** Consumption logs grouped by date (soft-deleted and 'ordered' excluded). */
export function toLogsByDate(logs: LogRow[]): LogsByDate {
  const result: LogsByDate = {};
  for (const log of logs) {
    if (log.deleted_at || log.kind !== 'consumed') continue;
    (result[log.log_date] ??= []).push({
      id: log.id,
      email: '',
      date: log.log_date,
      mealId: log.meal_id,
      loggedAt: log.logged_at,
    });
  }
  return result;
}

/** Sum of catalog nutrition for a set of logs (estimates from catalog values). */
export function totalNutrition(logs: LogRow[], mealById: Map<string, MealRow>): Nutrition {
  const total = { ...EMPTY_NUTRITION };
  for (const log of logs) {
    const meal = mealById.get(log.meal_id);
    if (!meal) continue;
    for (const key of Object.keys(total) as (keyof Nutrition)[]) total[key] += Number(meal[key]) || 0;
  }
  return total;
}

/** The Monday-to-Sunday week (date keys) containing `dateKey`. */
export function weekOf(dateKey: string): string[] {
  const date = dayjs(dateKey);
  const monday = date.subtract((date.day() + 6) % 7, 'day');
  return Array.from({ length: 7 }, (_, i) => monday.add(i, 'day').format(DATE_KEY));
}

/** Stored goal settings merged over defaults (mirrors the extension). */
export function parseGoalSettings(raw: unknown): GoalSettings {
  const stored = raw && typeof raw === 'object' ? (raw as Partial<GoalSettings>) : {};
  const days = Number(stored.totalDays);
  const targets: Record<string, number> = { ...DEFAULT_GOAL_SETTINGS.categoryTargets };
  for (const [name, value] of Object.entries(stored.categoryTargets ?? {})) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) targets[name] = n;
  }
  return {
    totalDays: Number.isFinite(days) && days > 0 ? days : DEFAULT_GOAL_SETTINGS.totalDays,
    categoryTargets: targets,
  };
}
