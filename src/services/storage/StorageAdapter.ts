/**
 * Low-level key/value persistence contract.
 *
 * This is the ONLY seam that touches a concrete storage backend.
 * Swapping Chrome Storage for Firebase/Supabase/IndexedDB later means
 * writing one new adapter — StorageService and the UI stay untouched.
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}
