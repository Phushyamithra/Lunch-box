import { Box, CircularProgress, CssBaseline, useMediaQuery } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useMemo } from 'react';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { NavigationProvider, useNavigation, type Page } from './context/NavigationContext';
import { SnackbarProvider } from './context/SnackbarContext';
import Dashboard from './pages/Dashboard';
import { resolveThemeMode } from './services/ThemeService';
import { createAppTheme } from './theme';

// Secondary pages are lazy-loaded to keep popup startup snappy.
const ManageMeals = lazy(() => import('./pages/ManageMeals'));
const Settings = lazy(() => import('./pages/Settings'));
const ManageCategories = lazy(() => import('./pages/ManageCategories'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

function Splash() {
  return (
    <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={32} />
    </Box>
  );
}

const PAGES: Record<Page, React.ComponentType> = {
  dashboard: Dashboard,
  meals: ManageMeals,
  categories: ManageCategories,
  settings: Settings,
  analytics: Analytics,
};

function Pages() {
  const { page } = useNavigation();
  const Current = PAGES[page];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={page}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.18 }}
        style={{ height: '100%' }}
      >
        <Suspense fallback={<Splash />}>
          <Current />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

/** Theme resolution + top-level routing between onboarding and the app. */
function Root() {
  const { loading, user, themeMode } = useAppData();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(
    () => createAppTheme(resolveThemeMode(themeMode, prefersDark)),
    [themeMode, prefersDark],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        {/* Centered app column — comfortable in the 560px app window and
            when the user resizes it wider. */}
        <Box sx={{ height: '100%', maxWidth: 640, mx: 'auto' }}>
          {loading ? (
            <Splash />
          ) : user ? (
            <NavigationProvider>
              <Pages />
            </NavigationProvider>
          ) : (
            <Suspense fallback={<Splash />}>
              <Onboarding />
            </Suspense>
          )}
        </Box>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <Root />
    </AppDataProvider>
  );
}
