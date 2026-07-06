import { ChromeStorageAdapter, isChromeStorageAvailable } from './ChromeStorageAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { StorageAdapter } from './StorageAdapter';

export type { StorageAdapter } from './StorageAdapter';

/** Picks the best available backend at runtime. */
export function createStorageAdapter(): StorageAdapter {
  return isChromeStorageAvailable() ? new ChromeStorageAdapter() : new LocalStorageAdapter();
}
