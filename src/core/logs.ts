import type { MealLog } from '../models';

/** date-key → logs for that day, for a single user. */
export type LogsByDate = Record<string, MealLog[]>;

/**
 * Migrates the extension's legacy shape (one log object per date) to
 * arrays. Legacy logs get id = date, which also matches the old
 * Google Tasks sync map. Shared by the extension and the web importer.
 */
export function normalizeUserLogs(raw: unknown): LogsByDate {
  const result: LogsByDate = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      result[date] = (value as (MealLog & { id?: string })[]).map((log) => ({
        ...log,
        id: log.id ?? date,
      }));
    } else if (value && typeof value === 'object') {
      const legacy = value as Omit<MealLog, 'id'> & { id?: string };
      result[date] = [{ ...legacy, id: legacy.id ?? date }];
    }
  }
  return result;
}
