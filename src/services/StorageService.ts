import { STORAGE_KEYS } from '../constants';
import type {
  AchievementMap,
  Category,
  GoalSettings,
  Meal,
  MealLog,
  SyncSettings,
  ThemeMode,
  UserProfile,
} from '../models';
import { normalizeUserLogs, type LogsByDate } from '../core/logs';
import { createStorageAdapter, type StorageAdapter } from './storage';

export type { LogsByDate } from '../core/logs';
/** email → LogsByDate. Multi-user ready. */
type LogsRoot = Record<string, LogsByDate>;
/** email → achievements. Multi-user ready. */
type AchievementsRoot = Record<string, AchievementMap>;
/** email → (date → Google Task id). */
type SyncTaskRoot = Record<string, Record<string, string>>;
/** OAuth access token persisted across popup sessions (short-lived). */
export interface StoredSyncToken {
  token: string;
  expiresAt: number; // epoch ms
}

/** Preserved original workbooks (e.g. macro-enabled), base64 by name. */
type WorkbookArchive = Record<string, { base64: string; storedAt: string }>;

/**
 * Domain-level persistence facade. The UI never touches chrome.storage
 * directly — everything flows through this service, so replacing the
 * backing store means swapping the injected StorageAdapter only.
 * Business rules live in MealService / GoalService / sync services.
 */
export class StorageService {
  constructor(private readonly adapter: StorageAdapter) {}

  // ---------- User ----------

  getUser(): Promise<UserProfile | null> {
    return this.adapter.get<UserProfile>(STORAGE_KEYS.user);
  }

