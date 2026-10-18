import { orderCategories } from '../constants';
import type { CategoryGoalProgress, GoalProgress, GoalSettings, Meal, MealCategory } from '../models';
import type { LogsByDate } from './logs';

/**
 * Pure derivation of goal progress from logs. Categories come from the
 * union of goal settings and the catalog, so new categories appear
 * automatically. Shared by the extension (GoalService) and the web app.
 */
export function computeGoalProgress(
  logs: LogsByDate,
  mealById: Map<string, Meal>,
  settings: GoalSettings,
  /** Managed (enabled) category names; falls back to derived when empty. */
  categoryNames: MealCategory[] = [],
): GoalProgress {
  const dayKeys = Object.keys(logs).filter((date) => (logs[date]?.length ?? 0) > 0);
  const entries = dayKeys.flatMap((date) => logs[date]);

  const counts = new Map<MealCategory, number>();
  for (const log of entries) {
    const meal = mealById.get(log.mealId);
    if (meal) counts.set(meal.category, (counts.get(meal.category) ?? 0) + 1);
  }

  const allCategories =
    categoryNames.length > 0
      ? categoryNames
      : orderCategories([
          ...Object.keys(settings.categoryTargets),
          ...[...new Set([...mealById.values()].map((m) => m.category))],
        ]);

  const categories: CategoryGoalProgress[] = allCategories.map((category) => {
    const target = settings.categoryTargets[category] ?? 0;
    const count = counts.get(category) ?? 0;
    const enabled = target > 0;
    return {
      category,
      count,
      target,
      enabled,
      complete: enabled && count >= target,
      remaining: Math.max(0, target - count),
      percent: enabled ? Math.min(100, Math.round((count / target) * 100)) : 0,
    };
  });

  const dayTarget = settings.totalDays;
  const dayCount = dayKeys.length; // distinct days with at least one log
  const days = {
    count: dayCount,
    target: dayTarget,
    remaining: Math.max(0, dayTarget - dayCount),
    percent: dayTarget > 0 ? Math.min(100, Math.round((dayCount / dayTarget) * 100)) : 0,
    complete: dayTarget > 0 && dayCount >= dayTarget,
  };

  const enabledCategories = categories.filter((c) => c.enabled);
  const balanceComplete =
    enabledCategories.length >= 2 && enabledCategories.every((c) => c.complete);
  const championComplete =
    days.complete && enabledCategories.length >= 1 && enabledCategories.every((c) => c.complete);

  return { days, categories, balanceComplete, championComplete };
}
