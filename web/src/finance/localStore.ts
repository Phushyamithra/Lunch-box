/**
 * IndexedDB on this device: the finance document (so it works offline) and,
 * if you chose "remember", the non-extractable key. One small key-value
 * store; values are structured-cloned, so a CryptoKey can be kept without
 * its bytes ever being readable.
 */
import type { FinanceDoc } from './model';
import type { KdfParams, Sealed } from './vault';

const DB = 'tracker-finance';
const STORE = 'kv';

export interface LocalState {
  doc: FinanceDoc;
  /** Cloud revision this copy last matched (0 = never synced). */
  baseRevision: number;
  /** Changed since the last successful sync. */
  dirty: boolean;
  kdf: KdfParams;
  /** A small sealed value to check a passphrase when offline. */
  check: Sealed;
  lastSyncedAt: string | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error('This browser blocked local storage.'));
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
    tx.onerror = () => reject(tx.error ?? new Error('Could not save on this device.'));
    tx.onabort = () => reject(tx.error ?? new Error('Could not save on this device (storage full?).'));
  });
}

const docKey = (userId: string) => `doc:${userId}`;
const keyKey = (userId: string) => `key:${userId}`;

export const loadLocal = (userId: string) => run<LocalState | undefined>('readonly', (s) => s.get(docKey(userId)));
export const saveLocal = (userId: string, state: LocalState) => run<void>('readwrite', (s) => s.put(state, docKey(userId)));
export const loadKey = (userId: string) => run<CryptoKey | undefined>('readonly', (s) => s.get(keyKey(userId)));
export const saveKey = (userId: string, key: CryptoKey) => run<void>('readwrite', (s) => s.put(key, keyKey(userId)));
export const forgetKey = (userId: string) => run<void>('readwrite', (s) => s.delete(keyKey(userId)));
/** Removes this device's copy (the encrypted cloud copy stays). */
export const forgetLocal = async (userId: string) => {
  await run<void>('readwrite', (s) => s.delete(docKey(userId)));
  await forgetKey(userId);
};

/** A random label for "saved last by", so you can tell devices apart. Not personal data. */
export function deviceLabel(): string {
  const k = 'tracker.finance.device';
  try {
    let v = localStorage.getItem(k);
    if (!v) {
      const ua = navigator.userAgent;
      const kind = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Device';
      v = `${kind}-${Math.random().toString(36).slice(2, 6)}`;
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'Device';
  }
}
