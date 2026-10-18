import { APP_VERSION, STORAGE_KEYS } from '../constants';
import { storageAdapter } from './StorageService';
import type { StorageAdapter } from './storage';

export const BACKUP_FORMAT = 'lunchbox-backup';
export const BACKUP_SCHEMA_VERSION = 1;

/**
 * Keys never written to a backup. The OAuth access token is a secret and
 * expires within the hour anyway — restoring it would be useless and
 * leaking it into a file on disk is not.
 */
const EXCLUDED_KEYS: ReadonlySet<string> = new Set([STORAGE_KEYS.syncToken]);

/** Every persisted key, verbatim, as stored by the extension. */
export interface LunchBoxBackup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string; // ISO timestamp
  data: Record<string, unknown>;
}

export type BackupValidation =
  | { ok: true; backup: LunchBoxBackup }
  | { ok: false; error: string };

/**
 * Full-fidelity JSON backup of the extension's storage. Values are copied
 * as-is (no normalization), so a backup is a faithful snapshot that the
 * future web app can import and migrate on its side.
 */
export class BackupService {
  constructor(private readonly adapter: StorageAdapter) {}

  async createBackup(now: Date = new Date()): Promise<LunchBoxBackup> {
    const data: Record<string, unknown> = {};
    for (const key of Object.values(STORAGE_KEYS)) {
      if (EXCLUDED_KEYS.has(key)) continue;
      const value = await this.adapter.get<unknown>(key);
      if (value !== null) data[key] = value;
    }
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: now.toISOString(),
      data,
    };
  }

  /** Structural check of a parsed backup file; never trusts its contents. */
  validate(raw: unknown): BackupValidation {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'Not a LunchBox backup file.' };
    }
    const candidate = raw as Partial<LunchBoxBackup>;
    if (candidate.format !== BACKUP_FORMAT) {
      return { ok: false, error: 'Not a LunchBox backup file.' };
    }
    if (typeof candidate.schemaVersion !== 'number' || candidate.schemaVersion > BACKUP_SCHEMA_VERSION) {
      return { ok: false, error: 'This backup was made by a newer version of LunchBox.' };
    }
    if (typeof candidate.exportedAt !== 'string' || Number.isNaN(Date.parse(candidate.exportedAt))) {
      return { ok: false, error: 'Backup is missing a valid export date.' };
    }
    const data = candidate.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'Backup has no data section.' };
    }
    const known = new Set<string>(Object.values(STORAGE_KEYS));
    const unknownKey = Object.keys(data).find((k) => !known.has(k));
    if (unknownKey) return { ok: false, error: `Backup contains an unknown key: ${unknownKey}` };
    if (STORAGE_KEYS.meals in data && !Array.isArray(data[STORAGE_KEYS.meals])) {
      return { ok: false, error: 'Backup meal catalog is malformed.' };
    }
    const logs = data[STORAGE_KEYS.logs];
    if (logs !== undefined && (!logs || typeof logs !== 'object' || Array.isArray(logs))) {
      return { ok: false, error: 'Backup meal logs are malformed.' };
    }
    return { ok: true, backup: candidate as LunchBoxBackup };
  }

  backupFileName(backup: LunchBoxBackup): string {
    return `lunchbox-backup-${backup.exportedAt.slice(0, 10)}.json`;
  }
}

export const backupService = new BackupService(storageAdapter);

/** Triggers a browser download of the backup as pretty-printed JSON. */
export function downloadBackup(backup: LunchBoxBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupService.backupFileName(backup);
  link.click();
  URL.revokeObjectURL(url);
}
