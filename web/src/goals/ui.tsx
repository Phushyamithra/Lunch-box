import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import { SectionBar, SectionTiles } from '../layout/SectionNav';
import { useGoals } from './GoalsContext';

/** Goals' sections, shown as tiles under the goals list. */
const SECTIONS = [
  { path: '/goals/timeline', label: 'Timeline', hint: 'Milestones by date' },
  { path: '/templates', label: 'Bulk add', hint: 'Templates and upload' },
];

/** Frame for goal screens: section tabs plus load/error states. */
export function GoalsLayout() {
  const { pathname } = useLocation();
  const goals = useGoals();

  return (
    <Box>
      <SectionBar home="/goals" sections={SECTIONS} pathname={pathname} />
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
        <div key={pathname}>
          <Outlet />
          {pathname === '/goals' && (
            <Box sx={{ mt: 4 }}>
              <SectionTiles sections={SECTIONS} title="More in Goals" />
            </Box>
          )}
        </div>
      )}
    </Box>
  );
}
