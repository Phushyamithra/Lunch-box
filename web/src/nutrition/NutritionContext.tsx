import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile } from './engine';
import type { Entry, Food, FoodInput } from './foodLog';
import * as api from './nutritionApi';
import { cachedLoad, onReconnect, sessionUserId } from '../lib/offlineCache';

interface NutritionValue {
  loading: boolean;
  error: string | null;
  data: api.NutritionData | null;
  reload: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  addTargets: (t: api.TargetInput) => Promise<api.TargetRow>;
  saveFood: (input: FoodInput, id?: string) => Promise<Food>;
  archiveFood: (id: string) => Promise<void>;
  addEntry: (input: api.EntryInput) => Promise<Entry>;
  /** Soft delete; `false` restores (undo). */
  setEntryDeleted: (entry: Entry, deleted: boolean) => Promise<void>;
  /** Adds imported rows, then reloads from the server. */
  importRows: (rows: api.ImportRows, onProgress?: (done: number, total: number) => void) => Promise<void>;
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
      setData(await cachedLoad('nutrition', await sessionUserId(client), () => api.loadNutrition(client)));
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

  // Back online: refresh from the server.
  useEffect(() => onReconnect(() => void reload()), [reload]);

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
      async saveFood(input, id) {
        const row = await api.saveFood(client, input, id);
        setData((d) => (d ? { ...d, foods: [...d.foods.filter((f) => f.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name)) } : d));
        return row;
      },
      async archiveFood(id) {
        await api.archiveFood(client, id);
        setData((d) => (d ? { ...d, foods: d.foods.filter((f) => f.id !== id) } : d));
      },
      async addEntry(input) {
        const row = await api.addEntry(client, input);
        setData((d) => (d ? { ...d, entries: [...d.entries, row] } : d));
        return row;
      },
      async setEntryDeleted(entry, deleted) {
        const row = await api.setEntryDeleted(client, entry.id, deleted);
        setData((d) => (d ? { ...d, entries: deleted ? d.entries.filter((e) => e.id !== entry.id) : [...d.entries, row] } : d));
      },
      async importRows(rows, onProgress) {
        try {
          await api.importRows(client, rows, onProgress);
        } finally {
          setData(await api.loadNutrition(client));
        }
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
