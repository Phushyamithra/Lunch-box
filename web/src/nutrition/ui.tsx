import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import { SectionBar, SectionTiles } from '../layout/SectionNav';
import { useFitness } from '../fitness/FitnessContext';
import type { FitnessData } from '../fitness/fitnessApi';
import { weeklyAverages } from '../fitness/rules';
import { useNutrition } from './NutritionContext';

/** Nutrition's sections, shown as tiles under Today. */
const SECTIONS = [
  { path: '/nutrition/days', label: 'Days', hint: 'Every day, meal by meal' },
  { path: '/nutrition/trends', label: 'Trends', hint: 'Calories and protein over time' },
  { path: '/nutrition/overview', label: 'Overview', hint: 'Averages and streaks' },
  { path: '/nutrition/foods', label: 'My foods', hint: 'Saved foods and meals' },
  { path: '/nutrition/targets', label: 'Targets', hint: 'Calories and macros' },
  { path: '/nutrition/data', label: 'Backup', hint: 'Export and import' },
  { path: '/templates', label: 'Bulk add', hint: 'Templates and upload' },
];

/** Frame for nutrition screens: section tabs plus load/error states. */
export function NutritionLayout() {
  const { pathname } = useLocation();
  const nutrition = useNutrition();
  const fitness = useFitness();
  const error = nutrition.error ?? fitness.error;

  return (
    <Box>
      <SectionBar home="/nutrition" sections={SECTIONS} pathname={pathname} />
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
          {pathname === '/nutrition' && (
            <Box sx={{ mt: 4 }}>
              <SectionTiles sections={SECTIONS} title="More in Nutrition" />
            </Box>
          )}
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
