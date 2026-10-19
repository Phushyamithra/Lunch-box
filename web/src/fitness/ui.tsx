import { Alert, Box, Button, CircularProgress, Paper, Tab, Tabs, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useFitness } from './FitnessContext';

export function Card({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <Paper variant="outlined" id={id} sx={{ p: 2, scrollMarginTop: 96 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle1" component="h2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {aside}
      </Box>
      {children}
    </Paper>
  );
}

/** Big number with a small caption, for headline metrics. */
export function Metric({ value, unit, caption }: { value: string; unit?: string; caption: string }) {
  return (
    <Box>
      <Typography component="p" sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
        {value}
        {unit && (
          <Typography component="span" sx={{ fontSize: 16, fontWeight: 600, ml: 0.5 }} color="text.secondary">
            {unit}
          </Typography>
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {caption}
      </Typography>
    </Box>
  );
}

export const kg = (v: number | null | undefined, digits = 1): string => (v === null || v === undefined ? '–' : v.toFixed(digits));
export const signed = (v: number, digits = 2): string => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;

const TABS = [
  { path: '/fitness', label: 'Today' },
  { path: '/fitness/dashboard', label: 'Dashboard' },
  { path: '/fitness/training', label: 'Training' },
  { path: '/fitness/program', label: 'Program' },
  { path: '/fitness/review', label: 'Review' },
  { path: '/fitness/settings', label: 'Targets & away' },
];

/** Frame for every fitness screen: section tabs plus load/error states. */
export function FitnessLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { loading, error, data, reload } = useFitness();
  const current = TABS.find((t) => t.path === pathname)?.path ?? false;

  return (
    <Box>
      <Tabs
        value={current}
        onChange={(_, path: string) => navigate(path)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Fitness sections"
        sx={{
          mb: 2,
          minHeight: 44,
          '& .MuiTabs-indicator': { display: 'none' },
          '& .MuiTab-root': { minHeight: 40, borderRadius: 999, textTransform: 'none', fontWeight: 600, px: 2, mr: 0.5 },
          '& .Mui-selected': { bgcolor: (t) => t.tracker.tonal, color: (t) => `${t.tracker.onTonal} !important` },
        }}
      >
        {TABS.map((t) => (
          <Tab key={t.path} value={t.path} label={t.label} />
        ))}
      </Tabs>
      {error ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void reload()}>Retry</Button>}>
          {error}
        </Alert>
      ) : loading && !data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading fitness data" />
        </Box>
      ) : (
        <motion.div key={pathname} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
          <Outlet />
        </motion.div>
      )}
    </Box>
  );
}
