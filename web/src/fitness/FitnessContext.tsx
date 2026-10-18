import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from './fitnessApi';
import type { FitnessData, FitnessSettings, SessionRow, SlotRow, WorkoutSetRow } from './fitnessApi';
import { deriveKeyLifts, type ParsedReference } from './referenceImport';
import type { AwayPeriod, DietDay, WeighIn } from './rules';

interface FitnessValue {
  loading: boolean;
  error: string | null;
  data: FitnessData | null;
  reload: () => Promise<void>;
  saveSettings: (patch: Partial<FitnessSettings>) => Promise<void>;
  addWeighIn: (day: string, kg: number, timeOfDay: WeighIn['time_of_day']) => Promise<api.WeighInRow>;
  addWaist: (day: string, cm: number) => Promise<api.WaistRow>;
  /** Soft delete (and undo) for weigh-ins and waist entries. */
  setMeasurementDeleted: (kind: 'weight' | 'waist', row: api.WeighInRow | api.WaistRow, deleted: boolean) => Promise<void>;
  setDiet: (day: string, tag: DietDay['tag'], kcal: number | null, notes: string | null) => Promise<void>;
  setSteps: (day: string, steps: number) => Promise<void>;
  saveAway: (input: { starts_on: string; ends_on: string; label: string | null }, id?: string) => Promise<void>;
  removeAway: (id: string) => Promise<void>;
  saveSlot: (input: Omit<SlotRow, 'id'>) => Promise<void>;
  saveSession: (input: {
    day: string;
    variant_index: number;
    completed: boolean;
    slots_completed: number;
    cardio_done: boolean;
  }) => Promise<SessionRow>;
  /** Logs a set and remembers its weight × reps as the exercise preset. */
  addSet: (input: Omit<WorkoutSetRow, 'id' | 'notes'>) => Promise<WorkoutSetRow>;
  removeSet: (id: string) => Promise<void>;
  savePreset: (exercise: string, weight: number, reps: number) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
  /** Loads the program, finishers and targets from a parsed reference file. */
  importProgram: (parsed: ParsedReference) => Promise<void>;
}

const FitnessContext = createContext<FitnessValue | null>(null);

/**
 * Fitness data for the signed-in user (Supabase, RLS-protected). Writes go
 * to the server first; local state changes only once a write succeeded.
 */
export function FitnessProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [data, setData] = useState<FitnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.loadFitness(client));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load fitness data.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = (fn: (d: FitnessData) => FitnessData) => setData((d) => (d ? fn(d) : d));
  const upsertBy = <T,>(rows: T[], row: T, same: (a: T) => boolean): T[] => [...rows.filter((r) => !same(r)), row];

  const value = useMemo<FitnessValue>(
    () => ({
      loading,
      error,
      data,
      reload,
      async saveSettings(p) {
        const settings = await api.saveSettings(client, p);
        patch((d) => ({ ...d, settings }));
      },
      async addWeighIn(day, kg, timeOfDay) {
        const row = await api.addWeighIn(client, { day, weight_kg: kg, time_of_day: timeOfDay });
        patch((d) => ({ ...d, weighIns: [...d.weighIns, row] }));
        return row;
      },
      async addWaist(day, cm) {
        const row = await api.addWaist(client, { day, waist_cm: cm });
        patch((d) => ({ ...d, waists: [...d.waists, row].sort((a, b) => a.day.localeCompare(b.day)) }));
        return row;
      },
      async setMeasurementDeleted(kind, row, deleted) {
        await api.setDeleted(client, kind === 'weight' ? 'weigh_ins' : 'waist_measurements', row.id, deleted);
        patch((d) =>
          kind === 'weight'
            ? { ...d, weighIns: deleted ? d.weighIns.filter((w) => w.id !== row.id) : [...d.weighIns, row as api.WeighInRow] }
            : {
                ...d,
                waists: (deleted ? d.waists.filter((w) => w.id !== row.id) : [...d.waists, row as api.WaistRow]).sort((a, b) =>
                  a.day.localeCompare(b.day),
                ),
              },
        );
      },
      async setDiet(day, tag, kcal, notes) {
        const row = await api.upsertDiet(client, { day, tag, kcal_estimate: kcal, notes });
        patch((d) => ({ ...d, diet: upsertBy(d.diet, row, (r) => r.day === day) }));
      },
      async setSteps(day, steps) {
        const row = await api.upsertSteps(client, day, steps);
        patch((d) => ({ ...d, steps: upsertBy(d.steps, row, (r) => r.day === day) }));
      },
      async saveAway(input, id) {
        const row = id ? await api.updateAway(client, id, input) : await api.addAway(client, input);
        patch((d) => ({ ...d, away: upsertBy(d.away, row, (r) => r.id === row.id).sort((a, b) => a.starts_on.localeCompare(b.starts_on)) }));
      },
      async removeAway(id) {
        await api.deleteAway(client, id);
        patch((d) => ({ ...d, away: d.away.filter((a: AwayPeriod) => a.id !== id) }));
      },
      async saveSlot(input) {
        const row = await api.upsertSlot(client, input);
        patch((d) => ({ ...d, slots: upsertBy(d.slots, row, (r) => r.weekday === input.weekday && r.slot === input.slot) }));
      },
      async saveSession(input) {
        const row = await api.upsertSession(client, input);
        patch((d) => ({ ...d, sessions: upsertBy(d.sessions, row, (r) => r.day === input.day).sort((a, b) => a.day.localeCompare(b.day)) }));
        return row;
      },
      async addSet(input) {
        const row = await api.addSet(client, input);
        patch((d) => ({ ...d, sets: [...d.sets, row] }));
        // Best effort: a failed preset update never blocks logging.
        api
          .upsertPreset(client, input.exercise, input.weight_kg, input.reps)
          .then((preset) => patch((d) => ({ ...d, presets: upsertBy(d.presets, preset, (p) => p.id === preset.id) })))
          .catch(() => undefined);
        return row;
      },
      async savePreset(exercise, weight, reps) {
        const preset = await api.upsertPreset(client, exercise, weight, reps);
        patch((d) => ({ ...d, presets: upsertBy(d.presets, preset, (p) => p.id === preset.id) }));
      },
      async removePreset(id) {
        await api.deletePreset(client, id);
        patch((d) => ({ ...d, presets: d.presets.filter((p) => p.id !== id) }));
      },
      async importProgram(parsed) {
        const { slots, settings } = await api.importReference(client, parsed, deriveKeyLifts(parsed.slots));
        patch((d) => ({
          ...d,
          settings,
          slots: [...d.slots.filter((s) => !slots.some((n) => n.weekday === s.weekday && n.slot === s.slot)), ...slots],
        }));
      },
      async removeSet(id) {
        await api.deleteSet(client, id);
        patch((d) => ({ ...d, sets: d.sets.filter((s) => s.id !== id) }));
      },
    }),
    [client, loading, error, data, reload],
  );
  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
}

export function useFitness(): FitnessValue {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error('useFitness must be used within FitnessProvider');
  return ctx;
}
