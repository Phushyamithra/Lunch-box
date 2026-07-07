import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { memo } from 'react';
import type { TrendPoint } from '../../services/NutritionService';
import { fromDateKey } from '../../utils/date';

interface TrendChartProps {
  points: TrendPoint[];
  color: string;
  unit: string;
}

const CHART_HEIGHT = 96;

/**
 * Dependency-free animated bar chart for a nutrient over time.
 * Each bar is one day; hover/focus reveals the exact value via title.
 */
export const TrendChart = memo(function TrendChart({ points, color, unit }: TrendChartProps) {
  const theme = useTheme();
  const max = Math.max(...points.map((p) => p.value), 1);
  const hasData = points.some((p) => p.value > 0);

  if (!hasData) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          No data in this period yet — log some meals!
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        role="img"
        aria-label={`Trend chart, maximum ${max} ${unit}`}
        sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: CHART_HEIGHT }}
      >
        {points.map((p) => {
          const h = Math.max(3, Math.round((p.value / max) * CHART_HEIGHT));
          return (
            <Box
              key={p.date}
              title={`${fromDateKey(p.date).format('MMM D')}: ${p.value} ${unit}`}
              sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' }}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                style={{
                  width: '100%',
                  borderRadius: 4,
                  background: p.value > 0 ? color : alpha(theme.palette.text.primary, 0.08),
                }}
              />
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {fromDateKey(points[0].date).format('MMM D')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {fromDateKey(points[points.length - 1].date).format('MMM D')}
        </Typography>
      </Box>
    </Box>
  );
});
