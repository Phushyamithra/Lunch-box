import { STORAGE_KEYS } from '../constants';

export const BACKUP_FORMAT = 'lunchbox-backup';
export const BACKUP_SCHEMA_VERSION = 1;

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
 * Structural check of a parsed backup file; never trusts its contents.
 * Shared by the extension (BackupService) and the web importer.
 */
export function validateBackup(raw: unknown): BackupValidation {
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
