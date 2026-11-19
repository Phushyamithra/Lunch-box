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
import { GlobalStyles, ThemeProvider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, type ReactElement } from 'react';
import { moodFor, tornMask } from '../moods';
import { createTrackerTheme, globalStyles } from '../theme';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSettings, type SyncState } from '../settings/SettingsContext';
import { ErrorBoundary } from './ErrorBoundary';
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
      <Box role="status" aria-label={label} sx={{ display: 'flex', px: 1, color: 'inherit', opacity: 0.75 }}>
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
  const outer = useTheme();
  const { pathname } = useLocation();
  const mood = moodFor(pathname);
  const theme = useMemo(() => createTrackerTheme(outer.tracker.appMode, mood), [outer.tracker.appMode, mood]);
  const c = theme.tracker.mood;
  // The phone's status bar takes the mood's band.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.band);
  }, [c.band]);
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles styles={globalStyles(c, theme.palette.mode === 'dark', theme.tracker.grain)} />
      <ShellFrame />
    </ThemeProvider>
  );
}

/** The frame itself, inside the section's mood. */
function ShellFrame() {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const section = '/' + (location.pathname.split('/')[1] ?? '');
  const navigate = useNavigate();
  const active = activeNavPath(location.pathname);
  const title =
    NAV_ITEMS.find((item) => item.path === active)?.label ??
    (location.pathname.startsWith('/settings') ? 'Settings' : location.pathname.startsWith('/templates') ? 'Bulk add' : 'Tracker');

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
            top: 0,
            height: '100vh',
            p: 1.5,
            borderRadius: 0,
            borderTop: 0,
            borderRight: `1px solid ${theme.tracker.mood.rule}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 1.5 }}>
            <GlassIcon icon={<InsightsRoundedIcon />} tint={APP_TINT} size={34} />
            <Typography variant="h5" component="p">
              Tracker
            </Typography>
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
        {/* The ink band: the screen's name in condensed capitals, like a results-sheet mast. */}
        {/* Rounded at its foot, or torn like a sheet off a pad where the mood is paper. */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            top: 0,
            pt: 'env(safe-area-inset-top)',
            // Frosted: the screen scrolls softly under the band.
            backgroundColor: alpha(theme.tracker.mood.band, 0.88),
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            ...(theme.tracker.torn ? { pb: '8px', ...tornMask('bottom') } : { borderRadius: '0 0 24px 24px' }),
          }}
        >
          <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 60 } }}>
            <Typography variant="h5" component="h1" sx={{ flexGrow: 1, fontSize: { xs: '1.55rem', sm: '1.75rem' } }}>
              {title}
            </Typography>
            <SyncIndicator />
            <IconButton aria-label="Settings" onClick={() => navigate('/settings')} size="large" sx={{ color: 'inherit' }}>
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
            px: 2.5,
            pt: 3,
            pb: wide ? 4 : 'calc(96px + env(safe-area-inset-bottom))',
          }}
        >
          <OfflineBanner />
            <div key={section}>
            {/* A screen that fails shows its error here; the header, tabs and other screens keep working. */}
            <ErrorBoundary key={location.pathname} label="This screen">
              <Outlet />
            </ErrorBoundary>
          </div>
        </Box>
      </Box>

      {!wide && (
        // The ink tab bar: the current section sits on volt.
        <Paper
          component="nav"
          aria-label="Main"
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            pb: 'env(safe-area-inset-bottom)',
            zIndex: 10,
            backgroundColor: alpha(theme.tracker.mood.band, 0.88),
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            ...(theme.tracker.torn
              ? { borderRadius: 0, pt: '8px', ...tornMask('top') }
              : { borderRadius: '24px 24px 0 0', borderTop: theme.tracker.minimal ? `1px solid ${theme.tracker.mood.rule}` : 0 }),
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
                  color: theme.tracker.mood.onBand,
                  opacity: 0.72,
                  '& .nav-pill': {
                    width: { xs: 46, sm: 56 },
                    height: 32,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    mb: 0.5,
                    transition: 'background-color 150ms, transform 140ms ease',
                  },
                  '&.Mui-selected': { color: theme.tracker.mood.onBand, opacity: 1 },
                  '&.Mui-selected .nav-pill': { bgcolor: theme.tracker.cta, color: theme.tracker.onCta, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' },
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
