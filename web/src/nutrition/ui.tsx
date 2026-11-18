import { Alert, Box, Button, CircularProgress, Tab, Tabs } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useFitness } from '../fitness/FitnessContext';
import type { FitnessData } from '../fitness/fitnessApi';
import { weeklyAverages } from '../fitness/rules';
import { useNutrition } from './NutritionContext';

const TABS = [
  { path: '/nutrition', label: 'Today' },
  { path: '/nutrition/days', label: 'Days' },
  { path: '/nutrition/trends', label: 'Trends' },
  { path: '/nutrition/overview', label: 'Overview' },
  { path: '/nutrition/foods', label: 'My foods' },
  { path: '/nutrition/targets', label: 'Targets' },
  { path: '/nutrition/data', label: 'Backup' },
];

/** Frame for nutrition screens: section tabs plus load/error states. */
export function NutritionLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const nutrition = useNutrition();
  const fitness = useFitness();
  const current = TABS.find((t) => t.path === pathname)?.path ?? false;
  const error = nutrition.error ?? fitness.error;

  return (
    <Box>
      <Tabs
        value={current}
        onChange={(_, path: string) => navigate(path)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Nutrition sections"
        sx={{
          mb: 2,
          minHeight: 44,
          '& .MuiTabs-indicator': { display: 'none' },
          '& .MuiTab-root': { minHeight: 48, borderRadius: 1, textTransform: 'none', fontWeight: 600, px: 2, mr: 0.5 },
          '& .Mui-selected': { bgcolor: (t) => t.tracker.cta, color: (t) => `${t.tracker.onCta} !important` },
        }}
      >
        {TABS.map((t) => (
          <Tab key={t.path} value={t.path} label={t.label} />
        ))}
      </Tabs>
      {error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => void Promise.all([nutrition.reload(), fitness.reload()])}>
              Retry
            </Button>
          }
        >
          {error}
          {/(relation|table|column) .*(nutrition_|foods|food_log)/.test(error) &&
            ' — run the nutrition migrations (0008, 0009, 0010) from supabase/migrations in the Supabase SQL Editor, in order, then Retry.'}
        </Alert>
      ) : !nutrition.data || !fitness.data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading nutrition data" />
        </Box>
      ) : (
        <div key={pathname}>
          <Outlet />
        </div>
      )}
    </Box>
  );
}

/** Body weight for estimates: latest weekly average at your trend time, else the latest weigh-in. */
export function currentWeight(data: FitnessData, today: string): { kg: number; source: string } | null {
  const week = [...weeklyAverages(data.weighIns, data.away, today, data.settings.weigh_time)].reverse().find((w) => w.average !== null);
  if (week?.average) return { kg: week.average, source: `weekly average, week of ${week.weekStart}` };
  const last = [...data.weighIns].filter((w) => !w.deleted_at).sort((a, b) => a.measured_at.localeCompare(b.measured_at)).pop();
  return last ? { kg: Number(last.weight_kg), source: `latest weigh-in (${last.day})` } : null;
}

/** Training days per week in your program (Mon–Sat rows with exercises). */
export const trainingDays = (data: FitnessData): number => new Set(data.slots.filter((s) => s.weekday <= 6 && s.variants.some(Boolean)).map((s) => s.weekday)).size;
