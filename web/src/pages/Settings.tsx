import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded';
import {
  Alert,
  Button,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
import type { ThemeMode } from '../../../src/models';
import { describeAuthError, useAuth } from '../auth/AuthContext';
import { useSettings } from '../settings/SettingsContext';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Paper>
  );
}

export default function Settings() {
  const { session, signOut } = useAuth();
  const { settings, updateSettings, syncState, syncError, resync } = useSettings();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  return (
    <Stack spacing={2} sx={{ maxWidth: 560 }}>
      <Section title="Appearance">
        <ToggleButtonGroup
          value={settings.themeMode}
          exclusive
          fullWidth
          onChange={(_, next: ThemeMode | null) => next && updateSettings({ themeMode: next })}
          aria-label="Theme"
        >
          <ToggleButton value="dark" sx={{ minHeight: 48 }}>
            <DarkModeRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Dark
          </ToggleButton>
          <ToggleButton value="light" sx={{ minHeight: 48 }}>
            <LightModeRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Light
          </ToggleButton>
          <ToggleButton value="system" sx={{ minHeight: 48 }}>
            <SettingsBrightnessRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> System
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          The theme is saved to your account and follows you to every device.
        </Typography>
      </Section>

      <Section title="Sync">
        {syncState === 'synced' && <Alert severity="success">Settings are in sync with the cloud.</Alert>}
        {syncState === 'offline' && (
          <Alert severity="info">You are offline. Changes are kept on this device and sync when you reconnect.</Alert>
        )}
        {syncState === 'error' && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={resync}>
                Retry
              </Button>
            }
          >
            {syncError ?? 'Sync failed.'}
          </Alert>
        )}
        {(syncState === 'loading' || syncState === 'saving') && <Alert severity="info">Syncing…</Alert>}
      </Section>

      <Section title="Account">
        <Typography>Signed in as {session?.user.email}</Typography>
        {signOutError && <Alert severity="error">{signOutError}</Alert>}
        <Button
          variant="outlined"
          color="error"
          size="large"
          onClick={() => {
            setSignOutError(null);
            signOut().catch((e: unknown) => setSignOutError(describeAuthError(e)));
          }}
        >
          Sign out of this device
        </Button>
      </Section>

      <Typography variant="body2" color="text.secondary" align="center">
        LunchBox web · {import.meta.env.MODE === 'production' ? 'production build' : 'development'}
      </Typography>
    </Stack>
  );
}
