import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { ReactElement } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSettings, type SyncState } from '../settings/SettingsContext';
import { NAV_ITEMS, activeNavPath } from './navItems';

const RAIL_WIDTH = 220;

const SYNC_LABELS: Record<SyncState, { label: string; icon: ReactElement }> = {
  loading: { label: 'Connecting…', icon: <CloudSyncRoundedIcon fontSize="small" /> },
  saving: { label: 'Saving…', icon: <CloudSyncRoundedIcon fontSize="small" /> },
  synced: { label: 'Settings synced', icon: <CloudDoneRoundedIcon fontSize="small" /> },
  offline: { label: 'Offline — changes will sync later', icon: <CloudOffRoundedIcon fontSize="small" /> },
  error: { label: 'Sync error — see Settings', icon: <ErrorOutlineRoundedIcon fontSize="small" color="error" /> },
};

function SyncIndicator() {
  const { syncState } = useSettings();
  const { label, icon } = SYNC_LABELS[syncState];
  return (
    <Tooltip title={label}>
      <Box role="status" aria-label={label} sx={{ display: 'flex', px: 1, color: 'text.secondary' }}>
        {icon}
      </Box>
    </Tooltip>
  );
}

/**
 * Shared frame for every module: bottom navigation on phones, a side rail
 * on laptops, one header with sync status and Settings.
 */
export function AppShell() {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const active = activeNavPath(location.pathname);
  const title =
    NAV_ITEMS.find((item) => item.path === active)?.label ??
    (location.pathname.startsWith('/settings') ? 'Settings' : 'LunchBox');

  return (
    <Box sx={{ display: 'flex', minHeight: '100%' }}>
      {wide && (
        <Box
          component="nav"
          aria-label="Main"
          sx={{
            width: RAIL_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            height: '100vh',
            p: 1.5,
          }}
        >
          <Typography variant="h6" sx={{ px: 1.5, py: 1.5 }}>
            🍱 LunchBox
          </Typography>
          <List>
            {NAV_ITEMS.map((item) => (
              <ListItemButton
                key={item.path}
                selected={item.path === active}
                onClick={() => navigate(item.path)}
                sx={{ minHeight: 48, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ gap: 1, pt: 'env(safe-area-inset-top)' }}>
            <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
              {title}
            </Typography>
            <SyncIndicator />
            <IconButton aria-label="Settings" onClick={() => navigate('/settings')} size="large">
              <SettingsRoundedIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: '100%',
            maxWidth: 1100,
            mx: 'auto',
            px: 2,
            pt: 2,
            pb: wide ? 4 : 'calc(88px + env(safe-area-inset-bottom))',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {!wide && (
        <Paper
          component="nav"
          aria-label="Main"
          elevation={3}
          sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, pb: 'env(safe-area-inset-bottom)', zIndex: 10 }}
        >
          <BottomNavigation
            showLabels
            value={active ?? false}
            onChange={(_, path: string) => navigate(path)}
            sx={{ height: 64 }}
          >
            {NAV_ITEMS.map((item) => (
              <BottomNavigationAction key={item.path} value={item.path} label={item.label} icon={item.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
