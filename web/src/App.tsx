import { MotionConfig } from 'framer-motion';
import { Box, CircularProgress, CssBaseline, GlobalStyles, useMediaQuery } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import type { SupabaseClient } from '@supabase/supabase-js';
import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ThemeMode } from '../../src/models';
import { createTrackerTheme } from './theme';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SignIn } from './auth/SignIn';
import { AppShell } from './layout/AppShell';
import { supabase } from './lib/supabase';
import Home from './pages/Home';
import { SetupRequired } from './pages/SetupRequired';
import { FitnessProvider } from './fitness/FitnessContext';
import { FitnessLayout } from './fitness/ui';
import { FoodProvider } from './food/FoodContext';
import { FinanceProvider } from './finance/FinanceContext';
import { FinanceLayout } from './finance/ui';
import { GoalsProvider } from './goals/GoalsContext';
import { GoalsLayout } from './goals/ui';
import { NutritionProvider } from './nutrition/NutritionContext';
import { NutritionLayout } from './nutrition/ui';
import { SnackbarProvider } from './layout/Snackbar';
import { SettingsProvider, useSettings } from './settings/SettingsContext';

const Settings = lazy(() => import('./pages/Settings'));
const FoodPage = lazy(() => import('./food/FoodPage'));
const ImportPage = lazy(() => import('./food/ImportPage'));
const PlanPage = lazy(() => import('./food/PlanPage'));
const MealsPage = lazy(() => import('./food/MealsPage'));
const CategoriesPage = lazy(() => import('./food/CategoriesPage'));
const FitnessToday = lazy(() => import('./fitness/TodayPage'));
const FitnessDashboard = lazy(() => import('./fitness/DashboardPage'));
const FitnessTraining = lazy(() => import('./fitness/TrainingPage'));
const FitnessProgram = lazy(() => import('./fitness/ProgramPage'));
const FitnessReview = lazy(() => import('./fitness/ReviewPage'));
const FitnessSettings = lazy(() => import('./fitness/FitnessSettingsPage'));
const NutritionOverview = lazy(() => import('./nutrition/OverviewPage'));
const NutritionToday = lazy(() => import('./nutrition/TodayPage'));
const NutritionFoods = lazy(() => import('./nutrition/FoodsPage'));
const NutritionTrends = lazy(() => import('./nutrition/TrendsPage'));
const NutritionData = lazy(() => import('./nutrition/DataPage'));
const GoalsPage = lazy(() => import('./goals/GoalsPage'));
const GoalsTimeline = lazy(() => import('./goals/TimelinePage'));
const FinanceToday = lazy(() => import('./finance/TodayPage'));
const FinanceTransactions = lazy(() => import('./finance/TransactionsPage'));
const FinanceMonth = lazy(() => import('./finance/MonthPage'));
const FinanceCards = lazy(() => import('./finance/CardsPage'));
const FinanceSavings = lazy(() => import('./finance/SavingsPage'));
const FinancePlan = lazy(() => import('./finance/PlanPage'));
const FinanceBank = lazy(() => import('./finance/BankPage'));
const FinanceSettingsPage = lazy(() => import('./finance/SettingsPage'));
const NutritionTargets = lazy(() => import('./nutrition/TargetsPage'));

/** Tracker design system (cream, peach, rose, charcoal), dark by default. */
function Themed({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  const theme = useMemo(() => createTrackerTheme(resolved), [resolved]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{ html: { backgroundColor: theme.palette.background.default } }} />
      {children}
    </ThemeProvider>
  );
}

function Splash() {
  return (
    <Box sx={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={32} aria-label="Loading" />
    </Box>
  );
}

function SignedInApp({ client, userId }: { client: SupabaseClient; userId: string }) {
  const { settings } = useSettings();
  return (
    <Themed mode={settings.themeMode}>
      <SnackbarProvider>
        <FoodProvider client={client}>
          <FitnessProvider client={client}>
          <NutritionProvider client={client}>
          <GoalsProvider client={client}>
          <FinanceProvider client={client} userId={userId}>
            <MotionConfig reducedMotion="user">
            <BrowserRouter>
              <Suspense fallback={<Splash />}>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<Home />} />
                    <Route path="nutrition" element={<NutritionLayout />}>
                      <Route index element={<NutritionToday />} />
                      <Route path="overview" element={<NutritionOverview />} />
                      <Route path="foods" element={<NutritionFoods />} />
                      <Route path="trends" element={<NutritionTrends />} />
                      <Route path="data" element={<NutritionData />} />
                      <Route path="targets" element={<NutritionTargets />} />
                    </Route>
                    <Route path="food" element={<FoodPage />} />
                    <Route path="food/import" element={<ImportPage client={client} />} />
                    <Route path="food/plan" element={<PlanPage />} />
                    <Route path="food/meals" element={<MealsPage />} />
                    <Route path="food/categories" element={<CategoriesPage />} />
                    <Route path="fitness" element={<FitnessLayout />}>
                      <Route index element={<FitnessToday />} />
                      <Route path="dashboard" element={<FitnessDashboard />} />
                      <Route path="training" element={<FitnessTraining />} />
                      <Route path="program" element={<FitnessProgram />} />
                      <Route path="review" element={<FitnessReview />} />
                      <Route path="settings" element={<FitnessSettings />} />
                    </Route>
                    <Route path="finance" element={<FinanceLayout />}>
                      <Route index element={<FinanceToday />} />
                      <Route path="month" element={<FinanceMonth />} />
                      <Route path="cards" element={<FinanceCards />} />
                      <Route path="savings" element={<FinanceSavings />} />
                      <Route path="plan" element={<FinancePlan />} />
                      <Route path="bank" element={<FinanceBank />} />
                      <Route path="transactions" element={<FinanceTransactions />} />
                      <Route path="settings" element={<FinanceSettingsPage />} />
                    </Route>
                    <Route path="goals" element={<GoalsLayout />}>
                      <Route index element={<GoalsPage />} />
                      <Route path="timeline" element={<GoalsTimeline />} />
                    </Route>
                    <Route path="settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
            </MotionConfig>
          </FinanceProvider>
          </GoalsProvider>
          </NutritionProvider>
          </FitnessProvider>
        </FoodProvider>
      </SnackbarProvider>
    </Themed>
  );
}

function AuthGate({ client }: { client: SupabaseClient }) {
  const { loading, session } = useAuth();
  if (loading) {
    return (
      <Themed mode="dark">
        <Splash />
      </Themed>
    );
  }
  if (!session) {
    return (
      <Themed mode="dark">
        <SignIn />
      </Themed>
    );
  }
  return (
    // Keyed by user so signing in as someone else never reuses state.
    <SettingsProvider key={session.user.id} client={client} userId={session.user.id}>
      <SignedInApp client={client} userId={session.user.id} />
    </SettingsProvider>
  );
}

export default function App() {
  if (!supabase) {
    return (
      <Themed mode="dark">
        <SetupRequired />
      </Themed>
    );
  }
  return (
    <AuthProvider client={supabase}>
      <AuthGate client={supabase} />
    </AuthProvider>
  );
}
