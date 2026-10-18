import { EMPTY_NUTRITION, STORAGE_KEYS } from '../../../src/constants';
import type { LunchBoxBackup } from '../../../src/core/backupFormat';
import { normalizeUserLogs } from '../../../src/core/logs';
import type { Nutrition } from '../../../src/models';

export interface PlannedCategory {
  legacyId: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  enabled: boolean;
}

export interface PlannedMeal {
  legacyId: string;
  categoryLegacyId: string;
  name: string;
  icon: string | null;
  nutrition: Nutrition;
  /** Placeholder for a meal that logs reference but the catalog lost. */
  archived: boolean;
}

export interface PlannedLog {
  legacyId: string;
  mealLegacyId: string;
  logDate: string; // YYYY-MM-DD
  loggedAt: string; // ISO
  externalTaskId: string | null;
}

export interface ImportPlan {
  exportedAt: string;
  categories: PlannedCategory[];
  meals: PlannedMeal[];
  logs: PlannedLog[];
  goalSettings: unknown;
  achievements: Record<string, unknown>;
  /** Accounts (extension emails) whose logs are included. */
  emails: string[];
  warnings: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_ICON = '🍽️';
const DEFAULT_COLOR = '#B46060';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function sanitizeNutrition(raw: unknown): Nutrition {
  const source = asRecord(raw);
  const clean = { ...EMPTY_NUTRITION };
  for (const key of Object.keys(clean) as (keyof Nutrition)[]) {
    const value = Number(source[key]);
    clean[key] = Number.isFinite(value) && value > 0 ? value : 0;
  }
  return clean;
}

function isRealDate(date: string): boolean {
  return DATE_RE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
}

/**
 * Turns an extension backup into rows for the cloud, without touching the
 * database. Nothing is dropped silently: logs whose meal was deleted from
 * the catalog get an archived placeholder meal, and every skipped record
 * is reported in `warnings`. Legacy ids make the import idempotent.
 */
export function planImport(backup: LunchBoxBackup): ImportPlan {
  const data = backup.data;
  const warnings: string[] = [];

  // ---------- Categories ----------
  const categories: PlannedCategory[] = [];
  const categoryByName = new Map<string, PlannedCategory>();
  const addCategory = (category: PlannedCategory): PlannedCategory => {
    const key = category.name.toLowerCase();
    const existing = categoryByName.get(key);
    if (existing) return existing;
    categoryByName.set(key, category);
    categories.push(category);
    return category;
  };

  const rawCategories = Array.isArray(data[STORAGE_KEYS.categories]) ? (data[STORAGE_KEYS.categories] as unknown[]) : [];
  rawCategories.forEach((raw, index) => {
    const c = asRecord(raw);
    const name = str(c.name);
    if (!name) {
      warnings.push(`Skipped a category with no name (position ${index + 1}).`);
      return;
    }
    addCategory({
      legacyId: str(c.id) || `name:${name.toLowerCase()}`,
      name,
      icon: str(c.icon) || DEFAULT_ICON,
      color: str(c.color) || DEFAULT_COLOR,
      sortOrder: Number.isFinite(Number(c.order)) ? Number(c.order) : index,
      enabled: c.enabled !== false,
    });
  });
  const categoryFor = (name: string): PlannedCategory =>
    addCategory({
      legacyId: `name:${name.toLowerCase()}`,
      name,
      icon: DEFAULT_ICON,
      color: DEFAULT_COLOR,
      sortOrder: categories.length,
      enabled: true,
    });

  // ---------- Meals ----------
  const meals: PlannedMeal[] = [];
  const mealIds = new Set<string>();
  const rawMeals = Array.isArray(data[STORAGE_KEYS.meals]) ? (data[STORAGE_KEYS.meals] as unknown[]) : [];
  rawMeals.forEach((raw, index) => {
    const m = asRecord(raw);
    const id = str(m.id);
    const name = str(m.name);
    if (!id || !name) {
      warnings.push(`Skipped a meal with no ${id ? 'name' : 'id'} (position ${index + 1}).`);
      return;
    }
    if (mealIds.has(id)) return;
    mealIds.add(id);
    meals.push({
      legacyId: id,
      categoryLegacyId: categoryFor(str(m.category) || 'Uncategorized').legacyId,
      name,
      icon: str(m.icon) || null,
      nutrition: sanitizeNutrition(m.nutrition),
      archived: false,
    });
  });

  // ---------- Logs (every extension account in the backup) ----------
  const logsRoot = asRecord(data[STORAGE_KEYS.logs]);
  const syncRoot = asRecord(data[STORAGE_KEYS.syncTasks]);
  const logs: PlannedLog[] = [];
  const seenLogs = new Set<string>();
  let missingMealLogs = 0;
  const emails = Object.keys(logsRoot).sort();

  for (const email of emails) {
    const byDate = normalizeUserLogs(logsRoot[email]);
    const taskMap = asRecord(syncRoot[email]);
    for (const [date, dayLogs] of Object.entries(byDate)) {
      if (!isRealDate(date)) {
        warnings.push(`Skipped ${dayLogs.length} log(s) under an invalid date "${date}".`);
        continue;
      }
      for (const log of dayLogs) {
        const legacyId = `${email}:${log.id}`;
        if (seenLogs.has(legacyId)) continue;
        seenLogs.add(legacyId);
        const mealId = str(log.mealId);
        if (!mealId) {
          warnings.push(`Skipped a log on ${date} with no meal.`);
          continue;
        }
        if (!mealIds.has(mealId)) {
          // The meal was deleted from the catalog; keep the history.
          mealIds.add(mealId);
          missingMealLogs += 1;
          meals.push({
            legacyId: mealId,
            categoryLegacyId: categoryFor('Uncategorized').legacyId,
            name: 'Deleted meal',
            icon: null,
            nutrition: { ...EMPTY_NUTRITION },
            archived: true,
          });
        }
        const loggedAt = str(log.loggedAt);
        const taskId = str(taskMap[log.id]);
        logs.push({
          legacyId,
          mealLegacyId: mealId,
          logDate: date,
          loggedAt: loggedAt && !Number.isNaN(Date.parse(loggedAt)) ? loggedAt : `${date}T12:00:00.000Z`,
          externalTaskId: taskId || null,
        });
      }
    }
  }
  if (missingMealLogs > 0) {
    warnings.push(
      'Some logs point to meals that were deleted from the catalog. They are kept, under an archived "Deleted meal".',
    );
  }
  if (emails.length > 1) {
    warnings.push(`Logs from ${emails.length} extension accounts are merged: ${emails.join(', ')}.`);
  }

  // Achievements are per email in the extension; merge, keeping the earliest date.
  const achievements: Record<string, unknown> = {};
  for (const map of Object.values(asRecord(data[STORAGE_KEYS.achievements]))) {
    for (const [id, at] of Object.entries(asRecord(map))) {
      const current = achievements[id];
      if (typeof at === 'string' && (typeof current !== 'string' || at < current)) achievements[id] = at;
    }
  }

  logs.sort((a, b) => a.logDate.localeCompare(b.logDate) || a.loggedAt.localeCompare(b.loggedAt));

  return {
    exportedAt: backup.exportedAt,
    categories,
    meals,
    logs,
    goalSettings: data[STORAGE_KEYS.goals] ?? null,
    achievements,
    emails,
    warnings,
  };
}
