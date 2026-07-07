import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded';
import {
  Box,
  Button,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { GoalStepper } from '../components/Goals/GoalStepper';
import { ExportButton } from '../components/ImportExport/ExportButton';
import { ImportButton } from '../components/ImportExport/ImportButton';
import { GoogleTasksSection } from '../components/Sync/GoogleTasksSection';
import { APP_NAME, APP_TAGLINE, APP_VERSION, getCategoryMeta } from '../constants';
import { useAppData } from '../context/AppDataContext';
import { useNavigation } from '../context/NavigationContext';
import { useSnackbar } from '../context/SnackbarContext';
import type { ThemeMode } from '../models';

type PendingAction = 'clearLogs' | 'reset' | null;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1, px: 0.5 }}>
        {title}
      </Typography>
      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {children}
      </Paper>
    </Box>
  );
}

export default function Settings() {
  const {
    user,
    themeMode,
    setThemeMode,
    clearLogs,
    resetApp,
    goalSettings,
    updateGoalSettings,
    goalProgress,
  } = useAppData();
  const { navigate } = useNavigation();
  const { showSnackbar } = useSnackbar();
  const [pending, setPending] = useState<PendingAction>(null);

  // Union of catalog + configured categories, already ordered by GoalService.
  const goalCategories = goalProgress.categories.map((c) => c.category);

  const handleConfirm = async () => {
    const action = pending;
    setPending(null);
    try {
      if (action === 'clearLogs') {
        await clearLogs();
        showSnackbar('All meal logs cleared');
      } else if (action === 'reset') {
        await resetApp();
      }
    } catch {
      showSnackbar('Something went wrong. Please try again.', 'error');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 1 }}>
        <IconButton aria-label="Back to dashboard" size="small" onClick={() => navigate('dashboard')}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" component="h1">
          Settings
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2, pb: 2 }}>
        <Section title="Appearance">
          <ToggleButtonGroup
            value={themeMode}
            exclusive
            fullWidth
            size="small"
            onChange={(_, next: ThemeMode | null) => {
              if (next) void setThemeMode(next);
            }}
            aria-label="Theme mode"
          >
            <ToggleButton value="light" aria-label="Light theme">
              <LightModeRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Light
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Dark theme">
              <DarkModeRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Dark
            </ToggleButton>
            <ToggleButton value="system" aria-label="System theme">
              <SettingsBrightnessRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> System
            </ToggleButton>
          </ToggleButtonGroup>
        </Section>

        <Section title="Goals">
          <GoalStepper
            label="Logged days goal"
            emoji="📅"
            value={goalSettings.totalDays}
            min={1}
            onChange={(totalDays) => void updateGoalSettings({ ...goalSettings, totalDays })}
          />
          {goalCategories.map((category) => (
            <GoalStepper
              key={category}
              label={`${category} goal`}
              emoji={getCategoryMeta(category).emoji}
              value={goalSettings.categoryTargets[category] ?? 0}
              min={0}
              onChange={(target) =>
                void updateGoalSettings({
                  ...goalSettings,
                  categoryTargets: { ...goalSettings.categoryTargets, [category]: target },
                })
              }
            />
          ))}
          <Typography variant="caption" color="text.secondary">
            Set a category goal to 0 to disable it.
          </Typography>
        </Section>

        <Section title="Google Tasks Sync">
          <GoogleTasksSection />
        </Section>

        <Section title="Meals">
          <Button
            variant="outlined"
            fullWidth
            startIcon={<RestaurantMenuRoundedIcon />}
            onClick={() => navigate('meals')}
          >
            Manage meals
          </Button>
          <ImportButton fullWidth />
          <ExportButton fullWidth />
        </Section>

        <Section title="Danger zone">
          <Button
            color="error"
            variant="outlined"
            fullWidth
            startIcon={<DeleteSweepRoundedIcon />}
            onClick={() => setPending('clearLogs')}
          >
            Clear meal logs
          </Button>
          <Button
            color="error"
            variant="contained"
            fullWidth
            startIcon={<RestartAltRoundedIcon />}
            onClick={() => setPending('reset')}
          >
            Reset application
          </Button>
        </Section>

        <Section title="About">
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography aria-hidden sx={{ fontSize: 32 }}>
              🥪
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {APP_NAME} v{APP_VERSION}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {APP_TAGLINE}
            </Typography>
            {user && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Signed in locally as {user.email}
              </Typography>
            )}
          </Box>
        </Section>
      </Box>

      <ConfirmDialog
        open={pending === 'clearLogs'}
        title="Clear all meal logs?"
        message="Every logged day will be removed. Your meal catalog stays intact. This can't be undone."
        confirmLabel="Clear logs"
        onConfirm={() => void handleConfirm()}
        onClose={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'reset'}
        title="Reset the application?"
        message="This wipes everything — your email, meal catalog, logs, goals and preferences. You'll start fresh. This can't be undone."
        confirmLabel="Reset everything"
        onConfirm={() => void handleConfirm()}
        onClose={() => setPending(null)}
      />
    </Box>
  );
}
