import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_GOAL_SETTINGS,
  KNOWN_CATEGORY_ORDER,
  MAX_STORED_WORKBOOK_BYTES,
  orderCategories,
} from '../constants';
import type {
  AchievementId,
  AchievementMap,
  ExportFormat,
  GoalProgress,
  GoalSettings,
  ImportResult,
  Meal,
  MealCategory,
  MealLog,
  ThemeMode,
  UserProfile,
} from '../models';
import { goalService } from '../services/GoalService';
import { googleTasksSyncService } from '../services/GoogleTasksSyncService';
import { mealService, type MealInput } from '../services/MealService';
import { storageService, type LogsByDate } from '../services/StorageService';
import { themeService } from '../services/ThemeService';
import { createId } from '../utils/id';

interface AppDataValue {
  loading: boolean;
  user: UserProfile | null;
  meals: Meal[];
  mealById: Map<string, Meal>;
  /** Distinct catalog categories, known-first ordering. */
  categories: MealCategory[];
  /** All logs for the current user, keyed by date (YYYY-MM-DD). */
  logs: LogsByDate;
  themeMode: ThemeMode;

  // Goals & achievements
  goalSettings: GoalSettings;
  achievements: AchievementMap;
  /** Derived live from logs + settings via GoalService. */
  goalProgress: GoalProgress;
  /** Achievements earned but not yet celebrated (FIFO queue). */
  pendingCelebrations: AchievementId[];
  dismissCelebration: () => void;
  updateGoalSettings: (settings: GoalSettings) => Promise<void>;

  saveEmail: (email: string) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;

  /** Adds a log for the day (multiple meals per day are allowed). */
  logMeal: (date: string, mealId: string) => Promise<void>;
  deleteLog: (date: string, logId: string) => Promise<void>;

  addMeal: (input: MealInput) => Promise<void>;
  updateMeal: (id: string, input: MealInput) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;

  importFromFile: (file: File) => Promise<ImportResult>;
  exportCatalog: (format: ExportFormat) => Promise<void>;

  clearLogs: () => Promise<void>;
  resetApp: () => Promise<void>;
}

const AppDataContext = createContext<AppDataValue | null>(null);

interface State {
  loading: boolean;
  user: UserProfile | null;
  meals: Meal[];
  logs: LogsByDate;
  themeMode: ThemeMode;
  goalSettings: GoalSettings;
  achievements: AchievementMap;
}

const INITIAL_STATE: State = {
  loading: true,
  user: null,
  meals: [],
  logs: {},
  themeMode: 'system',
  goalSettings: DEFAULT_GOAL_SETTINGS,
  achievements: {},
};

