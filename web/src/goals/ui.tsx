import { Alert, Box, Button, CircularProgress, Tab, Tabs } from '@mui/material';
import { motion } from 'framer-motion';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useGoals } from './GoalsContext';

const TABS = [
  { path: '/goals', label: 'Goals' },
  { path: '/goals/timeline', label: 'Timeline' },
];

/** Frame for goal screens: section tabs plus load/error states. */
export function GoalsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const goals = useGoals();
  const current = TABS.find((t) => t.path === pathname)?.path ?? false;

  return (
    <Box>
      <Tabs
        value={current}
        onChange={(_, path: string) => navigate(path)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Goals sections"
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
      {goals.error ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void goals.reload()}>Retry</Button>}>
          {goals.error}
          {/(relation|table).*(goals|goal_checkins|milestones)/.test(goals.error) && ' — run supabase/migrations/0014_goals.sql in the Supabase SQL Editor, then Retry.'}
        </Alert>
      ) : !goals.data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading goals" />
        </Box>
      ) : (
        <motion.div key={pathname} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
          <Outlet />
        </motion.div>
      )}
    </Box>
  );
}
