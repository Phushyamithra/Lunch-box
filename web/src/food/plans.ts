/**
 * Meal-plan rules, kept pure so they can be unit-tested.
 *
 * A plan holds a quota per category (e.g. 20 salads, 20 sandwiches) and a
 * consumption cap per item (one default, overridable per item). Logging a
 * meal is both the order and the consumption, so each live log in a plan
 * uses one unit of its category quota and one of its item cap.
 *
 * Counts are always derived from logs, never stored, so completing a plan
 * and starting a new one can never delete or rewrite history.
 */

export interface PlanRow {
  id: string;
  name: string;
  started_on: string; // YYYY-MM-DD
  default_item_cap: number | null;
  completed_at: string | null;
  completion: 'quota_met' | 'forced' | null;
  created_at: string;
}

export interface QuotaRow {
  id: string;
  plan_id: string;
  category_id: string;
  quantity: number;
}

export interface ItemCapRow {
  id: string;
  plan_id: string;
  meal_id: string;
  cap: number;
}

/** The subset of a log the plan rules need. */
export interface PlanLog {
  id: string;
  meal_id: string;
  log_date: string;
  kind: 'consumed' | 'ordered';
  deleted_at: string | null;
  plan_id: string | null;
  cap_override: boolean;
}

/** Meal id → category id. */
export type CategoryOf = (mealId: string) => string | undefined;

export interface PlanState {
  plan: PlanRow;
  quotas: QuotaRow[];
  caps: ItemCapRow[];
}

export const isActive = (plan: PlanRow): boolean => plan.completed_at === null;

/** Live logs that count toward a plan. */
export function logsInPlan(planId: string, logs: PlanLog[]): PlanLog[] {
  return logs.filter((l) => l.plan_id === planId && !l.deleted_at && l.kind === 'consumed');
}

/** The cap that applies to an item: its own override, else the plan default (null = uncapped). */
export function capFor(state: PlanState, mealId: string): number | null {
  const own = state.caps.find((c) => c.plan_id === state.plan.id && c.meal_id === mealId);
  return own ? own.cap : state.plan.default_item_cap;
}

export function usageByMeal(planLogs: PlanLog[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const log of planLogs) usage.set(log.meal_id, (usage.get(log.meal_id) ?? 0) + 1);
  return usage;
}

export type CapStatus = 'uncapped' | 'ok' | 'last' | 'reached' | 'over';

export function capStatus(used: number, cap: number | null): CapStatus {
  if (cap === null) return 'uncapped';
  if (used > cap) return 'over';
  if (used === cap) return 'reached';
  if (cap - used === 1) return 'last';
  return 'ok';
}

export interface ItemUsage {
  mealId: string;
  used: number;
  cap: number | null;
  remaining: number | null;
  status: CapStatus;
  /** Logs recorded past the cap with explicit authorisation. */
  overrides: number;
}

export function itemUsage(state: PlanState, mealId: string, logs: PlanLog[]): ItemUsage {
  const mine = logsInPlan(state.plan.id, logs).filter((l) => l.meal_id === mealId);
  const cap = capFor(state, mealId);
  const used = mine.length;
  return {
    mealId,
    used,
    cap,
    remaining: cap === null ? null : Math.max(0, cap - used),
    status: capStatus(used, cap),
    overrides: mine.filter((l) => l.cap_override).length,
  };
}

export interface QuotaProgress {
  categoryId: string;
  quantity: number;
  used: number;
  remaining: number;
  complete: boolean;
}

export function quotaProgress(state: PlanState, logs: PlanLog[], categoryOf: CategoryOf): QuotaProgress[] {
  const planLogs = logsInPlan(state.plan.id, logs);
  return state.quotas
    .filter((q) => q.plan_id === state.plan.id)
    .map((q) => {
      const used = planLogs.filter((l) => categoryOf(l.meal_id) === q.category_id).length;
      return {
        categoryId: q.category_id,
        quantity: q.quantity,
        used,
        remaining: Math.max(0, q.quantity - used),
        complete: used >= q.quantity,
      };
    });
}

/** Every quota used up (a plan with no quotas never auto-completes). */
export function allQuotasMet(progress: QuotaProgress[]): boolean {
  return progress.length > 0 && progress.every((q) => q.complete);
}

export type LogCheck =
  /** Not part of the plan (no active plan, date before it, or category without a quota). */
  | { kind: 'outside' }
  | { kind: 'allowed'; planId: string; usage: ItemUsage; quota: QuotaProgress }
  /** Over a limit: allowed only with an explicit, recorded override. */
  | { kind: 'blocked'; planId: string; reason: 'item_cap' | 'category_quota'; usage: ItemUsage; quota: QuotaProgress };

/** Decides how a new log for `mealId` on `date` relates to the active plan. */
export function checkLog(
  state: PlanState | null,
  mealId: string,
  date: string,
  logs: PlanLog[],
  categoryOf: CategoryOf,
): LogCheck {
  if (!state || !isActive(state.plan) || date < state.plan.started_on) return { kind: 'outside' };
  const categoryId = categoryOf(mealId);
  const quota = quotaProgress(state, logs, categoryOf).find((q) => q.categoryId === categoryId);
  if (!quota) return { kind: 'outside' };
  const usage = itemUsage(state, mealId, logs);
  const planId = state.plan.id;
  if (usage.cap !== null && usage.used >= usage.cap) return { kind: 'blocked', planId, reason: 'item_cap', usage, quota };
  if (quota.complete) return { kind: 'blocked', planId, reason: 'category_quota', usage, quota };
  return { kind: 'allowed', planId, usage, quota };
}

/** After a change to the logs: should the plan close, reopen, or stay? */
export function completionAfterChange(
  state: PlanState,
  logs: PlanLog[],
  categoryOf: CategoryOf,
): 'complete' | 'reopen' | 'unchanged' {
  const met = allQuotasMet(quotaProgress(state, logs, categoryOf));
  if (isActive(state.plan)) return met ? 'complete' : 'unchanged';
  // Only an automatic completion is undone by an undo; a forced one stands.
  if (state.plan.completion === 'quota_met' && !met) return 'reopen';
  return 'unchanged';
}
