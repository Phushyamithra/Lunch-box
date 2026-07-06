import type { StorageAdapter } from './StorageAdapter';

/**
 * Fallback adapter backed by window.localStorage.
 * Used automatically during `vite dev` (plain browser tab, no chrome.* APIs)
 * so the whole app can be developed and tested outside the extension shell.
 */
export class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null; // corrupt entry — treat as missing rather than crash
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    window.localStorage.clear();
  }
}
