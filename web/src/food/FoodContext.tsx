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
import { insertLog, loadFoodData, setLogDeleted, type FoodData, type LogRow, type MealRow } from './foodApi';

interface FoodValue {
  loading: boolean;
  error: string | null;
  data: FoodData;
  mealById: Map<string, MealRow>;
  reload: () => Promise<void>;
  /** Records a consumption; resolves with the saved row (for undo). */
  logMeal: (mealId: string, date: string) => Promise<LogRow>;
  /** Soft-deletes a log; `restoreLog` undoes it. */
  removeLog: (log: LogRow) => Promise<void>;
  restoreLog: (log: LogRow) => Promise<void>;
}

const EMPTY: FoodData = { categories: [], meals: [], logs: [], settings: null };
const FoodContext = createContext<FoodValue | null>(null);

/**
 * Food data for the signed-in user, loaded from Supabase. Mutations go to
 * the server first and update local state only on success, so the screen
 * never shows a log that was not actually saved.
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

  const logMeal = useCallback(
    async (mealId: string, date: string) => {
      const row = await insertLog(client, mealId, date);
      setData((d) => ({ ...d, logs: [...d.logs, row] }));
      return row;
    },
    [client],
  );

  const removeLog = useCallback(
    async (log: LogRow) => {
      await setLogDeleted(client, log.id, true);
      setData((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== log.id) }));
    },
    [client],
  );

  const restoreLog = useCallback(
    async (log: LogRow) => {
      await setLogDeleted(client, log.id, false);
      setData((d) => ({
        ...d,
        logs: [...d.logs.filter((l) => l.id !== log.id), { ...log, deleted_at: null }].sort((a, b) =>
          a.logged_at.localeCompare(b.logged_at),
        ),
      }));
    },
    [client],
  );

  const value = useMemo<FoodValue>(
    () => ({ loading, error, data, mealById, reload, logMeal, removeLog, restoreLog }),
    [loading, error, data, mealById, reload, logMeal, removeLog, restoreLog],
  );
  return <FoodContext.Provider value={value}>{children}</FoodContext.Provider>;
}

export function useFood(): FoodValue {
  const ctx = useContext(FoodContext);
  if (!ctx) throw new Error('useFood must be used within FoodProvider');
  return ctx;
}
