import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Meal, MealLog } from '../models';
import { MemoryStorageAdapter } from '../test/MemoryStorageAdapter';
import { GoogleTasksSyncService } from './GoogleTasksSyncService';
import { StorageService } from './StorageService';

const email = 'me@example.com';
const meal: Meal = {
  id: 'm1',
  name: 'Paneer Sandwich',
  category: 'Sandwich',
  icon: '🥪',
  nutrition: { calories: 400, protein: 20, carbs: 40, fiber: 4, fat: 12 },
  createdAt: 'x',
};
const log: MealLog = { id: 'log_1', email, date: '2026-10-01', mealId: 'm1', loggedAt: 'x' };

/** Records Google Tasks API calls and answers like the real endpoints. */
function stubFetch(responses: Partial<Record<string, number>> = {}) {
  const calls: { method: string; url: string; body?: Record<string, unknown> }[] = [];
  let nextId = 1;
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const status = responses[method] ?? 200;
    if (status !== 200) return new Response(JSON.stringify({ error: { message: 'x' } }), { status });
    return new Response(JSON.stringify({ id: `task-${nextId++}` }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

async function connectedService() {
  const storage = new StorageService(new MemoryStorageAdapter());
  await storage.saveSyncSettings({
    connected: true,
    accountEmail: email,
    enabled: true,
    taskListId: 'list-1',
    taskListTitle: 'Meal Tracker',
    lastSyncAt: null,
    historyChoiceMade: true,
  });
  await storage.saveSyncToken({ token: 'tok', expiresAt: Date.now() + 3_600_000 });
  return { storage, service: new GoogleTasksSyncService(storage) };
}

beforeEach(() => {
  vi.stubGlobal('chrome', {
    identity: { launchWebAuthFlow: vi.fn(), getRedirectURL: () => 'https://id.chromiumapp.org/' },
    runtime: { getManifest: () => ({ oauth2: { client_id: 'client' } }) },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('GoogleTasksSyncService (one-way push, existing behavior)', () => {
  it('creates one completed task per log and remembers its id', async () => {
    const calls = stubFetch();
    const { storage, service } = await connectedService();
    await service.upsertLogTask(log, meal);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toMatchObject({ title: '🥪 Paneer Sandwich', status: 'completed' });
    expect(await storage.getSyncTaskMap(email)).toEqual({ log_1: 'task-1' });
  });

  it('re-syncing the same log patches the existing task instead of duplicating it', async () => {
    const calls = stubFetch();
    const { storage, service } = await connectedService();
    await service.upsertLogTask(log, meal);
    await service.upsertLogTask(log, meal);
    expect(calls.map((c) => c.method)).toEqual(['POST', 'PATCH']);
    expect(calls[1].url).toContain('/lists/list-1/tasks/task-1');
    expect(await storage.getSyncTaskMap(email)).toEqual({ log_1: 'task-1' });
  });

  it('recreates the task when it was deleted in Google Tasks (404)', async () => {
    const { storage, service } = await connectedService();
    await storage.saveSyncTaskMap(email, { log_1: 'gone' });
    const calls = stubFetch({ PATCH: 404 });
    await service.upsertLogTask(log, meal);
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'POST']);
    expect(await storage.getSyncTaskMap(email)).toEqual({ log_1: 'task-1' });
  });

  it('does nothing while sync is disabled', async () => {
    const calls = stubFetch();
    const { service } = await connectedService();
    await service.setEnabled(false);
    await service.upsertLogTask(log, meal);
    expect(calls).toHaveLength(0);
  });

  it('deleting a log deletes its task and the mapping', async () => {
    const { storage, service } = await connectedService();
    await storage.saveSyncTaskMap(email, { log_1: 'task-9' });
    const calls = stubFetch();
    await service.deleteLogTask(email, 'log_1');
    expect(calls[0]).toMatchObject({ method: 'DELETE' });
    expect(await storage.getSyncTaskMap(email)).toEqual({});
  });
});
