import { Box, ButtonBase, Paper, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { memo, useMemo } from 'react';
import { CATEGORY_META, RECENT_LOGS_LIMIT } from '../../constants';
import type { Meal, MealLog } from '../../models';
import { formatFriendly } from '../../utils/date';

interface MealSummaryListProps {
  /** Logs for the currently displayed month. */
  logs: Record<string, MealLog>;
  mealById: Map<string, Meal>;
  onSelect: (dateKey: string) => void;
}

/** Recent meals for the visible month; clicking an entry jumps to that day. */
export const MealSummaryList = memo(function MealSummaryList({
  logs,
  mealById,
  onSelect,
}: MealSummaryListProps) {
  const entries = useMemo(
    () =>
      Object.values(logs)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, RECENT_LOGS_LIMIT),
    [logs],
  );

  if (entries.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3, px: 2 }}>
        <Typography aria-hidden sx={{ fontSize: 36, mb: 0.5 }}>
          🍽️
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No meals logged this month yet.
          <br />
          Tap any day on the calendar to start!
        </Typography>
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {entries.map((log, index) => {
        const meal = mealById.get(log.mealId);
        const emoji = meal ? CATEGORY_META[meal.category].emoji : '🍽️';
        return (
          <motion.div
            key={log.date}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, duration: 0.2 }}
          >
            <ButtonBase
              onClick={() => onSelect(log.date)}
              aria-label={`Jump to ${formatFriendly(log.date)}: ${meal?.name ?? 'logged meal'}`}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                gap: 1.5,
                px: 2,
                py: 1.25,
                borderBottom: index < entries.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                textAlign: 'left',
              }}
            >
              <span aria-hidden style={{ fontSize: 22 }}>
                {emoji}
              </span>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {meal?.name ?? 'Meal removed from catalog'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFriendly(log.date)}
                </Typography>
              </Box>
            </ButtonBase>
          </motion.div>
        );
      })}
    </Paper>
  );
});
