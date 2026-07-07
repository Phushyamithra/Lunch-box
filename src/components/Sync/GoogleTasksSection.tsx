import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import type { SyncSettings, TaskListInfo } from '../../models';
import { googleTasksSyncService } from '../../services/GoogleTasksSyncService';

/**
 * Settings → Google Tasks Sync. Talks only to GoogleTasksSyncService;
 * the Google Tasks API is never called from UI code. One-way sync:
 * extension → Google Tasks → the user's Android devices.
 */
export function GoogleTasksSection() {
  const { logs, mealById } = useAppData();
  const { showSnackbar } = useSnackbar();

  const [settings, setSettings] = useState<SyncSettings | null>(null);
  const [taskLists, setTaskLists] = useState<TaskListInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [historyDialog, setHistoryDialog] = useState(false);

  const refresh = useCallback(async () => {
    setSettings(await googleTasksSyncService.getSettings());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (label: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(label);
    try {
      await action();
      await refresh();
      if (success) showSnackbar(success);
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const loadTaskLists = () =>
    run('lists', async () => setTaskLists(await googleTasksSyncService.listTaskLists()));

  const handleEnableToggle = async (enabled: boolean) => {
    if (!settings) return;
    if (enabled && !settings.taskListId) {
      showSnackbar('Choose a task list (or create "Meal Tracker") first.', 'info');
      return;
    }
    await run('enable', () => googleTasksSyncService.setEnabled(enabled));
    if (enabled && !settings.historyChoiceMade) setHistoryDialog(true);
  };

  const handleHistoryChoice = async (syncHistory: boolean) => {
    setHistoryDialog(false);
    await googleTasksSyncService.markHistoryChoiceMade();
    if (syncHistory) {
      await run(
        'history',
        () => googleTasksSyncService.syncAll(logs, mealById),
        'Historical meal logs synced to Google Tasks.',
      );
    } else {
      await refresh();
      showSnackbar('Only future meal logs will be synced.');
    }
  };

  if (!settings) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  const status = googleTasksSyncService.getStatus();
  const statusChip = !settings.connected
    ? { label: 'Not connected', color: 'default' as const, icon: <CloudOffRoundedIcon /> }
    : status.status === 'error'
      ? { label: 'Sync error', color: 'error' as const, icon: <CloudOffRoundedIcon /> }
      : settings.enabled
        ? { label: 'Sync on', color: 'success' as const, icon: <CloudDoneRoundedIcon /> }
        : { label: 'Sync off', color: 'default' as const, icon: <CloudOffRoundedIcon /> };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Status row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip size="small" icon={statusChip.icon} label={statusChip.label} color={statusChip.color} variant="outlined" />
        {settings.lastSyncAt && (
          <Typography variant="caption" color="text.secondary">
            Last sync: {dayjs(settings.lastSyncAt).format('MMM D, HH:mm')}
          </Typography>
        )}
      </Box>
      {status.status === 'error' && status.message && (
        <Typography variant="caption" color="error">
          {status.message}
        </Typography>
      )}

      {/* Connect / disconnect */}
      {!settings.connected ? (
        <Button
          variant="contained"
          fullWidth
          startIcon={<CloudSyncRoundedIcon />}
          disabled={busy !== null}
          onClick={() => void run('connect', () => googleTasksSyncService.connect(), 'Connected to Google!')}
        >
          {busy === 'connect' ? 'Connecting…' : 'Connect Google Account'}
        </Button>
      ) : (
        <>
          {/* Task list selection */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              select
              size="small"
              fullWidth
              label="Task list"
              value={settings.taskListId ?? ''}
              onFocus={() => {
                if (taskLists.length === 0) void loadTaskLists();
              }}
              onChange={(e) => {
                const list = taskLists.find((l) => l.id === e.target.value);
                if (list) void run('select', () => googleTasksSyncService.selectTaskList(list));
              }}
              helperText={settings.taskListTitle ? `Syncing to "${settings.taskListTitle}"` : 'Pick a list or create one'}
            >
              {settings.taskListId && !taskLists.some((l) => l.id === settings.taskListId) && (
                <MenuItem value={settings.taskListId}>{settings.taskListTitle}</MenuItem>
              )}
              {taskLists.map((list) => (
                <MenuItem key={list.id} value={list.id}>
                  {list.title}
                </MenuItem>
              ))}
              {taskLists.length === 0 && (
                <MenuItem disabled value="">
                  {busy === 'lists' ? 'Loading…' : 'Focus to load lists'}
                </MenuItem>
              )}
            </TextField>
          </Box>
          <Button
            variant="outlined"
            fullWidth
            size="small"
            startIcon={<PlaylistAddCheckRoundedIcon />}
            disabled={busy !== null}
            onClick={() =>
              void run('create', () => googleTasksSyncService.ensureMealTrackerList(), '"Meal Tracker" list ready.')
            }
          >
            Use / create "Meal Tracker" list
          </Button>

          {/* Enable + actions */}
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                disabled={busy !== null}
                onChange={(e) => void handleEnableToggle(e.target.checked)}
                inputProps={{ 'aria-label': 'Enable Google Tasks sync' }}
              />
            }
            label={<Typography variant="body2">Sync logged meals as completed tasks</Typography>}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              disabled={busy !== null || !settings.enabled}
              onClick={() =>
                void run(
                  'syncnow',
                  async () => {
                    const count = await googleTasksSyncService.syncAll(logs, mealById);
                    showSnackbar(`Synced ${count} meal log${count === 1 ? '' : 's'}.`);
                  },
                )
              }
            >
              {busy === 'syncnow' || busy === 'history' ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button
              color="error"
              size="small"
              fullWidth
              disabled={busy !== null}
              onClick={() =>
                void run('disconnect', () => googleTasksSyncService.disconnect(), 'Disconnected from Google.')
              }
            >
              Disconnect
            </Button>
          </Box>
        </>
      )}

      <Typography variant="caption" color="text.secondary">
        One-way sync: this extension stays the source of truth. Completed tasks appear in Google
        Tasks and on your Android devices; edits made there never change your meal data.
      </Typography>
      {googleTasksSyncService.getRedirectUri() && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ userSelect: 'all', wordBreak: 'break-all' }}
        >
          Redirect URI for Google Cloud Console (click to select, then copy):{' '}
          <strong>{googleTasksSyncService.getRedirectUri()}</strong>
        </Typography>
      )}
      {googleTasksSyncService.getRedirectUri() && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ userSelect: 'all', wordBreak: 'break-all' }}
        >
          Redirect URI for Google Cloud Console (click to select, then copy):{' '}
          <strong>{googleTasksSyncService.getRedirectUri()}</strong>
        </Typography>
      )}

      {/* First-enable history choice */}
      <Dialog open={historyDialog} maxWidth="xs" fullWidth aria-labelledby="history-dialog-title">
        <DialogTitle id="history-dialog-title">Sync existing history?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Would you like to sync all your previously logged meals to Google Tasks, or only meals
            you log from now on?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => void handleHistoryChoice(false)} color="inherit">
            Future only
          </Button>
          <Button onClick={() => void handleHistoryChoice(true)} variant="contained">
            Sync all history
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