/**
 * Single source of truth for app data. Holds an in-memory mirror of the
 * persisted state so every mutation updates the UI instantly, then writes
 * through the service layer. Google Tasks sync is fired best-effort after
 * each log mutation — the extension remains the source of truth.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [pendingCelebrations, setPendingCelebrations] = useState<AchievementId[]>([]);
  /**
   * Email whose achievements were already checked once this session.
   * The first check after load is silent: milestones that were already
   * met historically get recorded without re-triggering confetti.
   */
  const silentCheckDoneFor = useRef<string | null>(null);

  const bootstrap = useCallback(async () => {
    try {
      const [user, themeMode, meals, goalSettings] = await Promise.all([
        storageService.getUser(),
        themeService.getMode(),
        mealService.ensureSeeded(),
        goalService.loadSettings(),
      ]);
      const [logs, achievements] = user
        ? await Promise.all([
            storageService.getAllLogs(user.email),
            goalService.getAchievements(user.email),
          ])
        : [{}, {}];
      setState({ loading: false, user, meals, logs, themeMode, goalSettings, achievements });
    } catch (error) {
      console.error('Failed to load app data', error);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const mealById = useMemo(() => new Map(state.meals.map((m) => [m.id, m])), [state.meals]);

  const categories = useMemo(() => {
    const found = orderCategories(state.meals.map((m) => m.category));
    return found.length > 0 ? found : KNOWN_CATEGORY_ORDER;
  }, [state.meals]);

  const goalProgress = useMemo(
    () => goalService.computeProgress(state.logs, mealById, state.goalSettings),
    [state.logs, mealById, state.goalSettings],
  );

  // Award achievements whenever derived progress crosses a milestone.
  useEffect(() => {
    if (state.loading || !state.user) return;
    const silent = silentCheckDoneFor.current !== state.user.email;
    silentCheckDoneFor.current = state.user.email;

    const earned = goalService.newlyEarned(goalProgress, state.achievements);
    if (earned.length === 0) return;

    const awardedAt = new Date().toISOString();
    const updated: AchievementMap = { ...state.achievements };
    for (const id of earned) updated[id] = awardedAt;

    void goalService.saveAchievements(state.user.email, updated);
    setState((s) => ({ ...s, achievements: updated }));
    if (!silent) setPendingCelebrations((queue) => [...queue, ...earned]);
  }, [goalProgress, state.loading, state.user, state.achievements]);

  const dismissCelebration = useCallback(
    () => setPendingCelebrations((queue) => queue.slice(1)),
    [],
  );

  const updateGoalSettings = useCallback(async (settings: GoalSettings) => {
    await goalService.saveSettings(settings);
    setState((s) => ({ ...s, goalSettings: settings }));
  }, []);

  const saveEmail = useCallback(async (email: string) => {
    const user: UserProfile = {
      email: email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    };
    await storageService.saveUser(user);
    const [logs, achievements] = await Promise.all([
      storageService.getAllLogs(user.email),
      goalService.getAchievements(user.email),
    ]);
    setState((s) => ({ ...s, user, logs, achievements }));
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    await themeService.saveMode(mode);
    setState((s) => ({ ...s, themeMode: mode }));
  }, []);

  const logMeal = useCallback(
    async (date: string, mealId: string) => {
      if (!state.user) return;
      const dayLogs = state.logs[date] ?? [];
      if (dayLogs.some((l) => l.mealId === mealId)) {
        const name = mealById.get(mealId)?.name ?? 'That meal';
        throw new Error(`${name} is already logged for this day.`);
      }
      const log: MealLog = {
        id: createId('log'),
        email: state.user.email,
        date,
        mealId,
        loggedAt: new Date().toISOString(),
      };
      await storageService.saveMealLog(log);
      setState((s) => ({ ...s, logs: { ...s.logs, [date]: [...(s.logs[date] ?? []), log] } }));
      // Best-effort mirror to Google Tasks (no-op unless sync is enabled).
      void googleTasksSyncService.upsertLogTask(log, mealById.get(mealId));
    },
    [state.user, state.logs, mealById],
  );

  const deleteLog = useCallback(
    async (date: string, logId: string) => {
      if (!state.user) return;
      const email = state.user.email;
      await storageService.deleteMealLog(email, date, logId);
      setState((s) => {
        const logs = { ...s.logs };
        const remaining = (logs[date] ?? []).filter((l) => l.id !== logId);
        if (remaining.length > 0) logs[date] = remaining;
        else delete logs[date];
        return { ...s, logs };
      });
      void googleTasksSyncService.deleteLogTask(email, logId);
    },
    [state.user],
  );

  const addMeal = useCallback(
    async (input: MealInput) => {
      mealService.validateNewMeal(input.name, input.category, state.meals);
      const meal = mealService.createMeal(input);
      await storageService.saveMeal(meal);
      setState((s) => ({ ...s, meals: [...s.meals, meal] }));
    },
    [state.meals],
  );

  const updateMeal = useCallback(
    async (id: string, input: MealInput) => {
      mealService.validateNewMeal(input.name, input.category, state.meals, id);
      const existing = state.meals.find((m) => m.id === id);
      if (!existing) throw new Error('Meal not found.');
      const updated: Meal = {
        ...existing,
        name: input.name.trim(),
        category: input.category,
        nutrition: mealService.sanitizeNutrition(input.nutrition),
      };
      await storageService.updateMeal(updated);
      setState((s) => ({ ...s, meals: s.meals.map((m) => (m.id === id ? updated : m)) }));
    },
    [state.meals],
  );

  const deleteMeal = useCallback(async (id: string) => {
    await storageService.deleteMeal(id);
    setState((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) }));
  }, []);

  const importFromFile = useCallback(
    async (file: File): Promise<ImportResult> => {
      // SheetJS is heavy — loaded on demand so popup startup stays fast.
      const { parseSpreadsheet, fileToBase64 } = await import('../utils/spreadsheet');
      const parsed = await parseSpreadsheet(file);
      const { meals: newMeals, summary } = mealService.buildImport(parsed.rows, state.meals);
      if (newMeals.length > 0) {
        await storageService.importMeals(newMeals);
        setState((s) => ({ ...s, meals: [...s.meals, ...newMeals] }));
      }
      // Preserve macro-enabled workbooks verbatim (VBA is never executed).
      if (parsed.hasMacros && file.size <= MAX_STORED_WORKBOOK_BYTES) {
        try {
          await storageService.saveOriginalWorkbook(file.name, await fileToBase64(file));
        } catch (error) {
          console.warn('Could not archive original workbook', error);
        }
      }
      return { summary, hasMacros: parsed.hasMacros };
    },
    [state.meals],
  );

  const exportCatalog = useCallback(
    async (format: ExportFormat) => {
      const { downloadCatalog } = await import('../utils/spreadsheet');
      downloadCatalog(state.meals, format);
    },
    [state.meals],
  );

  const clearLogs = useCallback(async () => {
    if (!state.user) return;
    await storageService.clearLogs(state.user.email);
    setState((s) => ({ ...s, logs: {} }));
  }, [state.user]);

  const resetApp = useCallback(async () => {
    await storageService.resetData();
    silentCheckDoneFor.current = null;
    setPendingCelebrations([]);
    setState({ ...INITIAL_STATE });
    await bootstrap();
  }, [bootstrap]);

  const value = useMemo<AppDataValue>(
    () => ({
      ...state,
      mealById,
      categories,
      goalProgress,
      pendingCelebrations,
      dismissCelebration,
      updateGoalSettings,
      saveEmail,
      setThemeMode,
      logMeal,
      deleteLog,
      addMeal,
      updateMeal,
      deleteMeal,
      importFromFile,
      exportCatalog,
      clearLogs,
      resetApp,
    }),
    [
      state,
      mealById,
      categories,
      goalProgress,
      pendingCelebrations,
      dismissCelebration,
      updateGoalSettings,
      saveEmail,
      setThemeMode,
      logMeal,
      deleteLog,
      addMeal,
      updateMeal,
      deleteMeal,
      importFromFile,
      exportCatalog,
      clearLogs,
      resetApp,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
