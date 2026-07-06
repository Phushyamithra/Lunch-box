import { STORAGE_KEYS } from '../constants';
import type {
  AchievementMap,
  GoalSettings,
  Meal,
  MealLog,
  ThemeMode,
  UserProfile,
} from '../models';
import { createStorageAdapter, type StorageAdapter } from './storage';

/** date-key → log, for a single user. */
export type LogsByDate = Record<string, MealLog>;
/** email → LogsByDate. Multi-user ready. */
type LogsRoot = Record<string, LogsByDate>;
/** email → achievements. Multi-user ready. */
type AchievementsRoot = Record<string, AchievementMap>;

/**
 * Domain-level persistence facade. The UI never touches chrome.storage
 * directly — everything flows through this service, so replacing the
 * backing store means swapping the injected StorageAdapter only.
 * Business rules live in MealService / GoalService, not here.
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

  async getAllLogs(email: string): Promise<LogsByDate> {
    return (await this.getLogsRoot())[email] ?? {};
  }

  async getMealLog(email: string, date: string): Promise<MealLog | null> {
    return (await this.getAllLogs(email))[date] ?? null;
  }

  /** @param monthKey YYYY-MM */
  async getMonthlyLogs(email: string, monthKey: string): Promise<LogsByDate> {
    const logs = await this.getAllLogs(email);
    return Object.fromEntries(
      Object.entries(logs).filter(([date]) => date.startsWith(monthKey)),
    );
  }

  async saveMealLog(log: MealLog): Promise<void> {
    const root = await this.getLogsRoot();
    root[log.email] = { ...root[log.email], [log.date]: log };
    await this.adapter.set(STORAGE_KEYS.logs, root);
  }

  /** Same upsert semantics — kept as a named method for intent clarity. */
  updateMealLog(log: MealLog): Promise<void> {
    return this.saveMealLog(log);
  }

  async deleteMealLog(email: string, date: string): Promise<void> {
    const root = await this.getLogsRoot();
    if (root[email]) {
      delete root[email][date];
      await this.adapter.set(STORAGE_KEYS.logs, root);
    }
  }

  async clearLogs(email: string): Promise<void> {
    const root = await this.getLogsRoot();
    delete root[email];
    await this.adapter.set(STORAGE_KEYS.logs, root);
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

  async isSmoothiesSeeded(): Promise<boolean> {
    return (await this.adapter.get<boolean>(STORAGE_KEYS.smoothiesSeeded)) === true;
  }

  markSmoothiesSeeded(): Promise<void> {
    return this.adapter.set(STORAGE_KEYS.smoothiesSeeded, true);
  }

  /** Wipes everything — user, catalog, logs, goals, achievements, theme. */
  resetData(): Promise<void> {
    return this.adapter.clear();
  }
}

/** App-wide singleton, wired to the best available adapter. */
export const storageService = new StorageService(createStorageAdapter());
