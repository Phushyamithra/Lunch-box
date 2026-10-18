import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createPlan,
  insertLog,
  insertMeal,
  loadFoodData,
  setItemCap,
  setLogDeleted,
  setMealArchived,
  setQuota,
  updateMeal,
  updatePlan,
  type FoodData,
  type LogRow,
  type MealInput,
  type MealRow,
  type NewPlan,
} from './foodApi';
import {
  checkLog,
  completionAfterChange,
  isActive,
  type LogCheck,
  type PlanRow,
  type PlanState,
  type QuotaRow,
} from './plans';

export interface LogResult {
  row: LogRow;
  /** The plan this log completed (all quotas met), if any. */
  completedPlan: PlanRow | null;
}

interface FoodValue {
  loading: boolean;
  error: string | null;
  data: FoodData;
  mealById: Map<string, MealRow>;
  categoryOf: (mealId: string) => string | undefined;
  /** The active plan with its quotas and caps, or null. */
  activePlan: PlanState | null;
  stateOf: (plan: PlanRow) => PlanState;
  reload: () => Promise<void>;
  /** How a log of this meal on this date would relate to the active plan. */
  check: (mealId: string, date: string) => LogCheck;
  /**
   * Records a meal (order + consumption in one). Throws if a limit would be
   * exceeded, unless `override` is given — the override is stored on the log.
   */
  logMeal: (mealId: string, date: string, override?: { reason: string | null }) => Promise<LogResult>;
  removeLog: (log: LogRow) => Promise<void>;
  restoreLog: (log: LogRow) => Promise<void>;
  // Plans
  startPlan: (input: NewPlan) => Promise<void>;
  completePlan: (plan: PlanRow) => Promise<void>;
  setDefaultCap: (plan: PlanRow, cap: number | null) => Promise<void>;
  setMealCap: (plan: PlanRow, mealId: string, cap: number | null) => Promise<void>;
  setQuotaQuantity: (quota: QuotaRow, quantity: number) => Promise<void>;
  // Catalog
  addMeal: (input: MealInput) => Promise<MealRow>;
  editMeal: (id: string, input: MealInput) => Promise<void>;
  archiveMeal: (id: string, archived: boolean) => Promise<void>;
}

const EMPTY: FoodData = { categories: [], meals: [], logs: [], settings: null, plans: [], quotas: [], caps: [] };
const FoodContext = createContext<FoodValue | null>(null);

/** Thrown by logMeal when a limit applies and no override was given. */
export class LimitError extends Error {
  constructor(readonly result: Extract<LogCheck, { kind: 'blocked' }>) {
    super(result.reason === 'item_cap' ? 'This item has reached its cap.' : 'This category quota is used up.');
  }
}

/**
 * Food data for the signed-in user, loaded from Supabase. Mutations go to
 * the server first and update local state only on success, so the screen
 * never shows a change that was not actually saved.
 */
