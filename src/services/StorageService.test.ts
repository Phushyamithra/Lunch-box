import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants';
import { MemoryStorageAdapter } from '../test/MemoryStorageAdapter';
import { StorageService } from './StorageService';

const email = 'me@example.com';

describe('StorageService log storage', () => {
  it('migrates legacy single-log-per-day data to arrays with id = date', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(STORAGE_KEYS.logs, {
      [email]: { '2026-01-05': { email, date: '2026-01-05', mealId: 'm1', loggedAt: 'x' } },
    });
    const logs = await new StorageService(adapter).getAllLogs(email);
    expect(logs['2026-01-05']).toEqual([
      { id: '2026-01-05', email, date: '2026-01-05', mealId: 'm1', loggedAt: 'x' },
    ]);
  });

  it('upserts by log id and removes empty days on delete', async () => {
    const storage = new StorageService(new MemoryStorageAdapter());
    const base = { email, date: '2026-10-01', loggedAt: 'x' };
    await storage.saveMealLog({ ...base, id: 'l1', mealId: 'm1' });
    await storage.saveMealLog({ ...base, id: 'l2', mealId: 'm2' });
    await storage.saveMealLog({ ...base, id: 'l1', mealId: 'm3' }); // edit
    const day = await storage.getLogsForDate(email, '2026-10-01');
    expect(day.map((l) => [l.id, l.mealId])).toEqual([
      ['l2', 'm2'],
      ['l1', 'm3'],
    ]);

    await storage.deleteMealLog(email, '2026-10-01', 'l1');
    await storage.deleteMealLog(email, '2026-10-01', 'l2');
    expect(await storage.getLogsForDate(email, '2026-10-01')).toEqual([]);
    expect(Object.keys(await storage.getAllLogs(email))).toEqual([]);
  });

  it('keeps users isolated', async () => {
    const storage = new StorageService(new MemoryStorageAdapter());
    await storage.saveMealLog({ id: 'l1', email, date: '2026-10-01', mealId: 'm', loggedAt: 'x' });
    expect(await storage.getAllLogs('other@example.com')).toEqual({});
  });
});
