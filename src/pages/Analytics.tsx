import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import {
  Box,
  Chip,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { CategoryBreakdown } from '../components/Analytics/CategoryBreakdown';
import { StatTile } from '../components/Analytics/StatTile';
import { TrendChart } from '../components/Analytics/TrendChart';
import { NUTRIENT_META } from '../constants';
import { useAppData } from '../context/AppDataContext';
import { useNavigation } from '../context/NavigationContext';
import type { Nutrition } from '../models';
import { insightService } from '../services/InsightService';
import { nutritionService } from '../services/NutritionService';

type Period = 'today' | 'week' | 'month';
const TREND_DAYS = 14;

const NUTRIENT_COLORS: Record<keyof Nutrition, string> = {
  calories: '#F59E0B',
  protein: '#8B5CF6',
  carbs: '#F97316',
  fiber: '#22C55E',
  fat: '#EC4899',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1, px: 0.5 }}>
        {title}
      </Typography>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        {children}
      </Paper>
    </Box>
  );
}

/**
 * Nutrition analytics: daily/weekly/monthly summaries, smart insights,
 * category distribution and per-nutrient trends. All figures derive from
 * real logs via NutritionService / InsightService — nothing is fabricated.
 */
export default function Analytics() {
  const { logs, mealById, goalProgress } = useAppData();
  const { navigate } = useNavigation();
  const [period, setPeriod] = useState<Period>('week');
  const [nutrient, setNutrient] = useState<keyof Nutrition>('calories');

  const summary = useMemo(() => {
    if (period === 'today') return nutritionService.todaySummary(logs, mealById);
    if (period === 'week') return nutritionService.weeklySummary(logs, mealById);
    return nutritionService.monthlySummary(logs, mealById);
  }, [logs, mealById, period]);

  const breakdown = useMemo(
    () => nutritionService.categoryBreakdown(logs, mealById),
    [logs, mealById],
  );

  const trend = useMemo(
    () => nutritionService.trend(logs, mealById, TREND_DAYS, nutrient),
    [logs, mealById, nutrient],
  );

  const insights = useMemo(
    () => insightService.generate(goalProgress, logs, mealById),
    [goalProgress, logs, mealById],
  );

  // Today shows totals; week/month show per-meal averages.
  const values = period === 'today' ? summary.total : summary.average;
  const nutrientMeta = NUTRIENT_META.find((n) => n.key === nutrient);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 1 }}>
        <IconButton aria-label="Back to dashboard" size="small" onClick={() => navigate('dashboard')}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" component="h1">
          Analytics
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2, pb: 2 }}>
        {/* Smart insights */}
        {insights.length > 0 && (
          <Section title="Smart Insights">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {insights.map((insight) => (
                <Typography key={insight} variant="body2">
                  ✨ {insight}
                </Typography>
              ))}
            </Box>
          </Section>
        )}

        {/* Nutrition summary */}
        <Section title="Nutrition Summary">
          <ToggleButtonGroup
            value={period}
            exclusive
            fullWidth
            size="small"
            sx={{ mb: 1.5 }}
            onChange={(_, next: Period | null) => {
              if (next) setPeriod(next);
            }}
            aria-label="Summary period"
          >
            <ToggleButton value="today">Today</ToggleButton>
            <ToggleButton value="week">7 days</ToggleButton>
            <ToggleButton value="month">Month</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {NUTRIENT_META.map(({ key, label, unit, emoji }, i) => (
              <StatTile key={key} emoji={emoji} label={label} value={values[key]} unit={unit} index={i} />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {summary.count === 0
              ? 'No meals logged in this period.'
              : period === 'today'
                ? `Totals from today's logged meal.`
                : `Average per meal across ${summary.count} logged meal${summary.count === 1 ? '' : 's'}.`}
          </Typography>
        </Section>

        {/* Category distribution */}
        <Section title="Meal Breakdown">
          <CategoryBreakdown entries={breakdown} />
        </Section>

        {/* Nutrient trends */}
        <Section title={`Trends — last ${TREND_DAYS} days`}>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
            {NUTRIENT_META.map(({ key, label, emoji }) => (
              <Chip
                key={key}
                label={`${emoji} ${label}`}
                size="small"
                color={nutrient === key ? 'primary' : 'default'}
                variant={nutrient === key ? 'filled' : 'outlined'}
                onClick={() => setNutrient(key)}
                aria-pressed={nutrient === key}
              />
            ))}
          </Box>
          <TrendChart points={trend} color={NUTRIENT_COLORS[nutrient]} unit={nutrientMeta?.unit ?? ''} />
        </Section>
      </Box>
    </Box>
  );
}
