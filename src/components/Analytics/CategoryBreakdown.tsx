import { Box, Typography } from '@mui/material';
import { memo } from 'react';
import { getCategoryMeta } from '../../constants';
import type { CategoryBreakdownEntry } from '../../services/NutritionService';
import { ProgressBar } from '../Goals/ProgressBar';

interface CategoryBreakdownProps {
  entries: CategoryBreakdownEntry[];
}

/** Meal totals + percentage distribution per category. */
export const CategoryBreakdown = memo(function CategoryBreakdown({ entries }: CategoryBreakdownProps) {
  if (entries.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Nothing logged yet — your category distribution will appear here.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {entries.map((entry) => {
        const meta = getCategoryMeta(entry.category);
        return (
          <Box key={entry.category}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <span aria-hidden style={{ fontSize: 15 }}>
                {meta.emoji}
              </span>
              <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                {meta.plural}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {entry.count} meal{entry.count === 1 ? '' : 's'} · {entry.percent}%
              </Typography>
            </Box>
            <ProgressBar percent={entry.percent} color={meta.color} height={6} />
          </Box>
        );
      })}
    </Box>
  );
});
