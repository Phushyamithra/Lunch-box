import { APP_VERSION, STORAGE_KEYS } from '../constants';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  validateBackup,
  type BackupValidation,
  type LunchBoxBackup,
} from '../core/backupFormat';
import { storageAdapter } from './StorageService';
import type { StorageAdapter } from './storage';

export {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  type BackupValidation,
  type LunchBoxBackup,
} from '../core/backupFormat';

/**
 * Keys never written to a backup. The OAuth access token is a secret and
 * expires within the hour anyway — restoring it would be useless and
 * leaking it into a file on disk is not.
 */
const EXCLUDED_KEYS: ReadonlySet<string> = new Set([STORAGE_KEYS.syncToken]);

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

  /** Structural check of a parsed backup file — see core/backupFormat. */
  validate(raw: unknown): BackupValidation {
    return validateBackup(raw);
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
