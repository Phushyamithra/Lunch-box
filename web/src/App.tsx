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
import { MODULES, ModulePlaceholder } from './pages/ModulePlaceholder';
import { SetupRequired } from './pages/SetupRequired';
import { SettingsProvider, useSettings } from './settings/SettingsContext';

const Settings = lazy(() => import('./pages/Settings'));

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

function SignedInApp() {
  const { settings } = useSettings();
  return (
    <Themed mode={settings.themeMode}>
      <BrowserRouter>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="food" element={<ModulePlaceholder module={MODULES.food} />} />
              <Route path="fitness" element={<ModulePlaceholder module={MODULES.fitness} />} />
              <Route path="finance" element={<ModulePlaceholder module={MODULES.finance} />} />
              <Route path="goals" element={<ModulePlaceholder module={MODULES.goals} />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
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
      <SignedInApp />
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
