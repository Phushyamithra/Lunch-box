/**
 * Last-known copy of each module's data on this device, so the app still
 * opens (read-only) without a connection. Cloud data is never served stale
 * silently: whenever a cached copy is shown, the offline banner says so and
 * when it's from. Finance isn't here; it keeps its own encrypted copy.
 *
 * Cleared on sign-out.
 */
import { useSyncExternalStore } from 'react';

const DB = 'tracker-cache';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error('Local storage unavailable.'));
      };
    });
  }
  return dbPromise;
}
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

interface Entry<T> {
  savedAt: string;
  data: T;
}

// ---------- which modules are showing a cached copy ----------

type State = Readonly<Record<string, string>>; // module → savedAt
let state: State = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setStale = (module: string, savedAt: string | null) => {
  const next = { ...state };
  if (savedAt) next[module] = savedAt;
  else delete next[module];
  state = next;
  emit();
};

/** Modules currently showing their cached copy, with when it was saved. */
/** Current state (for tests and non-React callers). */
export const cachedModules = (): State => state;

export function useCachedModules(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Network failures (not server errors like a missing table). */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /Failed to fetch|NetworkError|Load failed|network|Offline|No connection/i.test(m);
}

/**
 * Loads fresh data and keeps a copy; if the network is down, falls back to
 * the last copy (and flags it for the banner). Other errors are rethrown.
 */
export interface CacheStore {
  get: (key: string) => Promise<unknown>;
  put: (key: string, value: unknown) => Promise<void>;
}
const idbStore: CacheStore = {
  get: (key) => run<unknown>('readonly', (s) => s.get(key)),
  put: (key, value) => run<void>('readwrite', (s) => s.put(value, key)),
};

export async function cachedLoad<T>(module: string, userId: string | null | undefined, load: () => Promise<T>, store: CacheStore = idbStore): Promise<T> {
  const key = `${userId ?? 'anon'}:${module}`;
  try {
    const data = await load();
    setStale(module, null);
    await store.put(key, { savedAt: new Date().toISOString(), data } satisfies Entry<T>).catch(() => undefined);
    return data;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const cached = (await store.get(key).catch(() => undefined)) as Entry<T> | undefined;
    if (!cached) throw new Error('You’re offline and this hasn’t been loaded on this device yet. Connect once and it will be available offline.');
    setStale(module, cached.savedAt);
    return cached.data;
  }
}

export async function clearOfflineCache(): Promise<void> {
  state = {};
  emit();
  await run<void>('readwrite', (s) => s.clear()).catch(() => undefined);
}

/** Calls `fn` when the connection comes back (to refresh). */
export function onReconnect(fn: () => void): () => void {
  window.addEventListener('online', fn);
  return () => window.removeEventListener('online', fn);
}

export const OFFLINE_MESSAGE = 'You’re offline, so this wasn’t saved. Try again once you’re connected.';

/** The signed-in user's id from the stored session (works offline). */
export async function sessionUserId(client: { auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> } }): Promise<string | null> {
  try {
    return (await client.auth.getSession()).data.session?.user.id ?? null;
  } catch {
    return null;
  }
}
