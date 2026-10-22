import { describe, expect, it } from 'vitest';
import { cachedLoad, cachedModules, isNetworkError, type CacheStore } from './offlineCache';

const memory = (): CacheStore & { map: Map<string, unknown> } => {
  const map = new Map<string, unknown>();
  return { map, get: async (k) => map.get(k), put: async (k, v) => void map.set(k, v) };
};
const offline = () => {
  const e = new Error('try again once you’re online.');
  e.name = 'No connection';
  return e;
};

describe('offline cache', () => {
  it('keeps the latest copy and serves it, flagged, when the network is down', async () => {
    const store = memory();
    expect(await cachedLoad('fitness', 'u1', async () => ({ weight: 66.5 }), store)).toEqual({ weight: 66.5 });
    expect(cachedModules().fitness).toBeUndefined();
    const back = await cachedLoad('fitness', 'u1', () => Promise.reject(offline()), store);
    expect(back).toEqual({ weight: 66.5 });
    expect(cachedModules().fitness).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Online again: the flag clears.
    await cachedLoad('fitness', 'u1', async () => ({ weight: 66.7 }), store);
    expect(cachedModules().fitness).toBeUndefined();
  });

  it('never mixes users, and says so when there is nothing saved yet', async () => {
    const store = memory();
    await cachedLoad('goals', 'u1', async () => ['mine'], store);
    await expect(cachedLoad('goals', 'u2', () => Promise.reject(offline()), store)).rejects.toThrow(/hasn’t been loaded on this device/);
  });

  it('real server errors (e.g. a missing table) are not hidden behind the cache', async () => {
    const store = memory();
    await cachedLoad('nutrition', 'u1', async () => 1, store);
    await expect(cachedLoad('nutrition', 'u1', () => Promise.reject(new Error('relation "foods" does not exist')), store)).rejects.toThrow(/relation/);
  });

  it('recognises network failures', () => {
    expect(isNetworkError(offline())).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('permission denied for table goals'))).toBe(false);
  });
});
