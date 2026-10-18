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
  DEFAULT_APP_SETTINGS,
  parseAppSettings,
  reconcileSettings,
  type AppSettings,
  type CachedSettings,
  type SettingsSnapshot,
} from './appSettings';

export type SyncState = 'loading' | 'synced' | 'saving' | 'offline' | 'error';

interface SettingsValue {
  settings: AppSettings;
  syncState: SyncState;
  syncError: string | null;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Retries the cloud round-trip (e.g. after coming back online). */
  resync: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);
const CACHE_KEY = 'lunchbox.web.settings';

function readCache(userId: string): CachedSettings | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY}.${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedSettings>;
    if (typeof parsed.updatedAt !== 'string') return null;
    return { settings: parseAppSettings(parsed.settings), updatedAt: parsed.updatedAt, dirty: Boolean(parsed.dirty) };
  } catch {
    return null;
  }
}

function writeCache(userId: string, value: CachedSettings): void {
  try {
    window.localStorage.setItem(`${CACHE_KEY}.${userId}`, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the cloud copy is still authoritative */
  }
}

/**
 * Cross-device UI settings: instant start from the local cache, then a
 * last-write-wins round-trip with the `app_settings` row (RLS-protected).
 */
export function SettingsProvider({
  client,
  userId,
  children,
}: {
  client: SupabaseClient;
  userId: string;
  children: ReactNode;
}) {
  const [cache, setCache] = useState<CachedSettings | null>(() => readCache(userId));
  const [syncState, setSyncState] = useState<SyncState>('loading');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const persist = useCallback(
    (next: CachedSettings) => {
      setCache(next);
      writeCache(userId, next);
    },
    [userId],
  );

  const push = useCallback(
    async (snapshot: SettingsSnapshot) => {
      setSyncState('saving');
      const { error } = await client.from('app_settings').upsert({
        user_id: userId,
        settings: snapshot.settings,
        updated_at: snapshot.updatedAt,
      });
      if (error) throw error;
      persist({ ...snapshot, dirty: false });
    },
    [client, userId, persist],
  );

  const fail = useCallback((error: unknown) => {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    setSyncState(offline ? 'offline' : 'error');
    setSyncError(offline ? null : error instanceof Error ? error.message : 'Could not reach the server.');
  }, []);

  // Initial (and retried) reconciliation with the cloud copy.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await client
          .from('app_settings')
          .select('settings, updated_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        const remote: SettingsSnapshot | null = data
          ? { settings: parseAppSettings(data.settings), updatedAt: data.updated_at as string }
          : null;
        const result = reconcileSettings(readCache(userId), remote);
        if (result.push) await push(result.snapshot);
        else persist({ ...result.snapshot, dirty: false });
        if (!active) return;
        setSyncState('synced');
        setSyncError(null);
      } catch (error) {
        if (active) fail(error);
      }
    })();
    return () => {
      active = false;
    };
  }, [client, userId, attempt, push, persist, fail]);

  useEffect(() => {
    const retry = () => setAttempt((n) => n + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const next: CachedSettings = {
        settings: parseAppSettings({ ...(cache?.settings ?? DEFAULT_APP_SETTINGS), ...patch }),
        updatedAt: new Date().toISOString(),
        dirty: true,
      };
      persist(next);
      push(next)
        .then(() => {
          setSyncState('synced');
          setSyncError(null);
        })
        .catch(fail);
    },
    [cache, persist, push, fail],
  );

  const value = useMemo<SettingsValue>(
    () => ({
      settings: cache?.settings ?? DEFAULT_APP_SETTINGS,
      syncState,
      syncError,
      updateSettings,
      resync: () => setAttempt((n) => n + 1),
    }),
    [cache, syncState, syncError, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
