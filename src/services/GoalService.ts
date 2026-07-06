import { CATEGORY_META, DEFAULT_GOAL_SETTINGS } from '../constants';
import {
  MEAL_CATEGORIES,
  type AchievementId,
  type AchievementMap,
  type CategoryGoalProgress,
  type GoalProgress,
  type GoalSettings,
  type Meal,
  type MealCategory,
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

  /** Pure derivation from logs — cheap enough to recompute on every change. */
  computeProgress(
    logs: LogsByDate,
    mealById: Map<string, Meal>,
    settings: GoalSettings,
  ): GoalProgress {
    const entries = Object.values(logs);

    const counts = Object.fromEntries(MEAL_CATEGORIES.map((c) => [c, 0])) as Record<
      MealCategory,
      number
    >;
    for (const log of entries) {
      const meal = mealById.get(log.mealId);
      if (meal) counts[meal.category] += 1;
    }

    const categories: CategoryGoalProgress[] = MEAL_CATEGORIES.map((category) => {
      const target = settings.categoryTargets[category] ?? 0;
      const count = counts[category];
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
    const dayCount = entries.length; // one log per day by design
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

    return { days, categories, balanceComplete };
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

    if (days.complete && enabled.length > 0 && enabled.every((c) => c.complete)) {
      return 'Every goal completed — amazing consistency! 🏆';
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
      return `${almost.remaining} more ${CATEGORY_META[almost.category].plural.toLowerCase()} to go — almost there!`;
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
