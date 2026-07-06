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
import { DEFAULT_GOAL_SETTINGS } from '../constants';
import type {
  AchievementId,
  AchievementMap,
  ExportFormat,
  GoalProgress,
  GoalSettings,
  ImportSummary,
  Meal,
  MealCategory,
  MealLog,
  ThemeMode,
  UserProfile,
} from '../models';
import { goalService } from '../services/GoalService';
import { mealService } from '../services/MealService';
import { storageService, type LogsByDate } from '../services/StorageService';
import { themeService } from '../services/ThemeService';
import { createId } from '../utils/id';

interface AppDataValue {
  loading: boolean;
  user: UserProfile | null;
  meals: Meal[];
  mealById: Map<string, Meal>;
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

  logMeal: (date: string, mealId: string) => Promise<void>;
  deleteLog: (date: string) => Promise<void>;

  addMeal: (name: string, category: MealCategory) => Promise<void>;
  updateMeal: (id: string, name: string, category: MealCategory) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;

  importFromFile: (file: File) => Promise<ImportSummary>;
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
 * through the service layer.
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
      const log: MealLog = {
        email: state.user.email,
        date,
        mealId,
        loggedAt: new Date().toISOString(),
      };
      await storageService.saveMealLog(log);
      setState((s) => ({ ...s, logs: { ...s.logs, [date]: log } }));
    },
    [state.user],
  );

  const deleteLog = useCallback(
    async (date: string) => {
      if (!state.user) return;
      await storageService.deleteMealLog(state.user.email, date);
      setState((s) => {
        const logs = { ...s.logs };
        delete logs[date];
        return { ...s, logs };
      });
    },
    [state.user],
  );

  const addMeal = useCallback(
    async (name: string, category: MealCategory) => {
      mealService.validateNewMeal(name, category, state.meals);
      const meal: Meal = {
        id: createId('meal'),
        name: name.trim(),
        category,
        createdAt: new Date().toISOString(),
      };
      await storageService.saveMeal(meal);
      setState((s) => ({ ...s, meals: [...s.meals, meal] }));
    },
    [state.meals],
  );

  const updateMeal = useCallback(
    async (id: string, name: string, category: MealCategory) => {
      mealService.validateNewMeal(name, category, state.meals, id);
      const existing = state.meals.find((m) => m.id === id);
      if (!existing) throw new Error('Meal not found.');
      const updated: Meal = { ...existing, name: name.trim(), category };
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
    async (file: File): Promise<ImportSummary> => {
      // SheetJS is heavy — loaded on demand so popup startup stays fast.
      const { parseSpreadsheet } = await import('../utils/spreadsheet');
      const rows = await parseSpreadsheet(file);
      const { meals: newMeals, summary } = mealService.buildImport(rows, state.meals);
      if (newMeals.length > 0) {
        await storageService.importMeals(newMeals);
        setState((s) => ({ ...s, meals: [...s.meals, ...newMeals] }));
      }
      return summary;
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
