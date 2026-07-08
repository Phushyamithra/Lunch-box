import { DEFAULT_GOAL_SETTINGS, getCategoryMeta, orderCategories } from '../constants';
import type {
  AchievementId,
  AchievementMap,
  CategoryGoalProgress,
  GoalProgress,
  GoalSettings,
  Meal,
  MealCategory,
} from '../models';
import { storageService, type LogsByDate, type StorageService } from './StorageService';

/**
 * All goal & achievement business logic lives here — progress calculation,
 * milestone detection and motivational messaging. The UI only renders what
 * this service derives; StorageService only persists what it decides.
 *
 * New goal types (streaks, weekly goals, calories …) slot in by extending
 * GoalProgress + AchievementId and adding detection below.
 */
export class GoalService {
  constructor(private readonly storage: StorageService) {}

  // ---------- Settings ----------

  /** Stored settings merged over defaults, so new categories get a target. */
  async loadSettings(): Promise<GoalSettings> {
    const stored = await this.storage.getGoalSettings();
    return {
      totalDays: stored?.totalDays ?? DEFAULT_GOAL_SETTINGS.totalDays,
      categoryTargets: {
        ...DEFAULT_GOAL_SETTINGS.categoryTargets,
        ...stored?.categoryTargets,
      },
    };
  }

  saveSettings(settings: GoalSettings): Promise<void> {
    return this.storage.saveGoalSettings(settings);
  }

  // ---------- Progress ----------

  /**
   * Pure derivation from logs. Categories come from the union of goal
   * settings and the catalog, so new categories appear automatically.
   */
  computeProgress(
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

  // ---------- Achievements ----------

  /** Milestones reached now but not yet recorded. Awards are one-time. */
  newlyEarned(progress: GoalProgress, awarded: AchievementMap): AchievementId[] {
    const earned: AchievementId[] = [];
    if (progress.days.complete && !awarded.days_goal) earned.push('days_goal');
    for (const cat of progress.categories) {
      const id: AchievementId = `category_${cat.category}`;
      if (cat.complete && !awarded[id]) earned.push(id);
    }
    if (progress.balanceComplete && !awarded.balance) earned.push('balance');
    if (progress.championComplete && !awarded.nutrition_champion) earned.push('nutrition_champion');
    return earned;
  }

  getAchievements(email: string): Promise<AchievementMap> {
    return this.storage.getAchievements(email);
  }

  saveAchievements(email: string, achievements: AchievementMap): Promise<void> {
    return this.storage.saveAchievements(email, achievements);
  }

  // ---------- Motivation ----------

  /** Dynamic nudge based on the closest milestone. */
  motivationalMessage(progress: GoalProgress): string {
    const { days, categories } = progress;
    const enabled = categories.filter((c) => c.enabled);

    if (progress.championComplete) {
      return 'Nutrition Champion — every goal completed! 🏆';
    }

    const oneAway = enabled.find((c) => !c.complete && c.remaining === 1);
    if (oneAway) {
      return `Great job! One more ${oneAway.category.toLowerCase()} to complete your ${oneAway.category} goal.`;
    }

    if (!days.complete && days.remaining >= 1 && days.remaining <= 5) {
      return `Only ${days.remaining} more day${days.remaining === 1 ? '' : 's'} to reach your ${days.target}-day goal!`;
    }

    const almost = enabled.find((c) => !c.complete && c.remaining <= 3);
    if (almost) {
      return `${almost.remaining} more ${getCategoryMeta(almost.category).plural.toLowerCase()} to go — almost there!`;
    }

    if (!days.complete && days.percent >= 50) {
      return `You've completed ${days.percent}% of your ${days.target}-day goal. Keep it up!`;
    }

    if (days.count > 0) {
      return `${days.percent}% of your goal logged — every meal counts! ✨`;
    }

    return 'Log your first meal to start making progress! 🌱';
  }
}

export const goalService = new GoalService(storageService);
