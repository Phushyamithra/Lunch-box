import dayjs, { type Dayjs } from 'dayjs';
import { EMPTY_NUTRITION } from '../constants';
import type { Meal, MealCategory, Nutrition } from '../models';
import { toDateKey } from '../utils/date';
import type { LogsByDate } from './StorageService';

export interface NutritionSummary {
  /** Number of logged meals in the range. */
  count: number;
  total: Nutrition;
  /** Per logged meal; zeros when nothing is logged. */
  average: Nutrition;
}

export interface CategoryBreakdownEntry {
  category: MealCategory;
  count: number;
  /** Share of all logged meals, 0–100. */
  percent: number;
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Pure nutrition analytics derived from logs + the meal catalog.
 * Stateless: everything is computed on demand, nothing is persisted.
 * Days can contain multiple logs; every logged meal counts.
 */
export class NutritionService {
  /** Inclusive date-range summary (totals + per-meal averages). */
  summarize(
    logs: LogsByDate,
    mealById: Map<string, Meal>,
    from: Dayjs,
    to: Dayjs,
  ): NutritionSummary {
    const fromKey = toDateKey(from);
    const toKey = toDateKey(to);
    const total: Nutrition = { ...EMPTY_NUTRITION };
    let count = 0;

    for (const [date, dayLogs] of Object.entries(logs)) {
      if (date < fromKey || date > toKey) continue;
      for (const log of dayLogs) {
        const meal = mealById.get(log.mealId);
        if (!meal) continue;
        count += 1;
        for (const key of Object.keys(total) as (keyof Nutrition)[]) {
          total[key] += meal.nutrition?.[key] ?? 0;
        }
      }
    }

    const average: Nutrition = { ...EMPTY_NUTRITION };
    if (count > 0) {
      for (const key of Object.keys(total) as (keyof Nutrition)[]) {
        total[key] = round1(total[key]);
        average[key] = round1(total[key] / count);
      }
    }
    return { count, total, average };
  }

  todaySummary(logs: LogsByDate, mealById: Map<string, Meal>): NutritionSummary {
    const today = dayjs();
    return this.summarize(logs, mealById, today, today);
  }

  /** Last 7 days including today. */
  weeklySummary(logs: LogsByDate, mealById: Map<string, Meal>): NutritionSummary {
    return this.summarize(logs, mealById, dayjs().subtract(6, 'day'), dayjs());
  }

  /** Current calendar month. */
  monthlySummary(logs: LogsByDate, mealById: Map<string, Meal>): NutritionSummary {
    return this.summarize(logs, mealById, dayjs().startOf('month'), dayjs().endOf('month'));
  }

  /** Meal counts + percentage share per category, across all logs. */
  categoryBreakdown(logs: LogsByDate, mealById: Map<string, Meal>): CategoryBreakdownEntry[] {
    const counts = new Map<MealCategory, number>();
    let total = 0;
    for (const log of Object.values(logs).flat()) {
      const meal = mealById.get(log.mealId);
      if (!meal) continue;
      total += 1;
      counts.set(meal.category, (counts.get(meal.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([category, count]) => ({
        category,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** Daily totals of one nutrient over the trailing `days` days. */
  trend(
    logs: LogsByDate,
    mealById: Map<string, Meal>,
    days: number,
    key: keyof Nutrition,
  ): TrendPoint[] {
    const points: TrendPoint[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = toDateKey(dayjs().subtract(i, 'day'));
      const value = (logs[date] ?? []).reduce((sum, log) => {
        const meal = mealById.get(log.mealId);
        return sum + (meal?.nutrition?.[key] ?? 0);
      }, 0);
      points.push({ date, value: round1(value) });
    }
    return points;
  }
}

export const nutritionService = new NutritionService();
