import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants';
import { MemoryStorageAdapter } from '../test/MemoryStorageAdapter';
import { BackupService } from './BackupService';

const now = new Date('2026-10-18T09:30:00.000Z');

async function seededService() {
  const adapter = new MemoryStorageAdapter();
  await adapter.set(STORAGE_KEYS.user, { email: 'me@example.com', createdAt: 'x' });
  await adapter.set(STORAGE_KEYS.meals, [{ id: 'm1', name: 'Paneer Sandwich' }]);
  await adapter.set(STORAGE_KEYS.logs, { 'me@example.com': { '2026-10-01': [{ id: 'l1' }] } });
  await adapter.set(STORAGE_KEYS.syncTasks, { 'me@example.com': { l1: 'task-1' } });
  await adapter.set(STORAGE_KEYS.syncToken, { token: 'secret', expiresAt: 1 });
  return new BackupService(adapter);
}

describe('BackupService', () => {
  it('copies every stored key verbatim, except the OAuth token', async () => {
    const backup = await (await seededService()).createBackup(now);
    expect(backup).toMatchObject({ format: 'lunchbox-backup', schemaVersion: 1, exportedAt: now.toISOString() });
    expect(backup.data[STORAGE_KEYS.logs]).toEqual({ 'me@example.com': { '2026-10-01': [{ id: 'l1' }] } });
    expect(backup.data[STORAGE_KEYS.syncTasks]).toEqual({ 'me@example.com': { l1: 'task-1' } });
    expect(STORAGE_KEYS.syncToken in backup.data).toBe(false);
    expect(JSON.stringify(backup)).not.toContain('secret');
  });

  it('omits keys that were never written', async () => {
    const backup = await new BackupService(new MemoryStorageAdapter()).createBackup(now);
    expect(backup.data).toEqual({});
  });

  it('round-trips through JSON and validates', async () => {
    const service = await seededService();
    const parsed: unknown = JSON.parse(JSON.stringify(await service.createBackup(now)));
    expect(service.validate(parsed).ok).toBe(true);
    expect(service.backupFileName(await service.createBackup(now))).toBe('lunchbox-backup-2026-10-18.json');
  });

  it('rejects files that are not valid backups', () => {
    const service = new BackupService(new MemoryStorageAdapter());
    const valid = { format: 'lunchbox-backup', schemaVersion: 1, appVersion: '1.4.0', exportedAt: now.toISOString(), data: {} };
    expect(service.validate(null).ok).toBe(false);
    expect(service.validate([]).ok).toBe(false);
    expect(service.validate({ ...valid, format: 'other' }).ok).toBe(false);
    expect(service.validate({ ...valid, schemaVersion: 99 }).ok).toBe(false);
    expect(service.validate({ ...valid, exportedAt: 'yesterday' }).ok).toBe(false);
    expect(service.validate({ ...valid, data: { 'evil.key': 1 } }).ok).toBe(false);
    expect(service.validate({ ...valid, data: { [STORAGE_KEYS.meals]: {} } }).ok).toBe(false);
    expect(service.validate({ ...valid, data: { [STORAGE_KEYS.logs]: [] } }).ok).toBe(false);
  });
});
