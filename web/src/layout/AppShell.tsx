import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import type { ReactElement } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSettings, type SyncState } from '../settings/SettingsContext';
import { GlassIcon, type IconTint } from './GlassIcon';
import { NAV_ITEMS, activeNavPath } from './navItems';
import { OfflineBanner } from './OfflineBanner';

const RAIL_WIDTH = 232;
const APP_TINT: IconTint = { from: '#4A7A86', to: '#335C67', ink: '#FFF3B0' };

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
  const section = '/' + (location.pathname.split('/')[1] ?? '');
  const navigate = useNavigate();
  const active = activeNavPath(location.pathname);
  const title =
    NAV_ITEMS.find((item) => item.path === active)?.label ??
    (location.pathname.startsWith('/settings') ? 'Settings' : 'Tracker');

  return (
    <Box sx={{ display: 'flex', minHeight: '100%' }}>
      {wide && (
        <Paper
          component="nav"
          aria-label="Main"
          variant="outlined"
          sx={{
            width: RAIL_WIDTH,
            flexShrink: 0,
            position: 'sticky',
            top: 12,
            height: 'calc(100vh - 24px)',
            m: 1.5,
            mr: 0,
            p: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 1.5 }}>
            <GlassIcon icon={<InsightsRoundedIcon />} tint={APP_TINT} size={34} />
            <Typography variant="h6">Tracker</Typography>
          </Box>
          <List>
            {NAV_ITEMS.map((item) => (
              <ListItemButton
                key={item.path}
                selected={item.path === active}
                onClick={() => navigate(item.path)}
                sx={{ minHeight: 52, mb: 0.5, gap: 1.5 }}
              >
                <GlassIcon icon={item.icon} tint={item.tint} size={32} />
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Floating glass header — rounded like the tab bar and the cards. */}
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            top: 'calc(10px + env(safe-area-inset-top))',
            mt: 'calc(10px + env(safe-area-inset-top))',
            mx: { xs: 1.5, md: 2 },
            width: 'auto',
            borderRadius: '24px',
            border: `1px solid ${theme.tracker.glassBorder}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <Toolbar sx={{ gap: 1, minHeight: { xs: 60, sm: 64 } }}>
            <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
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
            pb: wide ? 4 : 'calc(104px + env(safe-area-inset-bottom))',
          }}
        >
          <OfflineBanner />
          {/* Each section fades/slides in; reduced-motion users get no movement (MotionConfig). */}
          <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
            <Outlet />
          </motion.div>
        </Box>
      </Box>

      {!wide && (
        // Floating glass tab bar with Material 3 pill indicators.
        <Paper
          component="nav"
          aria-label="Main"
          variant="outlined"
          sx={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 'calc(12px + env(safe-area-inset-bottom))',
            zIndex: 10,
            borderRadius: '28px',
            overflow: 'hidden',
          }}
        >
          <BottomNavigation
            showLabels
            value={active ?? false}
            onChange={(_, path: string) => navigate(path)}
            sx={{ height: 72, bgcolor: 'transparent' }}
          >
            {NAV_ITEMS.map((item) => (
              <BottomNavigationAction
                key={item.path}
                value={item.path}
                label={item.label}
                icon={<Box className="nav-pill">{item.icon}</Box>}
                sx={{
                  minWidth: 0,
                  px: 0.5,
                  color: 'text.secondary',
                  '& .nav-pill': {
                    width: { xs: 46, sm: 56 },
                    height: 32,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    mb: 0.5,
                    transition: 'background-color 200ms',
                  },
                  '&.Mui-selected': { color: theme.tracker.onTonal },
                  '&.Mui-selected .nav-pill': { bgcolor: theme.tracker.tonal },
                  '& .MuiBottomNavigationAction-label': { fontWeight: 600, fontSize: { xs: 11, sm: 12 }, whiteSpace: 'nowrap' },
                  '& .MuiBottomNavigationAction-label.Mui-selected': { fontSize: { xs: 11, sm: 12 } },
                }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
