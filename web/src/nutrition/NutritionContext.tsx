import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile } from './engine';
import * as api from './nutritionApi';

interface NutritionValue {
  loading: boolean;
  error: string | null;
  data: api.NutritionData | null;
  reload: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  addTargets: (t: api.TargetInput) => Promise<api.TargetRow>;
}

const NutritionContext = createContext<NutritionValue | null>(null);

/** Nutrition data for the signed-in user (Supabase, RLS). Server first, then local state. */
export function NutritionProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [data, setData] = useState<api.NutritionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.loadNutrition(client));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load nutrition data.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<NutritionValue>(
    () => ({
      loading,
      error,
      data,
      reload,
      async saveProfile(p) {
        const profile = await api.saveProfile(client, p);
        setData((d) => (d ? { ...d, profile } : d));
      },
      async addTargets(t) {
        const row = await api.addTargets(client, t);
        setData((d) => (d ? { ...d, targets: [...d.targets, row] } : d));
        return row;
      },
    }),
    [client, loading, error, data, reload],
  );
  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}

export function useNutrition(): NutritionValue {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition must be used within NutritionProvider');
  return ctx;
}
