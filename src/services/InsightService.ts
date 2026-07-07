import type { GoalProgress, Meal } from '../models';
import { nutritionService } from './NutritionService';
import type { LogsByDate } from './StorageService';

/**
 * Generates short, factual insights from the user's ACTUAL data —
 * nothing is fabricated. Returns at most `limit` insights, ordered by
 * usefulness (goal proximity first, then nutrition facts).
 */
export class InsightService {
  generate(
    progress: GoalProgress,
    logs: LogsByDate,
    mealById: Map<string, Meal>,
    limit = 4,
  ): string[] {
    const insights: string[] = [];
    const enabled = progress.categories.filter((c) => c.enabled);

    // Goal proximity — only when a goal is genuinely close.
    if (!progress.days.complete && progress.days.remaining >= 1 && progress.days.remaining <= 5) {
      insights.push(
        `Only ${progress.days.remaining} day${progress.days.remaining === 1 ? '' : 's'} left to reach your logging goal.`,
      );
    }
    for (const cat of enabled) {
      if (!cat.complete && cat.remaining === 1) {
        insights.push(`One more ${cat.category.toLowerCase()} to complete your ${cat.category} goal.`);
      } else if (!cat.complete && cat.count > 0 && cat.percent >= 50) {
        insights.push(`You've completed ${cat.percent}% of your ${cat.category} goal.`);
      }
    }

    // Nutrition facts — only when there is logged data to back them.
    const month = nutritionService.monthlySummary(logs, mealById);
    if (month.count > 0) {
      insights.push(`Average calories this month: ${Math.round(month.average.calories)} kcal.`);
      if (month.average.protein > 0) {
        insights.push(`Average protein intake: ${Math.round(month.average.protein)} g per meal.`);
      }
    }

    const week = nutritionService.weeklySummary(logs, mealById);
    if (week.count > 0) {
      insights.push(`You logged ${week.count} meal${week.count === 1 ? '' : 's'} in the last 7 days.`);
    }

    if (progress.championComplete) {
      insights.unshift('All goals complete — you are a Nutrition Champion! 🏆');
    }

    return insights.slice(0, limit);
  }
}

export const insightService = new InsightService();
