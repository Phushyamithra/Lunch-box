import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { deviceLabel, forgetKey, forgetLocal, loadKey, loadLocal, saveKey, saveLocal, type LocalState } from './localStore';
import { emptyDoc, parseFinanceDoc, type FinanceDoc, type FinanceSettings } from './model';
import { createVault, fetchVault, updateVault, type VaultRow } from './vaultApi';
import { deriveKey, mergeDocs, newKdfParams, open, seal, WrongPassphraseError, type KdfParams } from './vault';

export type FinanceStatus = 'loading' | 'setup' | 'locked' | 'ready' | 'error';
export interface SyncState {
  state: 'synced' | 'saving' | 'pending' | 'offline' | 'error';
  lastSyncedAt: string | null;
  message: string | null;
}

interface FinanceValue {
  status: FinanceStatus;
  error: string | null;
  doc: FinanceDoc | null;
  sync: SyncState;
  /** First time: choose a passphrase; starts from the brief's values. */
  setup: (passphrase: string, remember: boolean) => Promise<void>;
  unlock: (passphrase: string, remember: boolean) => Promise<void>;
  /** Forgets the key on this device (data stays, encrypted in the cloud and readable here only after unlocking). */
  lock: () => Promise<void>;
  /** Any change to the document goes through here: saved locally at once, then synced. */
  update: (fn: (doc: FinanceDoc) => FinanceDoc) => Promise<void>;
  updateSettings: (patch: Partial<FinanceSettings>) => Promise<void>;
  syncNow: () => Promise<void>;
  changePassphrase: (current: string, next: string) => Promise<void>;
  /** Adds a backup's records to yours (newer edits win; nothing is deleted). */
  restore: (raw: unknown) => Promise<{ added: number }>;
  forgetDevice: () => Promise<void>;
}

const FinanceContext = createContext<FinanceValue | null>(null);
const CHECK = { tracker: 'finance-check' };
const today = () => new Date().toISOString().slice(0, 10);
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Finance data for the signed-in user: kept on this device, synced only as
 * ciphertext. Nothing readable is sent to Supabase.
 */
