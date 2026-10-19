import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cadence, Checkin, Goal, GoalVersion } from './engine';

export interface GoalsData {
  /** All goals, archived included (history is kept). */
  goals: Goal[];
  checkins: Checkin[];
}

const GOAL_COLUMNS = 'id, title, emoji, metric, params, cadence, versions, starts_on, ends_on, sort_order, archived_at, created_at';
const CHECKIN_COLUMNS = 'id, goal_id, period_start, note, deleted_at';

const check = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};
const normaliseGoal = (r: Goal): Goal => ({
  ...r,
  params: r.params && typeof r.params === 'object' && !Array.isArray(r.params) ? r.params : {},
  versions: Array.isArray(r.versions) ? r.versions.map((v) => ({ from: String(v.from), target: Number(v.target) })) : [{ from: r.starts_on, target: 1 }],
  sort_order: Number(r.sort_order ?? 0),
});

export async function loadGoals(client: SupabaseClient): Promise<GoalsData> {
  const [goals, checkins] = await Promise.all([
    client.from('goals').select(GOAL_COLUMNS).order('sort_order').order('created_at'),
    client.from('goal_checkins').select(CHECKIN_COLUMNS).is('deleted_at', null).order('period_start'),
  ]);
  return { goals: ((check(goals) ?? []) as Goal[]).map(normaliseGoal), checkins: (check(checkins) ?? []) as Checkin[] };
}

export interface NewGoal {
  title: string;
  emoji: string | null;
  metric: string;
  params: Record<string, unknown>;
  cadence: Cadence;
  versions: GoalVersion[];
  starts_on: string;
  ends_on: string | null;
  sort_order: number;
}

export async function addGoals(client: SupabaseClient, rows: NewGoal[]): Promise<Goal[]> {
  return ((check(await client.from('goals').insert(rows).select(GOAL_COLUMNS)) ?? []) as Goal[]).map(normaliseGoal);
}

export type GoalPatch = Partial<Pick<Goal, 'title' | 'emoji' | 'params' | 'versions' | 'ends_on' | 'archived_at' | 'sort_order'>>;
export async function updateGoal(client: SupabaseClient, id: string, patch: GoalPatch): Promise<Goal> {
  return normaliseGoal(check(await client.from('goals').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(GOAL_COLUMNS).single()) as Goal);
}

export async function addCheckin(client: SupabaseClient, goalId: string, periodStart: string, note: string | null): Promise<Checkin> {
  return check(await client.from('goal_checkins').insert({ goal_id: goalId, period_start: periodStart, note }).select(CHECKIN_COLUMNS).single()) as Checkin;
}
/** Soft delete (undo-able). */
export async function removeCheckin(client: SupabaseClient, id: string): Promise<void> {
  check(await client.from('goal_checkins').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single());
}