export function FoodProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [data, setData] = useState<FoodData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadFoodData(client));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load food data.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mealById = useMemo(() => new Map(data.meals.map((m) => [m.id, m])), [data.meals]);
  const categoryOf = useCallback((mealId: string) => mealById.get(mealId)?.category_id, [mealById]);
  const stateOf = useCallback(
    (plan: PlanRow): PlanState => ({
      plan,
      quotas: data.quotas.filter((q) => q.plan_id === plan.id),
      caps: data.caps.filter((c) => c.plan_id === plan.id),
    }),
    [data.quotas, data.caps],
  );
  const activePlan = useMemo(() => {
    const plan = data.plans.find(isActive);
    return plan ? stateOf(plan) : null;
  }, [data.plans, stateOf]);

  const check = useCallback(
    (mealId: string, date: string) => checkLog(activePlan, mealId, date, data.logs, categoryOf),
    [activePlan, data.logs, categoryOf],
  );

  const replacePlan = (plan: PlanRow) =>
    setData((d) => ({ ...d, plans: d.plans.map((p) => (p.id === plan.id ? plan : p)) }));

  /** Closes or reopens a plan after its logs changed (auto-completion only). */
  const syncCompletion = useCallback(
    async (planId: string | null, logs: LogRow[]): Promise<PlanRow | null> => {
      const plan = planId ? data.plans.find((p) => p.id === planId) : undefined;
      if (!plan) return null;
      const next = completionAfterChange(stateOf(plan), logs, categoryOf);
      if (next === 'complete') {
        const saved = await updatePlan(client, plan.id, { completed_at: new Date().toISOString(), completion: 'quota_met' });
        replacePlan(saved);
        return saved;
      }
      if (next === 'reopen') replacePlan(await updatePlan(client, plan.id, { completed_at: null, completion: null }));
      return null;
    },
    [client, data.plans, stateOf, categoryOf],
  );

  const logMeal = useCallback(
    async (mealId: string, date: string, override?: { reason: string | null }) => {
      const result = check(mealId, date);
      if (result.kind === 'blocked' && !override) throw new LimitError(result);
      const planId = result.kind === 'outside' ? null : result.planId;
      const row = await insertLog(client, {
        mealId,
        logDate: date,
        planId,
        override: result.kind === 'blocked' ? override : undefined,
      });
      const logs = [...data.logs, row];
      setData((d) => ({ ...d, logs: [...d.logs, row] }));
      const completedPlan = await syncCompletion(planId, logs);
      return { row, completedPlan };
    },
    [client, check, data.logs, syncCompletion],
  );

  const removeLog = useCallback(
    async (log: LogRow) => {
      await setLogDeleted(client, log.id, true);
      const logs = data.logs.filter((l) => l.id !== log.id);
      setData((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== log.id) }));
      await syncCompletion(log.plan_id, logs);
    },
    [client, data.logs, syncCompletion],
  );

  const restoreLog = useCallback(
    async (log: LogRow) => {
      await setLogDeleted(client, log.id, false);
      const restored = { ...log, deleted_at: null };
      const logs = [...data.logs.filter((l) => l.id !== log.id), restored];
      setData((d) => ({
        ...d,
        logs: [...d.logs.filter((l) => l.id !== log.id), restored].sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
      }));
      await syncCompletion(log.plan_id, logs);
    },
    [client, data.logs, syncCompletion],
  );

  const startPlan = useCallback(
    async (input: NewPlan) => {
      const { plan, quotas, caps } = await createPlan(client, input);
      setData((d) => ({ ...d, plans: [...d.plans, plan], quotas: [...d.quotas, ...quotas], caps: [...d.caps, ...caps] }));
    },
    [client],
  );

  const completePlan = useCallback(
    async (plan: PlanRow) => replacePlan(await updatePlan(client, plan.id, { completed_at: new Date().toISOString(), completion: 'forced' })),
    [client],
  );

  const setDefaultCap = useCallback(
    async (plan: PlanRow, cap: number | null) => replacePlan(await updatePlan(client, plan.id, { default_item_cap: cap })),
    [client],
  );

  const setMealCap = useCallback(
    async (plan: PlanRow, mealId: string, cap: number | null) => {
      const saved = await setItemCap(client, plan.id, mealId, cap);
      setData((d) => ({
        ...d,
        caps: [...d.caps.filter((c) => !(c.plan_id === plan.id && c.meal_id === mealId)), ...(saved ? [saved] : [])],
      }));
    },
    [client],
  );

  const setQuotaQuantity = useCallback(
    async (quota: QuotaRow, quantity: number) => {
      const saved = await setQuota(client, quota, quantity);
      setData((d) => ({ ...d, quotas: d.quotas.map((q) => (q.id === saved.id ? saved : q)) }));
    },
    [client],
  );

  const addMeal = useCallback(
    async (input: MealInput) => {
      const row = await insertMeal(client, input);
      setData((d) => ({ ...d, meals: [...d.meals, row].sort((a, b) => a.name.localeCompare(b.name)) }));
      return row;
    },
    [client],
  );
  const replaceMeal = (row: MealRow) => setData((d) => ({ ...d, meals: d.meals.map((m) => (m.id === row.id ? row : m)) }));
  const editMeal = useCallback(async (id: string, input: MealInput) => replaceMeal(await updateMeal(client, id, input)), [client]);
  const archiveMeal = useCallback(
    async (id: string, archived: boolean) => replaceMeal(await setMealArchived(client, id, archived)),
    [client],
  );

  const value = useMemo<FoodValue>(
    () => ({
      loading,
      error,
      data,
      mealById,
      categoryOf,
      activePlan,
      stateOf,
      reload,
      check,
      logMeal,
      removeLog,
      restoreLog,
      startPlan,
      completePlan,
      setDefaultCap,
      setMealCap,
      setQuotaQuantity,
      addMeal,
      editMeal,
      archiveMeal,
    }),
    [loading, error, data, mealById, categoryOf, activePlan, stateOf, reload, check, logMeal, removeLog, restoreLog, startPlan, completePlan, setDefaultCap, setMealCap, setQuotaQuantity, addMeal, editMeal, archiveMeal],
  );
  return <FoodContext.Provider value={value}>{children}</FoodContext.Provider>;
}

export function useFood(): FoodValue {
  const ctx = useContext(FoodContext);
  if (!ctx) throw new Error('useFood must be used within FoodProvider');
  return ctx;
}