export function FinanceProvider({ client, userId, children }: { client: SupabaseClient; userId: string; children: ReactNode }) {
  const [status, setStatus] = useState<FinanceStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<FinanceDoc | null>(null);
  const [sync, setSync] = useState<SyncState>({ state: 'synced', lastSyncedAt: null, message: null });
  const keyRef = useRef<CryptoKey | null>(null);
  const localRef = useRef<LocalState | null>(null);
  const pushing = useRef<Promise<void> | null>(null);
  const timer = useRef<number | null>(null);
  const device = useMemo(() => deviceLabel(), []);

  const persist = useCallback(
    async (next: LocalState) => {
      localRef.current = next;
      setDoc(next.doc);
      await saveLocal(userId, next);
    },
    [userId],
  );

  /** Bring this device and the cloud together: pull newer, merge, push ours. Safe to call any time. */
  const syncOnce = useCallback(async (): Promise<void> => {
    const key = keyRef.current;
    const local = localRef.current;
    if (!key || !local) return;
    if (!online()) {
      setSync((s) => ({ ...s, state: local.dirty ? 'offline' : s.state, message: local.dirty ? 'Offline: saved on this device, will sync when back online.' : null }));
      return;
    }
    setSync((s) => ({ ...s, state: 'saving', message: null }));
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const cur = localRef.current as LocalState;
        const remote = await fetchVault(client);
        let working = cur;
        if (remote && remote.revision !== cur.baseRevision) {
          const theirs = parseFinanceDoc(await open(remote, key));
          if ('error' in theirs) throw new Error(theirs.error);
          const merged = cur.dirty ? mergeDocs(cur.doc, theirs.doc) : theirs.doc;
          const changed = JSON.stringify(merged) !== JSON.stringify(theirs.doc);
          working = { ...cur, doc: merged, baseRevision: remote.revision, kdf: remote.kdf, dirty: changed };
          await persist(working);
        }
        if (!working.dirty && remote) {
          const at = new Date().toISOString();
          await persist({ ...working, lastSyncedAt: at });
          setSync({ state: 'synced', lastSyncedAt: at, message: null });
          return;
        }
        const sealed = await seal(working.doc, key, working.kdf);
        const rev = remote ? await updateVault(client, sealed, remote.revision, device) : (await createVault(client, sealed, device)) ? 1 : null;
        if (rev !== null) {
          const at = new Date().toISOString();
          // Edits made while we were uploading stay dirty for the next round.
          const latest = localRef.current as LocalState;
          const stillDirty = latest.doc !== working.doc;
          await persist({ ...latest, baseRevision: rev, dirty: stillDirty, lastSyncedAt: at });
          setSync({ state: stillDirty ? 'pending' : 'synced', lastSyncedAt: at, message: null });
          if (!stillDirty) return;
        }
        // Someone saved in between (or we have newer edits): loop to merge and retry.
      }
      setSync((s) => ({ ...s, state: 'pending', message: 'Busy syncing between devices; will retry shortly.' }));
    } catch (e) {
      const message = e instanceof WrongPassphraseError ? 'The cloud copy was saved with a different passphrase (changed on another device?). Lock and unlock with the new one.' : e instanceof Error ? e.message : 'Sync failed.';
      setSync((s) => ({ ...s, state: online() ? 'error' : 'offline', message: online() ? `Sync failed: ${message} Your data is safe on this device.` : 'Offline: saved on this device.' }));
    }
  }, [client, device, persist]);

  const syncNow = useCallback(async () => {
    if (pushing.current) await pushing.current;
    pushing.current = syncOnce().finally(() => {
      pushing.current = null;
    });
    await pushing.current;
  }, [syncOnce]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setSync((s) => ({ ...s, state: 'pending' }));
    timer.current = window.setTimeout(() => void syncNow(), 800);
  }, [syncNow]);

  // Start: local copy and remembered key first (works offline), then the cloud.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [local, key] = await Promise.all([loadLocal(userId), loadKey(userId)]);
        let remote: VaultRow | null = null;
        let reachable = true;
        try {
          remote = await fetchVault(client);
        } catch (e) {
          if (online()) throw e;
          reachable = false;
        }
        if (cancelled) return;
        localRef.current = local ?? null;
        if (!local && !remote) {
          setStatus(reachable ? 'setup' : 'error');
          if (!reachable) setError('You’re offline and Finance isn’t on this device yet. Connect once to set it up or download it.');
          return;
        }
        if (!key) {
          setStatus('locked');
          return;
        }
        keyRef.current = key;
        if (local) setDoc(local.doc);
        if (local) setSync({ state: local.dirty ? 'pending' : 'synced', lastSyncedAt: local.lastSyncedAt, message: null });
        if (!local && remote) {
          const parsed = parseFinanceDoc(await open(remote, key));
          if ('error' in parsed) throw new Error(parsed.error);
          await persist({ doc: parsed.doc, baseRevision: remote.revision, dirty: false, kdf: remote.kdf, check: await seal(CHECK, key, remote.kdf), lastSyncedAt: new Date().toISOString() });
        }
        setStatus('ready');
        void syncNow();
      } catch (e) {
        if (cancelled) return;
        if (e instanceof WrongPassphraseError) {
          await forgetKey(userId);
          setStatus('locked');
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not open Finance.');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, userId, persist, syncNow]);

  // Catch up when the app comes back to the front or the network returns.
  useEffect(() => {
    if (status !== 'ready') return;
    const wake = () => {
      if (document.visibilityState === 'visible') void syncNow();
    };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [status, syncNow]);

  const value = useMemo<FinanceValue>(
    () => ({
      status,
      error,
      doc,
      sync,
      async setup(passphrase, remember) {
        const kdf = newKdfParams();
        const key = await deriveKey(passphrase, kdf);
        keyRef.current = key;
        if (remember) await saveKey(userId, key);
        await persist({ doc: emptyDoc(today()), baseRevision: 0, dirty: true, kdf, check: await seal(CHECK, key, kdf), lastSyncedAt: null });
        setStatus('ready');
        await syncNow();
      },
      async unlock(passphrase, remember) {
        const local = localRef.current ?? (await loadLocal(userId)) ?? null;
        let remote: VaultRow | null = null;
        try {
          remote = await fetchVault(client);
        } catch (e) {
          if (!local) throw e;
        }
        const kdf: KdfParams | undefined = remote?.kdf ?? local?.kdf;
        if (!kdf) throw new Error('Nothing to unlock yet.');
        const key = await deriveKey(passphrase, kdf);
        if (remote) {
          const parsed = parseFinanceDoc(await open(remote, key)); // throws WrongPassphraseError
          if ('error' in parsed) throw new Error(parsed.error);
          const doc0 = local?.dirty ? mergeDocs(local.doc, parsed.doc) : parsed.doc;
          await persist({ doc: doc0, baseRevision: remote.revision, dirty: !!local?.dirty, kdf: remote.kdf, check: await seal(CHECK, key, remote.kdf), lastSyncedAt: new Date().toISOString() });
        } else if (local) {
          await open(local.check, key); // offline: check against the local copy
          localRef.current = local;
          setDoc(local.doc);
        }
        keyRef.current = key;
        if (remember) await saveKey(userId, key);
        else await forgetKey(userId);
        setStatus('ready');
        void syncNow();
      },
      async lock() {
        if (timer.current) window.clearTimeout(timer.current);
        await syncNow();
        keyRef.current = null;
        await forgetKey(userId);
        setDoc(null);
        setStatus('locked');
      },
      async update(fn) {
        const cur = localRef.current;
        if (!cur) throw new Error('Finance isn’t open.');
        await persist({ ...cur, doc: fn(cur.doc), dirty: true });
        schedule();
      },
      async updateSettings(patch) {
        const cur = localRef.current;
        if (!cur) throw new Error('Finance isn’t open.');
        await persist({ ...cur, doc: { ...cur.doc, settings: { ...cur.doc.settings, ...patch, updatedAt: new Date().toISOString() } }, dirty: true });
        schedule();
      },
      syncNow,
      async changePassphrase(current, next) {
        const cur = localRef.current;
        if (!cur || !keyRef.current) throw new Error('Unlock first.');
        await open(cur.check, await deriveKey(current, cur.kdf)); // throws if wrong
        await syncNow();
        const kdf = newKdfParams();
        const key = await deriveKey(next, kdf);
        const latest = localRef.current as LocalState;
        const remote = await fetchVault(client);
        const sealed = await seal(latest.doc, key, kdf);
        const rev = remote ? await updateVault(client, sealed, remote.revision, device) : (await createVault(client, sealed, device)) ? 1 : null;
        if (rev === null) throw new Error('Another device saved at the same moment. Try again.');
        keyRef.current = key;
        if (await loadKey(userId)) await saveKey(userId, key);
        await persist({ ...latest, kdf, check: await seal(CHECK, key, kdf), baseRevision: rev, dirty: false, lastSyncedAt: new Date().toISOString() });
        setSync({ state: 'synced', lastSyncedAt: new Date().toISOString(), message: null });
      },
      async restore(raw) {
        const parsed = parseFinanceDoc(raw);
        if ('error' in parsed) throw new Error(parsed.error);
        const cur = localRef.current;
        if (!cur) throw new Error('Finance isn’t open.');
        const before = new Set(cur.doc.transactions.map((t) => t.id));
        const merged = mergeDocs(cur.doc, parsed.doc);
        await persist({ ...cur, doc: merged, dirty: true });
        schedule();
        return { added: merged.transactions.filter((t) => !before.has(t.id)).length };
      },
      async forgetDevice() {
        await syncNow();
        keyRef.current = null;
        localRef.current = null;
        await forgetLocal(userId);
        setDoc(null);
        setStatus('locked');
      },
    }),
    [status, error, doc, sync, userId, client, device, persist, syncNow, schedule],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
