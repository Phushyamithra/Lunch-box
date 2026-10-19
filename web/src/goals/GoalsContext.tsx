import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Checkin, Goal } from './engine';
import * as api from './goalsApi';

interface GoalsValue {
  loading: boolean;
  error: string | null;
  data: api.GoalsData | null;
  reload: () => Promise<void>;
  addGoals: (rows: api.NewGoal[]) => Promise<Goal[]>;
  updateGoal: (id: string, patch: api.GoalPatch) => Promise<Goal>;
  addCheckin: (goalId: string, periodStart: string, note?: string | null) => Promise<Checkin>;
  removeCheckin: (id: string) => Promise<void>;
}

const GoalsContext = createContext<GoalsValue | null>(null);

/** Goals for the signed-in user (Supabase, RLS). */
export function GoalsProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [data, setData] = useState<api.GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.loadGoals(client));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load goals.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<GoalsValue>(
    () => ({
      loading,
      error,
      data,
      reload,
      async addGoals(rows) {
        const added = await api.addGoals(client, rows);
        setData((d) => (d ? { ...d, goals: [...d.goals, ...added] } : d));
        return added;
      },
      async updateGoal(id, patch) {
        const row = await api.updateGoal(client, id, patch);
        setData((d) => (d ? { ...d, goals: d.goals.map((g) => (g.id === id ? row : g)) } : d));
        return row;
      },
      async addCheckin(goalId, periodStart, note = null) {
        const row = await api.addCheckin(client, goalId, periodStart, note);
        setData((d) => (d ? { ...d, checkins: [...d.checkins, row] } : d));
        return row;
      },
      async removeCheckin(id) {
        await api.removeCheckin(client, id);
        setData((d) => (d ? { ...d, checkins: d.checkins.filter((c) => c.id !== id) } : d));
      },
    }),
    [client, loading, error, data, reload],
  );
  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals(): GoalsValue {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals must be used within GoalsProvider');
  return ctx;
}
