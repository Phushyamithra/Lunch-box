import type { StorageAdapter } from './StorageAdapter';

/** Persists to chrome.storage.local (available in the extension popup). */
export class ChromeStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }
}

export const isChromeStorageAvailable = (): boolean =>
  typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
