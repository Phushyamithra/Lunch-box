import dayjs from 'dayjs';
import { useMemo } from 'react';
import { useFitness } from '../fitness/FitnessContext';
import { useFood } from '../food/FoodContext';
import { useNutrition } from '../nutrition/NutritionContext';
import { summariseGoal, type GoalContext, type GoalSummary } from './engine';
import { useGoals } from './GoalsContext';
import { buildTimeline, type TimelineItem } from './timeline';

/** Everything a goal can be measured against, from the other modules. */
export function useGoalContext(): GoalContext | null {
  const { data: fitness } = useFitness();
  const { data: nutrition } = useNutrition();
  const food = useFood();
  const { data } = useGoals();
  const today = dayjs().format('YYYY-MM-DD');
  return useMemo(
    () =>
      data
        ? {
            today,
            fitness,
            nutrition,
            mealPrepDays: food.error ? null : food.data.logs.filter((l) => !l.deleted_at && l.kind === 'consumed').map((l) => l.log_date),
            checkins: data.checkins,
          }
        : null,
    [data, fitness, nutrition, food.data.logs, food.error, today],
  );
}

/** Goal summaries and the timeline, for screens outside Goals (Home, Today, report). */
export function useGoalsOverview(): { ctx: GoalContext; summaries: GoalSummary[]; timeline: TimelineItem[] } | null {
  const ctx = useGoalContext();
  const { data } = useGoals();
  const food = useFood();
  return useMemo(() => {
    if (!ctx || !data) return null;
    const summaries = data.goals.map((g) => summariseGoal(g, ctx));
    const timeline = buildTimeline({
      today: ctx.today,
      fitness: ctx.fitness,
      milestones: data.milestones,
      goals: summaries,
      plans: food.error ? [] : food.data.plans,
      legacyAchievements: food.data.settings?.legacy_achievements ?? null,
    });
    return { ctx, summaries, timeline };
  }, [ctx, data, food.data, food.error]);
}
