/**
 * Domain models. Kept storage-agnostic so a future backend (Firebase,
 * Supabase, …) can reuse them unchanged.
 */

/**
 * Categories are open strings so new ones (e.g. from imported workbooks)
 * work without code changes. Known categories get rich metadata in
 * constants/getCategoryMeta; unknown ones get a generated fallback.
 */
export type MealCategory = string;

/** Macro-nutrients per meal. Missing values default to 0. */
export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
}

/** A catalog entry. Logs reference meals by `id` only — never by name. */
export interface Meal {
  id: string;
  name: string;
  category: MealCategory;
  nutrition: Nutrition;
  /** Auto-assigned emoji (utils/icons.ts); falls back to category emoji. */
  icon?: string;
  createdAt: string; // ISO timestamp
}

/** One logged lunch. Exactly one per user per date. */
export interface MealLog {
  email: string;
  date: string; // YYYY-MM-DD
  mealId: string;
  loggedAt: string; // ISO timestamp
}

/**
 * Local user identity. Replace with a Google-auth profile later —
 * only `email` is used as the identifier throughout the app.
 */
export interface UserProfile {
  email: string;
  createdAt: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export interface ImportSummary {
  imported: number;
  duplicates: number;
  invalid: number;
}

/** Result of a file import, including macro-workbook detection. */
export interface ImportResult {
  summary: ImportSummary;
  /** True when the source workbook contained VBA (never executed). */
  hasMacros: boolean;
}

export type ExportFormat = 'xlsx' | 'csv';

// ---------- Goals & achievements ----------

/** User-configurable goal targets. A category target of 0 disables it. */
export interface GoalSettings {
  /** Total distinct logged days to aim for. */
  totalDays: number;
  categoryTargets: Record<MealCategory, number>;
}

export interface CategoryGoalProgress {
  category: MealCategory;
  count: number;
  target: number;
  remaining: number;
  /** 0–100, capped. */
  percent: number;
  complete: boolean;
  /** target > 0 */
  enabled: boolean;
}

/** Snapshot of all goal progress, derived from logs — never persisted. */
export interface GoalProgress {
  days: {
    count: number;
    target: number;
    remaining: number;
    percent: number;
    complete: boolean;
  };
  categories: CategoryGoalProgress[];
  /** All enabled category goals (two or more) are complete. */
  balanceComplete: boolean;
  /** Days goal AND every enabled category goal complete. */
  championComplete: boolean;
}

/**
 * Achievement identifiers. Adding new goal types (streaks, weekly goals,
 * calories …) means adding ids here plus detection logic in GoalService.
 */
export type AchievementId =
  | 'days_goal'
  | 'balance'
  | 'nutrition_champion'
  | `category_${string}`;

/** id → ISO timestamp of when it was awarded. Persisted per user. */
export type AchievementMap = Partial<Record<AchievementId, string>>;

// ---------- Google Tasks sync ----------

export interface SyncSettings {
  connected: boolean;
  enabled: boolean;
  taskListId: string | null;
  taskListTitle: string | null;
  lastSyncAt: string | null;
  /** Whether the user already chose future-only vs full-history sync. */
  historyChoiceMade: boolean;
}

export type SyncStatus = 'disconnected' | 'idle' | 'syncing' | 'error';

export interface TaskListInfo {
  id: string;
  title: string;
}