  saveUser(user: UserProfile): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.user, user);
  }

  // ---------- Meal catalog ----------

  async getMeals(): Promise<Meal[]> {
    return (await this.adapter.get<Meal[]>(STORAGE_KEYS.meals)) ?? [];
  }

  setMeals(meals: Meal[]): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.meals, meals);
  }

  async saveMeal(meal: Meal): Promise<void> {
    const meals = await this.getMeals();
    await this.setMeals([...meals, meal]);
  }

  async updateMeal(meal: Meal): Promise<void> {
    const meals = await this.getMeals();
    await this.setMeals(meals.map((m) => (m.id === meal.id ? meal : m)));
  }

  async deleteMeal(id: string): Promise<void> {
    const meals = await this.getMeals();
    await this.setMeals(meals.filter((m) => m.id !== id));
  }

  async importMeals(newMeals: Meal[]): Promise<void> {
    const meals = await this.getMeals();
    await this.setMeals([...meals, ...newMeals]);
  }

  // ---------- Meal logs ----------

  private async getLogsRoot(): Promise<LogsRoot> {
    return (await this.adapter.get<LogsRoot>(STORAGE_KEYS.logs)) ?? {};
  }

  /** Migrates legacy shape (one log object per date) on read — see core/logs. */
  private normalizeUserLogs(raw: unknown): LogsByDate {
    return normalizeUserLogs(raw);
  }

  async getAllLogs(email: string): Promise<LogsByDate> {
    return this.normalizeUserLogs((await this.getLogsRoot())[email]);
  }

  async getLogsForDate(email: string, date: string): Promise<MealLog[]> {
    return (await this.getAllLogs(email))[date] ?? [];
  }

  /** @param monthKey YYYY-MM */
  async getMonthlyLogs(email: string, monthKey: string): Promise<LogsByDate> {
    const logs = await this.getAllLogs(email);
    return Object.fromEntries(
      Object.entries(logs).filter(([date]) => date.startsWith(monthKey)),
    );
  }

  /** Upserts by log id — appends a new log or replaces an edited one. */
  async saveMealLog(log: MealLog): Promise<void> {
    const root = await this.getLogsRoot();
    const userLogs = this.normalizeUserLogs(root[log.email]);
    const day = userLogs[log.date] ?? [];
    userLogs[log.date] = [...day.filter((l) => l.id !== log.id), log];
    root[log.email] = userLogs;
    await this.adapter.set(STORAGE_KEYS.logs, root);
  }

  /** Same upsert semantics — kept as a named method for intent clarity. */
  updateMealLog(log: MealLog): Promise<void> {
    return this.saveMealLog(log);
  }

  async deleteMealLog(email: string, date: string, logId: string): Promise<void> {
    const root = await this.getLogsRoot();
    const userLogs = this.normalizeUserLogs(root[email]);
    const remaining = (userLogs[date] ?? []).filter((l) => l.id !== logId);
    if (remaining.length > 0) userLogs[date] = remaining;
    else delete userLogs[date];
    root[email] = userLogs;
    await this.adapter.set(STORAGE_KEYS.logs, root);
  }

  async clearLogs(email: string): Promise<void> {
    const root = await this.getLogsRoot();
    delete root[email];
    await this.adapter.set(STORAGE_KEYS.logs, root);
  }

  // ---------- Categories ----------

  async getCategories(): Promise<Category[]> {
    return (await this.adapter.get<Category[]>(STORAGE_KEYS.categories)) ?? [];
  }

  setCategories(categories: Category[]): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.categories, categories);
  }

  async isCategoriesSeeded(): Promise<boolean> {
    return (await this.adapter.get<boolean>(STORAGE_KEYS.categoriesSeeded)) === true;
  }

  markCategoriesSeeded(): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.categoriesSeeded, true);
  }

  // ---------- Goals & achievements (persistence only) ----------

  getGoalSettings(): Promise<GoalSettings | null> {
    return this.adapter.get<GoalSettings>(STORAGE_KEYS.goals);
  }

  saveGoalSettings(settings: GoalSettings): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.goals, settings);
  }

  private async getAchievementsRoot(): Promise<AchievementsRoot> {
    return (await this.adapter.get<AchievementsRoot>(STORAGE_KEYS.achievements)) ?? {};
  }

  async getAchievements(email: string): Promise<AchievementMap> {
    return (await this.getAchievementsRoot())[email] ?? {};
  }

  async saveAchievements(email: string, achievements: AchievementMap): Promise<void> {
    const root = await this.getAchievementsRoot();
    root[email] = achievements;
    await this.adapter.set(STORAGE_KEYS.achievements, root);
  }

  // ---------- Google Tasks sync (persistence only) ----------

  getSyncToken(): Promise<StoredSyncToken | null> {
    return this.adapter.get<StoredSyncToken>(STORAGE_KEYS.syncToken);
  }

  saveSyncToken(token: StoredSyncToken): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.syncToken, token);
  }

  clearSyncToken(): Promise<void> {
    return this.adapter.remove(STORAGE_KEYS.syncToken);
  }

  getSyncSettings(): Promise<SyncSettings | null> {
    return this.adapter.get<SyncSettings>(STORAGE_KEYS.sync);
  }

  saveSyncSettings(settings: SyncSettings): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.sync, settings);
  }

  private async getSyncTaskRoot(): Promise<SyncTaskRoot> {
    return (await this.adapter.get<SyncTaskRoot>(STORAGE_KEYS.syncTasks)) ?? {};
  }

  /** date → Google Task id map for one user. */
  async getSyncTaskMap(email: string): Promise<Record<string, string>> {
    return (await this.getSyncTaskRoot())[email] ?? {};
  }

  async saveSyncTaskMap(email: string, map: Record<string, string>): Promise<void> {
    const root = await this.getSyncTaskRoot();
    root[email] = map;
    await this.adapter.set(STORAGE_KEYS.syncTasks, root);
  }

  // ---------- Original workbook archive ----------

  /** Keeps an imported workbook verbatim (e.g. macro-enabled files). */
  async saveOriginalWorkbook(name: string, base64: string): Promise<void> {
    const archive =
      (await this.adapter.get<WorkbookArchive>(STORAGE_KEYS.workbooks)) ?? {};
    archive[name] = { base64, storedAt: new Date().toISOString() };
    await this.adapter.set(STORAGE_KEYS.workbooks, archive);
  }

  // ---------- Theme ----------

  getThemeMode(): Promise<ThemeMode | null> {
    return this.adapter.get<ThemeMode>(STORAGE_KEYS.theme);
  }

  saveThemeMode(mode: ThemeMode): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.theme, mode);
  }

  // ---------- Seeding / reset ----------

  async isSeeded(): Promise<boolean> {
    return (await this.adapter.get<boolean>(STORAGE_KEYS.seeded)) === true;
  }

  markSeeded(): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.seeded, true);
  }

  async isWorkbookSeeded(): Promise<boolean> {
    return (await this.adapter.get<boolean>(STORAGE_KEYS.workbookSeeded)) === true;
  }

  markWorkbookSeeded(): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.workbookSeeded, true);
  }

  /** Wipes everything — user, catalog, logs, goals, achievements, sync. */
  resetData(): Promise<void> {
    return this.adapter.clear();
  }
}

/** The runtime adapter, shared with BackupService for raw key access. */
export const storageAdapter = createStorageAdapter();

/** App-wide singleton, wired to the best available adapter. */
export const storageService = new StorageService(storageAdapter);
